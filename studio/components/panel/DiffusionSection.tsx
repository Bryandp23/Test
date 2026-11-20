"use client";
import { useState } from "react";
import { CalendarCheck2, Send, Undo2, Ban, ExternalLink, TriangleAlert } from "lucide-react";
import type { PublicationDetail } from "@/lib/domain";
import { PRODUCTION, cardStage } from "@/lib/domain";
import { patchPub, setDiffusionOp } from "@/lib/client/ops";
import { StageBadge, StageIcon, STAGE_COLOR } from "@/components/ui/badges";
import { Button, cx, Field, Input } from "@/components/ui/primitives";
import { fmtInstant, todayBrussels, utcToBrussels } from "@/lib/time";

export function ProductionControl({ d }: { d: PublicationDetail }) {
  return (
    <div role="radiogroup" aria-label="Statut de production" className="grid grid-cols-4 gap-1 rounded-lg border border-line-soft bg-bg/60 p-1">
      {PRODUCTION.map((p) => {
        const on = d.production_status === p.id;
        return (
          <button
            key={p.id}
            role="radio"
            aria-checked={on}
            onClick={() => !on && patchPub(d.id, { production_status: p.id })}
            className={cx("flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] transition-colors duration-150", on ? "bg-raised text-fg" : "text-muted hover:text-fg")}
            style={on ? { boxShadow: `inset 0 -2px 0 ${STAGE_COLOR[p.id]}` } : undefined}
          >
            <StageIcon stage={p.id} className="size-3.5" />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

type Mode = null | "programme" | "publie";

/**
 * Statut de diffusion. Rien n'est publié par l'application : « Programmé » et « Publié »
 * sont des confirmations manuelles de ce qui a été fait sur la plateforme externe.
 */
export function DiffusionControl({ d }: { d: PublicationDetail }) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const today = todayBrussels();
  const sched = d.scheduled_at ? utcToBrussels(d.scheduled_at) : null;
  const [date, setDate] = useState(d.target_date ?? today);
  const [time, setTime] = useState(d.target_time ?? "09:00");
  const [platform, setPlatform] = useState(d.scheduled_platform);
  const [url, setUrl] = useState(d.published_url);
  const stage = cardStage(d);

  async function submit(input: Record<string, unknown>) {
    setBusy(true);
    const ok = await setDiffusionOp(d.id, input);
    setBusy(false);
    if (ok) setMode(null);
  }

  function openMode(m: Mode) {
    if (m === "programme") {
      setDate(sched?.date ?? d.target_date ?? today);
      setTime(sched?.time ?? d.target_time ?? "09:00");
      setPlatform(d.scheduled_platform);
    }
    if (m === "publie") {
      setDate(d.published_at ? utcToBrussels(d.published_at).date : sched?.date && sched.date <= today ? sched.date : today);
      setTime(d.published_at ? utcToBrussels(d.published_at).time : (sched?.time ?? "12:00"));
      setUrl(d.published_url);
    }
    setMode(m);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={stage} />
        {d.diffusion_status === "programme" && d.scheduled_at && (
          <span className="text-[12px] text-muted">
            le {fmtInstant(d.scheduled_at)}
            {d.scheduled_platform ? ` · ${d.scheduled_platform}` : ""}
          </span>
        )}
        {d.diffusion_status === "publie" && d.published_at && <span className="text-[12px] text-muted">le {fmtInstant(d.published_at)}</span>}
        {d.diffusion_status === "a_programmer" && d.target_date && <span className="text-[12px] text-faint">Date cible définie, programmation non confirmée</span>}
      </div>

      {d.diffusion_status === "publie" && d.published_url && (
        <a href={d.published_url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-[12px] text-accent hover:underline">
          <ExternalLink className="size-3.5 shrink-0" />
          <span className="truncate">{d.published_url}</span>
        </a>
      )}

      {d.diffusion_status === "programme" && sched && sched.date < today && (
        <p className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-2 text-[12px] text-fg">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" /> La date programmée est passée. Confirmez la publication réelle pour garder un historique exact.
        </p>
      )}

      {mode === null && (
        <div className="flex flex-wrap gap-2">
          {(d.diffusion_status === "a_programmer" || d.diffusion_status === "programme") && (
            <Button size="sm" variant={d.diffusion_status === "a_programmer" ? "primary" : "secondary"} onClick={() => openMode("programme")}>
              <CalendarCheck2 className="size-3.5" />
              {d.diffusion_status === "programme" ? "Modifier la programmation" : "Confirmer la programmation…"}
            </Button>
          )}
          {d.diffusion_status !== "annule" && (
            <Button size="sm" variant={d.diffusion_status === "programme" ? "primary" : "secondary"} onClick={() => openMode("publie")}>
              <Send className="size-3.5" />
              {d.diffusion_status === "publie" ? "Modifier la publication" : "Marquer comme publié…"}
            </Button>
          )}
          {d.diffusion_status === "a_programmer" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => submit({ to: "annule" })}>
              <Ban className="size-3.5" /> Annuler la diffusion
            </Button>
          )}
          {d.diffusion_status !== "a_programmer" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => submit({ to: "a_programmer" })}>
              <Undo2 className="size-3.5" /> {d.diffusion_status === "annule" ? "Réactiver" : "Revenir à « À programmer »"}
            </Button>
          )}
        </div>
      )}

      {mode === "programme" && (
        <form
          className="space-y-3 rounded-lg border border-[var(--color-s-programme)]/40 bg-[var(--color-s-programme)]/[0.06] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit({ to: "programme", date, time, platform });
          }}
        >
          <p className="text-[12px] text-muted">
            Confirmez que la publication est <strong className="text-fg">réellement programmée</strong> sur la plateforme de diffusion. L'application ne publie rien automatiquement.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date programmée">
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Heure (Bruxelles)">
              <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Plateforme ou outil utilisé (facultatif)">
            <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="LinkedIn natif, Meta Business Suite, ActiveCampaign…" maxLength={120} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" disabled={busy}>
              Confirmer : c'est programmé
            </Button>
          </div>
        </form>
      )}

      {mode === "publie" && (
        <form
          className="space-y-3 rounded-lg border border-accent/40 bg-accent/[0.06] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            let u = url.trim();
            if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
            void submit({ to: "publie", date, time: time || null, url: u });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date de diffusion réelle">
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Heure (facultatif)">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="URL publique (facultatif)">
            <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" disabled={busy}>
              Enregistrer comme publié
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
