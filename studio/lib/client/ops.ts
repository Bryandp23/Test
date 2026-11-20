"use client";
// Opérations côté client : mise à jour optimiste du store, appel de l'action serveur,
// retour à l'état précédent et message clair en cas d'erreur, « Annuler » quand c'est utile.
import { useStudio } from "./store";
import type { Result } from "@/lib/server/action";
import type { Filters, Prefs, PublicationSummary, TagColor, TagDimension } from "@/lib/domain";
import { loadBoardAction, savePrefs, createSavedView, deleteSavedView } from "@/app/actions/board";
import {
  createPublication,
  deletePublication,
  duplicatePublication,
  getPublication,
  movePublication,
  setArchived,
  setDiffusion,
  setPublicationTags,
  updatePublication,
  addLink,
  deleteLink,
} from "@/app/actions/publications";
import { createCycle, deleteCycle, duplicateCycle, reorderCycles, updateCycle } from "@/app/actions/cycles";
import { createSession, deleteSession, reorderSessions, shiftTargetDates, sortSessionsChrono, updateSession } from "@/app/actions/sessions";
import { createTag, deleteTag, updateTag } from "@/app/actions/tags";
import { deleteAttachment, reorderAttachments } from "@/app/actions/files";

const S = () => useStudio.getState();

function fail(r: { ok: false; error: string; code?: string }) {
  if (r.code === "UNAUTHENTICATED") {
    S().toast({ kind: "error", message: r.error, action: { label: "Se reconnecter", run: () => (window.location.href = "/login") } });
  } else S().toast({ kind: "error", message: r.error });
}

async function call<T>(p: Promise<Result<T>>): Promise<T | null> {
  try {
    const r = await p;
    if (!r.ok) {
      fail(r);
      return null;
    }
    return r.data;
  } catch {
    S().toast({ kind: "error", message: "Connexion au serveur impossible. Vérifiez votre réseau puis réessayez." });
    return null;
  }
}

export async function refreshBoard() {
  const d = await call(loadBoardAction());
  if (d) S().hydrate(d);
  return Boolean(d);
}

// --- Préférences --------------------------------------------------------------

let prefTimer: ReturnType<typeof setTimeout> | undefined;
let pendingPrefs: Prefs = {};
export function updatePrefs(p: Prefs) {
  const next = { ...S().prefs, ...p };
  S().set({ prefs: next });
  try {
    localStorage.setItem("studio.prefs", JSON.stringify(next));
  } catch {
    /* ignoré */
  }
  pendingPrefs = { ...pendingPrefs, ...p };
  clearTimeout(prefTimer);
  prefTimer = setTimeout(() => {
    const send = pendingPrefs;
    pendingPrefs = {};
    void savePrefs(send);
  }, 600);
}

export function toggleCollapsed(cycleId: string) {
  const cur = new Set(S().prefs.collapsed ?? []);
  if (cur.has(cycleId)) cur.delete(cycleId);
  else cur.add(cycleId);
  updatePrefs({ collapsed: [...cur] });
}

// --- Publications ---------------------------------------------------------------

export async function createPub(input: { cycle_id: string; session_id: string | null; title: string; production_status?: string; channel_tag_id?: string | null; target_date?: string | null }, open = true) {
  const p = await call(createPublication(input));
  if (p) {
    S().upsertPub(p);
    if (open) S().select(p.id);
  }
  return p;
}

export async function loadDetail(id: string) {
  const d = await call(getPublication(id));
  if (d) S().setDetail(d);
  return d;
}

/** Modification d'un ou plusieurs champs. Renvoie true si l'enregistrement a réussi. */
export async function patchPub(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const before = S().pubs.find((p) => p.id === id);
  if (before) S().upsertPub({ ...before, ...(patch as Partial<PublicationSummary>) });
  const r = await call(updatePublication(id, patch));
  if (!r) {
    if (before) S().upsertPub(before);
    return false;
  }
  S().upsertPub(r);
  const det = S().details[id];
  if (det) {
    S().setDetail({ ...det, ...r, ...(patch as object) });
    // Rafraîchit l'historique après un changement journalisé.
    if (["production_status", "target_date", "title"].some((k) => k in patch)) void loadDetail(id);
  }
  return true;
}

export async function setDiffusionOp(id: string, input: Record<string, unknown>) {
  const d = await call(setDiffusion(id, input));
  if (d) S().setDetail(d);
  return Boolean(d);
}

export async function setTagsOp(id: string, tagIds: string[]) {
  const before = S().pubs.find((p) => p.id === id);
  if (before) S().upsertPub({ ...before, tag_ids: tagIds });
  const r = await call(setPublicationTags(id, tagIds));
  if (r) S().upsertPub(r);
  else if (before) S().upsertPub(before);
}

/** Ordre actuel d'une ligne (cycle, session). */
export function rowIds(cycleId: string, sessionId: string | null, exclude?: string): string[] {
  return S()
    .pubs.filter((p) => p.cycle_id === cycleId && p.session_id === sessionId && p.id !== exclude)
    .sort((a, b) => a.position - b.position)
    .map((p) => p.id);
}

function applyLocalOrder(order: string[], cycleId: string, sessionId: string | null) {
  const pos = new Map(order.map((id, i) => [id, i + 1]));
  useStudio.setState((s) => ({
    pubs: s.pubs.map((p) => (pos.has(p.id) ? { ...p, cycle_id: cycleId, session_id: sessionId, position: pos.get(p.id)! } : p)),
  }));
}

export function placeLabel(cycleId: string, sessionId: string | null) {
  const c = S().cycles.find((x) => x.id === cycleId);
  const s = sessionId ? S().sessions.find((x) => x.id === sessionId) : null;
  return s ? `${c?.name ?? ""} › ${s.title}` : `${c?.name ?? ""} › Contenus généraux`;
}

/** Déplace / réordonne une publication. `order` : ordre complet souhaité pour la ligne cible. */
export async function movePub(id: string, cycleId: string, sessionId: string | null, order?: string[], opts: { undoable?: boolean } = {}) {
  const before = S().pubs.find((p) => p.id === id);
  if (!before) return false;
  const fromOrder = rowIds(before.cycle_id, before.session_id);
  const target = order ?? [...rowIds(cycleId, sessionId, id), id];
  const snapshot = S().pubs;
  applyLocalOrder(target, cycleId, sessionId);
  const r = await call(movePublication(id, { cycle_id: cycleId, session_id: sessionId, order: target }));
  if (!r) {
    useStudio.setState({ pubs: snapshot });
    return false;
  }
  S().upsertPub(r);
  const changedRow = before.cycle_id !== cycleId || before.session_id !== sessionId;
  if (changedRow && opts.undoable !== false) {
    S().toast({
      kind: "success",
      message: `Déplacé vers ${placeLabel(cycleId, sessionId)}`,
      action: { label: "Annuler", run: () => void movePub(id, before.cycle_id, before.session_id, fromOrder, { undoable: false }) },
    });
  }
  return true;
}

/** Alternative clavier : déplacer d'un cran à gauche / droite dans sa ligne. */
export async function nudgePub(id: string, dir: -1 | 1) {
  const p = S().pubs.find((x) => x.id === id);
  if (!p) return;
  const ids = rowIds(p.cycle_id, p.session_id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await movePub(id, p.cycle_id, p.session_id, ids);
}

export async function duplicatePub(id: string) {
  const r = await call(duplicatePublication(id));
  if (!r) return;
  S().upsertPub(r.publication);
  const pos = new Map(r.order.map((x, i) => [x, i + 1]));
  useStudio.setState((s) => ({ pubs: s.pubs.map((p) => (pos.has(p.id) ? { ...p, position: pos.get(p.id)! } : p)) }));
  S().toast({ kind: "success", message: "Copie indépendante créée", action: { label: "Ouvrir", run: () => S().select(r.publication.id) } });
}

export async function archivePub(id: string, archived: boolean) {
  const r = await call(setArchived(id, archived));
  if (!r) return;
  S().upsertPub(r);
  if (archived) {
    if (S().selectedId === id && !S().filters.showArchived) S().select(null);
    S().toast({ kind: "info", message: "Publication archivée", action: { label: "Annuler", run: () => void archivePub(id, false) } });
  }
}

export function confirmDeletePub(id: string) {
  const p = S().pubs.find((x) => x.id === id);
  S().openDialog({
    kind: "confirm",
    title: "Supprimer la publication ?",
    message: `« ${p?.title ?? ""} » et ses ${p?.attachment_count ?? 0} fichier(s) seront définitivement supprimés. Pour la masquer sans la perdre, archivez-la plutôt.`,
    confirmLabel: "Supprimer définitivement",
    danger: true,
    onConfirm: async () => {
      const r = await call(deletePublication(id));
      if (r) {
        S().removePub(id);
        S().toast({ kind: "info", message: "Publication supprimée" });
      }
    },
  });
}

export async function addLinkOp(pubId: string, input: { url: string; title: string; kind: string }) {
  const d = await call(addLink(pubId, input));
  if (d) S().setDetail(d);
  return Boolean(d);
}
export async function deleteLinkOp(linkId: string) {
  const d = await call(deleteLink(linkId));
  if (d) S().setDetail(d);
}

export async function deleteAttachmentOp(pubId: string, attId: string) {
  const det = S().details[pubId];
  if (det) S().setDetail({ ...det, attachments: det.attachments.filter((a) => a.id !== attId) });
  const r = await call(deleteAttachment(attId));
  if (r) S().upsertPub(r);
  else if (det) S().setDetail(det);
}

export async function reorderAttachmentsOp(pubId: string, ids: string[]) {
  const det = S().details[pubId];
  if (det) {
    const pos = new Map(ids.map((x, i) => [x, i + 1]));
    S().setDetail({ ...det, attachments: det.attachments.map((a) => ({ ...a, position: pos.get(a.id) ?? a.position })).sort((a, b) => a.position - b.position) });
  }
  const r = await call(reorderAttachments(pubId, ids));
  if (r) S().upsertPub(r);
  else if (det) S().setDetail(det);
}

// --- Cycles et sessions ---------------------------------------------------------

export async function createCycleOp(input: Record<string, unknown>) {
  const r = await call(createCycle(input));
  if (!r) return null;
  useStudio.setState((s) => ({ cycles: [r.cycle, ...s.cycles], sessions: [...s.sessions, ...r.sessions] }));
  S().toast({ kind: "success", message: `${r.cycle.kind === "projet" ? "Projet" : "Cycle"} « ${r.cycle.name} » créé` });
  return r.cycle;
}

export async function updateCycleOp(id: string, patch: Record<string, unknown>) {
  const r = await call(updateCycle(id, patch));
  if (r) S().upsertCycle(r);
  return r;
}

export async function reorderCyclesOp(ids: string[]) {
  const snapshot = S().cycles;
  const pos = new Map(ids.map((x, i) => [x, i + 1]));
  useStudio.setState((s) => ({ cycles: s.cycles.map((c) => ({ ...c, position: pos.get(c.id) ?? c.position })).sort((a, b) => a.position - b.position) }));
  const r = await call(reorderCycles(ids));
  if (!r) useStudio.setState({ cycles: snapshot });
}

export async function moveCycle(id: string, dir: -1 | 1) {
  const ids = [...S().cycles].sort((a, b) => a.position - b.position).map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await reorderCyclesOp(ids);
}

export async function duplicateCycleOp(id: string) {
  const r = await call(duplicateCycle(id));
  if (!r) return;
  const pos = new Map(r.order.map((x, i) => [x, i + 1]));
  useStudio.setState((s) => ({
    cycles: [...s.cycles, r.cycle].map((c) => ({ ...c, position: pos.get(c.id) ?? c.position })).sort((a, b) => a.position - b.position),
    sessions: [...s.sessions, ...r.sessions],
  }));
  S().toast({ kind: "success", message: "Structure du cycle dupliquée (sessions incluses, sans les publications)" });
}

export function confirmDeleteCycle(id: string) {
  const c = S().cycles.find((x) => x.id === id);
  const n = S().pubs.filter((p) => p.cycle_id === id).length;
  S().openDialog({
    kind: "confirm",
    title: `Supprimer « ${c?.name} » ?`,
    message: `Le cycle, ses sessions et ses ${n} publication(s) avec leurs fichiers seront définitivement supprimés. Pour le retirer du board sans rien perdre, archivez-le.`,
    confirmLabel: "Supprimer définitivement",
    danger: true,
    onConfirm: async () => {
      const r = await call(deleteCycle(id));
      if (r) {
        useStudio.setState((s) => ({
          cycles: s.cycles.filter((x) => x.id !== id),
          sessions: s.sessions.filter((x) => x.cycle_id !== id),
          pubs: s.pubs.filter((x) => x.cycle_id !== id),
          selectedId: s.pubs.find((p) => p.id === s.selectedId)?.cycle_id === id ? null : s.selectedId,
        }));
      }
    },
  });
}

export async function createSessionOp(cycleId: string, input: Record<string, unknown>) {
  const r = await call(createSession(cycleId, input));
  if (r) {
    S().upsertSession(r);
    const c = S().cycles.find((x) => x.id === cycleId);
    if (c?.kind === "projet") S().upsertCycle({ ...c, kind: "cycle" });
  }
  return r;
}

export async function updateSessionOp(id: string, patch: Record<string, unknown>) {
  const r = await call(updateSession(id, patch));
  if (!r) return null;
  S().upsertSession(r.session);
  if (r.impact.length) S().openDialog({ kind: "dateImpact", sessionTitle: r.session.title, delta: r.delta, items: r.impact });
  return r.session;
}

export async function shiftDatesOp(ids: string[], days: number) {
  const r = await call(shiftTargetDates(ids, days));
  if (!r) return;
  useStudio.setState((s) => ({ pubs: s.pubs.map((p) => ({ ...p, target_date: r.find((x) => x.id === p.id)?.target_date ?? p.target_date })) }));
  S().toast({ kind: "success", message: `${r.length} date(s) cible(s) recalculée(s)` });
}

export async function moveSession(cycleId: string, sessionId: string, dir: -1 | 1) {
  const ids = S().sessions.filter((s) => s.cycle_id === cycleId).sort((a, b) => a.position - b.position).map((s) => s.id);
  const i = ids.indexOf(sessionId);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const pos = new Map(ids.map((x, k) => [x, k + 1]));
  const snapshot = S().sessions;
  useStudio.setState((s) => ({ sessions: s.sessions.map((x) => ({ ...x, position: pos.get(x.id) ?? x.position })).sort((a, b) => a.position - b.position) }));
  if (!(await call(reorderSessions(cycleId, ids)))) useStudio.setState({ sessions: snapshot });
}

export async function sortChronoOp(cycleId: string) {
  const ids = await call(sortSessionsChrono(cycleId));
  if (!ids) return;
  const pos = new Map(ids.map((x, k) => [x, k + 1]));
  useStudio.setState((s) => ({ sessions: s.sessions.map((x) => ({ ...x, position: pos.get(x.id) ?? x.position })).sort((a, b) => a.position - b.position) }));
}

export function confirmDeleteSession(id: string) {
  const sn = S().sessions.find((x) => x.id === id);
  const n = S().pubs.filter((p) => p.session_id === id).length;
  S().openDialog({
    kind: "confirm",
    title: `Supprimer la session « ${sn?.title} » ?`,
    message: n ? `Ses ${n} publication(s) ne sont pas supprimées : elles rejoignent les contenus généraux du cycle.` : "Cette session ne contient aucune publication.",
    confirmLabel: "Supprimer la session",
    danger: true,
    onConfirm: async () => {
      const moved = await call(deleteSession(id));
      if (moved) {
        useStudio.setState((s) => ({
          sessions: s.sessions.filter((x) => x.id !== id),
          pubs: s.pubs.map((p) => (moved.includes(p.id) ? { ...p, session_id: null, position: p.position + 10000 } : p)),
        }));
      }
    },
  });
}

// --- Tags et vues ---------------------------------------------------------------

export async function createTagOp(dimension: TagDimension, label: string, color: TagColor) {
  const t = await call(createTag({ dimension, label, color }));
  if (t) S().upsertTag(t);
  return t;
}
export async function updateTagOp(id: string, patch: { label?: string; color?: TagColor }) {
  const t = await call(updateTag(id, patch));
  if (t) S().upsertTag(t);
  return t;
}
export async function deleteTagOp(id: string) {
  const ok = await call(deleteTag(id));
  if (!ok) return;
  useStudio.setState((s) => ({
    tags: s.tags.filter((t) => t.id !== id),
    pubs: s.pubs.map((p) => ({
      ...p,
      channel_tag_id: p.channel_tag_id === id ? null : p.channel_tag_id,
      audience_tag_id: p.audience_tag_id === id ? null : p.audience_tag_id,
      nature_tag_id: p.nature_tag_id === id ? null : p.nature_tag_id,
      format_tag_id: p.format_tag_id === id ? null : p.format_tag_id,
      tag_ids: p.tag_ids.filter((t) => t !== id),
    })),
    cycles: s.cycles.map((c) => (c.audience_tag_id === id ? { ...c, audience_tag_id: null } : c)),
  }));
}

export async function saveViewOp(name: string, filters: Filters) {
  const v = await call(createSavedView(name, filters));
  if (v) {
    useStudio.setState((s) => ({ savedViews: [...s.savedViews, v] }));
    S().toast({ kind: "success", message: `Vue « ${v.name} » enregistrée` });
  }
}
export async function deleteViewOp(id: string) {
  if (await call(deleteSavedView(id))) useStudio.setState((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id) }));
}
