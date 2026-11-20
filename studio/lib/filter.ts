// Recherche et filtres combinables (board, Mon espace, et prochainement calendrier / timeline).
import { cardStage, diffusionLabel, productionLabel, STAGE_LABEL, type Cycle, type Filters, type PublicationSummary, type Session, type Tag } from "./domain";
import { fmtLong, fmtShort, utcToBrussels } from "./time";

/** Date de référence d'une publication : publiée > programmée > cible. */
export function effectiveDate(p: Pick<PublicationSummary, "diffusion_status" | "published_at" | "scheduled_at" | "target_date">): string | null {
  if (p.diffusion_status === "publie" && p.published_at) return utcToBrussels(p.published_at).date;
  if (p.diffusion_status === "programme" && p.scheduled_at) return utcToBrussels(p.scheduled_at).date;
  return p.target_date;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export interface FilterContext {
  cycles: Map<string, Cycle>;
  sessions: Map<string, Session>;
  tags: Map<string, Tag>;
}

export function makeContext(cycles: Cycle[], sessions: Session[], tags: Tag[]): FilterContext {
  return {
    cycles: new Map(cycles.map((c) => [c.id, c])),
    sessions: new Map(sessions.map((s) => [s.id, s])),
    tags: new Map(tags.map((t) => [t.id, t])),
  };
}

export function hasActiveFilters(f: Filters): boolean {
  return Boolean(
    f.q.trim() ||
      f.cycleIds.length ||
      f.channelIds.length ||
      f.audienceIds.length ||
      f.natureIds.length ||
      f.tagIds.length ||
      f.production.length ||
      f.diffusion.length ||
      f.from ||
      f.to,
  );
}

function haystack(p: PublicationSummary, ctx: FilterContext): string {
  const c = ctx.cycles.get(p.cycle_id);
  const s = p.session_id ? ctx.sessions.get(p.session_id) : undefined;
  const tagLabels = [p.channel_tag_id, p.audience_tag_id, p.nature_tag_id, p.format_tag_id, ...p.tag_ids]
    .map((id) => (id ? ctx.tags.get(id)?.label : ""))
    .filter(Boolean);
  const d = effectiveDate(p);
  return normalize(
    [
      p.title,
      p.body,
      c?.name,
      s?.title,
      ...tagLabels,
      productionLabel(p.production_status),
      diffusionLabel(p.diffusion_status),
      STAGE_LABEL[cardStage(p)],
      d,
      d ? fmtShort(d) : "",
      d ? fmtLong(d) : "",
    ]
      .filter(Boolean)
      .join(" \u0001 "),
  );
}

const cache = new WeakMap<PublicationSummary, string>();

export function matchesPublication(p: PublicationSummary, f: Filters, ctx: FilterContext): boolean {
  if (!f.showArchived && p.archived) return false;
  if (f.cycleIds.length && !f.cycleIds.includes(p.cycle_id)) return false;
  if (f.channelIds.length && !(p.channel_tag_id && f.channelIds.includes(p.channel_tag_id))) return false;
  if (f.audienceIds.length) {
    const aud = p.audience_tag_id ?? ctx.cycles.get(p.cycle_id)?.audience_tag_id ?? null;
    if (!aud || !f.audienceIds.includes(aud)) return false;
  }
  if (f.natureIds.length && !(p.nature_tag_id && f.natureIds.includes(p.nature_tag_id))) return false;
  if (f.tagIds.length && !p.tag_ids.some((t) => f.tagIds.includes(t))) return false;
  if (f.production.length && !f.production.includes(p.production_status)) return false;
  if (f.diffusion.length && !f.diffusion.includes(p.diffusion_status)) return false;
  if (f.from || f.to) {
    const d = effectiveDate(p);
    if (!d) return false;
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
  }
  const q = normalize(f.q);
  if (q) {
    let h = cache.get(p);
    if (h === undefined) {
      h = haystack(p, ctx);
      cache.set(p, h);
    }
    for (const token of q.split(/\s+/)) if (!h.includes(token)) return false;
  }
  return true;
}

/** Le cycle est-il visible dans le board, compte tenu des filtres ? */
export function cycleVisible(c: Cycle, f: Filters, matchingCount: number, ctx: FilterContext): boolean {
  if (c.status === "archive" && !f.showArchived && !f.cycleIds.includes(c.id)) return false;
  if (f.cycleIds.length && !f.cycleIds.includes(c.id)) return false;
  if (!hasActiveFilters(f)) return true;
  if (matchingCount > 0) return true;
  // Recherche textuelle sur le nom du cycle ou d'une de ses sessions (filtres de métadonnées absents).
  const onlyText = f.q.trim() && !f.channelIds.length && !f.audienceIds.length && !f.natureIds.length && !f.tagIds.length && !f.production.length && !f.diffusion.length && !f.from && !f.to;
  if (onlyText) {
    const q = normalize(f.q);
    if (normalize(c.name).includes(q)) return true;
    for (const s of ctx.sessions.values()) if (s.cycle_id === c.id && normalize(s.title).includes(q)) return true;
  }
  if (f.audienceIds.length && c.audience_tag_id && f.audienceIds.includes(c.audience_tag_id) && !f.q.trim() && !f.channelIds.length && !f.production.length && !f.diffusion.length) return true;
  return false;
}
