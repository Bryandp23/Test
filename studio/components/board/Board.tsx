"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Layers, FolderPlus, SearchX, Sparkles, Loader2 } from "lucide-react";
import { useStudio } from "@/lib/client/store";
import { cycleVisible, hasActiveFilters, makeContext, matchesPublication } from "@/lib/filter";
import type { PublicationSummary } from "@/lib/domain";
import { movePub, reorderCyclesOp, refreshBoard } from "@/lib/client/ops";
import { CardGhost, type Density } from "./PubCard";
import { CycleBlock, rowKey, parseRowKey } from "./CycleBlock";
import { Button } from "@/components/ui/primitives";
import { createDemoData } from "@/app/actions/demo";

export const LABEL_W: Record<Density, number> = { compact: 248, confortable: 288 };

export function Board() {
  const cycles = useStudio((s) => s.cycles);
  const sessions = useStudio((s) => s.sessions);
  const pubs = useStudio((s) => s.pubs);
  const tags = useStudio((s) => s.tags);
  const filters = useStudio((s) => s.filters);
  const density: Density = useStudio((s) => s.prefs.density ?? "confortable");
  const collapsed = useStudio((s) => s.prefs.collapsed);
  const resetFilters = useStudio((s) => s.resetFilters);

  const ctx = useMemo(() => makeContext(cycles, sessions, tags), [cycles, sessions, tags]);
  const filtering = hasActiveFilters(filters);

  // Lignes calculées : clé (cycle|session) → identifiants des publications visibles, triées.
  const { rows, counts, visibleCycles, byId } = useMemo(() => {
    const rows: Record<string, string[]> = {};
    const counts: Record<string, number> = {};
    const byId = new Map<string, PublicationSummary>();
    const sorted = [...pubs].sort((a, b) => a.position - b.position);
    for (const p of sorted) {
      byId.set(p.id, p);
      if (!matchesPublication(p, filters, ctx)) continue;
      const k = rowKey(p.cycle_id, p.session_id);
      (rows[k] ??= []).push(p.id);
      counts[p.cycle_id] = (counts[p.cycle_id] ?? 0) + 1;
    }
    const visibleCycles = [...cycles].sort((a, b) => a.position - b.position).filter((c) => cycleVisible(c, filters, counts[c.id] ?? 0, ctx));
    return { rows, counts, visibleCycles, byId };
  }, [pubs, cycles, filters, ctx]);

  // --- Glisser-déposer --------------------------------------------------------
  const [dragRows, setDragRows] = useState<Record<string, string[]> | null>(null);
  const [active, setActive] = useState<{ type: "pub" | "cycle"; id: string } | null>(null);
  const originRow = useRef<string | null>(null);
  const liveRows = dragRows ?? rows;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 260, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const findRow = useCallback((id: string, r: Record<string, string[]>) => {
    if (id.includes("|")) return id;
    for (const k in r) if (r[k].includes(id)) return k;
    return null;
  }, []);

  const collision: CollisionDetection = useCallback(
    (args) => {
      const type = args.active.data.current?.type;
      const containers = args.droppableContainers.filter((c) => (type === "cycle" ? c.data.current?.type === "cycle" : c.data.current?.type !== "cycle"));
      const a = { ...args, droppableContainers: containers };
      if (type === "cycle") return closestCenter(a);
      const within = pointerWithin(a);
      if (within.length) {
        // Préfère une carte à la ligne qui la contient.
        const card = within.find((c) => !String(c.id).includes("|"));
        return card ? [card] : within;
      }
      return rectIntersection(a);
    },
    [],
  );

  function onDragStart(e: DragStartEvent) {
    const type = e.active.data.current?.type as "pub" | "cycle";
    setActive({ type, id: String(e.active.id) });
    if (type === "pub") {
      const copy: Record<string, string[]> = {};
      for (const k in rows) copy[k] = [...rows[k]];
      setDragRows(copy);
      originRow.current = findRow(String(e.active.id), rows);
    }
  }

  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over || a.data.current?.type !== "pub" || !dragRows) return;
    const id = String(a.id);
    const from = findRow(id, dragRows);
    const to = findRow(String(over.id), dragRows);
    if (!from || !to || from === to) return;
    setDragRows((r) => {
      if (!r) return r;
      const next = { ...r, [from]: r[from].filter((x) => x !== id), [to]: [...(r[to] ?? [])] };
      const overIdx = next[to].indexOf(String(over.id));
      next[to].splice(overIdx === -1 ? next[to].length : overIdx, 0, id);
      return next;
    });
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    const type = a.data.current?.type;
    setActive(null);
    if (type === "cycle") {
      if (over && a.id !== over.id) {
        const ids = [...cycles].sort((x, y) => x.position - y.position).map((c) => `cycle:${c.id}`);
        const moved = arrayMove(ids, ids.indexOf(String(a.id)), ids.indexOf(String(over.id)));
        void reorderCyclesOp(moved.map((x) => x.slice(6)));
      }
      return;
    }
    const r = dragRows;
    setDragRows(null);
    if (!over || !r) return;
    const id = String(a.id);
    const to = findRow(id, r);
    if (!to) return;
    let visible = r[to];
    const overId = String(over.id);
    if (!overId.includes("|") && visible.includes(overId) && overId !== id) {
      visible = arrayMove(visible, visible.indexOf(id), visible.indexOf(overId));
    }
    if (to === originRow.current && visible.join() === rows[to]?.join()) return;
    const { cycleId, sessionId } = parseRowKey(to);
    // Les publications masquées par les filtres gardent leur place relative.
    const full = pubs
      .filter((p) => p.cycle_id === cycleId && p.session_id === sessionId && p.id !== id)
      .sort((x, y) => x.position - y.position)
      .map((p) => p.id);
    const i = visible.indexOf(id);
    const prev = visible[i - 1];
    const next = visible[i + 1];
    let at = full.length;
    if (prev && full.includes(prev)) at = full.indexOf(prev) + 1;
    else if (next && full.includes(next)) at = full.indexOf(next);
    else if (!prev) at = 0;
    full.splice(at, 0, id);
    void movePub(id, cycleId, sessionId, full);
  }

  const activePub = active?.type === "pub" ? byId.get(active.id) : undefined;
  const collapsedSet = useMemo(() => new Set(collapsed ?? []), [collapsed]);

  if (!cycles.length) return <EmptyBoard />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        setDragRows(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Espace pour saisir la carte, flèches pour la déplacer, Espace pour la déposer, Échap pour annuler. Entrée ouvre la publication.",
        },
      }}
    >
      <div className="absolute inset-0 overflow-auto overscroll-contain" id="board-scroller">
        <div className="pb-28 md:min-w-max">
          {filtering && visibleCycles.length === 0 ? (
            <div className="mx-auto mt-24 max-w-sm px-4 text-center">
              <SearchX className="mx-auto size-6 text-faint" />
              <p className="mt-3 font-medium">Aucun résultat</p>
              <p className="mt-1 text-muted">Aucune publication ne correspond à cette combinaison de recherche et de filtres.</p>
              <Button className="mt-4" onClick={resetFilters}>
                Effacer les filtres
              </Button>
            </div>
          ) : (
            <SortableContext items={visibleCycles.map((c) => `cycle:${c.id}`)} strategy={verticalListSortingStrategy}>
              {visibleCycles.map((c) => (
                <CycleBlock
                  key={c.id}
                  cycle={c}
                  sessions={sessions}
                  rows={liveRows}
                  byId={byId}
                  tags={tags}
                  density={density}
                  collapsed={collapsedSet.has(c.id)}
                  filtering={filtering}
                  matchCount={counts[c.id] ?? 0}
                  dragDisabled={active?.type === "cycle"}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activePub ? <CardGhost p={activePub} channel={tags.find((t) => t.id === activePub.channel_tag_id)} density={density} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function EmptyBoard() {
  const open = useStudio((s) => s.openDialog);
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="max-w-md">
        <div className="mb-5 flex gap-1.5" aria-hidden>
          <span className="h-10 w-16 rounded-md border border-line bg-surface" />
          <span className="h-10 w-10 rounded-md border border-accent/40 bg-accent/10" />
          <span className="h-10 w-24 rounded-md border border-line bg-surface" />
        </div>
        <h2 className="text-[17px] font-semibold tracking-tight">Votre board est vide</h2>
        <p className="mt-1.5 text-muted">
          Créez un cycle (par exemple « Humains.ia ») avec ses sessions : chaque session devient une ligne où déposer vos visuels, vidéos et textes. Pour une
          communication ponctuelle, créez un projet sans sessions.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => open({ kind: "cycle" })}>
            <Layers className="size-4" /> Créer un cycle
          </Button>
          <Button onClick={() => open({ kind: "cycle", projet: true })}>
            <FolderPlus className="size-4" /> Créer un projet
          </Button>
          <Button
            variant="ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const r = await createDemoData();
              if (r.ok) await refreshBoard();
              else useStudio.getState().toast({ kind: "error", message: r.error });
              setLoading(false);
            }}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Charger un exemple
          </Button>
        </div>
        <p className="mt-3 text-2xs text-faint">L'exemple crée deux cycles et un projet marqués « Exemple », supprimables à tout moment.</p>
      </div>
    </div>
  );
}
