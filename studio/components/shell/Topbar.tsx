"use client";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Bookmark, CalendarRange, FolderPlus, ListFilter, Menu as MenuIcon, Plus, Rows3, Rows2, Search, X, FileText, Layers, Trash2, Check } from "lucide-react";
import { useStudio } from "@/lib/client/store";
import { deleteViewOp, saveViewOp, updatePrefs } from "@/lib/client/ops";
import { hasActiveFilters } from "@/lib/filter";
import { DIFFUSION, EMPTY_FILTERS, PRODUCTION, type Filters, type TagDimension, cardStage } from "@/lib/domain";
import { Button, cx, IconButton, Input, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { StageIcon, Swatch } from "@/components/ui/badges";
import { NAV } from "./Sidebar";
import { fmtShort } from "@/lib/time";

export function Topbar() {
  const path = usePathname();
  const title = NAV.find((n) => path.startsWith(n.href))?.label ?? "";
  const filters = useStudio((s) => s.filters);
  const setFilters = useStudio((s) => s.setFilters);
  const set = useStudio((s) => s.set);
  const density = useStudio((s) => s.prefs.density ?? "confortable");
  const filterable = path.startsWith("/board") || path.startsWith("/espace") || path.startsWith("/mediatheque");

  return (
    <header className="shrink-0 border-b border-line-soft bg-bg">
      <div className="flex h-12 items-center gap-2 px-3 md:px-4">
        <IconButton label="Ouvrir la navigation" className="md:hidden" onClick={() => set({ sidebarMobileOpen: true })}>
          <MenuIcon className="size-4" />
        </IconButton>
        <h1 className="mr-2 hidden shrink-0 text-[13px] font-semibold tracking-tight sm:block">{title}</h1>

        <div className="relative max-w-[420px] min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            id="global-search"
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Rechercher cycles, sessions, publications, textes…"
            aria-label="Recherche globale"
            className="h-8 bg-surface pr-12 pl-8"
            onKeyDown={(e) => e.key === "Escape" && setFilters({ q: "" })}
          />
          <span className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 sm:block">
            <Kbd>⌘K</Kbd>
          </span>
        </div>

        {filterable && <FilterPopover />}
        {filterable && <ViewsMenu />}

        <div className="ml-auto flex items-center gap-1">
          {path.startsWith("/board") && (
            <div className="mr-1 hidden items-center rounded-md border border-line p-0.5 md:flex" role="group" aria-label="Densité d'affichage">
              <button
                aria-pressed={density === "compact"}
                onClick={() => updatePrefs({ density: "compact" })}
                title="Compact"
                className={cx("inline-flex size-6 items-center justify-center rounded", density === "compact" ? "bg-raised text-fg" : "text-faint hover:text-fg")}
              >
                <Rows3 className="size-3.5" />
                <span className="sr-only">Compact</span>
              </button>
              <button
                aria-pressed={density === "confortable"}
                onClick={() => updatePrefs({ density: "confortable" })}
                title="Confortable"
                className={cx("inline-flex size-6 items-center justify-center rounded", density === "confortable" ? "bg-raised text-fg" : "text-faint hover:text-fg")}
              >
                <Rows2 className="size-3.5" />
                <span className="sr-only">Confortable</span>
              </button>
            </div>
          )}
          <CreateMenu />
        </div>
      </div>
      {filterable && hasActiveFilters(filters) && <ActiveFilters />}
    </header>
  );
}

function CreateMenu() {
  const open = useStudio((s) => s.openDialog);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="primary" size="md" className="pr-2.5 pl-2">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Créer</span>
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<FileText />} onSelect={() => open({ kind: "publication" })} shortcut="P">
          Publication
        </MenuItem>
        <MenuItem icon={<Layers />} onSelect={() => open({ kind: "cycle" })}>
          Cycle avec sessions
        </MenuItem>
        <MenuItem icon={<CalendarRange />} onSelect={() => open({ kind: "session" })}>
          Session dans un cycle
        </MenuItem>
        <MenuItem icon={<FolderPlus />} onSelect={() => open({ kind: "cycle", projet: true })}>
          Projet ponctuel (sans sessions)
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors",
        on ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:border-faint hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

const TAG_FILTER: { dim: TagDimension; key: keyof Filters; label: string }[] = [
  { dim: "canal", key: "channelIds", label: "Canal" },
  { dim: "public", key: "audienceIds", label: "Public" },
  { dim: "nature", key: "natureIds", label: "Nature" },
  { dim: "libre", key: "tagIds", label: "Tags" },
];

function FilterPopover() {
  const f = useStudio((s) => s.filters);
  const setFilters = useStudio((s) => s.setFilters);
  const tags = useStudio((s) => s.tags);
  const cycles = useStudio((s) => s.cycles);
  const count =
    f.cycleIds.length + f.channelIds.length + f.audienceIds.length + f.natureIds.length + f.tagIds.length + f.production.length + f.diffusion.length + (f.from || f.to ? 1 : 0);
  const sortedCycles = useMemo(() => [...cycles].filter((c) => c.status !== "archive" || f.showArchived).sort((a, b) => a.position - b.position), [cycles, f.showArchived]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={count ? "secondary" : "ghost"} className={cx(count > 0 && "border-accent/50")}>
          <ListFilter className="size-4" />
          <span className="hidden lg:inline">Filtres</span>
          {count > 0 && <span className="tabular rounded bg-accent/20 px-1 text-[11px] text-accent">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[75vh] w-[min(560px,calc(100vw-24px))] overflow-y-auto p-4">
        <div className="space-y-4">
          {TAG_FILTER.map(({ dim, key, label }) => {
            const list = tags.filter((t) => t.dimension === dim);
            if (!list.length) return null;
            const sel = f[key] as string[];
            return (
              <section key={dim}>
                <h3 className="mb-1.5 text-2xs font-medium tracking-wide text-faint uppercase">{label}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((t) => (
                    <Chip key={t.id} on={sel.includes(t.id)} onClick={() => setFilters({ [key]: toggle(sel, t.id) } as Partial<Filters>)}>
                      <Swatch color={t.color} />
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </section>
            );
          })}
          <section>
            <h3 className="mb-1.5 text-2xs font-medium tracking-wide text-faint uppercase">Production</h3>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCTION.map((p) => (
                <Chip key={p.id} on={f.production.includes(p.id)} onClick={() => setFilters({ production: toggle(f.production, p.id) })}>
                  <StageIcon stage={p.id} className="size-3.5" />
                  {p.label}
                </Chip>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-1.5 text-2xs font-medium tracking-wide text-faint uppercase">Diffusion</h3>
            <div className="flex flex-wrap gap-1.5">
              {DIFFUSION.map((d) => (
                <Chip key={d.id} on={f.diffusion.includes(d.id)} onClick={() => setFilters({ diffusion: toggle(f.diffusion, d.id) })}>
                  <StageIcon stage={cardStage({ production_status: "pret", diffusion_status: d.id })} className="size-3.5" />
                  {d.label}
                </Chip>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-1.5 text-2xs font-medium tracking-wide text-faint uppercase">Période (date cible, programmée ou publiée)</h3>
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="Du" value={f.from ?? ""} onChange={(e) => setFilters({ from: e.target.value || null })} className="w-auto" />
              <span className="text-faint">→</span>
              <Input type="date" aria-label="Au" value={f.to ?? ""} onChange={(e) => setFilters({ to: e.target.value || null })} className="w-auto" />
            </div>
          </section>
          {sortedCycles.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-2xs font-medium tracking-wide text-faint uppercase">Cycles et projets</h3>
              <div className="flex flex-wrap gap-1.5">
                {sortedCycles.map((c) => (
                  <Chip key={c.id} on={f.cycleIds.includes(c.id)} onClick={() => setFilters({ cycleIds: toggle(f.cycleIds, c.id) })}>
                    {c.name}
                  </Chip>
                ))}
              </div>
            </section>
          )}
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={f.showArchived} onChange={(e) => setFilters({ showArchived: e.target.checked })} className="accent-[var(--color-accent)]" />
            Afficher les éléments archivés
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ViewsMenu() {
  const views = useStudio((s) => s.savedViews);
  const filters = useStudio((s) => s.filters);
  const set = useStudio((s) => s.set);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  return (
    <Menu onOpenChange={(o) => !o && setNaming(false)}>
      <MenuTrigger asChild>
        <Button variant="ghost" aria-label="Vues enregistrées">
          <Bookmark className="size-4" />
          <span className="hidden lg:inline">Vues</span>
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-[260px]">
        <MenuLabel>Vues enregistrées</MenuLabel>
        {views.length === 0 && <div className="px-2 pb-2 text-[12px] text-faint">Combinez des filtres puis enregistrez-les ici.</div>}
        {views.map((v) => (
          <div key={v.id} className="group flex items-center">
            <div className="flex-1">
              <MenuItem icon={<Bookmark />} onSelect={() => set({ filters: { ...EMPTY_FILTERS, ...v.filters } })}>
                {v.name}
              </MenuItem>
            </div>
            <button aria-label={`Supprimer la vue ${v.name}`} onClick={() => deleteViewOp(v.id)} className="mr-1 hidden size-6 items-center justify-center rounded text-faint group-hover:flex hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <MenuSeparator />
        {naming ? (
          <form
            className="flex items-center gap-1 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void saveViewOp(name.trim(), filters);
              setNaming(false);
              setName("");
            }}
          >
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la vue" onKeyDown={(e) => e.stopPropagation()} className="h-7" />
            <IconButton label="Enregistrer" size="sm" type="submit">
              <Check className="size-4" />
            </IconButton>
          </form>
        ) : (
          <MenuItem icon={<Plus />} disabled={!hasActiveFilters(filters)} onSelect={() => setTimeout(() => setNaming(true), 0)}>
            Enregistrer les filtres actuels
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}

function ActiveFilters() {
  const f = useStudio((s) => s.filters);
  const setFilters = useStudio((s) => s.setFilters);
  const reset = useStudio((s) => s.resetFilters);
  const tags = useStudio((s) => s.tags);
  const cycles = useStudio((s) => s.cycles);
  const chips: { key: string; label: React.ReactNode; remove: () => void }[] = [];
  if (f.q.trim()) chips.push({ key: "q", label: `« ${f.q.trim()} »`, remove: () => setFilters({ q: "" }) });
  for (const { key } of TAG_FILTER) {
    for (const id of f[key] as string[]) {
      const t = tags.find((x) => x.id === id);
      if (t)
        chips.push({
          key: id,
          label: (
            <>
              <Swatch color={t.color} /> {t.label}
            </>
          ),
          remove: () => setFilters({ [key]: (f[key] as string[]).filter((x) => x !== id) } as Partial<Filters>),
        });
    }
  }
  for (const id of f.cycleIds) chips.push({ key: id, label: cycles.find((c) => c.id === id)?.name ?? "Cycle", remove: () => setFilters({ cycleIds: f.cycleIds.filter((x) => x !== id) }) });
  for (const p of f.production) chips.push({ key: p, label: PRODUCTION.find((x) => x.id === p)!.label, remove: () => setFilters({ production: f.production.filter((x) => x !== p) }) });
  for (const d of f.diffusion) chips.push({ key: d, label: DIFFUSION.find((x) => x.id === d)!.label, remove: () => setFilters({ diffusion: f.diffusion.filter((x) => x !== d) }) });
  if (f.from || f.to) chips.push({ key: "date", label: `${f.from ? fmtShort(f.from) : "…"} → ${f.to ? fmtShort(f.to) : "…"}`, remove: () => setFilters({ from: null, to: null }) });
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-t border-line-soft px-3 py-1.5 md:px-4" aria-label="Filtres actifs">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-raised pr-1 pl-2 text-[12px] text-fg">
          {c.label}
          <button aria-label="Retirer ce filtre" onClick={c.remove} className="inline-flex size-4 items-center justify-center rounded text-faint hover:text-fg">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button onClick={reset} className="ml-1 shrink-0 text-[12px] text-faint hover:text-fg">
        Tout effacer
      </button>
    </div>
  );
}
