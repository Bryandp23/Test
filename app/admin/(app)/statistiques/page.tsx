import type { Metadata } from "next";
import { statsBreakdown, statsByEvent } from "@/lib/server/stats";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Statistiques" };

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Agenda (lien)",
  outlook_personal: "Outlook.com (lien)",
  outlook_work: "Microsoft 365 (lien)",
  outlook_desktop: "Outlook ordinateur (fichier)",
  apple: "Apple Calendrier (fichier)",
  ics: "Autre calendrier (fichier)",
  yahoo: "Yahoo (lien)",
  subscribe: "Abonnement",
  api_google: "Google Agenda connecté",
  api_microsoft: "Outlook connecté",
  copy: "Copie des informations",
};
const DEVICE_LABEL: Record<string, string> = { mobile: "Smartphone", tablet: "Tablette", desktop: "Ordinateur", "": "Inconnu" };

function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const sp = await searchParams;
  const today = todayIn("Europe/Brussels");
  const to = sp.au && /^\d{4}-\d{2}-\d{2}$/.test(sp.au) ? sp.au : today;
  const from = sp.du && /^\d{4}-\d{2}-\d{2}$/.test(sp.du) ? sp.du : shift(today, -90);
  const rows = await statsByEvent(from, to);
  const { providers, devices } = await statsBreakdown(from, to);
  const views = rows.reduce((a, r) => a + r.views, 0);
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const confirmed = rows.reduce((a, r) => a + r.confirmed, 0);
  const maxClicks = Math.max(1, ...providers.map((p) => p.clicks));
  const totalDev = devices.reduce((a, d) => a + d.views, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Statistiques</h1>
      <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm font-semibold">
          Du
          <input type="date" name="du" defaultValue={from} className="mt-1 block min-h-11 rounded-xl border-2 border-line bg-white px-3" />
        </label>
        <label className="text-sm font-semibold">
          Au
          <input type="date" name="au" defaultValue={to} className="mt-1 block min-h-11 rounded-xl border-2 border-line bg-white px-3" />
        </label>
        <button className="min-h-11 rounded-xl border-2 border-brand-700 px-4 font-semibold text-brand-800 hover:bg-brand-50">Afficher</button>
        <a href={`/api/admin/stats?du=${from}&au=${to}`} className="ml-auto inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800">
          Exporter en CSV
        </a>
      </form>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="shape bg-white p-5 ring-1 ring-line">
          <dt className="text-sm font-semibold text-muted">Ouvertures de pages d&apos;ajout</dt>
          <dd className="mt-1 text-3xl font-bold">{views}</dd>
        </div>
        <div className="shape bg-white p-5 ring-1 ring-line">
          <dt className="text-sm font-semibold text-muted">Clics sur un calendrier</dt>
          <dd className="mt-1 text-3xl font-bold">{clicks}</dd>
          <dd className="text-xs text-muted">Un clic ne prouve pas l&apos;enregistrement : le participant termine dans son calendrier.</dd>
        </div>
        <div className="shape bg-white p-5 ring-1 ring-line">
          <dt className="text-sm font-semibold text-muted">Ajouts confirmés</dt>
          <dd className="mt-1 text-3xl font-bold">{confirmed}</dd>
          <dd className="text-xs text-muted">Uniquement via les agendas connectés, où l&apos;ajout est vérifié par Google ou Microsoft.</dd>
        </div>
      </dl>
      {views === 0 && (
        <p className="mt-4 rounded-xl bg-canvas p-4 text-muted">Aucune donnée sur cette période. Les statistiques apparaîtront dès que des participants ouvriront les pages d&apos;ajout.</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="shape bg-white p-5 ring-1 ring-line" aria-labelledby="cal-title">
          <h2 id="cal-title" className="font-bold">
            Calendriers choisis
          </h2>
          {providers.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Pas encore de clic.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {providers.map((p) => (
                <li key={p.provider}>
                  <div className="flex justify-between text-sm">
                    <span>{PROVIDER_LABEL[p.provider] ?? p.provider}</span>
                    <span className="font-semibold">
                      {p.clicks} clic{p.clicks > 1 ? "s" : ""}
                      {p.confirmed > 0 && ` · ${p.confirmed} confirmé${p.confirmed > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-canvas" aria-hidden="true">
                    <div className="h-2.5 rounded-full bg-brand" style={{ width: `${(p.clicks / maxClicks) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="shape bg-white p-5 ring-1 ring-line" aria-labelledby="dev-title">
          <h2 id="dev-title" className="font-bold">
            Appareils (ouvertures)
          </h2>
          {devices.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Pas encore de donnée.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {devices.map((d) => (
                <li key={d.device}>
                  <div className="flex justify-between text-sm">
                    <span>{DEVICE_LABEL[d.device] ?? d.device}</span>
                    <span className="font-semibold">
                      {d.views} ({Math.round((d.views / totalDev) * 100)} %)
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-canvas" aria-hidden="true">
                    <div className="h-2.5 rounded-full bg-brand-800" style={{ width: `${(d.views / totalDev) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="ev-title">
        <h2 id="ev-title" className="text-lg font-bold">
          Par événement
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Événement</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ouvertures</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Clics</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Confirmés</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Engagement<span className="sr-only"> (clics divisés par ouvertures, estimation)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.event_id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {r.title}
                    {r.is_demo && <span className="ml-2 rounded-full bg-warn-50 px-2 py-0.5 text-xs text-warn">Démo</span>}
                  </th>
                  <td className="px-4 py-3 text-right">{r.views}</td>
                  <td className="px-4 py-3 text-right">{r.clicks}</td>
                  <td className="px-4 py-3 text-right">{r.confirmed}</td>
                  <td className="px-4 py-3 text-right">{r.views ? `${Math.min(100, Math.round((r.clicks / r.views) * 100))} %` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Engagement = clics sur un calendrier ÷ ouvertures de page. C&apos;est une estimation : un même participant peut cliquer plusieurs fois, et un clic n&apos;est pas un ajout confirmé. Aucune donnée personnelle n&apos;est collectée ; les chiffres sont agrégés par jour et conservés 13 mois.
        </p>
      </section>
    </div>
  );
}
