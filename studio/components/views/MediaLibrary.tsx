"use client";
import { useEffect, useMemo, useState } from "react";
import { FileCode2, FileText, FileType2, Play, RotateCcw, File as FileIcon } from "lucide-react";
import { listMedia } from "@/app/actions/files";
import { useStudio } from "@/lib/client/store";
import { makeContext, matchesPublication } from "@/lib/filter";
import type { Attachment } from "@/lib/domain";
import { formatBytes } from "@/lib/domain";
import { Button, cx } from "@/components/ui/primitives";

const KINDS = [
  { id: "all", label: "Tout" },
  { id: "visual", label: "Visuels" },
  { id: "video", label: "Vidéos" },
  { id: "doc", label: "Documents et HTML" },
] as const;

export function MediaLibrary() {
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("all");
  const pubs = useStudio((s) => s.pubs);
  const cycles = useStudio((s) => s.cycles);
  const sessions = useStudio((s) => s.sessions);
  const tags = useStudio((s) => s.tags);
  const filters = useStudio((s) => s.filters);
  const select = useStudio((s) => s.select);

  const load = () => {
    setError(null);
    listMedia().then((r) => (r.ok ? setItems(r.data) : setError(r.error)));
  };
  useEffect(load, [pubs.length]);

  const visible = useMemo(() => {
    if (!items) return [];
    const ctx = makeContext(cycles, sessions, tags);
    const ok = new Set(pubs.filter((p) => matchesPublication(p, filters, ctx)).map((p) => p.id));
    return items.filter((a) => {
      if (!ok.has(a.publication_id)) return false;
      if (kind === "visual") return a.kind === "image" || a.kind === "gif";
      if (kind === "video") return a.kind === "video";
      if (kind === "doc") return a.kind === "pdf" || a.kind === "document" || a.kind === "html" || a.kind === "other";
      return true;
    });
  }, [items, pubs, cycles, sessions, tags, filters, kind]);

  const pubTitle = (id: string) => pubs.find((p) => p.id === id)?.title ?? "";

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="px-4 pt-5 pb-24 md:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Type de fichier" className="inline-flex rounded-md border border-line p-0.5">
            {KINDS.map((k) => (
              <button key={k.id} role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className={cx("h-7 rounded px-3 text-[12px]", kind === k.id ? "bg-raised text-fg" : "text-muted hover:text-fg")}>
                {k.label}
              </button>
            ))}
          </div>
          <span className="tabular text-[12px] text-faint">{items ? `${visible.length} fichier${visible.length > 1 ? "s" : ""}` : ""}</span>
        </div>
        {error && (
          <div className="py-10 text-center">
            <p className="text-muted">{error}</p>
            <Button className="mt-3" size="sm" onClick={load}>
              <RotateCcw className="size-3.5" /> Réessayer
            </Button>
          </div>
        )}
        {!items && !error && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="skeleton aspect-square rounded-lg" />
            ))}
          </div>
        )}
        {items && !visible.length && !error && <p className="py-16 text-center text-muted">Aucun fichier. Déposez vos créations dans une session du board.</p>}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {visible.map((a) => {
            const src = a.thumb_url ?? (a.kind === "image" || a.kind === "gif" ? a.url : null);
            const Icon = a.kind === "pdf" ? FileType2 : a.kind === "html" ? FileCode2 : a.kind === "document" ? FileText : FileIcon;
            return (
              <li key={a.id}>
                <button onClick={() => select(a.publication_id)} className="group block w-full text-left">
                  <span className="relative block aspect-square overflow-hidden rounded-lg border border-line-soft bg-surface transition-colors group-hover:border-line">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                    ) : a.kind === "video" && a.url ? (
                      <video src={a.url + "#t=0.5"} preload="metadata" muted className="pointer-events-none size-full object-cover" />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-2 p-3 text-faint">
                        <Icon className="size-6" />
                        <span className="line-clamp-2 text-center text-[11px] break-all">{a.name}</span>
                      </span>
                    )}
                    {a.kind === "video" && (
                      <span className="absolute bottom-1.5 left-1.5 inline-flex size-5 items-center justify-center rounded-full bg-black/60 text-white">
                        <Play className="size-2.5 fill-current" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[12px] text-muted group-hover:text-fg">{pubTitle(a.publication_id)}</span>
                  <span className="block truncate text-2xs text-faint">
                    {a.name} · {formatBytes(a.size_bytes)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
