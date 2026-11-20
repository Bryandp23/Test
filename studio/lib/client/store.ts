"use client";
import { create } from "zustand";
import {
  EMPTY_FILTERS,
  type BoardData,
  type Cycle,
  type Filters,
  type Prefs,
  type PublicationDetail,
  type PublicationSummary,
  type SavedView,
  type Session,
  type Tag,
} from "@/lib/domain";

export interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  message: string;
  action?: { label: string; run: () => void };
}

export interface UploadJob {
  id: string; // attachmentId une fois préparé, sinon id local
  publicationId: string;
  name: string;
  size: number;
  progress: number; // 0..1
  state: "preparing" | "uploading" | "finishing" | "done" | "error";
  error?: string;
  retry?: () => void;
}

export type DialogState =
  | { kind: "cycle"; cycleId?: string; projet?: boolean }
  | { kind: "session"; cycleId?: string; sessionId?: string }
  | { kind: "publication"; cycleId?: string; sessionId?: string | null }
  | { kind: "drop"; cycleId: string; sessionId: string | null; files: File[] }
  | { kind: "move"; publicationId: string }
  | { kind: "confirm"; title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void> }
  | { kind: "dateImpact"; sessionTitle: string; delta: number; items: { id: string; title: string; target_date: string; diffusion_status: string }[] }
  | null;

interface State {
  ready: boolean;
  user: { email: string };
  mode: "supabase" | "local";
  loadedAt: number;
  cycles: Cycle[];
  sessions: Session[];
  pubs: PublicationSummary[];
  tags: Tag[];
  savedViews: SavedView[];
  prefs: Prefs;
  filters: Filters;
  selectedId: string | null;
  details: Record<string, PublicationDetail>;
  uploads: UploadJob[];
  toasts: Toast[];
  dialog: DialogState;
  sidebarMobileOpen: boolean;

  hydrate(d: BoardData): void;
  set(p: Partial<State>): void;
  setFilters(p: Partial<Filters>): void;
  resetFilters(): void;
  select(id: string | null): void;
  upsertPub(p: PublicationSummary): void;
  removePub(id: string): void;
  setDetail(d: PublicationDetail): void;
  upsertCycle(c: Cycle): void;
  upsertSession(s: Session): void;
  upsertTag(t: Tag): void;
  toast(t: Omit<Toast, "id">): void;
  dismissToast(id: number): void;
  upsertUpload(j: Partial<UploadJob> & { id: string }): void;
  openDialog(d: DialogState): void;
}

let toastSeq = 1;

export const useStudio = create<State>((set, get) => ({
  ready: false,
  user: { email: "" },
  mode: "local",
  loadedAt: 0,
  cycles: [],
  sessions: [],
  pubs: [],
  tags: [],
  savedViews: [],
  prefs: {},
  filters: EMPTY_FILTERS,
  selectedId: null,
  details: {},
  uploads: [],
  toasts: [],
  dialog: null,
  sidebarMobileOpen: false,

  hydrate: (d) =>
    set({
      ready: true,
      user: d.user,
      mode: d.mode,
      loadedAt: d.loadedAt,
      cycles: d.cycles,
      sessions: d.sessions,
      pubs: d.publications,
      tags: d.tags,
      savedViews: d.savedViews,
      prefs: { ...readLocalPrefs(), ...d.prefs },
    }),
  set: (p) => set(p),
  setFilters: (p) => set({ filters: { ...get().filters, ...p } }),
  resetFilters: () => set({ filters: { ...EMPTY_FILTERS, showArchived: get().filters.showArchived } }),
  select: (id) => set({ selectedId: id }),
  upsertPub: (p) =>
    set((s) => {
      const i = s.pubs.findIndex((x) => x.id === p.id);
      const pubs = i === -1 ? [...s.pubs, p] : s.pubs.map((x) => (x.id === p.id ? p : x));
      const d = s.details[p.id];
      return { pubs, details: d ? { ...s.details, [p.id]: { ...d, ...p } } : s.details };
    }),
  removePub: (id) =>
    set((s) => {
      const details = { ...s.details };
      delete details[id];
      return { pubs: s.pubs.filter((p) => p.id !== id), details, selectedId: s.selectedId === id ? null : s.selectedId };
    }),
  setDetail: (d) =>
    set((s) => {
      // Garde la vue d'ensemble synchronisée avec le détail.
      const { description: _d, scheduled_platform: _s, published_url: _u, notes: _n, created_at: _c, attachments: _a, links: _l, activity: _ac, ...summary } = d;
      void _d; void _s; void _u; void _n; void _c; void _a; void _l; void _ac;
      const exists = s.pubs.some((p) => p.id === d.id);
      return {
        details: { ...s.details, [d.id]: d },
        pubs: exists ? s.pubs.map((p) => (p.id === d.id ? (summary as PublicationSummary) : p)) : s.pubs,
      };
    }),
  upsertCycle: (c) =>
    set((s) => ({ cycles: s.cycles.some((x) => x.id === c.id) ? s.cycles.map((x) => (x.id === c.id ? c : x)) : [c, ...s.cycles] })),
  upsertSession: (sn) =>
    set((s) => ({
      sessions: (s.sessions.some((x) => x.id === sn.id) ? s.sessions.map((x) => (x.id === sn.id ? sn : x)) : [...s.sessions, sn]).sort(
        (a, b) => a.position - b.position,
      ),
    })),
  upsertTag: (t) => set((s) => ({ tags: s.tags.some((x) => x.id === t.id) ? s.tags.map((x) => (x.id === t.id ? t : x)) : [...s.tags, t] })),
  toast: (t) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), t.kind === "error" ? 8000 : t.action ? 7000 : 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  upsertUpload: (j) =>
    set((s) => {
      const i = s.uploads.findIndex((u) => u.id === j.id);
      if (i === -1) return { uploads: [...s.uploads, j as UploadJob] };
      const uploads = [...s.uploads];
      uploads[i] = { ...uploads[i], ...j };
      return { uploads };
    }),
  openDialog: (d) => set({ dialog: d }),
}));

// Préférences : enregistrées en base (multi-appareils) + copie locale pour un affichage immédiat.
const LS_KEY = "studio.prefs";
export function readLocalPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function writeLocalPrefs(p: Prefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* navigation privée */
  }
}

export const tagById = (tags: Tag[], id: string | null | undefined) => (id ? tags.find((t) => t.id === id) : undefined);
