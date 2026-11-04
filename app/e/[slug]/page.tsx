import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getPublicEventBySlug } from "@/lib/server/events";
import { currentUser } from "@/lib/server/auth";
import { getBaseUrl, getSettings } from "@/lib/server/settings";
import { configuredProviders, connectionsForBrowser, syncedStateForBrowser } from "@/lib/server/connections";
import { BROWSER_COOKIE, readBrowserKey } from "@/lib/server/browser";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { capitalize, formatLongDate, formatTime, formatShortDate } from "@/lib/time";
import { sessionLocation } from "@/lib/content";
import { EphecLogo, IconCalendar, IconClock, IconExternal, IconInfo, IconPin, IconVideo, IconWarn } from "@/components/icons";
import AddToCalendar from "@/components/participant/AddToCalendar";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getPublicEventBySlug(slug);
  if (!ev || ev.status === "draft" || ev.status === "archived") return { title: "Événement introuvable" };
  return { title: `Ajouter « ${ev.title} » à mon calendrier` };
}

function NotAvailable({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-center">
      <EphecLogo className="mx-auto h-10" />
      <h1 className="mt-10 text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-muted">{text}</p>
      <a href="https://www.ephec.be" className="mt-8 inline-block font-semibold text-brand-700 underline underline-offset-4">
        Aller sur ephec.be
      </a>
    </main>
  );
}

export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const ev = await getPublicEventBySlug(slug);
  const admin = sp.preview ? await currentUser() : null;
  const preview = !!admin;
  if (!ev || ((ev.status === "draft" || ev.status === "archived") && !preview)) {
    return <NotAvailable title="Cet événement n'est pas disponible" text="Le lien est peut-être incomplet, ou l'événement n'est plus proposé. Vérifiez le lien reçu par email ou contactez la Formation Continue de l'EPHEC." />;
  }
  const settings = await getSettings();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const base = await getBaseUrl(origin);
  const pageUrl = `${base}/e/${ev.slug}`;
  const jar = await cookies();
  const browserKey = readBrowserKey(jar.get(BROWSER_COOKIE)?.value);
  const connections = (await connectionsForBrowser(browserKey)).map((c) => ({ id: c.id, provider: c.provider, email: c.account_email, autoAdd: c.auto_add }));
  const synced = await syncedStateForBrowser(browserKey, ev.id);

  const active = ev.sessions.filter((s) => s.status === "active");
  const multi = active.length > 1;
  const first = active[0];
  const last = active[active.length - 1];
  const ended = active.length > 0 && new Date(last.endUtc).getTime() < Date.now();
  const cancelled = ev.status === "cancelled";
  const loc = first ? sessionLocation(ev, first) : null;
  const sameTimes = active.every((s) => s.startTime === first?.startTime && s.endTime === first?.endTime);
  const placesDiffer = active.some((s) => s.address || s.locationName);

  return (
    <div className="min-h-dvh">
      <a href="#ajouter" className="sr-only-focusable fixed left-3 top-3 z-50 rounded bg-white px-4 py-2 font-semibold shadow">
        Aller directement au choix du calendrier
      </a>
      {preview && (
        <div className="bg-ink px-4 py-2 text-center text-sm text-white" role="status">
          Aperçu réservé à l&apos;équipe EPHEC{ev.status === "draft" ? " — brouillon, invisible pour les participants" : ""}. Les visites en aperçu ne sont pas comptées.
        </div>
      )}
      {ev.isDemo && (
        <div className="bg-warn-50 px-4 py-2 text-center text-sm text-warn">
          <strong>Démonstration</strong> — dates, lieux et liens fictifs : ce ne sont pas des informations officielles de l&apos;EPHEC.
        </div>
      )}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6 sm:pt-8">
        <a href="https://www.ephec.be" aria-label="EPHEC — site officiel">
          <EphecLogo className="h-9 sm:h-10" src={settings.logoUrl || undefined} />
        </a>
        <span className="text-sm font-medium text-muted">Formation Continue</span>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 pt-6 sm:px-5 lg:grid-cols-[1fr_1.05fr] lg:gap-x-10 lg:gap-y-6 lg:pt-10">
        <section aria-labelledby="titre" className="lg:col-start-1 lg:row-start-1">
          <div className="shape-lg bg-white p-6 shadow-[0_1px_3px_rgba(16,66,63,.08),0_12px_32px_-12px_rgba(16,66,63,.18)] sm:p-8">
            {ev.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.imageUrl} alt="" className="-mx-6 -mt-6 mb-6 aspect-[2/1] w-[calc(100%+3rem)] max-w-none rounded-t-[8px_40px] object-cover sm:-mx-8 sm:-mt-8 sm:w-[calc(100%+4rem)]" />
            )}
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{EVENT_TYPE_LABELS[ev.type]}</p>
            <h1 id="titre" className="mt-2 text-[1.65rem] font-bold leading-tight text-ink sm:text-3xl">
              {ev.title}
            </h1>

            {cancelled && (
              <div className="mt-5 flex gap-3 rounded-xl bg-danger-50 p-4 text-danger" role="alert">
                <IconWarn className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Cet événement est annulé.</p>
                  {ev.cancelReason && <p className="mt-1 text-sm">{ev.cancelReason}</p>}
                </div>
              </div>
            )}

            {first && (
              <dl className="mt-6 space-y-4 text-[1.05rem]">
                <div className="flex gap-3">
                  <dt className="mt-0.5 text-brand-700">
                    <IconCalendar />
                    <span className="sr-only">Date</span>
                  </dt>
                  <dd className={cancelled ? "line-through decoration-2" : ""}>
                    {multi ? (
                      <>
                        <span className="font-semibold">{active.length} séances</span>
                        <span className="block text-muted">
                          du {formatShortDate(first.date)} au {formatShortDate(last.date)}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold">{capitalize(formatLongDate(first.date))}</span>
                    )}
                  </dd>
                </div>
                {(!multi || sameTimes) && (
                  <div className="flex gap-3">
                    <dt className="mt-0.5 text-brand-700">
                      <IconClock />
                      <span className="sr-only">Horaire</span>
                    </dt>
                    <dd>
                      <span className="font-semibold">
                        {formatTime(first.startTime)} – {formatTime(first.endTime)}
                      </span>
                      {multi && <span className="text-muted"> (chaque séance)</span>}
                      <span className="block text-sm text-muted">Heure de Belgique</span>
                    </dd>
                  </div>
                )}
                {ev.format !== "online" && loc && (loc.locationName || loc.address) && (
                  <div className="flex gap-3">
                    <dt className="mt-0.5 text-brand-700">
                      <IconPin />
                      <span className="sr-only">Lieu</span>
                    </dt>
                    <dd>
                      {loc.locationName && <span className="block font-semibold">{loc.locationName}</span>}
                      {loc.room && <span className="block">Local {loc.room}</span>}
                      {loc.address && (
                        <a
                          className="block text-brand-700 underline decoration-brand/40 underline-offset-4 hover:decoration-brand-700"
                          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(loc.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {loc.address}
                          <span className="sr-only"> (voir sur une carte, nouvel onglet)</span>
                        </a>
                      )}
                      {multi && placesDiffer && <span className="mt-1 block text-sm text-muted">Certaines séances ont lieu ailleurs : voir le détail.</span>}
                    </dd>
                  </div>
                )}
                {ev.format !== "onsite" && (
                  <div className="flex gap-3">
                    <dt className="mt-0.5 text-brand-700">
                      <IconVideo />
                      <span className="sr-only">En ligne</span>
                    </dt>
                    <dd>
                      <span className="font-semibold">{ev.format === "hybrid" ? "Aussi en ligne" : "En ligne"}</span>
                      {ev.onlinePlatform && <span className="text-muted"> · {ev.onlinePlatform}</span>}
                      {ev.onlineUrl && !cancelled && (
                        <a
                          href={ev.onlineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-4"
                        >
                          Lien de participation <IconExternal />
                          <span className="sr-only">(nouvel onglet)</span>
                        </a>
                      )}
                      {!ev.onlineUrl && <span className="block text-sm text-muted">Le lien de connexion sera communiqué avant l&apos;événement.</span>}
                      {ev.onlineUrl && <span className="block text-sm text-muted">Le lien est aussi inclus dans votre calendrier.</span>}
                    </dd>
                  </div>
                )}
              </dl>
            )}

          </div>
        </section>

        <section id="ajouter" aria-labelledby="ajouter-titre" tabIndex={-1} className="outline-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:sticky lg:top-8">
          {ended && !cancelled ? (
            <div className="shape-lg bg-white p-6 sm:p-8">
              <h2 id="ajouter-titre" className="text-xl font-bold">
                Cet événement est terminé
              </h2>
              <p className="mt-2 text-muted">Retrouvez les prochaines formations sur ephec.be.</p>
            </div>
          ) : (
            <AddToCalendar
              event={ev}
              pageUrl={pageUrl}
              preview={preview}
              enableYahoo={settings.enableYahoo}
              apiProviders={configuredProviders()}
              connections={connections}
              synced={synced.map((s) => ({ connectionId: s.connection_id, sessionId: s.session_id, state: s.state, link: s.provider_link }))}
              oauthResult={sp.connexion ?? null}
              oauthError={sp.connexion_erreur ?? null}
              registrationToken={sp.r ?? null}
            />
          )}
          <p className="mt-6 flex gap-2 px-2 text-sm text-muted">
            <IconInfo className="mt-0.5 size-4 shrink-0" />
            <span>
              Aucun compte n&apos;est nécessaire. Cette page n&apos;utilise ni publicité ni pistage.{" "}
              <Link href="/confidentialite" className="underline underline-offset-2">
                Confidentialité
              </Link>
              {connections.length > 0 && (
                <>
                  {" · "}
                  <Link href="/mes-calendriers" className="underline underline-offset-2">
                    Mes calendriers connectés
                  </Link>
                </>
              )}
            </span>
          </p>
        </section>
        <section aria-label="Informations complémentaires" className="px-2 lg:col-start-1 lg:row-start-2 lg:px-8">
            {ev.description && <p className="whitespace-pre-line leading-relaxed text-muted">{ev.description}</p>}

            {multi && (
              <details className="group mt-6 border-t border-line pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg py-2 font-semibold text-ink">
                  Voir le détail des {active.length} séances
                  <span className="text-brand-700 transition group-open:rotate-90" aria-hidden="true">
                    ›
                  </span>
                </summary>
                <ol className="mt-2 space-y-3">
                  {ev.sessions.map((s) => {
                    const l = sessionLocation(ev, s);
                    return (
                      <li key={s.id} className={`rounded-xl bg-canvas p-3 ${s.status === "cancelled" ? "opacity-70" : ""}`}>
                        <p className="font-semibold">
                          {s.status === "active" ? `${s.index}. ` : ""}
                          <span className={s.status === "cancelled" ? "line-through" : ""}>{capitalize(formatLongDate(s.date))}</span>
                          {s.status === "cancelled" && <span className="ml-2 rounded bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger">Annulée</span>}
                        </p>
                        <p className="text-sm text-muted">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                          {s.title ? ` · ${s.title}` : ""}
                        </p>
                        {(s.address || s.locationName) && <p className="text-sm text-muted">{[l.locationName, l.room && `Local ${l.room}`, l.address].filter(Boolean).join(", ")}</p>}
                      </li>
                    );
                  })}
                </ol>
              </details>
            )}

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
              {ev.infoUrl && (
                <a href={ev.infoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-4">
                  Page de la formation <IconExternal />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              )}
              {(ev.organizerEmail || ev.organizerPhone) && (
                <span className="text-muted">
                  Contact :{" "}
                  {ev.organizerEmail && (
                    <a className="text-brand-700 underline" href={`mailto:${ev.organizerEmail}`}>
                      {ev.organizerEmail}
                    </a>
                  )}
                  {ev.organizerEmail && ev.organizerPhone && " · "}
                  {ev.organizerPhone && (
                    <a className="text-brand-700 underline" href={`tel:${ev.organizerPhone.replace(/\s/g, "")}`}>
                      {ev.organizerPhone}
                    </a>
                  )}
                </span>
              )}
            </div>
        </section>
      </main>
    </div>
  );
}
