// Tests d'intégration serveur : vraie base PostgreSQL (PGlite en mémoire), fournisseurs simulés.
import { beforeAll, describe, expect, it, vi, afterEach } from "vitest";

process.env.PGLITE_DIR = "memory";
process.env.APP_SECRET = "test-secret-0123456789-abcdefghijklmnop";
process.env.SEED_DEMO = "true";

import { q, q1 } from "@/lib/server/db";
import { getPublicEventBySlug, saveEvent, setStatus } from "@/lib/server/events";
import { __setProviderForTests, addSessions, propagateChanges, saveConnection } from "@/lib/server/connections";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { microsoft } from "@/lib/server/providers/microsoft";
import { ProviderError, type CalendarProvider } from "@/lib/server/providers/types";
import { emptyEventInput } from "@/lib/validation";
import type { EventInput } from "@/lib/types";

const remote = new Map<string, { summary: string; start: string }>();
let creates = 0;
const fake: CalendarProvider = {
  id: "google",
  label: "Fake",
  configured: () => true,
  authorizeUrl: () => "",
  exchangeCode: async () => ({ accessToken: "a" }),
  refresh: async () => ({ accessToken: "a" }),
  accountEmail: async () => "x@example.com",
  async ensureEvent(_t, ev, s) {
    const id = `g${s.id.replace(/-/g, "")}`;
    if (!remote.has(id)) creates++;
    remote.set(id, { summary: s.title ?? ev.title, start: s.startUtc });
    return { id, link: null };
  },
  async updateEvent(_t, id, ev, s) {
    if (!remote.has(id)) throw new ProviderError("gone", "not_found", 404);
    remote.set(id, { summary: ev.title, start: s.startUtc });
    return { id, link: null };
  },
  async verifyEvent(_t, id) {
    return remote.has(id);
  },
  revoke: async () => true,
};

const input = (over: Partial<EventInput> = {}): EventInput => ({
  ...emptyEventInput(),
  title: "Test intégration",
  format: "online",
  onlineUrl: "https://teams.microsoft.com/l/x",
  sessions: [
    { date: "2027-03-25", startTime: "18:00", endTime: "20:00" },
    { date: "2027-04-01", startTime: "18:00", endTime: "20:00" },
  ],
  ...over,
});

beforeAll(async () => {
  __setProviderForTests("google", fake);
  await q(`select 1`);
});

describe("dépôt des événements", () => {
  it("les données de démonstration sont présentes et marquées comme telles", async () => {
    const rows = await q<{ title: string; is_demo: boolean; n: number }>(
      `select e.title, e.is_demo, (select count(*)::int from sessions s where s.event_id=e.id) n from events e order by e.title`
    );
    expect(rows.map((r) => [r.title.slice(0, 18), r.n, r.is_demo])).toEqual([
      ["Certificat en Spor", 6, true],
      ["Cycle IA & Humain", 9, true],
      ["Webinaire gratuit ", 1, true],
    ]);
  });

  it("SEQUENCE n'augmente que pour les séances réellement modifiées après publication", async () => {
    const r = await saveEvent({ input: input(), userId: null });
    await setStatus(r.id, "publish", (await q1<{ id: string }>(`select id from users limit 1`))!.id);
    let ev = (await getPublicEventBySlug(r.slug))!;
    expect(ev.sessions.map((s) => s.sequence)).toEqual([0, 0]);
    expect(ev.sessions[1].startUtc).toBe("2027-04-01T16:00:00.000Z"); // heure d'été
    const changed = input();
    changed.sessions = ev.sessions.map((s) => ({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime }));
    changed.sessions[0].startTime = "18:30";
    const res = await saveEvent({ id: r.id, input: changed, userId: null, publish: true });
    expect(res.changedSessionIds).toEqual([ev.sessions[0].id]);
    expect(res.changes[0]).toMatch(/déplacée/);
    ev = (await getPublicEventBySlug(r.slug))!;
    expect(ev.sessions.map((s) => s.sequence)).toEqual([1, 0]);
  });

  it("une séance publiée retirée est annulée, jamais effacée", async () => {
    const r = await saveEvent({ input: input(), userId: null });
    await q(`update events set status='published', published_at=now() where id=$1`, [r.id]);
    const ev = (await getPublicEventBySlug(r.slug))!;
    const keep = input();
    keep.sessions = [{ id: ev.sessions[0].id, date: "2027-03-25", startTime: "18:00", endTime: "20:00" }];
    await saveEvent({ id: r.id, input: keep, userId: null, publish: true });
    const after = (await getPublicEventBySlug(r.slug))!;
    expect(after.sessions.map((s) => s.status)).toEqual(["active", "cancelled"]);
  });
});

describe("agendas connectés (Mode B)", () => {
  it("ajout idempotent, propagation des modifications, suppression par l'utilisateur respectée", async () => {
    const r = await saveEvent({ input: input({ title: "Idempotence" }), userId: null });
    await q(`update events set status='published', published_at=now() where id=$1`, [r.id]);
    const ev = (await getPublicEventBySlug(r.slug))!;
    const conn = await saveConnection({ browserKey: "bk-1", provider: "google", email: "x@example.com", accessToken: "tok", expiresIn: 3600 });
    const stored = await q1<{ access_token_enc: string; account_email_hmac: string }>(`select * from calendar_connections where id=$1`, [conn.id]);
    expect(stored!.access_token_enc).not.toContain("tok"); // jamais en clair
    expect(decrypt(stored!.access_token_enc)).toBe("tok");

    const ids = ev.sessions.map((s) => s.id);
    const first = await Promise.all([addSessions(conn, ev, ids, "https://x/e/a"), addSessions(conn, ev, ids, "https://x/e/a")]);
    expect(first.flat().every((x) => x.outcome === "added" || x.outcome === "already")).toBe(true);
    expect(creates).toBe(2);
    const again = await addSessions(conn, ev, ids, "https://x/e/a");
    expect(again.map((x) => x.outcome)).toEqual(["already", "already"]);

    const victim = [...remote.keys()].find((k) => k.includes(ids[1].replace(/-/g, "")))!;
    remote.delete(victim);
    const rep = await propagateChanges(r.id, ids);
    expect(rep).toMatchObject({ connected: 2, updated: 1, removedByUser: 1, failed: 0 });
  });
});

describe("connecteur Microsoft Graph (requêtes simulées)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("fuseau Windows, rappel, transactionId et recherche préalable anti-doublon", async () => {
    const calls: { url: string; method: string; body: any }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.includes("$filter")) return new Response(JSON.stringify({ value: [] }), { status: 200 });
      return new Response(JSON.stringify({ id: "AAMk1", webLink: "https://outlook/x" }), { status: 201 });
    });
    const ev = (await getPublicEventBySlug((await q1<{ slug: string }>(`select slug from events where title like 'Webinaire%'`))!.slug))!;
    const ref = await microsoft.ensureEvent("tok", ev, ev.sessions[0], { pageUrl: "https://x/e/a", existingId: null, connectionId: "c1" });
    expect(ref.id).toBe("AAMk1");
    expect(calls[0].url).toContain("singleValueExtendedProperties");
    const post = calls[1];
    expect(post.method).toBe("POST");
    expect(post.body.start).toEqual({ dateTime: "2026-11-19T12:00:00", timeZone: "Romance Standard Time" });
    expect(post.body.reminderMinutesBeforeStart).toBe(60);
    expect(post.body.transactionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.body.subject).toBe("EPHEC | Webinaire gratuit — Découvrir les applications de l'IA");
  });
  it("erreurs d'autorisation classées pour déclencher une reconnexion", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "InvalidAuthenticationToken" } }), { status: 401 }));
    await expect(microsoft.verifyEvent("bad", "id")).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("chiffrement", () => {
  it("AES-GCM authentifié : une altération est détectée", () => {
    const c = encrypt("secret");
    const parts = c.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});
