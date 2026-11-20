"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useStudio } from "@/lib/client/store";
import { refreshBoard } from "@/lib/client/ops";
import type { BoardData } from "@/lib/domain";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "./Toaster";
import { UploadTray } from "./UploadTray";
import { DialogHost } from "@/components/dialogs/DialogHost";
import { PublicationPanel } from "@/components/panel/PublicationPanel";
import { TipProvider } from "@/components/ui/primitives";

export function StudioRoot({ initial, children }: { initial: BoardData; children: ReactNode }) {
  const done = useRef(false);
  if (!done.current) {
    // Hydratation synchrone : premier rendu complet, sans écran de chargement.
    useStudio.getState().hydrate(initial);
    done.current = true;
  }
  const sidebarCollapsed = useStudio((s) => s.prefs.sidebarCollapsed ?? false);

  // Les URLs de fichiers sont temporaires (2 h) : rafraîchissement au retour sur l'onglet.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - useStudio.getState().loadedAt > 40 * 60_000) void refreshBoard();
    };
    window.addEventListener("focus", onFocus);
    const t = setInterval(onFocus, 5 * 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, []);

  // Échap ferme le panneau ; Ctrl/Cmd+K place le focus dans la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TipProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="relative min-h-0 flex-1">{children}</main>
        </div>
      </div>
      <PublicationPanel />
      <DialogHost />
      <UploadTray />
      <Toaster />
    </TipProvider>
  );
}
