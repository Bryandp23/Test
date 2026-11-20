"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, Check, CircleAlert, Copy, Loader2, MoreHorizontal, MoveRight, Plus, RotateCcw, Trash2, X, ClipboardCopy } from "lucide-react";
import { useStudio, tagById } from "@/lib/client/store";
import { archivePub, confirmDeletePub, duplicatePub, loadDetail, movePub, patchPub, setTagsOp } from "@/lib/client/ops";
import { DIMENSIONS, SESSION_KIND, type PublicationDetail, type PublicationSummary, type TagDimension } from "@/lib/domain";
import { MediaSection, LinksSection } from "./MediaSection";
import { DiffusionControl, ProductionControl } from "./DiffusionSection";
import { Activity } from "./Activity";
import { Button, cx, Field, IconButton, Input, Menu, MenuCheckbox, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Select, Textarea } from "@/components/ui/primitives";
import { Swatch, TagChip } from "@/components/ui/badges";
import { fmtDM, fmtShort } from "@/lib/time";

// --- Suivi d'enregistrement -----------------------------------------------------

type SaveState = { status: "idle" | "saving" | "saved" | "error"; retry?: () => void };

function useSaver(id: string) {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const pending = useRef(0);
  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      pending.current++;
      setState({ status: "saving" });
      const ok = await patchPub(id, patch);
      pending.current--;
      if (!ok) setState({ status: "error", retry: () => void save(patch) });
      else if (pending.current === 0) setState({ status: "saved" });
      return ok;
    },
    [id],
  );
  return { state, save };
}

function SaveIndicator({ s }: { s: SaveState }) {
  if (s.status === "idle") return null;
  if (s.status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-faint" aria-live="polite">
        <Loader2 className="size-3 animate-spin" /> Enregistrement…
      </span>
    );
  if (s.status === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-faint" aria-live="polite">
        <Check className="size-3 text-accent" /> Enregistré
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-danger" role="alert">
      <CircleAlert className="size-3" /> Non enregistré
      {s.retry && (
        <button onClick={s.retry} className="ml-1 inline-flex items-center gap-0.5 underline">
          <RotateCcw className="size-3" /> Réessayer
        </button>
      )}
    </span>
  );
}

/** Champ texte enregistré automatiquement (pause de saisie ou sortie du champ). */
function AutoText({
  id,
  value,
  field,
  save,
  multiline,
  className,
  placeholder,
  rows,
  label,
  maxLength,
  required,
}: {
  id: string;
  value: string;
  field: string;
  save: (p: Record<string, unknown>) => Promise<boolean>;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  rows?: number;
  label: string;
  maxLength?: number;
  required?: boolean;
}) {
  const [v, setV] = useState(value);
  const last = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ id, v });
  latest.current = { id, v };
  useEffect(() => {
    setV(value);
    last.current = value;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const cur = latest.current.v;
    if (cur === last.current) return;
    if (required && !cur.trim()) return;
    last.current = cur;
    void save({ [field]: cur });
  }, [field, save, required]);
  useEffect(() => () => flush(), [flush]);
  const onChange = (nv: string) => {
    setV(nv);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };
  const common = { value: v, placeholder, "aria-label": label, maxLength, onBlur: flush };
  return multiline ? (
    <Textarea {...common} rows={rows ?? 4} onChange={(e) => onChange(e.target.value)} className={className} />
  ) : (
    <Input {...common} onChange={(e) => onChange(e.target.value)} className={className} />
  );
}

/** Titre : zone de texte qui s'agrandit, sans bordure. */
function TitleField({ d, save }: { d: PublicationDetail | PublicationSummary; save: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [v, setV] = useState(d.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(d.title), [d.id, d.title]);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [v]);
  const commit = () => {
    const t = v.trim();
    if (!t) setV(d.title);
    else if (t !== d.title) void save({ title: t });
  };
  return (
    <textarea
      ref={ref}
      id="panel-title"
      value={v}
      rows={1}
      maxLength={200}
      aria-label="Titre de la publication"
      onChange={(e) => setV(e.target.value.replace(/\n/g, " "))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="w-full resize-none overflow-hidden bg-transparent text-[18px] leading-snug font-semibold tracking-tight outline-none"
    />
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-2xs font-medium tracking-wide text-faint uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function TagSelect({ dim, value, onChange, label }: { dim: TagDimension; value: string | null; onChange: (v: string | null) => void; label: string }) {
  const tags = useStudio((s) => s.tags);
  const list = tags.filter((t) => t.dimension === dim);
  const cur = tagById(tags, value);
  return (
    <Field label={label}>
      <div className="relative">
        {cur && <Swatch color={cur.color} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />}
        <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cx(cur && "pl-6")}>
          <option value="">—</option>
          {list.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}

function FreeTags({ d }: { d: PublicationSummary }) {
  const tags = useStudio((s) => s.tags);
  const free = tags.filter((t) => t.dimension === "libre");
  const selected = free.filter((t) => d.tag_ids.includes(t.id));
  const toggle = (id: string, on: boolean) => setTagsOp(d.id, on ? [...d.tag_ids, id] : d.tag_ids.filter((x) => x !== id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((t) => (
        <TagChip key={t.id} tag={t} onRemove={() => toggle(t.id, false)} />
      ))}
      <Menu>
        <MenuTrigger asChild>
          <button className="inline-flex h-[22px] items-center gap-1 rounded-md border border-dashed border-line px-1.5 text-[11.5px] text-faint hover:border-faint hover:text-fg">
            <Plus className="size-3" /> Tag
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="max-h-[50vh] overflow-y-auto">
          {free.length === 0 && <div className="px-2 py-1.5 text-[12px] text-faint">Créez vos tags dans Paramètres.</div>}
          {free.map((t) => (
            <MenuCheckbox key={t.id} checked={d.tag_ids.includes(t.id)} onCheckedChange={(v) => toggle(t.id, v)} swatch={<Swatch color={t.color} />}>
              {t.label}
            </MenuCheckbox>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}

function Placement({ d }: { d: PublicationSummary }) {
  const cycles = useStudio((s) => s.cycles);
  const sessions = useStudio((s) => s.sessions);
  const own = sessions.filter((s) => s.cycle_id === d.cycle_id).sort((a, b) => a.position - b.position);
  const sorted = [...cycles].sort((a, b) => a.position - b.position);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Cycle ou projet">
        <Select value={d.cycle_id} onChange={(e) => movePub(d.id, e.target.value, null)}>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status === "archive" ? " (archivé)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Session">
        <Select value={d.session_id ?? ""} onChange={(e) => movePub(d.id, d.cycle_id, e.target.value || null)}>
          <option value="">Contenus généraux</option>
          {own.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
              {s.date ? ` — ${fmtDM(s.date)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function BodyField({ d, save }: { d: PublicationDetail; save: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [copied, setCopied] = useState(false);
  const pub = useStudio((s) => s.pubs.find((p) => p.id === d.id));
  const channel = useStudio((s) => tagById(s.tags, pub?.channel_tag_id));
  const len = (pub?.body ?? d.body).length;
  const limit = channel?.label.toLowerCase().includes("linkedin") ? 3000 : channel?.label.toLowerCase().includes("instagram") ? 2200 : null;
  return (
    <Section
      title="Texte de publication"
      aside={
        <div className="flex items-center gap-2">
          <span className={cx("tabular text-2xs", limit && len > limit ? "text-danger" : "text-faint")}>
            {len.toLocaleString("fr-BE")}
            {limit ? ` / ${limit.toLocaleString("fr-BE")}` : ""} car.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const text = useStudio.getState().pubs.find((p) => p.id === d.id)?.body ?? d.body;
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                useStudio.getState().toast({ kind: "error", message: "Copie impossible : autorisez l'accès au presse-papiers." });
              }
            }}
          >
            {copied ? <Check className="size-3.5 text-accent" /> : <ClipboardCopy className="size-3.5" />}
            {copied ? "Copié" : "Copier"}
          </Button>
        </div>
      }
    >
      <AutoText id={d.id} value={d.body} field="body" save={save} multiline rows={8} label="Texte de publication" placeholder="Rédigez le texte qui accompagnera la publication…" className="min-h-[160px] resize-y" />
    </Section>
  );
}

// --- Panneau --------------------------------------------------------------------

export function PublicationPanel() {
  const selectedId = useStudio((s) => s.selectedId);
  const summary = useStudio((s) => s.pubs.find((p) => p.id === s.selectedId));
  const detail = useStudio((s) => (s.selectedId ? s.details[s.selectedId] : undefined));
  const select = useStudio((s) => s.select);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    setLoadError(false);
    loadDetail(selectedId).then((d) => !d && setLoadError(true));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement;
      if (t.closest("[role=dialog],[role=menu]") && !t.closest("#publication-panel")) return;
      if (t.matches("input,textarea,select")) {
        t.blur();
        return;
      }
      select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  // Rendre le focus à la carte à la fermeture.
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId) lastId.current = selectedId;
    else if (lastId.current) {
      document.querySelector<HTMLElement>(`[data-pub-id="${lastId.current}"]`)?.focus();
      lastId.current = null;
    }
  }, [selectedId]);

  return (
    <AnimatePresence>
      {selectedId && summary && (
        <motion.aside
          key="panel"
          id="publication-panel"
          role="complementary"
          aria-label={`Publication : ${summary.title}`}
          initial={{ x: 32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0, transition: { duration: 0.14 } }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-40 flex flex-col border-line bg-surface shadow-2xl shadow-black/50 md:inset-y-0 md:right-0 md:left-auto md:w-[min(600px,calc(100vw-260px))] md:border-l"
        >
          <PanelBody key={selectedId} summary={summary} detail={detail} loadError={loadError} onRetry={() => loadDetail(selectedId).then((d) => setLoadError(!d))} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PanelBody({ summary, detail, loadError, onRetry }: { summary: PublicationSummary; detail?: PublicationDetail; loadError: boolean; onRetry: () => void }) {
  const { state, save } = useSaver(summary.id);
  const select = useStudio((s) => s.select);
  const open = useStudio((s) => s.openDialog);
  const cycle = useStudio((s) => s.cycles.find((c) => c.id === summary.cycle_id));
  const session = useStudio((s) => s.sessions.find((x) => x.id === summary.session_id));
  // Valeurs courantes (store) pour les champs à sélection.
  const d = detail ? { ...detail, ...summary } : undefined;
  const dimLabel = useMemo(() => Object.fromEntries(DIMENSIONS.map((x) => [x.id, x.label])), []);

  return (
    <>
      <header className="shrink-0 border-b border-line-soft px-5 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <nav aria-label="Emplacement" className="min-w-0 flex-1 truncate text-[12px] text-faint">
            <span className="text-muted">{cycle?.name}</span>
            <span className="mx-1.5">›</span>
            <span>{session ? `${session.title}${session.date ? ` · ${fmtDM(session.date)}` : ""}` : "Contenus généraux"}</span>
          </nav>
          <SaveIndicator s={state} />
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Actions">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<MoveRight />} onSelect={() => open({ kind: "move", publicationId: summary.id })}>
                Déplacer vers…
              </MenuItem>
              <MenuItem icon={<Copy />} onSelect={() => duplicatePub(summary.id)}>
                Dupliquer (variante indépendante)
              </MenuItem>
              <MenuItem icon={summary.archived ? <ArchiveRestore /> : <Archive />} onSelect={() => archivePub(summary.id, !summary.archived)}>
                {summary.archived ? "Désarchiver" : "Archiver"}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onSelect={() => confirmDeletePub(summary.id)}>
                Supprimer…
              </MenuItem>
            </MenuContent>
          </Menu>
          <IconButton label="Fermer le panneau (Échap)" onClick={() => select(null)}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="mt-1.5">
          <TitleField d={summary} save={save} />
        </div>
        {summary.archived && <p className="mt-1 text-2xs text-warn">Publication archivée : masquée du board tant que les éléments archivés ne sont pas affichés.</p>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!d ? (
          loadError ? (
            <div className="p-6 text-center">
              <p className="text-muted">Impossible de charger le détail de la publication.</p>
              <Button className="mt-3" size="sm" onClick={onRetry}>
                <RotateCcw className="size-3.5" /> Réessayer
              </Button>
            </div>
          ) : (
            <div className="space-y-4 p-5" aria-busy="true" aria-label="Chargement">
              <div className="skeleton h-56 rounded-lg" />
              <div className="skeleton h-8 w-2/3 rounded" />
              <div className="skeleton h-28 rounded" />
            </div>
          )
        ) : (
          <>
            <MediaSection d={d} />
            <Section title="Statut">
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 text-[12px] text-muted">Production</div>
                  <ProductionControl d={d} />
                </div>
                <div>
                  <div className="mb-1.5 text-[12px] text-muted">Diffusion</div>
                  <DiffusionControl key={`${d.id}-${d.diffusion_status}`} d={d} />
                </div>
              </div>
            </Section>
            <BodyField d={d} save={save} />
            <Section title="Planification">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date cible de diffusion" hint={session?.date ? `Session le ${fmtShort(session.date)}` : undefined}>
                  <Input type="date" value={d.target_date ?? ""} onChange={(e) => save({ target_date: e.target.value || null })} />
                </Field>
                <Field label="Heure cible">
                  <Input type="time" value={d.target_time ?? ""} disabled={!d.target_date} onChange={(e) => save({ target_time: e.target.value || null })} />
                </Field>
              </div>
              {d.diffusion_status === "programme" && (
                <p className="mt-2 text-2xs text-faint">Modifier la date cible ne change pas la programmation confirmée, ni la programmation réelle sur la plateforme externe.</p>
              )}
            </Section>
            <Section title="Emplacement">
              <Placement d={d} />
            </Section>
            <Section title="Classification">
              <div className="grid grid-cols-2 gap-3">
                <TagSelect dim="canal" label={dimLabel.canal} value={d.channel_tag_id} onChange={(v) => save({ channel_tag_id: v })} />
                <TagSelect dim="format" label={dimLabel.format} value={d.format_tag_id} onChange={(v) => save({ format_tag_id: v })} />
                <TagSelect dim="public" label={dimLabel.public} value={d.audience_tag_id} onChange={(v) => save({ audience_tag_id: v })} />
                <TagSelect dim="nature" label={dimLabel.nature} value={d.nature_tag_id} onChange={(v) => save({ nature_tag_id: v })} />
              </div>
              <div className="mt-3">
                <div className="mb-1.5 text-2xs font-medium text-muted">Tags libres</div>
                <FreeTags d={d} />
              </div>
            </Section>
            <Section title="Liens">
              <LinksSection d={d} />
            </Section>
            <Section title="Description et notes">
              <div className="space-y-3">
                <Field label="Description interne">
                  <AutoText id={d.id} value={d.description} field="description" save={save} multiline rows={2} label="Description" placeholder="Objectif, angle, brief…" maxLength={5000} />
                </Field>
                <Field label="Notes">
                  <AutoText id={d.id} value={d.notes} field="notes" save={save} multiline rows={3} label="Notes" placeholder="Idées, retours, points d'attention…" maxLength={20000} />
                </Field>
              </div>
            </Section>
            <Section title="Historique">
              <Activity d={d} />
              {session && <p className="mt-3 text-2xs text-faint">{SESSION_KIND[session.kind]} rattachée : {session.title}</p>}
            </Section>
          </>
        )}
      </div>
    </>
  );
}
