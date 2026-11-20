// Modèle de domaine partagé client / serveur.

export type CycleKind = "cycle" | "projet";
export type CycleStatus = "a_venir" | "en_cours" | "termine" | "archive";
export type SessionKind = "session" | "info" | "autre";
export type ProductionStatus = "idee" | "a_creer" | "en_cours" | "pret";
export type DiffusionStatus = "a_programmer" | "programme" | "publie" | "annule";
export type TagDimension = "canal" | "public" | "nature" | "format" | "libre";
export type TagColor = "blue" | "coral" | "orange" | "violet" | "green" | "yellow" | "teal" | "gray";
export type AttachmentKind = "image" | "video" | "gif" | "pdf" | "document" | "html" | "other";
export type LinkKind = "externe" | "page" | "publication";

export interface Tag {
  id: string;
  dimension: TagDimension;
  label: string;
  color: TagColor;
  position: number;
}

export interface CycleLink {
  url: string;
  title: string;
}

export interface Cycle {
  id: string;
  kind: CycleKind;
  name: string;
  description: string;
  audience_tag_id: string | null;
  category: string;
  start_date: string | null;
  end_date: string | null;
  status: CycleStatus;
  links: CycleLink[];
  notes: string;
  position: number;
}

export interface Session {
  id: string;
  cycle_id: string;
  kind: SessionKind;
  title: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  description: string;
  position: number;
}

/** Aperçu de la première pièce jointe, pour les cartes. */
export interface CoverPreview {
  kind: AttachmentKind;
  url: string | null; // miniature ou fichier (URL temporaire signée)
  isThumb: boolean; // url pointe vers une miniature image (même pour une vidéo)
  name: string;
}

/** Données légères d'une publication (board, calendrier, recherche). */
export interface PublicationSummary {
  id: string;
  cycle_id: string;
  session_id: string | null;
  title: string;
  body_excerpt: string;
  body: string; // utilisé pour la recherche plein texte côté client
  channel_tag_id: string | null;
  format_tag_id: string | null;
  audience_tag_id: string | null;
  nature_tag_id: string | null;
  tag_ids: string[];
  production_status: ProductionStatus;
  diffusion_status: DiffusionStatus;
  target_date: string | null;
  target_time: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  position: number;
  archived: boolean;
  attachment_count: number;
  link_count: number;
  cover: CoverPreview | null;
  first_link: { url: string; title: string } | null;
  updated_at: string;
}

export interface Attachment {
  id: string;
  publication_id: string;
  kind: AttachmentKind;
  storage_path: string;
  thumb_path: string | null;
  name: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  status: "pending" | "ready";
  position: number;
  url: string | null;
  thumb_url: string | null;
}

export interface PubLink {
  id: string;
  publication_id: string;
  url: string;
  title: string;
  kind: LinkKind;
  position: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface PublicationDetail extends PublicationSummary {
  description: string;
  scheduled_platform: string;
  published_url: string;
  notes: string;
  created_at: string;
  attachments: Attachment[];
  links: PubLink[];
  activity: ActivityEntry[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: Filters;
}

export interface Prefs {
  density?: "compact" | "confortable";
  collapsed?: string[]; // cycles réduits
  sidebarCollapsed?: boolean;
}

export interface Filters {
  q: string;
  cycleIds: string[];
  channelIds: string[];
  audienceIds: string[];
  natureIds: string[];
  tagIds: string[];
  production: ProductionStatus[];
  diffusion: DiffusionStatus[];
  from: string | null;
  to: string | null;
  showArchived: boolean;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  cycleIds: [],
  channelIds: [],
  audienceIds: [],
  natureIds: [],
  tagIds: [],
  production: [],
  diffusion: [],
  from: null,
  to: null,
  showArchived: false,
};

export interface BoardData {
  cycles: Cycle[];
  sessions: Session[];
  publications: PublicationSummary[];
  tags: Tag[];
  savedViews: SavedView[];
  prefs: Prefs;
  user: { email: string };
  mode: "supabase" | "local";
  loadedAt: number;
}

// --- Libellés -----------------------------------------------------------------

export const CYCLE_STATUS: Record<CycleStatus, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
  archive: "Archivé",
};

export const PRODUCTION: { id: ProductionStatus; label: string }[] = [
  { id: "idee", label: "Idée" },
  { id: "a_creer", label: "À créer" },
  { id: "en_cours", label: "En cours" },
  { id: "pret", label: "Prêt" },
];
export const DIFFUSION: { id: DiffusionStatus; label: string }[] = [
  { id: "a_programmer", label: "À programmer" },
  { id: "programme", label: "Programmé" },
  { id: "publie", label: "Publié" },
  { id: "annule", label: "Annulé" },
];
export const productionLabel = (s: ProductionStatus) => PRODUCTION.find((p) => p.id === s)!.label;
export const diffusionLabel = (s: DiffusionStatus) => DIFFUSION.find((p) => p.id === s)!.label;

export const DIMENSIONS: { id: TagDimension; label: string; plural: string }[] = [
  { id: "canal", label: "Canal", plural: "Canaux" },
  { id: "public", label: "Public", plural: "Publics" },
  { id: "nature", label: "Nature", plural: "Natures de communication" },
  { id: "format", label: "Format", plural: "Formats" },
  { id: "libre", label: "Tag", plural: "Tags libres" },
];

export const TAG_COLORS: TagColor[] = ["blue", "coral", "orange", "violet", "green", "yellow", "teal", "gray"];
export const TAG_COLOR_LABEL: Record<TagColor, string> = {
  blue: "Bleu",
  coral: "Corail",
  orange: "Orange",
  violet: "Violet",
  green: "Vert",
  yellow: "Jaune",
  teal: "Turquoise",
  gray: "Gris",
};

export const SESSION_KIND: Record<SessionKind, string> = {
  session: "Session",
  info: "Séance d'information",
  autre: "Autre",
};

/** Statut affiché sur une carte : la diffusion prime dès qu'elle a dépassé « À programmer ». */
export type CardStage = ProductionStatus | Exclude<DiffusionStatus, "a_programmer"> | "a_programmer";
export function cardStage(p: Pick<PublicationSummary, "production_status" | "diffusion_status">): CardStage {
  if (p.diffusion_status !== "a_programmer") return p.diffusion_status;
  if (p.production_status === "pret") return "a_programmer";
  return p.production_status;
}
export const STAGE_LABEL: Record<CardStage, string> = {
  idee: "Idée",
  a_creer: "À créer",
  en_cours: "En cours",
  pret: "Prêt",
  a_programmer: "Prêt · à programmer",
  programme: "Programmé",
  publie: "Publié",
  annule: "Annulé",
};

// --- Fichiers -----------------------------------------------------------------

export const ACCEPTED: Record<string, AttachmentKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/svg+xml": "image",
  "image/gif": "gif",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "application/pdf": "pdf",
  "text/html": "html",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-powerpoint": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.oasis.opendocument.text": "document",
  "application/vnd.oasis.opendocument.presentation": "document",
  "application/vnd.oasis.opendocument.spreadsheet": "document",
  "text/plain": "document",
  "text/csv": "document",
  "text/markdown": "document",
  "application/zip": "other",
};
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  html: "text/html",
  htm: "text/html",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  zip: "application/zip",
};
/** Type MIME normalisé (le navigateur en fournit parfois un vide ou approximatif). */
export function normalizeMime(name: string, mime: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const byExt = EXT_MIME[ext];
  if (mime && ACCEPTED[mime]) return mime;
  return byExt ?? null;
}
export const ACCEPT_ATTR = Object.keys(EXT_MIME)
  .map((e) => "." + e)
  .join(",");

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2).replace(".", ",")} Go`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
