"use client";
import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Download, ExternalLink, FileCode2, FileText, FileType2, File as FileIcon, Globe, Link2, Plus, Trash2, Upload, X } from "lucide-react";
import { ACCEPT_ATTR, formatBytes, hostOf, type Attachment, type PublicationDetail } from "@/lib/domain";
import { addLinkOp, deleteAttachmentOp, deleteLinkOp, reorderAttachmentsOp } from "@/lib/client/ops";
import { uploadFiles } from "@/lib/client/upload";
import { downloadUrl } from "@/app/actions/files";
import { useStudio } from "@/lib/client/store";
import { Button, cx, IconButton, Input, Select } from "@/components/ui/primitives";

function KindIcon({ a, className }: { a: Attachment; className?: string }) {
  const I = a.kind === "pdf" ? FileType2 : a.kind === "html" ? FileCode2 : a.kind === "document" ? FileText : FileIcon;
  return <I className={className} />;
}

async function download(a: Attachment) {
  const r = await downloadUrl(a.id);
  if (r.ok) window.open(r.data, "_blank", "noopener");
  else useStudio.getState().toast({ kind: "error", message: r.error });
}

function Viewer({ a }: { a: Attachment }) {
  if ((a.kind === "image" || a.kind === "gif") && a.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />;
  }
  if (a.kind === "video" && a.url) {
    return <video key={a.id} src={a.url} poster={a.thumb_url ?? undefined} controls playsInline preload="metadata" className="max-h-full max-w-full" />;
  }
  if (a.kind === "pdf" && a.url) {
    return <iframe key={a.id} src={a.url} title={a.name} className="size-full bg-white" />;
  }
  if (a.kind === "html") {
    // Aperçu isolé : origine opaque, aucun script, aucun accès à l'application.
    return <iframe key={a.id} src={`/api/preview/${a.id}`} title={`Aperçu HTML : ${a.name}`} sandbox="allow-popups allow-popups-to-escape-sandbox" className="size-full bg-white" />;
  }
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <KindIcon a={a} className="size-8 text-faint" />
      <div>
        <div className="font-medium break-all">{a.name}</div>
        <div className="mt-0.5 text-[12px] text-faint">{formatBytes(a.size_bytes)} · aperçu non disponible pour ce type de document</div>
      </div>
      <Button size="sm" onClick={() => download(a)}>
        <Download className="size-3.5" /> Télécharger
      </Button>
    </div>
  );
}

function Thumb({ a, active, onClick, onRemove }: { a: Attachment; active: boolean; onClick: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
  const src = a.thumb_url ?? ((a.kind === "image" || a.kind === "gif") ? a.url : null);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx("group/t relative shrink-0", isDragging && "z-10 opacity-60")}>
      <button
        {...attributes}
        {...listeners}
        onClick={onClick}
        aria-label={`Afficher ${a.name}`}
        aria-current={active}
        className={cx("block size-14 overflow-hidden rounded-md border bg-bg", active ? "border-accent ring-1 ring-accent/50" : "border-line hover:border-faint")}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <KindIcon a={a} className="size-4" />
          </span>
        )}
      </button>
      <button
        onClick={onRemove}
        aria-label={`Supprimer ${a.name}`}
        className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full border border-line bg-raised text-muted group-hover/t:flex hover:text-danger focus-visible:flex"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function MediaSection({ d }: { d: PublicationDetail }) {
  const [idx, setIdx] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploads = useStudio((s) => s.uploads.filter((u) => u.publicationId === d.id && u.state !== "done" && u.state !== "error").length);
  const atts = d.attachments;
  const cur = atts[Math.min(idx, atts.length - 1)];
  useEffect(() => setIdx(0), [d.id]);
  useEffect(() => {
    if (idx > atts.length - 1) setIdx(Math.max(0, atts.length - 1));
  }, [atts.length, idx]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = atts.map((a) => a.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    const activeId = cur?.id;
    void reorderAttachmentsOp(d.id, next);
    if (activeId) setIdx(next.indexOf(activeId));
  }

  function move(dir: -1 | 1) {
    const ids = atts.map((a) => a.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void reorderAttachmentsOp(d.id, ids);
    setIdx(j);
  }

  return (
    <section
      aria-label="Fichiers"
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setOver(false);
        void uploadFiles(d.id, Array.from(e.dataTransfer.files));
      }}
      className={cx("relative", over && "ring-2 ring-accent ring-inset")}
    >
      {cur ? (
        <div className="relative flex h-[min(52vh,440px)] items-center justify-center overflow-hidden bg-[#08090c]">
          <Viewer a={cur} />
          {atts.length > 1 && (
            <>
              <button
                aria-label="Fichier précédent"
                disabled={idx === 0}
                onClick={() => setIdx(idx - 1)}
                className="absolute top-1/2 left-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-0"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                aria-label="Fichier suivant"
                disabled={idx >= atts.length - 1}
                onClick={() => setIdx(idx + 1)}
                className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-0"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="tabular absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                {idx + 1} / {atts.length}
              </span>
            </>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            {atts.length > 1 && (
              <>
                <button
                  onClick={() => move(-1)}
                  disabled={idx === 0}
                  aria-label="Déplacer ce fichier vers la gauche"
                  className="inline-flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => move(1)}
                  disabled={idx >= atts.length - 1}
                  aria-label="Déplacer ce fichier vers la droite"
                  className="inline-flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </>
            )}
            {cur.url && cur.kind !== "html" && (
              <a href={cur.url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans un nouvel onglet" className="inline-flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80">
                <ExternalLink className="size-3.5" />
              </a>
            )}
            <button onClick={() => download(cur)} aria-label="Télécharger" className="inline-flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80">
              <Download className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => input.current?.click()}
          className={cx("flex h-40 w-full flex-col items-center justify-center gap-2 border-b border-line-soft bg-bg text-muted transition-colors hover:text-fg", over && "bg-accent/10")}
        >
          <Upload className="size-5" />
          <span className="text-[13px]">Déposez vos visuels, vidéos, PDF ou HTML</span>
          <span className="text-2xs text-faint">ou cliquez pour choisir · plusieurs fichiers acceptés (carrousel)</span>
        </button>
      )}

      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={atts.map((a) => a.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1.5 pr-2">
              {atts.map((a, i) => (
                <Thumb key={a.id} a={a} active={i === idx} onClick={() => setIdx(i)} onRemove={() => deleteAttachmentOp(d.id, a.id)} />
              ))}
              {uploads > 0 && Array.from({ length: uploads }, (_, i) => <div key={i} className="skeleton size-14 shrink-0 rounded-md" aria-label="Envoi en cours" />)}
            </div>
          </SortableContext>
        </DndContext>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void uploadFiles(d.id, files);
          }}
        />
        <Button size="sm" onClick={() => input.current?.click()}>
          <Plus className="size-3.5" /> Fichiers
        </Button>
      </div>
      {atts.length > 1 && <p className="px-5 pt-2 text-2xs text-faint">Glissez les miniatures pour ordonner le carrousel. Le premier fichier sert d'aperçu sur la carte.</p>}
      {over && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/15 text-[13px] font-medium">Déposer pour ajouter à cette publication</div>}
    </section>
  );
}

export function LinksSection({ d }: { d: PublicationDetail }) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("externe");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      {d.links.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {d.links.map((l) => (
            <li key={l.id} className="group/l flex items-center gap-2.5 rounded-md border border-line-soft bg-bg/50 px-2.5 py-2">
              <Globe className="size-4 shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] text-fg hover:text-accent">
                  {l.title || hostOf(l.url)}
                </a>
                <div className="truncate font-mono text-[10.5px] text-faint">
                  {l.kind === "publication" ? "Publication en ligne · " : l.kind === "page" ? "Page web · " : ""}
                  {l.url}
                </div>
              </div>
              <IconButton label="Retirer le lien" size="sm" onClick={() => deleteLinkOp(l.id)} className="opacity-0 group-hover/l:opacity-100 focus-visible:opacity-100 max-md:opacity-100">
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form
          className="space-y-2 rounded-md border border-line p-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            let u = url.trim();
            if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
            try {
              new URL(u);
            } catch {
              setErr("URL invalide");
              return;
            }
            if (await addLinkOp(d.id, { url: u, title: title.trim(), kind })) {
              setUrl("");
              setTitle("");
              setAdding(false);
            }
          }}
        >
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="URL" type="url" inputMode="url" />
          <div className="flex gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (facultatif)" aria-label="Titre du lien" />
            <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type de lien" className="w-[150px]">
              <option value="externe">Lien externe</option>
              <option value="page">Page web</option>
              <option value="publication">Publication en ligne</option>
            </Select>
          </div>
          {err && <p className="text-[12px] text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" disabled={!url.trim()}>
              Ajouter le lien
            </Button>
          </div>
          <p className="text-2xs text-faint">Les sites externes ne sont pas intégrés dans l'application : le lien s'ouvre dans un nouvel onglet.</p>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)} className="-ml-2">
          <Link2 className="size-3.5" /> Ajouter un lien
        </Button>
      )}
    </div>
  );
}
