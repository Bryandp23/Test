"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "@/components/icons";

/**
 * Incitation douce (« bottom sheet » non modale).
 * Règles : n'apparaît qu'une fois par événement et par appareil, seulement si le participant n'a encore rien choisi
 * ET que le choix du calendrier n'est pas visible à l'écran (il a fait défiler la page pour lire les détails).
 * Ne bloque jamais le contenu, ne vole pas le focus, se ferme avec Échap.
 */
export default function Nudge({ enabled, eventKey, targetId, onChoose }: { enabled: boolean; eventKey: string; targetId: string; onChoose: () => void }) {
  const [open, setOpen] = useState(false);
  const firstBtn = useRef<HTMLButtonElement>(null);
  const storageKey = `ephec-nudge-${eventKey}`;

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(storageKey) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.intersectionRatio > 0.15;
        if (timer) clearTimeout(timer);
        if (!visible) timer = setTimeout(() => !visible && setOpen(true), 2500);
      },
      { threshold: [0, 0.15, 0.5] }
    );
    const start = setTimeout(() => io.observe(target), 3000);
    return () => {
      clearTimeout(start);
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [enabled, storageKey, targetId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* navigation privée : on se contente de fermer */
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="nudge-title"
      aria-describedby="nudge-desc"
      className="animate-rise fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-[8px_28px_8px_28px] bg-white p-5 shadow-[0_18px_50px_-12px_rgba(16,66,63,.45)] ring-1 ring-line sm:bottom-6"
    >
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-muted hover:bg-canvas" aria-label="Fermer">
        <IconX />
      </button>
      <p id="nudge-title" className="pr-10 text-lg font-bold text-ink">
        Et si vous bloquiez déjà cette date ? <span aria-hidden="true">📅</span>
      </p>
      <p id="nudge-desc" className="mt-1 text-muted">
        Ajoutez votre formation à votre calendrier pour ne rien manquer. Cela ne prend que quelques secondes !
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          ref={firstBtn}
          type="button"
          className="shape min-h-12 flex-1 bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800"
          onClick={() => {
            dismiss();
            document.getElementById(targetId)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
            onChoose();
          }}
        >
          Choisir mon calendrier
        </button>
        <button type="button" className="min-h-12 rounded-xl px-5 font-semibold text-brand-800 hover:bg-brand-50" onClick={dismiss}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
