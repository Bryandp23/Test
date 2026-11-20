"use client";
import type { PublicationDetail } from "@/lib/domain";
import { diffusionLabel, productionLabel, type DiffusionStatus, type ProductionStatus } from "@/lib/domain";
import { useStudio } from "@/lib/client/store";
import { fmtInstant, fmtRelative, fmtShort } from "@/lib/time";

function place(v: string | null, cycles: { id: string; name: string }[], sessions: { id: string; title: string }[]) {
  if (!v) return "";
  const [c, s] = v.split("/");
  const cn = cycles.find((x) => x.id === c)?.name ?? "cycle supprimé";
  const sn = s ? (sessions.find((x) => x.id === s)?.title ?? "session supprimée") : "contenus généraux";
  return `${cn} › ${sn}`;
}

export function Activity({ d }: { d: PublicationDetail }) {
  const cycles = useStudio((s) => s.cycles);
  const sessions = useStudio((s) => s.sessions);
  if (!d.activity.length) return <p className="text-[12px] text-faint">Aucun historique.</p>;
  return (
    <ol className="space-y-2">
      {d.activity.map((a) => {
        let text: string;
        switch (a.action) {
          case "created":
            text = `Création (${productionLabel((a.to_value ?? "idee") as ProductionStatus)})`;
            break;
          case "production":
            text = `Production : ${productionLabel(a.from_value as ProductionStatus)} → ${productionLabel(a.to_value as ProductionStatus)}`;
            break;
          case "diffusion": {
            const m = a.meta as { scheduled_at?: string; platform?: string; url?: string; published_at?: string };
            text = `Diffusion : ${diffusionLabel(a.from_value as DiffusionStatus)} → ${diffusionLabel(a.to_value as DiffusionStatus)}`;
            if (a.to_value === "programme" && m.scheduled_at) text += ` (le ${fmtInstant(m.scheduled_at)}${m.platform ? `, ${m.platform}` : ""})`;
            if (a.to_value === "publie" && m.published_at) text += ` (le ${fmtInstant(m.published_at)})`;
            break;
          }
          case "target_date":
            text = `Date cible : ${a.from_value ? fmtShort(a.from_value) : "aucune"} → ${a.to_value ? fmtShort(a.to_value) : "aucune"}${(a.meta as { reason?: string }).reason === "session_shift" ? " (session décalée)" : ""}`;
            break;
          case "moved":
            text = `Déplacée : ${place(a.from_value, cycles, sessions)} → ${place(a.to_value, cycles, sessions)}`;
            break;
          case "title":
            text = `Titre modifié (ancien : « ${a.from_value} »)`;
            break;
          case "file_added":
            text = `Fichier ajouté : ${a.to_value}`;
            break;
          case "file_removed":
            text = `Fichier retiré : ${a.from_value}`;
            break;
          case "link_added":
            text = `Lien ajouté : ${a.to_value}`;
            break;
          case "duplicated":
            text = "Créée par duplication";
            break;
          case "archived":
            text = "Archivée";
            break;
          case "unarchived":
            text = "Désarchivée";
            break;
          default:
            text = a.action;
        }
        return (
          <li key={a.id} className="flex gap-3 text-[12px]">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-line" aria-hidden />
            <span className="min-w-0 flex-1 text-muted">{text}</span>
            <time className="shrink-0 text-faint" dateTime={a.created_at} title={fmtInstant(a.created_at)}>
              {fmtRelative(a.created_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
