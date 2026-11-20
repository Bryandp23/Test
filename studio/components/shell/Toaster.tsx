"use client";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useStudio } from "@/lib/client/store";

export function Toaster() {
  const toasts = useStudio((s) => s.toasts);
  const dismiss = useStudio((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-raised py-2 pr-2 pl-3 text-[13px] shadow-xl shadow-black/30"
          >
            {t.kind === "error" ? (
              <CircleAlert className="size-4 shrink-0 text-danger" />
            ) : t.kind === "success" ? (
              <CircleCheck className="size-4 shrink-0 text-accent" />
            ) : (
              <Info className="size-4 shrink-0 text-muted" />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
                className="rounded px-2 py-1 text-[12px] font-medium text-accent hover:bg-hover"
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="Fermer" onClick={() => dismiss(t.id)} className="inline-flex size-6 items-center justify-center rounded text-faint hover:text-fg">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
