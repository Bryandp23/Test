"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventStatus } from "@/lib/types";
import { Button } from "@/components/ui/fields";

export default function EventActions({ id, slug, status, title }: { id: string; slug: string; status: EventStatus; title: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelEmail, setCancelEmail] = useState<string | null>(null);
  const [sync, setSync] = useState<{ connected: number; updated: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/events/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error ?? "Action impossible.");
      return null;
    }
    return d;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/e/${slug}?preview=1`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-800 hover:bg-brand-50">
        Aperçu ↗
      </a>
      {(status === "published" || status === "cancelled") && (
        <Link href={`/admin/evenements/${id}/partager`} className="inline-flex min-h-11 items-center rounded-xl border-2 border-brand-700 px-4 font-semibold text-brand-800 hover:bg-brand-50">
          Partager
        </Link>
      )}
      <button
        type="button"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-800 hover:bg-brand-50"
        onClick={async () => {
          const d = await run("duplicate");
          if (d) router.push(`/admin/evenements/${d.id}?copie=1`);
        }}
      >
        Dupliquer
      </button>
      {status === "published" && (
        <button type="button" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-danger hover:bg-danger-50" onClick={() => dialog.current?.showModal()}>
          Annuler l&apos;événement
        </button>
      )}
      {status === "cancelled" && (
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-800 hover:bg-brand-50"
          onClick={async () => {
            if (await run("restore")) router.refresh();
          }}
        >
          Rétablir l&apos;événement
        </button>
      )}
      {error && (
        <p className="w-full text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      <dialog ref={dialog} aria-labelledby="cancel-title" className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-[8px_32px_8px_32px] p-0 backdrop:bg-ink/50">
        <div className="p-6">
          {!cancelEmail ? (
            <>
              <h2 id="cancel-title" className="text-xl font-bold">
                Annuler « {title} » ?
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
                <li>La page d&apos;ajout indiquera que l&apos;événement est annulé.</li>
                <li>Les calendriers connectés seront mis à jour automatiquement (mention « ANNULÉ »).</li>
                <li>Les participants ayant utilisé un lien ou un fichier devront être prévenus par email : un texte vous sera proposé.</li>
              </ul>
              <label htmlFor="reason" className="mt-4 block font-semibold">
                Message pour les participants <span className="font-normal text-muted">(facultatif)</span>
              </label>
              <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-xl border-2 border-line p-3" placeholder="Ex. La séance est reportée au printemps, une nouvelle date vous sera communiquée." />
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => dialog.current?.close()}>
                  Ne rien changer
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    const d = await run("cancel", { reason });
                    if (d) {
                      setCancelEmail(d.cancelEmail);
                      setSync(d.sync);
                      router.refresh();
                    }
                  }}
                >
                  {busy ? "Annulation…" : "Confirmer l'annulation"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 id="cancel-title" className="text-xl font-bold">
                Événement annulé
              </h2>
              {sync && sync.connected > 0 && (
                <p className="mt-2 text-muted">
                  Calendriers connectés : {sync.updated} mis à jour{sync.failed ? `, ${sync.failed} en échec` : ""}.
                </p>
              )}
              <p className="mt-2 font-semibold">Texte à envoyer aux inscrits via ActiveCampaign :</p>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 font-sans text-sm">{cancelEmail}</pre>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(cancelEmail)}>
                  Copier le texte
                </Button>
                <Button onClick={() => dialog.current?.close()}>Fermer</Button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
