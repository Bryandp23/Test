import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getEventHistory, getEventRowById, toEventInput } from "@/lib/server/events";
import { syncSummaryForEvent } from "@/lib/server/connections";
import { getBaseUrl } from "@/lib/server/settings";
import { STATUS_LABELS } from "@/lib/types";
import EventWizard from "@/components/admin/EventWizard";
import EventActions from "@/components/admin/EventActions";

export const metadata: Metadata = { title: "Modifier un événement" };

const ACTION_LABEL: Record<string, string> = {
  create: "Création",
  update: "Modification",
  publish: "Publication",
  cancel: "Annulation",
  restore: "Rétablissement",
  archive: "Archivage",
  unarchive: "Restauration",
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copie?: string; enregistre?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const r = await getEventRowById(id);
  if (!r) notFound();
  const h = await headers();
  const base = await getBaseUrl(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`);
  const sync = await syncSummaryForEvent(id);
  const history = await getEventHistory(id);
  const e = r.row;

  return (
    <>
      <div className="mx-auto mb-6 max-w-3xl">
        <Link href="/admin" className="text-sm font-semibold text-brand-700 underline underline-offset-4">
          ← Retour aux événements
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">
              {STATUS_LABELS[e.status]}
              {e.is_demo && " · Démonstration"}
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">{e.title}</h1>
          </div>
          <EventActions id={id} slug={e.slug} status={e.status} title={e.title} />
        </div>
        {sp.copie && (
          <p className="mt-4 rounded-xl bg-brand-50 p-3 text-brand-900" role="status">
            Copie créée en brouillon. Ajustez le nom et les dates, puis publiez.
          </p>
        )}
        {sp.enregistre && (
          <p className="mt-4 rounded-xl bg-ok-50 p-3 text-ok" role="status">
            Brouillon enregistré. Il n&apos;est pas visible des participants tant qu&apos;il n&apos;est pas publié.
          </p>
        )}
        {sync.errors > 0 && (
          <p className="mt-4 rounded-xl bg-danger-50 p-3 text-danger" role="alert">
            {sync.errors} ajout(s) dans des calendriers connectés n&apos;ont pas pu être mis à jour (accès retiré par le participant ou service indisponible). Ces participants doivent être prévenus par email.
          </p>
        )}
      </div>
      <EventWizard
        mode="edit"
        initial={toEventInput(e, r.sessions)}
        eventId={id}
        slug={e.slug}
        status={e.status}
        publishedOnce={!!e.published_at}
        baseUrl={base}
        connectedCount={sync.active}
      />
      {history.length > 0 && (
        <details className="mx-auto mt-8 max-w-3xl text-sm">
          <summary className="cursor-pointer font-semibold text-muted">Historique des modifications</summary>
          <ul className="mt-3 space-y-2">
            {history.map((hh, i) => (
              <li key={i} className="rounded-xl bg-white p-3 ring-1 ring-line">
                <span className="font-semibold">{ACTION_LABEL[hh.action] ?? hh.action}</span> · {new Date(hh.created_at).toLocaleString("fr-BE", { timeZone: "Europe/Brussels" })}
                {hh.user_name ? ` · ${hh.user_name}` : ""}
                {Array.isArray(hh.summary) && hh.summary.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {hh.summary.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
