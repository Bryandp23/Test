"use client";
import { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArrowLeft, ArrowRight, Copy, FileCode2, FileText, FileType2, Globe, Layers, MoreHorizontal, MoveRight, Play, Trash2, ExternalLink, File as FileIcon, Paperclip } from "lucide-react";
import { cardStage, hostOf, STAGE_LABEL, type PublicationSummary, type Tag } from "@/lib/domain";
import { useStudio } from "@/lib/client/store";
import { archivePub, confirmDeletePub, duplicatePub, nudgePub } from "@/lib/client/ops";
import { uploadFiles } from "@/lib/client/upload";
import { ChannelLabel, StageBadge } from "@/components/ui/badges";
import { cx, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/primitives";
import { fmtShort, todayBrussels, utcToBrussels } from "@/lib/time";
import { effectiveDate } from "@/lib/filter";

export type Density = "compact" | "confortable";
export const CARD_W: Record<Density, number> = { compact: 152, confortable: 212 };
export const THUMB_H: Record<Density, number> = { compact: 96, confortable: 150 };

function hasFiles(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}

/** Aperçu réel : image, première image de vidéo, extrait de texte, lien ou type de document. Jamais d'image fictive. */
export function CoverArt({ p, density }: { p: PublicationSummary; density: Density }) {
  const c = p.cover;
  const small = density === "compact";
  if (c && c.url && (c.kind === "image" || c.kind === "gif" || (c.kind === "video" && c.isThumb))) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.url} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
        {c.kind === "video" && <PlayBadge />}
      </>
    );
  }
  if (c && c.url && c.kind === "video") {
    return (
      <>
        <video src={c.url + "#t=0.5"} preload="metadata" muted playsInline className="pointer-events-none size-full object-cover" />
        <PlayBadge />
      </>
    );
  }
  if (c) {
    const Icon = c.kind === "pdf" ? FileType2 : c.kind === "html" ? FileCode2 : c.kind === "document" ? FileText : FileIcon;
    const ext = c.name.split(".").pop()?.toUpperCase().slice(0, 5) ?? "";
    return (
      <div className="flex size-full flex-col justify-between bg-surface p-2.5">
        <div className="flex items-center gap-1.5 text-faint">
          <Icon className="size-4" />
          <span className="font-mono text-[10px] tracking-wider">{c.kind === "html" ? "HTML" : ext}</span>
        </div>
        <div className={cx("line-clamp-2 break-all text-muted", small ? "text-[10.5px]" : "text-[11.5px]")}>{c.name}</div>
      </div>
    );
  }
  if (p.first_link) {
    return (
      <div className="flex size-full flex-col justify-between bg-surface p-2.5">
        <Globe className="size-4 text-faint" />
        <div className="min-w-0">
          <div className={cx("line-clamp-2 text-fg", small ? "text-[11px]" : "text-[12px]")}>{p.first_link.title || hostOf(p.first_link.url)}</div>
          <div className="truncate font-mono text-[10px] text-faint">{hostOf(p.first_link.url)}</div>
        </div>
      </div>
    );
  }
  if (p.body_excerpt.trim()) {
    return (
      <div className="size-full overflow-hidden bg-surface p-2.5">
        <p className={cx("text-muted whitespace-pre-line", small ? "line-clamp-5 text-[10.5px] leading-[1.45]" : "line-clamp-[8] text-[11.5px] leading-[1.5]")}>{p.body_excerpt}</p>
      </div>
    );
  }
  return (
    <div className="flex size-full items-center justify-center bg-surface">
      <span className="text-[11px] text-faint">Aucun contenu</span>
    </div>
  );
}

function PlayBadge() {
  return (
    <span className="absolute bottom-1.5 left-1.5 inline-flex size-5 items-center justify-center rounded-full bg-black/60 text-white">
      <Play className="size-2.5 fill-current" />
    </span>
  );
}

export function DateChip({ p }: { p: PublicationSummary }) {
  const d = effectiveDate(p);
  if (!d) return null;
  const today = todayBrussels();
  const late = d < today && (p.diffusion_status === "a_programmer" || p.diffusion_status === "programme");
  const isToday = d === today && p.diffusion_status !== "publie" && p.diffusion_status !== "annule";
  const time = p.diffusion_status === "programme" && p.scheduled_at ? utcToBrussels(p.scheduled_at).time : null;
  return (
    <span
      className={cx("tabular shrink-0 text-[11px]", late ? "text-danger" : isToday ? "text-warn" : "text-faint")}
      title={late ? (p.diffusion_status === "programme" ? "Date passée : confirmez la publication" : "En retard") : undefined}
    >
      {isToday ? "Aujourd'hui" : fmtShort(d, today)}
      {time ? ` ${time.replace(":", "h")}` : ""}
    </span>
  );
}

interface Props {
  p: PublicationSummary;
  channel?: Tag;
  density: Density;
  selected: boolean;
  dragDisabled?: boolean;
}

export const PubCard = memo(function PubCard({ p, channel, density, selected, dragDisabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
    data: { type: "pub", cycleId: p.cycle_id, sessionId: p.session_id },
    disabled: dragDisabled,
  });
  const [fileOver, setFileOver] = useState(false);
  const select = useStudio((s) => s.select);
  const stage = cardStage(p);
  const extra = p.attachment_count + p.link_count - (p.cover || p.first_link ? 1 : 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, width: CARD_W[density] }}
      className={cx("group/card relative shrink-0 snap-start", isDragging && "z-10 opacity-30")}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setFileOver(true);
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setFileOver(false);
        void uploadFiles(p.id, Array.from(e.dataTransfer.files));
      }}
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        aria-roledescription="Carte de publication déplaçable"
        aria-label={`${p.title} — ${channel?.label ?? "sans canal"}, ${STAGE_LABEL[stage]}`}
        data-pub-id={p.id}
        onClick={() => select(p.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            select(p.id);
          } else listeners?.onKeyDown?.(e);
        }}
        className={cx(
          "block cursor-pointer overflow-hidden rounded-lg border bg-surface text-left transition-[border-color,box-shadow,opacity] duration-150 outline-none select-none",
          selected ? "border-accent ring-1 ring-accent/40" : "border-line-soft hover:border-line",
          fileOver && "border-accent ring-2 ring-accent/40",
          p.archived && "opacity-55",
          "focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        <div className="relative overflow-hidden border-b border-line-soft bg-bg" style={{ height: THUMB_H[density] }}>
          <CoverArt p={p} density={density} />
          {extra > 0 && (
            <span className="tabular absolute right-1.5 bottom-1.5 inline-flex h-[18px] items-center gap-0.5 rounded bg-black/65 px-1.5 text-[10.5px] text-white" title={`${p.attachment_count} fichier(s), ${p.link_count} lien(s)`}>
              {p.attachment_count > 1 ? <Layers className="size-2.5" /> : <Paperclip className="size-2.5" />}+{extra}
            </span>
          )}
          {fileOver && <div className="absolute inset-0 flex items-center justify-center bg-accent/20 text-[11px] font-medium text-fg">Ajouter à cette publication</div>}
        </div>
        <div className={cx(density === "compact" ? "space-y-1 px-2 pt-1.5 pb-2" : "space-y-1.5 px-2.5 pt-2 pb-2.5")}>
          <div className={cx("line-clamp-2 leading-snug font-medium text-fg", density === "compact" ? "min-h-[2.5em] text-[12px]" : "min-h-[2.6em] text-[13px]")}>
            {p.title}
          </div>
          <div className="flex items-center justify-between gap-1.5 text-[11px]">
            <ChannelLabel tag={channel} className="min-w-0" />
            <DateChip p={p} />
          </div>
          <StageBadge stage={stage} size="sm" />
        </div>
      </div>
      <CardMenu p={p} />
    </div>
  );
});

function CardMenu({ p }: { p: PublicationSummary }) {
  const select = useStudio((s) => s.select);
  const open = useStudio((s) => s.openDialog);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label={`Actions pour ${p.title}`}
          className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<ExternalLink />} onSelect={() => select(p.id)}>
          Ouvrir
        </MenuItem>
        <MenuItem icon={<MoveRight />} onSelect={() => open({ kind: "move", publicationId: p.id })}>
          Déplacer vers…
        </MenuItem>
        <MenuItem icon={<ArrowLeft />} onSelect={() => nudgePub(p.id, -1)}>
          Décaler à gauche
        </MenuItem>
        <MenuItem icon={<ArrowRight />} onSelect={() => nudgePub(p.id, 1)}>
          Décaler à droite
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Copy />} onSelect={() => duplicatePub(p.id)}>
          Dupliquer (variante)
        </MenuItem>
        <MenuItem icon={<Archive />} onSelect={() => archivePub(p.id, !p.archived)}>
          {p.archived ? "Désarchiver" : "Archiver"}
        </MenuItem>
        <MenuItem icon={<Trash2 />} danger onSelect={() => confirmDeletePub(p.id)}>
          Supprimer…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Rendu simplifié pendant le glisser (DragOverlay). */
export function CardGhost({ p, channel, density }: { p: PublicationSummary; channel?: Tag; density: Density }) {
  return (
    <div style={{ width: CARD_W[density] }} className="cursor-grabbing overflow-hidden rounded-lg border border-accent bg-surface shadow-2xl shadow-black/50">
      <div className="relative overflow-hidden border-b border-line-soft bg-bg" style={{ height: THUMB_H[density] }}>
        <CoverArt p={p} density={density} />
      </div>
      <div className="space-y-1 px-2.5 py-2">
        <div className="line-clamp-2 text-[12px] font-medium">{p.title}</div>
        <ChannelLabel tag={channel} className="text-[11px]" />
      </div>
    </div>
  );
}
