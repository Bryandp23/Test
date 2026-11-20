"use server";
// Données d'exemple (bouton « Charger un exemple » du board vide). Clairement marquées « Exemple ».
import { randomUUID } from "node:crypto";
import { run, UserError } from "@/lib/server/action";
import { ensureDefaults } from "@/lib/server/repo";
import { putFile } from "@/lib/server/storage";
import { addDays, brusselsToUtcIso, todayBrussels } from "@/lib/time";
import type { Queryable } from "@/lib/server/db";

const PALETTES = [
  { bg: "#0f3b3a", fg: "#f5f5f6", acc: "#46c4bc" },
  { bg: "#1d2433", fg: "#f5f5f6", acc: "#6e9bf5" },
  { bg: "#f2efe8", fg: "#14161b", acc: "#f07f6e" },
  { bg: "#241d33", fg: "#f5f5f6", acc: "#a68bf0" },
  { bg: "#e8f3f2", fg: "#0d2a29", acc: "#1d7a75" },
];

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 4);
}

function poster(title: string, kicker: string, idx: number, slide?: string): Buffer {
  const p = PALETTES[idx % PALETTES.length];
  const lines = wrap(title, 16);
  const t = lines.map((l, i) => `<text x="80" y="${520 + i * 92}" font-size="80" font-weight="700" letter-spacing="-2">${esc(l)}</text>`).join("");
  const shape =
    idx % 3 === 0
      ? `<circle cx="830" cy="230" r="170" fill="${p.acc}"/>`
      : idx % 3 === 1
        ? `<rect x="640" y="90" width="340" height="300" rx="24" fill="${p.acc}"/>`
        : `<path d="M640 380 L1000 80 L1000 380 Z" fill="${p.acc}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<rect width="1080" height="1080" fill="${p.bg}"/>${shape}
<g fill="${p.fg}" font-family="Helvetica, Arial, sans-serif">
<text x="80" y="140" font-size="30" font-weight="600" letter-spacing="3" opacity="0.8">${esc(kicker.toUpperCase())}</text>
${t}
<text x="80" y="1000" font-size="28" opacity="0.7">EPHEC${slide ? " · " + esc(slide) : ""}</text>
</g></svg>`;
  return Buffer.from(svg);
}

async function tagId(tx: Queryable, dim: string, label: string) {
  return (await tx.query<{ id: string }>(`select id from public.tags where dimension = $1 and lower(label) = lower($2)`, [dim, label]))[0]?.id ?? null;
}

export async function createDemoData() {
  return run(async (tx, user) => {
    const n = await tx.query<{ n: number }>(`select count(*)::int as n from public.cycles`);
    if (n[0].n > 0) throw new UserError("L'exemple ne peut être chargé que dans un board vide.");
    await ensureDefaults(tx);
    const T = todayBrussels();
    const t = async (d: string, l: string) => tagId(tx, d, l);
    const [li, ig, nl, web, fc, he, al, org, ads, evt] = await Promise.all([
      t("canal", "LinkedIn"),
      t("canal", "Instagram"),
      t("canal", "Newsletter"),
      t("canal", "Site web"),
      t("public", "Formation Continue"),
      t("public", "Haute École"),
      t("public", "Alumni"),
      t("nature", "Organique"),
      t("nature", "Ads"),
      t("nature", "Événementiel"),
    ]);
    let img = 0;

    async function cycle(c: { kind?: string; name: string; aud: string | null; start: string; end: string; status: string; pos: number }) {
      const [r] = await tx.query<{ id: string }>(
        `insert into public.cycles (kind, name, description, audience_tag_id, category, start_date, end_date, status, position)
         values ($1,$2,'Données d''exemple — vous pouvez les supprimer à tout moment.',$3,'Exemple',$4,$5,$6,$7) returning id`,
        [c.kind ?? "cycle", c.name, c.aud, c.start, c.end, c.status, c.pos],
      );
      return r.id;
    }
    async function session(cycleId: string, title: string, kind: string, date: string | null, pos: number, time: string | null = null) {
      const [r] = await tx.query<{ id: string }>(
        `insert into public.sessions (cycle_id, title, kind, date, start_time, end_time, location, position) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [cycleId, title, kind, date, time, time ? `${String(Number(time.slice(0, 2)) + 3).padStart(2, "0")}:00` : null, date ? "EPHEC Woluwe" : "", pos],
      );
      return r.id;
    }
    let pos = 0;
    async function pub(o: {
      cycle: string;
      session?: string | null;
      title: string;
      body?: string;
      ch: string | null;
      nat?: string | null;
      prod: string;
      diff?: string;
      target?: string | null;
      images?: { kicker: string; slides?: number };
      link?: string;
    }) {
      const id = randomUUID();
      const diff = o.diff ?? "a_programmer";
      const scheduled = diff === "programme" && o.target ? brusselsToUtcIso(o.target, "09:30") : null;
      const published = diff === "publie" && o.target ? brusselsToUtcIso(o.target, "10:00") : null;
      await tx.query(
        `insert into public.publications (id, cycle_id, session_id, title, body, channel_tag_id, nature_tag_id, audience_tag_id, production_status, diffusion_status,
           target_date, target_time, scheduled_at, scheduled_platform, published_at, position)
         values ($1,$2,$3,$4,$5,$6,$7,(select audience_tag_id from public.cycles where id = $2),$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id, o.cycle, o.session ?? null, o.title, o.body ?? "", o.ch, o.nat ?? org, o.prod, diff, o.target ?? null, o.target ? "09:30" : null, scheduled, scheduled ? "LinkedIn (planificateur natif)" : "", published, ++pos],
      );
      if (o.images) {
        const count = o.images.slides ?? 1;
        const k = img++;
        for (let i = 0; i < count; i++) {
          const att = randomUUID();
          const path = `${user.id}/${id}/${att}.svg`;
          const buf = poster(i === 0 ? o.title : `${o.title} — ${i + 1}/${count}`, o.images.kicker, k + i, count > 1 ? `${i + 1}/${count}` : undefined);
          await putFile(path, buf, "image/svg+xml");
          await tx.query(
            `insert into public.publication_attachments (id, publication_id, kind, storage_path, name, mime, size_bytes, width, height, status, position)
             values ($1,$2,'image',$3,$4,'image/svg+xml',$5,1080,1080,'ready',$6)`,
            [att, id, path, `visuel-${i + 1}.svg`, buf.length, i + 1],
          );
        }
      }
      if (o.link) await tx.query(`insert into public.publication_links (publication_id, url, title, kind, position) values ($1,$2,'Page du programme','page',1)`, [id, o.link]);
      await tx.query(`insert into public.activity_log (entity_type, entity_id, publication_id, action, to_value) values ('publication',$1,$1,'created',$2)`, [id, o.prod]);
      return id;
    }

    // Cycle 1 — Formation Continue
    const h = await cycle({ name: "Humains.ia", aud: fc, start: addDays(T, 10), end: addDays(T, 75), status: "en_cours", pos: 1 });
    const hInfo = await session(h, "Séance d'information", "info", addDays(T, 3), 1, "18:00");
    const h1 = await session(h, "Session 1 — L'IA au travail", "session", addDays(T, 24), 2, "09:00");
    const h2 = await session(h, "Session 2 — Éthique et décisions", "session", addDays(T, 38), 3, "09:00");
    await session(h, "Session 3 — Cas pratiques", "session", null, 4);
    await pub({ cycle: h, title: "Annonce du cycle Humains.ia", ch: li, prod: "pret", diff: "publie", target: addDays(T, -12), images: { kicker: "Formation Continue", slides: 5 }, body: "L'intelligence artificielle transforme nos métiers. Avec Humains.ia, l'EPHEC Formation Continue vous propose quatre rendez-vous pour comprendre, expérimenter et décider.\n\nProgramme et inscriptions : lien en commentaire.", link: "https://www.ephec.be" });
    await pub({ cycle: h, title: "Campagne Ads — inscriptions", ch: li, nat: ads, prod: "en_cours", target: addDays(T, 5), images: { kicker: "Inscriptions ouvertes" } });
    await pub({ cycle: h, title: "Page programme sur le site", ch: web, prod: "pret", diff: "a_programmer", target: addDays(T, 1), link: "https://www.ephec.be/formation-continue" });
    await pub({ cycle: h, session: hInfo, title: "Invitation séance d'information", ch: li, prod: "pret", diff: "programme", target: addDays(T, 0), images: { kicker: "Séance d'information" }, body: "Rejoignez-nous pour la séance d'information du cycle Humains.ia : programme, intervenant·es, modalités pratiques." });
    await pub({ cycle: h, session: hInfo, title: "Story rappel J-1", ch: ig, prod: "a_creer", target: addDays(T, 2) });
    await pub({ cycle: h, session: h1, title: "Présentation de la session 1", ch: li, prod: "pret", target: addDays(T, 10), images: { kicker: "Session 1" }, body: "Session 1 — L'IA au travail. Comment intégrer les outils d'IA générative dans les processus d'une équipe, sans perdre la maîtrise de la qualité ?" });
    await pub({ cycle: h, session: h1, title: "Newsletter de rappel", ch: nl, prod: "idee", target: addDays(T, 17) });
    await pub({ cycle: h, session: h1, title: "Carrousel Instagram — 3 idées clés", ch: ig, prod: "en_cours", target: addDays(T, 20), images: { kicker: "3 idées clés", slides: 3 } });
    await pub({ cycle: h, session: h2, title: "Portrait de l'intervenante", ch: li, prod: "a_creer", target: addDays(T, 31) });

    // Cycle 2 — Haute École
    const j = await cycle({ name: "Journées portes ouvertes", aud: he, start: addDays(T, 20), end: addDays(T, 110), status: "a_venir", pos: 2 });
    const j1 = await session(j, "JPO de printemps", "session", addDays(T, 40), 1, "10:00");
    const j2 = await session(j, "JPO de juin", "session", addDays(T, 105), 2, "10:00");
    await pub({ cycle: j, title: "Save the date", ch: ig, nat: evt, prod: "pret", target: addDays(T, 7), images: { kicker: "Portes ouvertes" } });
    await pub({ cycle: j, session: j1, title: "Vidéo témoignages étudiants", ch: ig, prod: "a_creer", target: addDays(T, 30) });
    await pub({ cycle: j, session: j1, title: "Campagne Ads Meta", ch: ig, nat: ads, prod: "idee", target: addDays(T, 25) });
    await pub({ cycle: j, session: j2, title: "Annonce JPO de juin", ch: li, prod: "idee", target: addDays(T, 90) });

    // Projet ponctuel — Alumni
    const g = await cycle({ kind: "projet", name: "Gala Alumni", aud: al, start: addDays(T, 45), end: addDays(T, 45), status: "a_venir", pos: 3 });
    await pub({ cycle: g, title: "Invitation emailing", ch: nl, nat: evt, prod: "en_cours", target: addDays(T, 14), images: { kicker: "Alumni · Gala" } });
    await pub({ cycle: g, title: "Annonce LinkedIn", ch: li, prod: "a_creer", target: addDays(T, 16) });

    return true;
  });
}
