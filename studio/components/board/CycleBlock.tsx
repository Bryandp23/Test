"use client";
import { memo, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Copy,
  GripVertical,
  Info,
  ListOrdered,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  CalendarPlus,
  FolderOpen,
  ArchiveRestore,
} from "lucide-react";
import type { Cycle, PublicationSummary, Session, Tag } from "@/lib/domain";
import { useStudio } from "@/lib/client/store";
import { confirmDeleteCycle, confirmDeleteSession, createPub, duplicateCycleOp, moveCycle, moveSession, sortChronoOp, toggleCollapsed, updateCycleOp } from "@/lib/client/ops";
import { fmtDM, fmtPeriod, todayBrussels } from "@/lib/time";
import { effectiveDate } from "@/lib/filter";
import { CycleStatusDot, Swatch } from "@/components/ui/badges";
import { cx, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/primitives";
import { PubCard, CARD_W, THUMB_H, type Density } from "./PubCard";
import { LABEL_W } from "./Board";

export const rowKey = (cycleId: string, sessionId: string | null) => `${cycleId}|${sessionId ?? "g"}`;
export function parseRowKey(k: string) {
  const [cycleId, s] = k.split("|");
  return { cycleId, sessionId: s === "g" ? null : s };
}

interface Props {
  cycle: Cycle;
  sessions: Session[];
  rows: Record<string, string[]>;
  byId: Map<string, PublicationSummary>;
  tags: Tag[];
  density: Density;
  collapsed: boolean;
  filtering: boolean;
  matchCount: number;
  dragDisabled: boolean;
}

export const CycleBlock = memo(function CycleBlock({ cycle, sessions, rows, byId, tags, density, collapsed, filtering, matchCount, dragDisabled }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `cycle:${cycle.id}`,
    data: { type: "cycle" },
  });
  const own = useMemo(() => sessions.filter((s) => s.cycle_id === cycle.id).sort((a, b) => a.position - b.position), [sessions, cycle.id]);
  const generalKey = rowKey(cycle.id, null);
  // En filtrant, seules les lignes contenant des résultats restent affichées.
  const visibleSessions = filtering ? own.filter((s) => (rows[rowKey(cycle.id, s.id)]?.length ?? 0) > 0) : own;
  const showGeneral = !filtering || (rows[generalKey]?.length ?? 0) > 0;
  const allPubs = useMemo(() => [...byId.values()].filter((p) => p.cycle_id === cycle.id && !p.archived), [byId, cycle.id]);

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx("border-b border-line-soft", isDragging && "relative z-20 opacity-80 shadow-2xl shadow-black/50")}
      aria-label={`${cycle.kind === "projet" ? "Projet" : "Cycle"} ${cycle.name}`}
    >
      <CycleHeader
        cycle={cycle}
        tags={tags}
        density={density}
        collapsed={collapsed}
        pubs={allPubs}
        matchCount={matchCount}
        filtering={filtering}
        sessionCount={own.length}
        handle={
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Réordonner ${cycle.name}`}
            className="hidden size-5 cursor-grab items-center justify-center rounded text-faint opacity-0 group-hover/head:opacity-100 hover:text-fg focus-visible:opacity-100 md:inline-flex"
          >
            <GripVertical className="size-3.5" />
          </button>
        }
      />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden md:overflow-visible"
          >
            {showGeneral && (
              <BoardRow cycle={cycle} session={null} ids={rows[generalKey] ?? []} byId={byId} tags={tags} density={density} dragDisabled={dragDisabled} />
            )}
            {visibleSessions.map((s, i) => (
              <BoardRow
                key={s.id}
                cycle={cycle}
                session={s}
                ids={rows[rowKey(cycle.id, s.id)] ?? []}
                byId={byId}
                tags={tags}
                density={density}
                dragDisabled={dragDisabled}
                isFirst={i === 0}
                isLast={i === visibleSessions.length - 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});

function CycleHeader({
  cycle,
  tags,
  density,
  collapsed,
  pubs,
  matchCount,
  filtering,
  sessionCount,
  handle,
}: {
  cycle: Cycle;
  tags: Tag[];
  density: Density;
  collapsed: boolean;
  pubs: PublicationSummary[];
  matchCount: number;
  filtering: boolean;
  sessionCount: number;
  handle: React.ReactNode;
}) {
  const open = useStudio((s) => s.openDialog);
  const audience = tags.find((t) => t.id === cycle.audience_tag_id);
  const today = todayBrussels();
  const stats = useMemo(() => {
    let ready = 0, scheduled = 0, published = 0, late = 0, todo = 0;
    for (const p of pubs) {
      if (p.diffusion_status === "publie") published++;
      else if (p.diffusion_status === "programme") scheduled++;
      else if (p.diffusion_status === "a_programmer" && p.production_status === "pret") ready++;
      else if (p.diffusion_status === "a_programmer") todo++;
      const d = effectiveDate(p);
      if (d && d < today && (p.diffusion_status === "a_programmer" || p.diffusion_status === "programme")) late++;
    }
    return { ready, scheduled, published, late, todo };
  }, [pubs, today]);
  const total = pubs.length;

  return (
    <div className="group/head flex flex-col bg-bg md:flex-row">
      <div
        className="sticky left-0 z-[5] flex shrink-0 items-start bg-bg py-3 pr-2 pl-2 md:w-[var(--lw)] md:border-r md:border-line-soft"
        style={{ ["--lw" as string]: `${LABEL_W[density]}px` }}
      >
        <div className="flex w-full min-w-0 items-start gap-1.5">
          <button
            onClick={() => toggleCollapsed(cycle.id)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Déplier ${cycle.name}` : `Réduire ${cycle.name}`}
            className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded text-muted hover:bg-raised hover:text-fg"
          >
            <ChevronRight className={cx("size-4 transition-transform duration-200", !collapsed && "rotate-90")} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[13.5px] font-semibold tracking-tight text-fg" title={cycle.name}>
                {cycle.name}
              </h2>
              {cycle.kind === "projet" && <span className="shrink-0 rounded border border-line px-1 text-[10px] text-faint">Projet</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
              <CycleStatusDot status={cycle.status} withLabel />
              {audience && (
                <span className="inline-flex items-center gap-1">
                  <Swatch color={audience.color} /> {audience.label}
                </span>
              )}
              <span className="tabular text-faint">{fmtPeriod(cycle.start_date, cycle.end_date, today)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            {handle}
            <CycleMenu cycle={cycle} />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 text-[11.5px] whitespace-nowrap text-faint md:flex-nowrap md:py-3 md:pl-4">
        <span className="tabular text-muted">
          {filtering ? `${matchCount} / ${total}` : total} publication{total > 1 ? "s" : ""}
        </span>
        {cycle.kind === "cycle" && <span className="tabular">{sessionCount} session{sessionCount > 1 ? "s" : ""}</span>}
        {stats.todo > 0 && <span className="tabular">{stats.todo} en production</span>}
        {stats.ready > 0 && <span className="tabular text-[var(--color-s-a_programmer)]">{stats.ready} à programmer</span>}
        {stats.scheduled > 0 && <span className="tabular text-[var(--color-s-programme)]">{stats.scheduled} programmée{stats.scheduled > 1 ? "s" : ""}</span>}
        {stats.published > 0 && <span className="tabular text-[var(--color-s-publie)]">{stats.published} publiée{stats.published > 1 ? "s" : ""}</span>}
        {stats.late > 0 && <span className="tabular text-danger">{stats.late} en retard</span>}
        {collapsed && cycle.kind === "cycle" && (
          <button onClick={() => open({ kind: "session", cycleId: cycle.id })} className="hidden hover:text-fg md:inline">
            + Session
          </button>
        )}
      </div>
    </div>
  );
}

function CycleMenu({ cycle }: { cycle: Cycle }) {
  const open = useStudio((s) => s.openDialog);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button aria-label={`Actions pour ${cycle.name}`} className="inline-flex size-6 items-center justify-center rounded text-faint hover:bg-raised hover:text-fg data-[state=open]:bg-raised">
          <MoreHorizontal className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuItem icon={<Pencil />} onSelect={() => open({ kind: "cycle", cycleId: cycle.id })}>
          Modifier {cycle.kind === "projet" ? "le projet" : "le cycle"}
        </MenuItem>
        <MenuItem icon={<CalendarPlus />} onSelect={() => open({ kind: "session", cycleId: cycle.id })}>
          Ajouter une session
        </MenuItem>
        <MenuItem icon={<Plus />} onSelect={() => open({ kind: "publication", cycleId: cycle.id, sessionId: null })}>
          Ajouter une publication
        </MenuItem>
        {cycle.kind === "cycle" && (
          <MenuItem icon={<ListOrdered />} onSelect={() => sortChronoOp(cycle.id)}>
            Trier les sessions par date
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<ArrowUp />} onSelect={() => moveCycle(cycle.id, -1)}>
          Monter dans le board
        </MenuItem>
        <MenuItem icon={<ArrowDown />} onSelect={() => moveCycle(cycle.id, 1)}>
          Descendre dans le board
        </MenuItem>
        <MenuItem icon={<Copy />} onSelect={() => duplicateCycleOp(cycle.id)}>
          Dupliquer la structure
        </MenuItem>
        {cycle.status === "archive" ? (
          <MenuItem icon={<ArchiveRestore />} onSelect={() => updateCycleOp(cycle.id, { status: "termine" })}>
            Désarchiver
          </MenuItem>
        ) : (
          <MenuItem
            icon={<Archive />}
            onSelect={async () => {
              const r = await updateCycleOp(cycle.id, { status: "archive" });
              if (r)
                useStudio.getState().toast({
                  kind: "info",
                  message: `« ${cycle.name} » archivé`,
                  action: { label: "Annuler", run: () => void updateCycleOp(cycle.id, { status: cycle.status }) },
                });
            }}
          >
            Archiver
          </MenuItem>
        )}
        <MenuItem icon={<Trash2 />} danger onSelect={() => confirmDeleteCycle(cycle.id)}>
          Supprimer…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function hasFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}

const BoardRow = memo(function BoardRow({
  cycle,
  session,
  ids,
  byId,
  tags,
  density,
  dragDisabled,
  isFirst,
  isLast,
}: {
  cycle: Cycle;
  session: Session | null;
  ids: string[];
  byId: Map<string, PublicationSummary>;
  tags: Tag[];
  density: Density;
  dragDisabled: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const key = rowKey(cycle.id, session?.id ?? null);
  const { setNodeRef, isOver } = useDroppable({ id: key, data: { type: "row" } });
  const [fileOver, setFileOver] = useState(false);
  const selectedId = useStudio((s) => s.selectedId);
  const open = useStudio((s) => s.openDialog);
  const channelOf = (id: string | null) => tags.find((t) => t.id === id);
  const label = session ? session.title : cycle.kind === "projet" ? "Contenus" : "Contenus généraux du cycle";
  const minH = THUMB_H[density] + (density === "compact" ? 78 : 92);

  return (
    <div
      className={cx("row-lazy group/row flex flex-col md:flex-row", fileOver && "bg-accent/[0.06]")}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!fileOver) setFileOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFileOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setFileOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) open({ kind: "drop", cycleId: cycle.id, sessionId: session?.id ?? null, files });
      }}
      data-row={key}
    >
      {/* Libellé de ligne, collant pendant le défilement horizontal */}
      <div className="sticky left-0 z-[4] shrink-0 bg-bg md:w-[var(--lw)] md:border-r md:border-line-soft" style={{ ["--lw" as string]: `${LABEL_W[density]}px` }}>
        <div className={cx("flex items-center gap-2 py-1.5 pr-2 pl-3 md:h-full md:items-start md:py-3 md:pl-9", fileOver && "bg-accent/[0.06]")}>
          <div className="flex w-full min-w-0 items-start gap-2">
            <span className="mt-[3px] text-faint" aria-hidden>
              {session ? session.kind === "info" ? <Info className="size-3.5" /> : <CalendarDays className="size-3.5" /> : <FolderOpen className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx("truncate text-[12.5px]", session ? "text-fg" : "text-muted")} title={label}>
                {label}
              </div>
              {session && (session.date || session.location) && (
                <div className="tabular mt-0.5 truncate text-[11px] text-faint">
                  {session.date ? fmtDM(session.date) : ""}
                  {session.start_time ? ` · ${session.start_time.replace(":", "h")}` : ""}
                  {session.location ? ` · ${session.location}` : ""}
                </div>
              )}
              {session && !session.date && <div className="mt-0.5 text-[11px] text-faint">Date à définir</div>}
            </div>
            <span className="tabular mt-px text-[11px] text-faint">{ids.length || ""}</span>
            {session && <SessionMenu cycle={cycle} session={session} isFirst={isFirst} isLast={isLast} />}
          </div>
        </div>
      </div>

      {/* Piste de cartes */}
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cx(
            "flex snap-x gap-2 overflow-x-auto px-3 pt-1 pb-3 md:snap-none md:overflow-visible md:py-2.5 md:pr-8 md:pl-4",
            isOver && "bg-accent/[0.05]",
          )}
          style={{ minHeight: ids.length ? minH : undefined }}
        >
          {ids.map((id) => {
            const p = byId.get(id);
            if (!p) return null;
            return <PubCard key={id} p={p} channel={channelOf(p.channel_tag_id)} density={density} selected={selectedId === id} dragDisabled={dragDisabled} />;
          })}
          <AddTile cycleId={cycle.id} sessionId={session?.id ?? null} density={density} empty={!ids.length} fileOver={fileOver} />
        </div>
      </SortableContext>
    </div>
  );
});

function SessionMenu({ cycle, session, isFirst, isLast }: { cycle: Cycle; session: Session; isFirst?: boolean; isLast?: boolean }) {
  const open = useStudio((s) => s.openDialog);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label={`Actions pour ${session.title}`}
          className="inline-flex size-5 items-center justify-center rounded text-faint opacity-0 group-hover/row:opacity-100 hover:bg-raised hover:text-fg focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuItem icon={<Pencil />} onSelect={() => open({ kind: "session", cycleId: cycle.id, sessionId: session.id })}>
          Modifier la session
        </MenuItem>
        <MenuItem icon={<Plus />} onSelect={() => open({ kind: "publication", cycleId: cycle.id, sessionId: session.id })}>
          Ajouter une publication
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<ArrowUp />} disabled={isFirst} onSelect={() => moveSession(cycle.id, session.id, -1)}>
          Monter
        </MenuItem>
        <MenuItem icon={<ArrowDown />} disabled={isLast} onSelect={() => moveSession(cycle.id, session.id, 1)}>
          Descendre
        </MenuItem>
        <MenuItem icon={<Trash2 />} danger onSelect={() => confirmDeleteSession(session.id)}>
          Supprimer la session…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Création rapide : un titre, Entrée, et la publication s'ouvre. Accepte aussi le dépôt de fichiers. */
function AddTile({ cycleId, sessionId, density, empty, fileOver }: { cycleId: string; sessionId: string | null; density: Density; empty: boolean; fileOver: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const w = CARD_W[density];
  if (editing) {
    return (
      <form
        className="flex shrink-0 flex-col gap-2 rounded-lg border border-accent/50 bg-surface p-2.5"
        style={{ width: w }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          const p = await createPub({ cycle_id: cycleId, session_id: sessionId, title: title.trim() });
          setBusy(false);
          if (p) {
            setTitle("");
            setEditing(false);
          }
        }}
      >
        <textarea
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => !title.trim() && setEditing(false)}
          placeholder="Titre de la publication"
          rows={3}
          aria-label="Titre de la nouvelle publication"
          className="w-full resize-none bg-transparent text-[12.5px] outline-none placeholder:text-faint"
        />
        <div className="flex items-center justify-between text-[11px] text-faint">
          <span>Entrée pour créer</span>
          <button type="submit" disabled={busy || !title.trim()} className="rounded bg-accent px-2 py-0.5 font-medium text-accent-ink disabled:opacity-40">
            Créer
          </button>
        </div>
      </form>
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={cx(
        "flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 text-[12px] transition-colors",
        empty ? "h-12 md:h-14" : "flex-col",
        fileOver ? "border-accent bg-accent/10 text-fg" : "border-line text-faint hover:border-faint hover:text-muted",
        !empty && "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 max-md:opacity-100",
      )}
      style={{ width: empty ? Math.max(w * 1.6, 300) : 120 }}
    >
      {fileOver ? <Upload className="size-4" /> : <Plus className="size-4" />}
      {fileOver ? "Déposer pour créer une publication" : empty ? "Ajouter une publication ou déposer des fichiers" : "Ajouter"}
    </button>
  );
}
