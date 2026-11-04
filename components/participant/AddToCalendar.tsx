"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiProvider, CalendarSession, PublicEvent } from "@/lib/types";
import { googleLink, outlookPersonalLink, outlookWorkLink, yahooLink } from "@/lib/links";
import { detectDevice, suggestProvider, type DeviceInfo } from "@/lib/device";
import { capitalize, formatLongDate, formatShortDate, formatTime } from "@/lib/time";
import { buildDescription, buildLocation, buildSummary } from "@/lib/content";
import {
  AppleIcon,
  FileCalendarIcon,
  GoogleCalendarIcon,
  IconCheck,
  IconChevron,
  IconCopy,
  IconExternal,
  IconInfo,
  IconWarn,
  OutlookIcon,
  YahooIcon,
} from "@/components/icons";
import Nudge from "./Nudge";

type Tile = "google" | "outlook" | "apple" | "ics" | "yahoo";
type LinkProvider = "google" | "outlook_personal" | "outlook_work" | "yahoo";
type Pref = Tile;

interface Connection {
  id: string;
  provider: ApiProvider;
  email: string | null;
  autoAdd: boolean;
}
interface Synced {
  connectionId: string;
  sessionId: string;
  state: string;
  link: string | null;
}

interface Props {
  event: PublicEvent;
  pageUrl: string;
  preview: boolean;
  enableYahoo: boolean;
  apiProviders: ApiProvider[];
  connections: Connection[];
  synced: Synced[];
  oauthResult: string | null;
  oauthError: string | null;
  registrationToken: string | null;
}

type Status =
  | null
  | {
      tone: "ready" | "success" | "info" | "error";
      title: string;
      body?: React.ReactNode;
      retry?: { label: string; href?: string; onClick?: () => void; download?: boolean };
    };

const PREF_KEY = "ephec-calendar-pref";
const LABELS: Record<Tile, string> = {
  google: "Google Agenda",
  outlook: "Outlook",
  apple: "Apple Calendrier",
  ics: "Autre calendrier",
  yahoo: "Yahoo Agenda",
};
const SUBLABELS: Record<Tile, string> = {
  google: "Gmail, Android",
  outlook: "Outlook.com, Hotmail, Microsoft 365",
  apple: "iPhone, iPad, Mac",
  ics: "Fichier compatible avec tous les agendas",
  yahoo: "Yahoo Mail",
};
const PROVIDER_NAME: Record<ApiProvider, string> = { google: "Google Agenda", microsoft: "Outlook" };

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function beacon(body: Record<string, string>) {
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([data], { type: "application/json" }));
    else void fetch("/api/track", { method: "POST", body: data, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {
    /* les statistiques ne doivent jamais gêner le participant */
  }
}

export default function AddToCalendar(props: Props) {
  const { event: ev, pageUrl, preview } = props;
  const active = useMemo(() => ev.sessions.filter((s) => s.status === "active"), [ev.sessions]);
  const multi = active.length > 1;
  const cancelled = ev.status === "cancelled";

  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [pref, setPref] = useState<Pref | null>(null);
  const [remember, setRemember] = useState(false);
  const [mode, setMode] = useState<"all" | "choose">("all");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(active.map((s) => s.id)));
  const [outlookOpen, setOutlookOpen] = useState(false);
  const [stepper, setStepper] = useState<{ provider: LinkProvider; opened: Set<string> } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [interacted, setInteracted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [synced, setSynced] = useState<Synced[]>(props.synced);
  const [copied, setCopied] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const selected: CalendarSession[] = useMemo(
    () => (mode === "all" || ev.sessionSelection === "all" ? active : active.filter((s) => chosen.has(s.id))),
    [mode, chosen, active, ev.sessionSelection]
  );
  const subset = selected.length !== active.length;
  const qs = new URLSearchParams();
  if (subset) qs.set("s", selected.map((s) => s.id).join(","));
  if (preview) qs.set("preview", "1");
  const icsHref = `/e/${ev.slug}/ics${qs.toString() ? `?${qs}` : ""}`;

  useEffect(() => {
    const d = detectDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0, navigator.platform ?? "");
    setDevice(d);
    const p = safeStorage()?.getItem(PREF_KEY) as Pref | null;
    if (p && p in LABELS) {
      setPref(p);
      setRemember(true);
    }
    if (!preview && document.visibilityState === "visible") beacon({ slug: ev.slug, kind: "view", device: d.device });
  }, [ev.slug, preview]);

  // Message après retour d'une autorisation OAuth : on n'affiche un succès que si le serveur a confirmé l'ajout.
  useEffect(() => {
    if (props.oauthError) {
      setStatus({
        tone: "error",
        title: props.oauthError === "refus" ? "Vous n'avez pas autorisé l'accès à votre agenda." : "La connexion à votre agenda n'a pas abouti.",
        body: "Aucun problème : utilisez l'ajout simple ci-dessous, il fonctionne sans connexion.",
      });
    } else if (props.oauthResult) {
      const conn = props.connections.find((c) => c.provider === props.oauthResult);
      if (conn) {
        const ok = props.synced.filter((s) => s.connectionId === conn.id && s.state === "active").length;
        const ko = props.synced.filter((s) => s.connectionId === conn.id && s.state === "error").length;
        if (ok > 0 && ko === 0)
          setStatus({
            tone: "success",
            title: ok > 1 ? `${ok} séances ajoutées à votre ${PROVIDER_NAME[conn.provider]}` : `Événement ajouté à votre ${PROVIDER_NAME[conn.provider]}`,
            body: "Ajout confirmé par votre agenda. En cas de changement d'horaire ou de lieu, il sera mis à jour automatiquement.",
          });
        else if (ok > 0)
          setStatus({ tone: "info", title: `${ok} séance(s) ajoutée(s), ${ko} en échec.`, body: "Réessayez le bouton d'ajout direct ci-dessous pour les séances manquantes." });
        else if (ko > 0) setStatus({ tone: "error", title: "Votre agenda est connecté, mais l'ajout a échoué.", body: "Réessayez avec le bouton d'ajout direct ci-dessous ou utilisez l'ajout simple." });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status) statusRef.current?.focus();
  }, [status]);

  const track = useCallback(
    (provider: string) => {
      if (!preview) beacon({ slug: ev.slug, kind: "click", provider, device: device?.device ?? "" });
    },
    [preview, ev.slug, device]
  );

  const savePref = (p: Pref) => {
    const st = safeStorage();
    if (remember) {
      st?.setItem(PREF_KEY, p);
      setPref(p);
    }
  };

  const forgetPref = () => {
    safeStorage()?.removeItem(PREF_KEY);
    setPref(null);
    setRemember(false);
  };

  const linkFor = (p: LinkProvider, s: CalendarSession) =>
    p === "google" ? googleLink(ev, s, pageUrl) : p === "outlook_personal" ? outlookPersonalLink(ev, s, pageUrl) : p === "outlook_work" ? outlookWorkLink(ev, s, pageUrl) : yahooLink(ev, s, pageUrl);

  const providerTitle = (p: LinkProvider) =>
    p === "google" ? "Google Agenda" : p === "outlook_personal" ? "Outlook.com" : p === "outlook_work" ? "Outlook (Microsoft 365)" : "Yahoo Agenda";

  const readyStatus = (p: LinkProvider, href: string): Status => ({
    tone: "ready",
    title: "Votre calendrier est prêt, il ne reste plus qu'à enregistrer l'événement.",
    body: (
      <>
        Dans l&apos;onglet {providerTitle(p)} qui vient de s&apos;ouvrir, vérifiez les informations puis cliquez sur <strong>« Enregistrer »</strong>.
        {p !== "google" && p !== "yahoo" && " Connectez-vous d'abord si votre compte vous le demande."}
      </>
    ),
    retry: { label: "Rien ne s'est ouvert ? Réessayer", href },
  });

  const onLinkClick = (p: LinkProvider, s: CalendarSession, tile: Tile) => {
    setInteracted(true);
    track(p);
    savePref(tile);
    setStatus(readyStatus(p, linkFor(p, s)));
  };

  const startStepper = (p: LinkProvider, tile: Tile) => {
    setInteracted(true);
    savePref(tile);
    setStatus(null);
    setStepper({ provider: p, opened: new Set() });
  };

  const fileStatus = (): Status => {
    const os = device?.os;
    const many = selected.length > 1;
    let body: React.ReactNode;
    if (os === "ios" || os === "ipados")
      body = (
        <>
          Votre {os === "ios" ? "iPhone" : "iPad"} affiche {many ? "les séances" : "l'événement"} : touchez <strong>« {many ? "Tout ajouter" : "Ajouter au calendrier"} »</strong>, puis choisissez votre calendrier.
        </>
      );
    else if (os === "macos")
      body = (
        <>
          Le fichier vient d&apos;être téléchargé. Ouvrez-le (dans vos téléchargements) : l&apos;app Calendrier vous proposera de l&apos;ajouter. Confirmez avec <strong>« OK »</strong>.
        </>
      );
    else if (os === "android")
      body = <>Ouvrez le fichier téléchargé depuis la notification. Si aucune application ne le reconnaît, choisissez plutôt « Google Agenda » ci-dessus.</>;
    else if (os === "windows")
      body = <>Ouvrez le fichier téléchargé : Outlook ou l&apos;application Calendrier vous proposera d&apos;enregistrer {many ? "les séances" : "l'événement"}.</>;
    else body = <>Ouvrez le fichier téléchargé avec votre application de calendrier pour enregistrer {many ? "les séances" : "l'événement"}.</>;
    return {
      tone: "ready",
      title: many ? `Votre fichier avec ${selected.length} séances est prêt.` : "Votre fichier calendrier est prêt.",
      body: (
        <>
          {body}
          {device?.inApp && <span className="mt-2 block">Rien ne se passe ? Ouvrez cette page dans votre navigateur habituel (menu ⋯ ou ⋮ → « Ouvrir dans le navigateur »).</span>}
          <span className="mt-2 block text-sm">
            Si vous aviez déjà importé ce fichier, votre calendrier peut créer un doublon : nous ne pouvons pas le vérifier pour un fichier.
          </span>
        </>
      ),
      retry: { label: "Télécharger à nouveau", href: icsHref, download: true },
    };
  };

  const onFileClick = (tile: Tile, provider: string) => {
    setInteracted(true);
    track(provider);
    savePref(tile);
    setStatus(fileStatus());
  };

  async function apiAdd(conn: Connection) {
    setBusy(conn.id);
    setInteracted(true);
    setStatus(null);
    track(conn.provider === "google" ? "api_google" : "api_microsoft");
    try {
      const res = await fetch("/api/connected/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: ev.slug, connectionId: conn.id, sessionIds: selected.map((s) => s.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ tone: "error", title: data.error ?? "L'ajout n'a pas abouti.", body: data.reconnect ? "Reconnectez votre agenda, ou utilisez l'ajout simple ci-dessus." : "Vous pouvez utiliser l'ajout simple ci-dessus." });
        return;
      }
      const results: { sessionId: string; outcome: string; link: string | null; error?: string }[] = data.results;
      const ok = results.filter((r) => r.outcome === "added" || r.outcome === "already");
      const already = results.filter((r) => r.outcome === "already").length;
      const ko = results.filter((r) => r.outcome === "error");
      setSynced((prev) => [
        ...prev.filter((p) => !(p.connectionId === conn.id && results.some((r) => r.sessionId === p.sessionId))),
        ...results.map((r) => ({ connectionId: conn.id, sessionId: r.sessionId, state: r.outcome === "error" ? "error" : "active", link: r.link })),
      ]);
      const name = PROVIDER_NAME[conn.provider];
      const link = ok.find((r) => r.link)?.link;
      if (ko.length === 0)
        setStatus({
          tone: "success",
          title:
            already === ok.length
              ? ok.length > 1
                ? `Ces ${ok.length} séances sont déjà dans votre ${name}.`
                : `Cet événement est déjà dans votre ${name}.`
              : ok.length > 1
                ? `${ok.length} séances ajoutées à votre ${name}`
                : `Événement ajouté à votre ${name}`,
          body: (
            <>
              Ajout vérifié auprès de votre agenda{already && already < ok.length ? ` (${already} déjà présente(s), sans doublon)` : ""}. Les changements éventuels y seront reportés automatiquement.
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 font-semibold underline underline-offset-4">
                  Voir dans {name} <IconExternal />
                </a>
              )}
            </>
          ),
        });
      else
        setStatus({
          tone: ok.length ? "info" : "error",
          title: ok.length ? `${ok.length} séance(s) ajoutée(s), ${ko.length} non ajoutée(s).` : "L'ajout n'a pas abouti.",
          body: "Réessayez dans un instant, ou utilisez l'ajout simple ci-dessus.",
        });
    } catch {
      setStatus({ tone: "error", title: "Connexion interrompue.", body: "Vérifiez votre connexion Internet puis réessayez, ou utilisez l'ajout simple ci-dessus." });
    } finally {
      setBusy(null);
    }
  }

  async function copyDetails() {
    const lines = [
      ev.title,
      ...selected.map((s) => `${capitalize(formatLongDate(s.date))}, ${formatTime(s.startTime)} – ${formatTime(s.endTime)}${s.title && multi ? ` (${s.title})` : ""}`),
      buildLocation(ev, selected[0] ?? active[0]),
      ev.format !== "onsite" && ev.onlineUrl ? `Lien : ${ev.onlineUrl}` : "",
      `Infos : ${pageUrl}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      track("copy");
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopied(false);
    }
  }

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setStatus({ tone: "info", title: "Lien copié.", body: "Collez-le dans Safari ou Chrome pour continuer." });
    } catch {
      /* rien */
    }
  }

  // Ordre des tuiles : préférence mémorisée > suggestion selon l'appareil > ordre par défaut.
  const suggested = device ? suggestProvider(device) : null;
  const baseOrder: Tile[] = ["google", "outlook", "apple", "ics", ...(props.enableYahoo ? (["yahoo"] as Tile[]) : [])];
  const top = pref ?? suggested;
  const order = top ? [top, ...baseOrder.filter((t) => t !== top)] : baseOrder;

  if (cancelled) {
    return (
      <div className="shape-lg bg-white p-6 sm:p-8">
        <h2 id="ajouter-titre" className="text-xl font-bold">
          Vous l&apos;aviez ajouté à votre calendrier ?
        </h2>
        <p className="mt-2 text-muted">
          Si vous aviez connecté votre agenda sur cette page, l&apos;événement y est déjà marqué « ANNULÉ ». Sinon, supprimez-le simplement de votre calendrier.
        </p>
        <a href={`/e/${ev.slug}/ics?annulation=1`} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line px-5 font-semibold text-ink hover:border-brand">
          Télécharger l&apos;avis d&apos;annulation (.ics)
        </a>
        <p className="mt-2 text-sm text-muted">Certains calendriers (Outlook, Apple) savent retirer l&apos;événement avec ce fichier ; d&apos;autres non.</p>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="shape-lg bg-white p-6 sm:p-8">
        <h2 id="ajouter-titre" className="text-xl font-bold">
          Les dates seront bientôt communiquées
        </h2>
      </div>
    );
  }

  const tileClass =
    "group relative flex min-h-[4.25rem] w-full items-center gap-4 rounded-2xl border-2 border-line bg-white px-4 py-3 text-left transition hover:border-brand hover:shadow-[0_6px_20px_-10px_rgba(16,66,63,.35)] focus-visible:border-brand-700 active:scale-[.99]";

  const tileInner = (t: Tile, icon: React.ReactNode, tag?: string) => (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[1.05rem] font-semibold leading-snug text-ink">{LABELS[t]}</span>
        <span className="block text-sm leading-snug text-muted">{SUBLABELS[t]}</span>
      </span>
      {tag && <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 sm:inline">{tag}</span>}
      <IconChevron className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
    </>
  );

  const tagFor = (t: Tile) => (pref === t ? "Votre choix habituel" : !pref && suggested === t ? "Suggéré pour cet appareil" : undefined);
  const single = selected.length === 1 ? selected[0] : null;

  function renderTile(t: Tile) {
    const tag = tagFor(t);
    const describedBy = tag ? { "aria-description": tag } : {};
    switch (t) {
      case "google":
        return single ? (
          <a href={linkFor("google", single)} target="_blank" rel="noopener noreferrer" className={tileClass} onClick={() => onLinkClick("google", single, "google")} {...describedBy}>
            {tileInner("google", <GoogleCalendarIcon />, tag)}
            <span className="sr-only">(ouvre un nouvel onglet)</span>
          </a>
        ) : (
          <button type="button" className={tileClass} onClick={() => startStepper("google", "google")} {...describedBy}>
            {tileInner("google", <GoogleCalendarIcon />, tag)}
          </button>
        );
      case "yahoo":
        return single ? (
          <a href={linkFor("yahoo", single)} target="_blank" rel="noopener noreferrer" className={tileClass} onClick={() => onLinkClick("yahoo", single, "yahoo")}>
            {tileInner("yahoo", <YahooIcon />, tag)}
            <span className="sr-only">(ouvre un nouvel onglet)</span>
          </a>
        ) : (
          <button type="button" className={tileClass} onClick={() => startStepper("yahoo", "yahoo")}>
            {tileInner("yahoo", <YahooIcon />, tag)}
          </button>
        );
      case "outlook":
        return (
          <div>
            <button type="button" className={tileClass} aria-expanded={outlookOpen} aria-controls="outlook-choices" onClick={() => setOutlookOpen((o) => !o)} {...describedBy}>
              {tileInner("outlook", <OutlookIcon />, tag)}
            </button>
            {outlookOpen && (
              <div id="outlook-choices" className="animate-rise mt-2 space-y-2 rounded-2xl bg-canvas p-3">
                <p className="px-1 text-sm font-medium text-muted">Quel type de compte Outlook utilisez-vous ?</p>
                {(
                  [
                    ["outlook_personal", "Compte personnel", "Outlook.com, Hotmail, Live, MSN"],
                    ["outlook_work", "Compte professionnel ou scolaire", "Microsoft 365, adresse de votre employeur"],
                  ] as const
                ).map(([p, label, sub]) =>
                  single ? (
                    <a
                      key={p}
                      href={linkFor(p, single)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 font-semibold text-ink ring-1 ring-line hover:ring-brand"
                      onClick={() => onLinkClick(p, single, "outlook")}
                    >
                      <span>
                        {label}
                        <span className="block text-sm font-normal text-muted">{sub}</span>
                      </span>
                      <IconExternal className="size-4 shrink-0 text-muted" />
                      <span className="sr-only">(ouvre un nouvel onglet)</span>
                    </a>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 text-left font-semibold text-ink ring-1 ring-line hover:ring-brand"
                      onClick={() => startStepper(p, "outlook")}
                    >
                      <span>
                        {label}
                        <span className="block text-sm font-normal text-muted">{sub}</span>
                      </span>
                      <IconChevron className="size-4 shrink-0 text-muted" />
                    </button>
                  )
                )}
                <a
                  href={icsHref}
                  download
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 font-semibold text-ink ring-1 ring-line hover:ring-brand"
                  onClick={() => onFileClick("outlook", "outlook_desktop")}
                >
                  <span>
                    Application Outlook sur ordinateur
                    <span className="block text-sm font-normal text-muted">
                      {selected.length > 1 ? `Un seul fichier pour les ${selected.length} séances` : "Windows ou Mac"}
                    </span>
                  </span>
                  <FileCalendarIcon className="size-6 shrink-0" />
                </a>
              </div>
            )}
          </div>
        );
      case "apple":
        // Pas d'attribut download : Safari sur iPhone/iPad affiche directement la fiche « Ajouter au calendrier ».
        return (
          <a href={icsHref} className={tileClass} onClick={() => onFileClick("apple", "apple")} {...describedBy}>
            {tileInner("apple", <AppleIcon />, tag)}
          </a>
        );
      case "ics":
        return (
          <a href={icsHref} download className={tileClass} onClick={() => onFileClick("ics", "ics")} {...describedBy}>
            {tileInner("ics", <FileCalendarIcon />, tag)}
          </a>
        );
    }
  }

  const apiAvailable = props.apiProviders.length > 0;
  const syncedFor = (c: Connection) => selected.filter((s) => synced.some((x) => x.connectionId === c.id && x.sessionId === s.id && x.state === "active")).length;
  const connectQs = new URLSearchParams({ e: ev.slug });
  if (subset) connectQs.set("s", selected.map((s) => s.id).join(","));

  return (
    <div className="shape-lg bg-white p-5 shadow-[0_1px_3px_rgba(16,66,63,.08),0_12px_32px_-12px_rgba(16,66,63,.18)] sm:p-8">
      <h2 id="ajouter-titre" ref={headingRef} tabIndex={-1} className="text-xl font-bold text-ink sm:text-2xl">
        Ajouter à mon calendrier
      </h2>
      <p className="mt-1 text-muted">Choisissez votre calendrier : toutes les informations sont déjà remplies.</p>

      {device?.inApp && (
        <div className="mt-4 flex gap-3 rounded-xl bg-warn-50 p-4 text-sm text-warn">
          <IconInfo className="mt-0.5 size-5 shrink-0" />
          <div>
            Vous consultez cette page dans l&apos;application {device.inAppName === "application" ? "de messagerie" : device.inAppName}. Si un bouton ne réagit pas, ouvrez la page dans{" "}
            {device.os === "ios" || device.os === "ipados" ? "Safari" : "Chrome"} (menu ⋯ ou ⋮ → « Ouvrir dans le navigateur »).
            <button type="button" onClick={copyPageLink} className="mt-2 block font-semibold underline underline-offset-4">
              Copier le lien de cette page
            </button>
          </div>
        </div>
      )}

      {multi && ev.sessionSelection === "choose" && (
        <fieldset className="mt-6">
          <legend className="font-semibold text-ink">Quelles séances ajouter ?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["all", `Toutes les séances (${active.length})`],
                ["choose", "Choisir mes séances"],
              ] as const
            ).map(([v, label]) => (
              <label
                key={v}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2 font-medium ${mode === v ? "border-brand-700 bg-brand-50" : "border-line"}`}
              >
                <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="size-5 accent-[#1d7a75]" />
                {label}
              </label>
            ))}
          </div>
          {mode === "choose" && (
            <div className="animate-rise mt-3 rounded-xl bg-canvas p-3">
              <div className="mb-2 flex items-center justify-between px-1 text-sm">
                <span className="text-muted" aria-live="polite">
                  {chosen.size} séance{chosen.size > 1 ? "s" : ""} sélectionnée{chosen.size > 1 ? "s" : ""}
                </span>
                <span className="flex gap-3">
                  <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setChosen(new Set(active.map((s) => s.id)))}>
                    Tout cocher
                  </button>
                  <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setChosen(new Set())}>
                    Tout décocher
                  </button>
                </span>
              </div>
              <ul className="max-h-80 space-y-1 overflow-auto">
                {active.map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-white">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 accent-[#1d7a75]"
                        checked={chosen.has(s.id)}
                        onChange={(e) => {
                          const n = new Set(chosen);
                          if (e.target.checked) n.add(s.id);
                          else n.delete(s.id);
                          setChosen(n);
                          setStepper(null);
                        }}
                      />
                      <span>
                        <span className="font-medium">
                          {s.index}. {capitalize(formatShortDate(s.date))}, {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        </span>
                        {s.title && <span className="block text-sm text-muted">{s.title}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>
      )}
      {multi && ev.sessionSelection === "all" && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-brand-900">
          Les <strong>{active.length} séances</strong> seront ajoutées, chacune à sa date et à son horaire.
        </p>
      )}

      {selected.length === 0 ? (
        <p className="mt-6 rounded-xl bg-warn-50 p-4 font-medium text-warn" role="status">
          Cochez au moins une séance pour continuer.
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-3" aria-label="Calendriers disponibles">
            {order.map((t) => (
              <li key={t}>{renderTile(t)}</li>
            ))}
          </ul>

          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm text-muted">
            <input
              type="checkbox"
              className="size-5 accent-[#1d7a75]"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                if (!e.target.checked) forgetPref();
              }}
            />
            <span>
              Retenir mon choix sur cet appareil
              {pref && (
                <>
                  {" "}
                  (actuellement : {LABELS[pref]} ·{" "}
                  <button type="button" onClick={forgetPref} className="font-semibold text-brand-700 underline">
                    oublier
                  </button>
                  )
                </>
              )}
            </span>
          </label>
        </>
      )}

      {stepper && selected.length > 1 && (
        <div className="animate-rise mt-6 rounded-2xl border-2 border-brand-100 bg-brand-50/50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-ink">
              {providerTitle(stepper.provider)} : {selected.length} séances à enregistrer
            </h3>
            <button type="button" onClick={() => setStepper(null)} className="text-sm font-semibold text-brand-700 underline">
              Fermer
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">
            {providerTitle(stepper.provider)} n&apos;accepte qu&apos;une séance à la fois par lien. Ouvrez chaque séance puis cliquez sur « Enregistrer » dans l&apos;onglet ouvert.
          </p>
          <ol className="mt-3 space-y-2">
            {selected.map((s) => {
              const done = stepper.opened.has(s.id);
              return (
                <li key={s.id}>
                  <a
                    href={linkFor(stepper.provider, s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      track(stepper.provider);
                      setStepper({ ...stepper, opened: new Set(stepper.opened).add(s.id) });
                    }}
                    className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-2 ring-1 transition ${done ? "bg-white/60 ring-line" : "bg-white ring-line hover:ring-brand"}`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-800"}`}>
                      {done ? <IconCheck className="size-4" /> : s.index}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {capitalize(formatShortDate(s.date))}, {formatTime(s.startTime)}
                      </span>
                      <span className="block text-sm text-muted">{done ? "Onglet ouvert — pensez à enregistrer" : "Ouvrir dans un nouvel onglet"}</span>
                    </span>
                    <IconExternal className="size-4 shrink-0 text-muted" />
                  </a>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 rounded-xl bg-white p-3 text-sm">
            <p className="font-semibold">Plus rapide :</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              {apiAvailable && (
                <li>
                  connectez votre agenda ci-dessous : toutes les séances sont ajoutées <strong>en une fois</strong> et mises à jour en cas de changement ;
                </li>
              )}
              <li>
                ou{" "}
                <a href={icsHref} download className="font-semibold text-brand-700 underline" onClick={() => onFileClick("ics", "ics")}>
                  téléchargez un fichier unique
                </a>{" "}
                contenant toutes les séances (Outlook sur ordinateur, Apple Calendrier…).
              </li>
            </ul>
          </div>
        </div>
      )}

      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {status && (
          <div
            role={status.tone === "error" ? "alert" : "status"}
            className={`animate-rise mt-6 flex gap-3 rounded-2xl p-4 sm:p-5 ${
              status.tone === "success" ? "bg-ok-50 text-ok" : status.tone === "error" ? "bg-danger-50 text-danger" : "bg-brand-50 text-brand-900"
            }`}
          >
            {status.tone === "success" ? (
              <IconCheck className="mt-0.5 size-6 shrink-0" />
            ) : status.tone === "error" ? (
              <IconWarn className="mt-0.5 size-6 shrink-0" />
            ) : (
              <IconInfo className="mt-0.5 size-6 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold">{status.title}</p>
              {status.body && <div className="mt-1 text-[0.95rem] text-ink/80">{status.body}</div>}
              {status.retry && (
                <a
                  href={status.retry.href}
                  {...(status.retry.download ? { download: true } : { target: "_blank", rel: "noopener noreferrer" })}
                  className="mt-2 inline-block font-semibold underline underline-offset-4"
                >
                  {status.retry.label}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {apiAvailable && selected.length > 0 && (
        <section aria-labelledby="direct-titre" className="mt-8 border-t border-line pt-6">
          <h3 id="direct-titre" className="font-bold text-ink">
            Ajout direct et mises à jour automatiques
          </h3>
          <p className="mt-1 text-sm text-muted">
            Autorisez une fois l&apos;EPHEC à ajouter ses événements dans votre agenda Google ou Outlook. L&apos;ajout est vérifié, sans doublon, et les changements d&apos;horaire ou de lieu vous parviennent automatiquement. Vous pouvez retirer cet accès à tout moment.
          </p>
          <div className="mt-4 space-y-2">
            {props.connections.map((c) => {
              const n = syncedFor(c);
              const all = n === selected.length;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => apiAdd(c)}
                  className="shape flex min-h-14 w-full items-center justify-center gap-3 bg-brand-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {c.provider === "google" ? <GoogleCalendarIcon className="size-7 rounded bg-white" /> : <OutlookIcon className="size-7 rounded bg-white" />}
                  <span>
                    {busy === c.id
                      ? "Ajout en cours…"
                      : all
                        ? `Déjà dans votre ${PROVIDER_NAME[c.provider]} — vérifier à nouveau`
                        : `Ajouter directement${selected.length > 1 ? ` les ${selected.length} séances` : ""} à ${PROVIDER_NAME[c.provider]}`}
                    {c.email && <span className="block text-sm font-normal opacity-90">{c.email}</span>}
                  </span>
                </button>
              );
            })}
            <div className="grid gap-2 sm:grid-cols-2">
              {props.apiProviders
                .filter((p) => !props.connections.some((c) => c.provider === p))
                .map((p) => (
                  <a
                    key={p}
                    href={preview ? undefined : `/connect/${p}?${connectQs}`}
                    aria-disabled={preview}
                    onClick={() => setInteracted(true)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-700 px-4 py-2 font-semibold text-brand-800 hover:bg-brand-50 aria-disabled:opacity-50"
                  >
                    {p === "google" ? <GoogleCalendarIcon className="size-6" /> : <OutlookIcon className="size-6" />}
                    Connecter {PROVIDER_NAME[p]}
                  </a>
                ))}
            </div>
          </div>
        </section>
      )}

      <details className="mt-8 border-t border-line pt-4 text-sm">
        <summary className="cursor-pointer py-2 font-semibold text-ink">Autres options</summary>
        <div className="mt-2 space-y-4 text-muted">
          <div>
            <button type="button" onClick={copyDetails} className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 underline underline-offset-4">
              <IconCopy className="size-4" /> {copied ? "Informations copiées ✓" : "Copier les informations de l'événement"}
            </button>
            <p>Pour les coller dans une note, un message ou un agenda non listé.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">Rester synchronisé par abonnement</p>
            <p>
              Votre calendrier consulte régulièrement la page EPHEC et reporte les changements. Le délai dépend du calendrier (de quelques minutes à plus de 24 h pour Google).
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              <a
                className="font-semibold text-brand-700 underline underline-offset-4"
                href={`webcal://${pageUrl.replace(/^https?:\/\//, "")}/feed.ics`}
                onClick={() => track("subscribe")}
              >
                Apple / Outlook (abonnement)
              </a>
              <a
                className="font-semibold text-brand-700 underline underline-offset-4"
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`webcal://${pageUrl.replace(/^https?:\/\//, "")}/feed.ics`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("subscribe")}
              >
                Google (abonnement)
              </a>
            </div>
          </div>
          <p>
            Les ajouts par lien ou par fichier créent une copie indépendante dans votre calendrier : elle n&apos;est pas mise à jour automatiquement. En cas de changement, l&apos;EPHEC vous préviendra par email.
          </p>
        </div>
      </details>

      <Nudge
        enabled={!interacted && !preview}
        eventKey={ev.slug}
        targetId="ajouter"
        onChoose={() => {
          headingRef.current?.focus();
        }}
      />
      {/* Données utiles aux lecteurs d'écran : résumé de ce qui sera ajouté */}
      <p className="sr-only">
        {selected.length > 0 && `${buildSummary(ev, selected[0])}. ${buildDescription(ev, selected[0], { pageUrl }).split("\n")[0]}`}
      </p>
    </div>
  );
}
