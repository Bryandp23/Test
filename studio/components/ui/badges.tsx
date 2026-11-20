"use client";
// Statuts et tags. Le statut est une pastille avec icône (forme + couleur) ; le canal est un carré
// de couleur suivi de son libellé : deux informations visuellement distinctes.
import { Ban, CalendarCheck2, CircleCheck, CircleDashed, CircleDot, Lightbulb, Send, Clock3 } from "lucide-react";
import { STAGE_LABEL, type CardStage, type CycleStatus, type Tag, type TagColor, CYCLE_STATUS } from "@/lib/domain";
import { cx } from "./primitives";

export const COLOR_VAR: Record<TagColor, string> = {
  blue: "var(--color-t-blue)",
  coral: "var(--color-t-coral)",
  orange: "var(--color-t-orange)",
  violet: "var(--color-t-violet)",
  green: "var(--color-t-green)",
  yellow: "var(--color-t-yellow)",
  teal: "var(--color-t-teal)",
  gray: "var(--color-t-gray)",
};

export const STAGE_COLOR: Record<CardStage, string> = {
  idee: "var(--color-s-idee)",
  a_creer: "var(--color-s-a_creer)",
  en_cours: "var(--color-s-en_cours)",
  pret: "var(--color-s-pret)",
  a_programmer: "var(--color-s-a_programmer)",
  programme: "var(--color-s-programme)",
  publie: "var(--color-s-publie)",
  annule: "var(--color-s-annule)",
};

const STAGE_ICON: Record<CardStage, typeof Lightbulb> = {
  idee: Lightbulb,
  a_creer: CircleDashed,
  en_cours: CircleDot,
  pret: CircleCheck,
  a_programmer: Clock3,
  programme: CalendarCheck2,
  publie: Send,
  annule: Ban,
};

export function StageIcon({ stage, className }: { stage: CardStage; className?: string }) {
  const I = STAGE_ICON[stage];
  return <I className={cx("shrink-0", className)} style={{ color: STAGE_COLOR[stage] }} aria-hidden />;
}

export function StageBadge({ stage, size = "md", label }: { stage: CardStage; size?: "sm" | "md"; label?: string }) {
  const c = STAGE_COLOR[stage];
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-[18px] px-1.5 text-[10.5px]" : "h-[22px] px-2 text-[11.5px]",
      )}
      style={{ color: c, borderColor: `color-mix(in oklab, ${c} 32%, transparent)`, background: `color-mix(in oklab, ${c} 10%, transparent)` }}
    >
      <StageIcon stage={stage} className={size === "sm" ? "size-3" : "size-3.5"} />
      <span className="truncate">{label ?? STAGE_LABEL[stage]}</span>
    </span>
  );
}

export function Swatch({ color, className }: { color: TagColor; className?: string }) {
  return <span className={cx("inline-block size-2 shrink-0 rounded-[2px]", className)} style={{ background: COLOR_VAR[color] }} aria-hidden />;
}

export function ChannelLabel({ tag, className }: { tag?: Tag; className?: string }) {
  if (!tag) return <span className={cx("text-faint", className)}>Sans canal</span>;
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-1.5 text-muted", className)}>
      <Swatch color={tag.color} />
      <span className="truncate">{tag.label}</span>
    </span>
  );
}

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex h-[22px] items-center gap-1.5 rounded-md border px-1.5 text-[11.5px] text-fg"
      style={{ borderColor: `color-mix(in oklab, ${COLOR_VAR[tag.color]} 35%, var(--color-line))`, background: `color-mix(in oklab, ${COLOR_VAR[tag.color]} 9%, transparent)` }}
    >
      <Swatch color={tag.color} />
      {tag.label}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Retirer ${tag.label}`} className="-mr-0.5 text-faint hover:text-fg">
          ×
        </button>
      )}
    </span>
  );
}

const CYCLE_STATUS_COLOR: Record<CycleStatus, string> = {
  a_venir: "var(--color-t-blue)",
  en_cours: "var(--color-accent)",
  termine: "var(--color-t-gray)",
  archive: "#5b606b",
};

export function CycleStatusDot({ status, withLabel }: { status: CycleStatus; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span
        className={cx("inline-block size-[7px] rounded-full", status === "en_cours" && "ring-2 ring-accent/20")}
        style={{ background: status === "a_venir" ? "transparent" : CYCLE_STATUS_COLOR[status], border: `1.5px solid ${CYCLE_STATUS_COLOR[status]}` }}
        aria-hidden
      />
      {withLabel ? CYCLE_STATUS[status] : <span className="sr-only">{CYCLE_STATUS[status]}</span>}
    </span>
  );
}
