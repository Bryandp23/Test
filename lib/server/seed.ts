import "server-only";
import type { Queryable } from "./db";
import { hashPassword } from "./crypto";
import { saveEventTx } from "./events";
import type { EventInput } from "@/lib/types";

const DEMO_NOTE =
  "\n\n[Événement de démonstration — dates, lieux et liens fictifs, non officiels.]";
const FAKE_TEAMS = "https://teams.microsoft.com/l/meetup-join/LIEN-FICTIF-DEMONSTRATION-EPHEC";
const WOLUWE = "Avenue Konrad Adenauer 3, 1200 Woluwe-Saint-Lambert";
const LLN = "Avenue du Ciseau 15, 1348 Louvain-la-Neuve";

export function demoEvents(): EventInput[] {
  const base = {
    infoUrl: "https://www.ephec.be",
    organizerName: "Formation Continue EPHEC",
    organizerEmail: "",
    organizerPhone: "",
    imageUrl: "",
    timezone: "Europe/Brussels",
    room: "",
    onlinePlatform: "",
  };
  const webinar: EventInput = {
    ...base,
    title: "Webinaire gratuit — Découvrir les applications de l'IA",
    type: "webinaire",
    description:
      "Une heure pour comprendre concrètement ce que l'intelligence artificielle peut apporter à votre quotidien professionnel, avec des exemples simples et une séance de questions-réponses." +
      DEMO_NOTE,
    format: "online",
    locationName: "",
    address: "",
    onlineUrl: FAKE_TEAMS,
    onlinePlatform: "Microsoft Teams",
    reminderMinutes: 60,
    sessionSelection: "all",
    sessions: [{ date: "2026-11-19", startTime: "12:00", endTime: "13:00" }],
  };
  const sports: EventInput = {
    ...base,
    title: "Certificat en Sports Business",
    type: "formation",
    description:
      "Formation continue destinée aux professionnels du secteur sportif : marketing, sponsoring, gestion d'événements et modèles économiques des organisations sportives." +
      DEMO_NOTE,
    format: "onsite",
    locationName: "EPHEC — Campus de Woluwe",
    address: WOLUWE,
    room: "à confirmer",
    onlineUrl: "",
    reminderMinutes: 1440,
    sessionSelection: "all",
    sessions: [
      { date: "2027-02-02", startTime: "18:00", endTime: "21:00", title: "Économie du sport et acteurs du secteur" },
      { date: "2027-02-09", startTime: "18:00", endTime: "21:00", title: "Marketing sportif et marques" },
      { date: "2027-02-23", startTime: "18:00", endTime: "21:00", title: "Sponsoring et partenariats" },
      {
        date: "2027-03-06",
        startTime: "09:00",
        endTime: "16:30",
        title: "Journée intensive : organisation d'un événement sportif",
        locationName: "EPHEC — Campus de Louvain-la-Neuve",
        address: LLN,
        room: "à confirmer",
      },
      { date: "2027-03-23", startTime: "18:00", endTime: "21:00", title: "Droit du sport et contrats" },
      { date: "2027-03-30", startTime: "18:00", endTime: "21:00", title: "Présentation des projets et clôture" },
    ],
  };
  const titles = [
    "Comprendre l'IA générative",
    "Méthodes de travail avec l'IA",
    "IA et créativité",
    "Éthique et responsabilité",
    "IA et management d'équipe",
    "IA et relation client",
    "Données personnelles et RGPD",
    "Atelier pratique : cas d'entreprise",
    "Séance de clôture",
  ];
  const dates = ["2027-01-14", "2027-01-21", "2027-01-28", "2027-02-04", "2027-02-11", "2027-02-25", "2027-03-04", "2027-03-11", "2027-04-01"];
  const cycle: EventInput = {
    ...base,
    title: "Cycle IA & Humain",
    type: "formation",
    description:
      "Neuf séances pour apprivoiser l'intelligence artificielle sans perdre de vue l'humain : usages, limites, éthique et mise en pratique. Participation sur place ou à distance." +
      DEMO_NOTE,
    format: "hybrid",
    locationName: "EPHEC — Campus de Woluwe",
    address: WOLUWE,
    room: "à confirmer",
    onlineUrl: FAKE_TEAMS,
    onlinePlatform: "Microsoft Teams",
    reminderMinutes: 120,
    sessionSelection: "choose",
    sessions: dates.map((date, i) => ({ date, startTime: "18:30", endTime: "20:30", title: titles[i] })),
  };
  return [webinar, sports, cycle];
}

export async function seedIfEmpty(db: Queryable) {
  const users = await db.query<{ n: number }>(`select count(*)::int as n from users`);
  if (users[0].n === 0) {
    const isProd = process.env.NODE_ENV === "production";
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      await db.query(`insert into users (email, name, role, password_hash) values ($1,$2,'admin',$3)`, [email, process.env.ADMIN_NAME ?? "Administrateur", await hashPassword(password)]);
    } else if (!isProd || process.env.ALLOW_DEMO_ACCOUNTS) {
      // Comptes de démonstration — à remplacer avant toute mise en production.
      await db.query(`insert into users (email, name, role, password_hash) values ($1,$2,'admin',$3)`, ["admin@ephec.local", "Admin démo", await hashPassword("Demo-EPHEC-2026!")]);
      await db.query(`insert into users (email, name, role, password_hash) values ($1,$2,'editor',$3)`, ["editeur@ephec.local", "Éditeur démo", await hashPassword("Demo-Editeur-2026!")]);
    } else {
      throw new Error("Aucun administrateur : définissez ADMIN_EMAIL et ADMIN_PASSWORD pour le premier démarrage.");
    }
  }
  const events = await db.query<{ n: number }>(`select count(*)::int as n from events`);
  if (events[0].n === 0 && process.env.SEED_DEMO !== "false") {
    for (const input of demoEvents()) {
      const r = await saveEventTx(db, { input, userId: null, isDemo: true });
      await db.query(`update events set status='published', published_at=now() where id=$1`, [r.id]);
    }
  }
}
