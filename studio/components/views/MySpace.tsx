"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Info } from "lucide-react";
import { useStudio, tagById } from "@/lib/client/store";
import { effectiveDate, makeContext, matchesPublication } from "@/lib/filter";
import { cardStage, type PublicationSummary } from "@/lib/domain";
import { addDays, fmtDM, fmtLong, fmtPeriod, fmtShort, todayBrussels } from "@/lib/time";
import { ChannelLabel, StageBadge, CycleStatusDot } from "@/components/ui/badges";
import { CoverArt, DateChip } from "@/components/board/PubCard";
import { cx } from "@/components/ui/primitives";

function Row({ p }: { p: PublicationSummary }) {
  const select = useStudio((s) => s.select);
  const tags = useStudio((s) => s.tags);
  const cycle = useStudio((s) => s.cycles.find((c) => c.id === p.cycle_id));
  const session = useStudio((s) => s.sessions.find((x) => x.id === p.session_id));
  return (
    <li>
      <button onClick={() => select(p.id)} data-pub-id={p.id} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-md border border-line-soft bg-bg">
          <CoverArt p={p} density="compact" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-fg">{p.title}</span>
          <span className="block truncate text-[11.5px] text-faint">
            {cycle?.name}
            {session ? ` › ${session.title}` : ""}
          </span>
        </span>
        <span className="hidden w-28 shrink-0 sm:block">
          <ChannelLabel tag={tagById(tags, p.channel_tag_id)} className="text-[12px]" />
        </span>
        <span className="hidden shrink-0 md:block">
          <StageBadge stage={cardStage(p)} size="sm" />
        </span>
        <span className="w-20 shrink-0 text-right">
          <DateChip p={p} />
        </span>
      </button>
    </li>
  );
}

function Block({ title, hint, items, empty, tone }: { title: string; hint?: string; items: PublicationSummary[]; empty: string; tone?: "danger" | "warn" }) {
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-2">
        <h2 className={cx("text-[13px] font-semibold tracking-tight", tone === "danger" && items.length ? "text-danger" : "")}>
          {title}
          <span className="tabular ml-2 font-normal text-faint">{items.length}</span>
        </h2>
        {hint && <span className="text-2xs text-faint">{hint}</span>}
      </div>
      {items.length ? (
        <ul className="divide-y divide-line-soft">{items.slice(0, 12).map((p) => <Row key={p.id} p={p} />)}</ul>
      ) : (
        <p className="px-2 py-3 text-[12.5px] text-faint">{empty}</p>
      )}
      {items.length > 12 && <p className="px-2 pt-1 text-2xs text-faint">+ {items.length - 12} autres (utilisez les filtres du board)</p>}
    </section>
  );
}

export function MySpace() {
  const pubs = useStudio((s) => s.pubs);
  const cycles = useStudio((s) => s.cycles);
  const sessions = useStudio((s) => s.sessions);
  const tags = useStudio((s) => s.tags);
  const filters = useStudio((s) => s.filters);
  const today = todayBrussels();

  const data = useMemo(() => {
    const ctx = makeContext(cycles, sessions, tags);
    const activeCycles = new Set(cycles.filter((c) => c.status !== "archive").map((c) => c.id));
    const list = pubs.filter((p) => !p.archived && activeCycles.has(p.cycle_id) && matchesPublication(p, filters, ctx));
    const byDate = (a: PublicationSummary, b: PublicationSummary) => (effectiveDate(a) ?? "9999").localeCompare(effectiveDate(b) ?? "9999");
    const open = (p: PublicationSummary) => p.diffusion_status !== "publie" && p.diffusion_status !== "annule";
    const todayList = list.filter((p) => open(p) && effectiveDate(p) === today).sort(byDate);
    const late = list
      .filter((p) => {
        const d = effectiveDate(p);
        return d && d < today && open(p);
      })
      .sort(byDate);
    const toSchedule = list.filter((p) => p.production_status === "pret" && p.diffusion_status === "a_programmer" && !(effectiveDate(p) && effectiveDate(p)! < today)).sort(byDate);
    const inProgress = list.filter((p) => p.production_status === "en_cours" && open(p)).sort(byDate);
    const soonToCreate = list
      .filter((p) => (p.production_status === "a_creer" || p.production_status === "idee") && open(p) && effectiveDate(p) && effectiveDate(p)! >= today && effectiveDate(p)! <= addDays(today, 21))
      .sort(byDate);
    const events = sessions
      .filter((s) => s.date && s.date >= today && s.date <= addDays(today, 30) && activeCycles.has(s.cycle_id))
      .sort((a, b) => a.date!.localeCompare(b.date!) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    const nextCycles = cycles.filter((c) => c.status === "a_venir" || (c.start_date && c.start_date >= today && c.status !== "archive")).sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"));
    return { todayList, late, toSchedule, inProgress, soonToCreate, events, nextCycles };
  }, [pubs, cycles, sessions, tags, filters, today]);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-24 md:px-8">
        <p className="text-[12px] text-faint capitalize">{fmtLong(today)}</p>
        <h1 className="mt-0.5 text-[20px] font-semibold tracking-tight">
          {data.todayList.length
            ? `${data.todayList.length} publication${data.todayList.length > 1 ? "s" : ""} prévue${data.todayList.length > 1 ? "s" : ""} aujourd'hui`
            : "Rien de prévu aujourd'hui"}
          {data.late.length > 0 && <span className="text-danger"> · {data.late.length} en retard</span>}
        </h1>

        <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-8">
            <Block title="Aujourd'hui" items={data.todayList} empty="Aucune publication prévue aujourd'hui." />
            {data.late.length > 0 && <Block title="En retard" hint="Date passée, ni publiée ni annulée" items={data.late} empty="" tone="danger" />}
            <Block title="À programmer" hint="Prêtes, programmation non confirmée" items={data.toSchedule} empty="Aucune création prête en attente de programmation." />
            <Block title="Créations en cours" items={data.inProgress} empty="Aucune création en cours." />
            <Block title="À créer dans les 3 semaines" items={data.soonToCreate} empty="Rien à lancer dans les trois prochaines semaines." />
          </div>
          <aside className="min-w-0 space-y-8">
            <section>
              <h2 className="mb-2 px-2 text-[13px] font-semibold tracking-tight">Prochains événements</h2>
              {data.events.length ? (
                <ul className="space-y-0.5">
                  {data.events.slice(0, 10).map((s) => {
                    const c = cycles.find((x) => x.id === s.cycle_id);
                    return (
                      <li key={s.id} className="flex items-start gap-3 rounded-md px-2 py-2">
                        <span className="tabular w-11 shrink-0 text-[12px] text-muted">{fmtDM(s.date)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[13px]">
                            {s.kind === "info" ? <Info className="size-3.5 text-faint" /> : <CalendarDays className="size-3.5 text-faint" />}
                            <span className="truncate">{s.title}</span>
                          </span>
                          <span className="block truncate text-[11.5px] text-faint">
                            {c?.name}
                            {s.start_time ? ` · ${s.start_time.replace(":", "h")}` : ""}
                            {s.date === today ? " · aujourd'hui" : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-2 text-[12.5px] text-faint">Aucune session dans les 30 prochains jours.</p>
              )}
            </section>
            <section>
              <h2 className="mb-2 px-2 text-[13px] font-semibold tracking-tight">Prochains cycles</h2>
              {data.nextCycles.length ? (
                <ul className="space-y-0.5">
                  {data.nextCycles.slice(0, 8).map((c) => (
                    <li key={c.id} className="rounded-md px-2 py-2">
                      <div className="flex items-center gap-2 text-[13px]">
                        <CycleStatusDot status={c.status} />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="pl-[15px] text-[11.5px] text-faint">
                        {fmtPeriod(c.start_date, c.end_date)} · {pubs.filter((p) => p.cycle_id === c.id && !p.archived).length} publication(s)
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 text-[12.5px] text-faint">Aucun cycle à venir.</p>
              )}
            </section>
            <Link href="/board" className="inline-flex items-center gap-1.5 px-2 text-[12.5px] text-accent hover:underline">
              Ouvrir le board <ArrowRight className="size-3.5" />
            </Link>
            <p className="px-2 text-2xs text-faint">Dates à {fmtShort(today)}, fuseau Europe/Bruxelles. Les filtres actifs s'appliquent aussi ici.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
