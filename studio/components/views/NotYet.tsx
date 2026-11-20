"use client";
import Link from "next/link";
import { CalendarDays, ChartNoAxesColumn, GanttChart } from "lucide-react";

const VIEWS = {
  calendrier: {
    icon: CalendarDays,
    title: "Calendrier éditorial",
    phase: "Phase 2",
    text: "Vues mois, semaine et jour, avec couleurs de statut, filtres par cycle, public, canal et statut, et déplacement d'une publication à une autre date (avec avertissement pour les publications officiellement programmées).",
  },
  timeline: {
    icon: GanttChart,
    title: "Timeline des cycles",
    phase: "Phase 2",
    text: "Vue horizontale des cycles, sessions, séances d'information et communications associées, avec zoom semaine, mois et trimestre, pour repérer les périodes où plusieurs cycles se chevauchent.",
  },
  bilan: {
    icon: ChartNoAxesColumn,
    title: "Bilan et portfolio",
    phase: "Phase 3",
    text: "Nombre de publications, cycles, visuels, vidéos, emailings et contenus web ; répartition par canal, public et nature ; filtre par période et export.",
  },
} as const;

/** Vue non encore développée : affichée explicitement, sans bouton fictif. */
export function NotYet({ view }: { view: keyof typeof VIEWS }) {
  const v = VIEWS[view];
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="max-w-md">
        <v.icon className="size-6 text-faint" />
        <div className="mt-3 flex items-center gap-2">
          <h2 className="text-[17px] font-semibold tracking-tight">{v.title}</h2>
          <span className="rounded border border-line px-1.5 text-[11px] text-faint">{v.phase}</span>
        </div>
        <p className="mt-2 text-muted">Cette vue n'est pas encore implémentée. Elle utilisera les mêmes données que le board.</p>
        <p className="mt-2 text-[12.5px] text-faint">{v.text}</p>
        <Link href="/board" className="mt-4 inline-block text-[13px] text-accent hover:underline">
          Retour au board
        </Link>
      </div>
    </div>
  );
}
