"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardEvent } from "@/lib/server/events";
import { EVENT_TYPE_LABELS, FORMAT_LABELS, type EventType, type EventFormat } from "@/lib/types";
import { capitalize, formatShortDate } from "@/lib/time";
import { IconCalendar, IconPlus, IconSearch, IconWarn } from "@/components/icons";

type Tab = "upcoming" | "draft" | "past" | "cancelled" | "archived";
const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "upcoming", label: "À venir", empty: "Aucun événement publié à venir." },
  { id: "draft", label: "Brouillons", empty: "Aucun brouillon en cours." },
  { id: "past", label: "Passés", empty: "Aucun événement passé." },
  { id: "cancelled", label: "Annulés", empty: "Aucun événement annulé." },
  { id: "archived", label: "Archivés", empty: "Aucun événement archivé." },
];

function tabOf(e: DashboardEvent, now: number): Tab {
  if (e.status === "archived") return "archived";
  if (e.status === "draft") return "draft";
  if (e.status === "cancelled") return "cancelled";
  return e.lastEnd && new Date(e.lastEnd).getTime() < now ? "past" : "upcoming";
}

export default function Dashboard({ events, now }: { events: DashboardEvent[]; now: string }) {
  const router = useRouter();
  const nowMs = new Date(now).getTime();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | EventType>("");
  const [period, setPeriod] = useState<"" | "month" | "3months" | "year">("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { upcoming: 0, draft: 0, past: 0, cancelled: 0, archived: 0 };
    events.forEach((e) => c[tabOf(e, nowMs)]++);
    return c;
  }, [events, nowMs]);

  const list = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const limit = period === "month" ? 31 : period === "3months" ? 92 : period === "year" ? 366 : null;
    const filtered = events.filter((e) => {
      if (tabOf(e, nowMs) !== tab) return false;
      if (type && e.type !== type) return false;
      if (q && !e.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)) return false;
      if (limit && e.firstStart) {
        const d = Math.abs(new Date(e.firstStart).getTime() - nowMs) / 86400000;
        if (d > limit) return false;
      }
      return true;
    });
    return tab === "past" || tab === "archived" ? filtered.reverse() : filtered;
  }, [events, tab, query, type, period, nowMs]);

  async function action(e: DashboardEvent, act: "duplicate" | "archive" | "unarchive") {
    setBusy(e.id + act);
    const r = await fetch(`/api/admin/events/${e.id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: act }) });
    const d = await r.json();
    setBusy(null);
    if (!r.ok) return setToast({ text: d.error ?? "Action impossible." });
    if (act === "duplicate") return router.push(`/admin/evenements/${d.id}?copie=1`);
    setToast({
      text: act === "archive" ? `« ${e.title} » a été archivé.` : `« ${e.title} » a été restauré.`,
      undo: act === "archive" ? () => action(e, "unarchive") : undefined,
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Événements</h1>
          <p className="mt-1 text-muted">Créez un événement, puis copiez son bouton dans votre email ActiveCampaign.</p>
        </div>
        <Link href="/admin/evenements/nouveau" className="shape inline-flex min-h-14 items-center gap-2 bg-brand-700 px-6 text-lg font-semibold text-white shadow-sm hover:bg-brand-800">
          <IconPlus /> Créer un événement
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <label htmlFor="q" className="sr-only">
            Rechercher par nom
          </label>
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom…"
            className="block min-h-12 w-full rounded-xl border-2 border-line bg-white pl-11 pr-3 focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <label className="text-sm font-semibold">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as EventType | "")} className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 font-normal">
              <option value="">Tous</option>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((k) => (
                <option key={k} value={k}>
                  {EVENT_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Période
            <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 font-normal">
              <option value="">Toutes les dates</option>
              <option value="month">± 1 mois</option>
              <option value="3months">± 3 mois</option>
              <option value="year">± 1 an</option>
            </select>
          </label>
        </div>
      </div>

      <div role="tablist" aria-label="Statut des événements" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="liste"
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex min-h-12 items-center gap-2 whitespace-nowrap border-b-4 px-4 font-semibold ${tab === t.id ? "border-brand-700 text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${tab === t.id ? "bg-brand-700 text-white" : "bg-line text-ink"}`}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div id="liste" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
        {list.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center text-muted">
            {query || type || period ? "Aucun événement ne correspond à votre recherche." : TABS.find((t) => t.id === tab)!.empty}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((e) => (
              <li key={e.id} className="shape flex flex-col bg-white p-5 shadow-[0_1px_2px_rgba(16,66,63,.06)] ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">{EVENT_TYPE_LABELS[e.type as EventType] ?? e.type}</span>
                  <span className="rounded-full bg-canvas px-2.5 py-1 text-muted">{FORMAT_LABELS[e.format as EventFormat]?.split(" (")[0]}</span>
                  {e.isDemo && <span className="rounded-full bg-warn-50 px-2.5 py-1 text-warn">Démo</span>}
                  {e.status === "draft" && <span className="rounded-full bg-line px-2.5 py-1 text-ink">Brouillon</span>}
                  {e.status === "cancelled" && <span className="rounded-full bg-danger-50 px-2.5 py-1 text-danger">Annulé</span>}
                </div>
                <h2 className="mt-3 text-lg font-bold leading-snug">
                  <Link href={`/admin/evenements/${e.id}`} className="hover:underline">
                    {e.title}
                  </Link>
                </h2>
                <p className="mt-1 flex items-center gap-2 text-muted">
                  <IconCalendar className="size-4" />
                  {e.firstDate
                    ? e.sessionCount > 1
                      ? `${e.sessionCount} séances · ${formatShortDate(e.firstDate)}${e.nextDate && e.nextDate !== e.firstDate && tab === "upcoming" ? ` · prochaine : ${formatShortDate(e.nextDate)}` : ""}`
                      : capitalize(formatShortDate(e.firstDate))
                    : "Pas encore de date"}
                </p>
                {e.status !== "draft" && (
                  <p className="mt-1 text-sm text-muted">
                    {e.views} ouverture{e.views > 1 ? "s" : ""} · {e.clicks} clic{e.clicks > 1 ? "s" : ""} sur un calendrier
                  </p>
                )}
                {e.syncIssues > 0 && (
                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-danger">
                    <IconWarn className="size-4" /> {e.syncIssues} calendrier(s) connecté(s) non mis à jour
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/admin/evenements/${e.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800">
                    Modifier
                  </Link>
                  {(e.status === "published" || e.status === "cancelled") && (
                    <Link href={`/admin/evenements/${e.id}/partager`} className="inline-flex min-h-11 items-center rounded-xl border-2 border-brand-700 px-4 font-semibold text-brand-800 hover:bg-brand-50">
                      Partager
                    </Link>
                  )}
                  <button type="button" disabled={!!busy} onClick={() => action(e, "duplicate")} className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50">
                    {busy === e.id + "duplicate" ? "Duplication…" : "Dupliquer"}
                  </button>
                  {e.status === "archived" ? (
                    <button type="button" disabled={!!busy} onClick={() => action(e, "unarchive")} className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-brand-800 hover:bg-brand-50">
                      Restaurer
                    </button>
                  ) : (
                    <button type="button" disabled={!!busy} onClick={() => action(e, "archive")} className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-muted hover:bg-canvas">
                      Archiver
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div aria-live="polite" className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        {toast && (
          <div className="animate-rise flex items-center gap-4 rounded-2xl bg-ink px-5 py-3 text-white shadow-lg">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className="font-semibold text-brand-light underline"
                onClick={() => {
                  toast.undo!();
                  setToast(null);
                }}
              >
                Annuler
              </button>
            )}
            <button type="button" className="text-sm opacity-80" onClick={() => setToast(null)} aria-label="Fermer le message">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
