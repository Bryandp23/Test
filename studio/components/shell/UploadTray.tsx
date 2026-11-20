"use client";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Loader2, RotateCcw, X } from "lucide-react";
import { useStudio } from "@/lib/client/store";
import { formatBytes } from "@/lib/domain";

export function UploadTray() {
  const uploads = useStudio((s) => s.uploads);
  if (!uploads.length) return null;
  const active = uploads.filter((u) => u.state !== "done" && u.state !== "error").length;
  return (
    <div className="fixed right-4 bottom-4 z-[65] w-[min(340px,calc(100vw-24px))] rounded-lg border border-line bg-raised shadow-xl shadow-black/30" role="region" aria-label="Envois de fichiers">
      <div className="flex items-center justify-between border-b border-line-soft px-3 py-2 text-[12px]">
        <span className="font-medium">{active ? `Envoi de ${active} fichier${active > 1 ? "s" : ""}…` : "Envois terminés"}</span>
        <button
          aria-label="Masquer les envois terminés"
          onClick={() => useStudio.setState((s) => ({ uploads: s.uploads.filter((u) => u.state !== "done" && u.state !== "error") }))}
          className="inline-flex size-6 items-center justify-center rounded text-faint hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="max-h-[40vh] overflow-y-auto p-1">
        <AnimatePresence initial={false}>
          {uploads.map((u) => (
            <motion.li key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-md px-2 py-1.5">
              <div className="flex items-center gap-2 text-[12px]">
                {u.state === "done" ? (
                  <CircleCheck className="size-3.5 shrink-0 text-accent" />
                ) : u.state === "error" ? (
                  <CircleAlert className="size-3.5 shrink-0 text-danger" />
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted" />
                )}
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="tabular shrink-0 text-faint">
                  {u.state === "error" ? "Échec" : u.state === "preparing" ? "Préparation" : u.state === "finishing" ? "Finalisation" : u.state === "done" ? formatBytes(u.size) : `${Math.round(u.progress * 100)} %`}
                </span>
                {u.state === "error" && u.retry && (
                  <button onClick={u.retry} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-accent hover:bg-hover">
                    <RotateCcw className="size-3" /> Réessayer
                  </button>
                )}
              </div>
              {u.state === "error" ? (
                <p className="mt-0.5 pl-5.5 text-2xs text-danger">{u.error}</p>
              ) : (
                <div className="mt-1 ml-5.5 h-[3px] overflow-hidden rounded bg-line">
                  <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
