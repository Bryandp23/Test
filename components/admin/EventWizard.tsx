"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventFormat, EventInput, EventStatus, EventType, SessionInput } from "@/lib/types";
import { EVENT_TYPE_LABELS, REMINDER_OPTIONS } from "@/lib/types";
import { sortSessions, validateEvent, type ValidationIssue } from "@/lib/validation";
import { addWeek, detectPlatform } from "@/lib/templates";
import { capitalize, formatLongDate, formatTime, durationMinutes, todayIn } from "@/lib/time";
import { inputToPublic } from "@/lib/preview";
import { buildDescription, buildLocation, buildSummary } from "@/lib/content";
import { Button, RadioCards, Select, TextArea, TextField } from "@/components/ui/fields";
import { AppleIcon, FileCalendarIcon, GoogleCalendarIcon, IconCheck, IconPin, IconPlus, IconTrash, IconVideo, IconWarn, OutlookIcon } from "@/components/icons";

interface Props {
  mode: "create" | "edit";
  initial: EventInput;
  eventId?: string;
  slug?: string;
  status?: EventStatus;
  publishedOnce?: boolean;
  baseUrl: string;
  connectedCount?: number;
}

const STEP_FIELDS: ((f: string) => boolean)[] = [
  (f) => ["title", "type", "description", "infoUrl", "organizerName", "organizerEmail", "organizerPhone", "imageUrl"].includes(f),
  (f) => !["title", "type", "description", "infoUrl", "organizerName", "organizerEmail", "organizerPhone", "imageUrl"].includes(f),
];
const STEPS = ["Informations générales", "Dates et infos pratiques", "Vérification et publication"];

type SaveOutcome = {
  changes: string[];
  sync: { connected: number; updated: number; failed: number; removedByUser: number; errors: string[] } | null;
  changeEmail: string | null;
};

export default function EventWizard(props: Props) {
  const router = useRouter();
  const [input, setInput] = useState<EventInput>(props.initial);
  const [step, setStep] = useState(0);
  const [touchedSteps, setTouchedSteps] = useState<Set<number>>(new Set(props.mode === "edit" ? [0, 1] : []));
  const [saving, setSaving] = useState<null | "draft" | "publish" | "save">(null);
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [placeOpen, setPlaceOpen] = useState<Set<number>>(
    () => new Set(props.initial.sessions.map((s, i) => (s.address || s.locationName || s.room || s.onlineUrl ? i : -1)).filter((i) => i >= 0))
  );
  const [advanced, setAdvanced] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isPublished = props.status === "published" || props.status === "cancelled";

  const today = todayIn("Europe/Brussels");
  const validation = useMemo(() => validateEvent(input, "publish", today), [input, today]);
  const draftValidation = useMemo(() => validateEvent(input, "draft"), [input]);
  const issueFor = (field: string, list: ValidationIssue[] = validation.errors) =>
    [...serverIssues.filter((i) => i.field === field), ...list.filter((i) => i.field === field)][0]?.message;
  const show = (s: number) => touchedSteps.has(s);
  const err = (field: string, s: number) => (show(s) ? issueFor(field) : undefined);
  const warn = (field: string, s: number) => (show(s) ? validation.warnings.find((w) => w.field === field)?.message : undefined);

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => {
    setInput((i) => ({ ...i, [k]: v }));
    setServerIssues([]);
    setOutcome(null);
  };
  const setSession = (idx: number, patch: Partial<SessionInput>) => {
    setInput((i) => ({ ...i, sessions: i.sessions.map((s, k) => (k === idx ? { ...s, ...patch } : s)) }));
    setServerIssues([]);
    setOutcome(null);
  };
  const activeSessions = input.sessions.filter((s) => s.status !== "cancelled");
  const multi = activeSessions.length > 1;

  function addSession() {
    setInput((i) => {
      const last = sortSessions(i.sessions.filter((s) => s.status !== "cancelled" && s.date)).at(-1) ?? i.sessions.at(-1);
      const next: SessionInput = { date: last ? addWeek(last.date) : "", startTime: last?.startTime ?? "", endTime: last?.endTime ?? "" };
      return { ...i, sessions: [...i.sessions, next] };
    });
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-session-date]");
      inputs[inputs.length - 1]?.focus();
    }, 30);
  }
  function removeSession(idx: number) {
    const s = input.sessions[idx];
    if (s.id && isPublished) {
      if (!confirm("Cette séance a déjà été publiée. Elle sera marquée « annulée » (et retirée des calendriers connectés). Continuer ?")) return;
      setSession(idx, { status: "cancelled" });
      return;
    }
    setInput((i) => ({ ...i, sessions: i.sessions.filter((_, k) => k !== idx) }));
  }
  function sortNow() {
    setInput((i) => ({ ...i, sessions: sortSessions(i.sessions) }));
  }

  function stepErrors(s: number) {
    if (s === 2) return validation.errors;
    return validation.errors.filter((e) => STEP_FIELDS[s](e.field.split(".")[0] === "sessions" ? "sessions" : e.field));
  }

  function go(to: number) {
    // On peut toujours revenir en arrière ; pour avancer, l'étape courante doit être correcte.
    setTouchedSteps((t) => new Set(t).add(step));
    if (to > step && stepErrors(step).length > 0) {
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 30);
      return;
    }
    if (step === 1) sortNow();
    setStep(to);
    setTimeout(() => headingRef.current?.focus(), 30);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function save(kind: "draft" | "publish" | "save") {
    setSaving(kind);
    setServerError(null);
    setServerIssues([]);
    try {
      const res = await fetch(props.eventId ? `/api/admin/events/${props.eventId}` : "/api/admin/events", {
        method: props.eventId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { ...input, sessions: sortSessions(input.sessions) }, publish: kind === "publish" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "L'enregistrement n'a pas abouti.");
        if (data.issues) {
          setServerIssues(data.issues);
          setTouchedSteps(new Set([0, 1, 2]));
        }
        return;
      }
      if (kind === "publish" && !isPublished) {
        router.push(`/admin/evenements/${data.id}/partager?publie=1`);
        return;
      }
      if (!props.eventId) {
        router.push(`/admin/evenements/${data.id}?enregistre=1`);
        return;
      }
      setInput(data.input ?? input);
      setOutcome({ changes: data.changes ?? [], sync: data.sync ?? null, changeEmail: data.changeEmail ?? null });
      router.refresh();
    } catch {
      setServerError("Connexion interrompue. Vos informations sont toujours là : réessayez.");
    } finally {
      setSaving(null);
    }
  }

  const preview = useMemo(() => inputToPublic(input, { id: props.eventId, slug: props.slug, status: props.status }), [input, props.eventId, props.slug, props.status]);
  const firstSession = preview.sessions.find((s) => s.status === "active");
  const pageUrl = `${props.baseUrl}/e/${props.slug ?? "…"}`;

  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Étapes" className="mb-6">
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((label, i) => {
            const current = i === step;
            const done = i < step || (props.mode === "edit" && i !== step);
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => (i < step || props.mode === "edit" ? go(i) : i === step + 1 ? go(i) : undefined)}
                  aria-current={current ? "step" : undefined}
                  className={`w-full rounded-xl border-b-4 px-1 pb-2 pt-1 text-left transition ${current ? "border-brand-700" : done ? "border-brand-100" : "border-line"}`}
                >
                  <span className={`block text-xs font-semibold uppercase tracking-wide ${current ? "text-brand-700" : "text-muted"}`}>Étape {i + 1}</span>
                  <span className={`block text-sm font-semibold sm:text-base ${current ? "text-ink" : "text-muted"}`}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="shape-lg bg-white p-5 shadow-sm sm:p-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none sm:text-2xl">
          {STEPS[step]}
        </h2>

        {step === 0 && (
          <div className="mt-6 space-y-6">
            <TextField
              label="Nom de l'événement"
              value={input.title}
              onChange={(v) => set("title", v)}
              placeholder="Ex. Certificat en Sports Business"
              hint="Tel qu'il apparaîtra dans le calendrier, précédé de « EPHEC | »."
              error={err("title", 0)}
              warning={warn("title", 0)}
              required
            />
            <Select<EventType>
              label="Type"
              value={input.type}
              onChange={(v) => set("type", v)}
              options={(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((k) => ({ value: k, label: EVENT_TYPE_LABELS[k] }))}
            />
            <TextArea
              label="Courte description"
              value={input.description}
              onChange={(v) => set("description", v)}
              rows={4}
              maxLength={2000}
              hint="2 ou 3 phrases suffisent. Elles seront visibles dans le calendrier du participant."
              error={err("description", 0)}
              warning={warn("description", 0)}
              optional
            />
            <TextField
              label="Lien vers la page de la formation sur ephec.be"
              value={input.infoUrl}
              onChange={(v) => set("infoUrl", v.trim())}
              type="url"
              inputMode="url"
              placeholder="https://www.ephec.be/…"
              error={err("infoUrl", 0)}
              warning={warn("infoUrl", 0)}
              optional
            />
            <TextField label="Organisateur ou service" value={input.organizerName} onChange={(v) => set("organizerName", v)} optional />
            <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="font-semibold text-brand-700 underline underline-offset-4">
              {advanced ? "Masquer" : "Afficher"} les options complémentaires (contact, image)
            </button>
            {advanced && (
              <div className="space-y-6 rounded-2xl bg-canvas p-4">
                <TextField
                  label="Email de contact"
                  value={input.organizerEmail}
                  onChange={(v) => set("organizerEmail", v.trim())}
                  type="email"
                  inputMode="email"
                  error={err("organizerEmail", 0)}
                  optional
                  hint="Affiché aux participants et ajouté dans la description du calendrier."
                />
                <TextField label="Téléphone de contact" value={input.organizerPhone} onChange={(v) => set("organizerPhone", v)} type="tel" inputMode="tel" optional />
                <TextField
                  label="Image (lien)"
                  value={input.imageUrl}
                  onChange={(v) => set("imageUrl", v.trim())}
                  type="url"
                  placeholder="https://…"
                  error={err("imageUrl", 0)}
                  optional
                  hint="Lien d'une image déjà publiée (ex. visuel de la formation sur ephec.be). Affichée sur la page d'ajout."
                />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 space-y-8">
            <section aria-labelledby="dates-title">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="dates-title" className="text-lg font-bold">
                  {multi ? `Séances (${activeSessions.length})` : "Date et horaire"}
                </h3>
                <span className="text-sm text-muted">Heure de Belgique (Europe/Brussels)</span>
              </div>
              {err("sessions", 1) && (
                <p className="mt-2 text-sm font-medium text-danger" role="alert">
                  {err("sessions", 1)}
                </p>
              )}
              <ol className="mt-3 space-y-3">
                {input.sessions.map((s, idx) => {
                  if (s.status === "cancelled")
                    return (
                      <li key={s.id ?? idx} className="flex items-center justify-between gap-3 rounded-xl bg-danger-50 px-4 py-3 text-sm">
                        <span>
                          <strong className="text-danger">Séance annulée</strong> — {s.date && capitalize(formatLongDate(s.date))}, {s.startTime && formatTime(s.startTime)}
                        </span>
                        <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setSession(idx, { status: "active" })}>
                          Rétablir
                        </button>
                      </li>
                    );
                  const n = input.sessions.slice(0, idx + 1).filter((x) => x.status !== "cancelled").length;
                  const f = (k: string) => `sessions.${idx}.${k}`;
                  const dur = s.startTime && s.endTime ? durationMinutes(s.startTime, s.endTime) : 0;
                  return (
                    <li key={s.id ?? `new-${idx}`} className="rounded-2xl border-2 border-line p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{multi ? `Séance ${n}` : "Date"}</span>
                        {input.sessions.length > 1 && (
                          <button type="button" onClick={() => removeSession(idx)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-danger hover:bg-danger-50">
                            <IconTrash className="size-4" /> {s.id && isPublished ? "Annuler la séance" : "Supprimer"}
                            <span className="sr-only"> {n}</span>
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
                        <div>
                          <label className="block text-sm font-semibold" htmlFor={`d-${idx}`}>
                            Date
                          </label>
                          <input
                            id={`d-${idx}`}
                            data-session-date
                            type="date"
                            value={s.date}
                            onChange={(e) => setSession(idx, { date: e.target.value })}
                            aria-invalid={!!err(f("date"), 1)}
                            className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line px-3 aria-[invalid=true]:border-danger"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold" htmlFor={`s-${idx}`}>
                            Début
                          </label>
                          <input
                            id={`s-${idx}`}
                            type="time"
                            step={300}
                            value={s.startTime}
                            onChange={(e) => setSession(idx, { startTime: e.target.value })}
                            aria-invalid={!!err(f("startTime"), 1)}
                            className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line px-3 aria-[invalid=true]:border-danger"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold" htmlFor={`e-${idx}`}>
                            Fin
                          </label>
                          <input
                            id={`e-${idx}`}
                            type="time"
                            step={300}
                            value={s.endTime}
                            onChange={(e) => setSession(idx, { endTime: e.target.value })}
                            aria-invalid={!!err(f("endTime"), 1)}
                            className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line px-3 aria-[invalid=true]:border-danger"
                          />
                        </div>
                      </div>
                      {s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && (
                        <p className="mt-2 text-sm text-muted">
                          {capitalize(formatLongDate(s.date))}
                          {dur > 0 && ` · ${Math.floor(dur / 60)} h ${String(dur % 60).padStart(2, "0")}`}
                        </p>
                      )}
                      {[err(f("date"), 1), err(f("startTime"), 1), err(f("endTime"), 1), err(f("address"), 1), err(f("onlineUrl"), 1)].filter(Boolean).map((m) => (
                        <p key={m} className="mt-1 text-sm font-medium text-danger">
                          ⚠ {m}
                        </p>
                      ))}
                      {[warn(f("date"), 1), warn(f("startTime"), 1), warn(f("endTime"), 1)].filter(Boolean).map((m) => (
                        <p key={m} className="mt-1 text-sm text-warn">
                          {m}
                        </p>
                      ))}
                      {multi && (
                        <TextField
                          className="mt-3"
                          label="Intitulé de la séance"
                          optional
                          value={s.title ?? ""}
                          onChange={(v) => setSession(idx, { title: v })}
                          placeholder="Ex. Marketing sportif"
                        />
                      )}
                      {multi && (
                        <button
                          type="button"
                          className="mt-3 text-sm font-semibold text-brand-700 underline underline-offset-4"
                          aria-expanded={placeOpen.has(idx)}
                          onClick={() => setPlaceOpen((p) => {
                            const n2 = new Set(p);
                            if (n2.has(idx)) n2.delete(idx);
                            else n2.add(idx);
                            return n2;
                          })}
                        >
                          {placeOpen.has(idx) ? "Masquer le lieu particulier" : "Cette séance a lieu ailleurs ou a un autre lien ?"}
                        </button>
                      )}
                      {multi && placeOpen.has(idx) && (
                        <div className="mt-3 grid gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-2">
                          {input.format !== "online" && (
                            <>
                              <TextField label="Nom du lieu" optional value={s.locationName ?? ""} onChange={(v) => setSession(idx, { locationName: v || null })} />
                              <TextField label="Local" optional value={s.room ?? ""} onChange={(v) => setSession(idx, { room: v || null })} />
                              <TextField className="sm:col-span-2" label="Adresse" optional value={s.address ?? ""} onChange={(v) => setSession(idx, { address: v || null })} />
                            </>
                          )}
                          {input.format !== "onsite" && (
                            <TextField className="sm:col-span-2" label="Lien de connexion de cette séance" optional type="url" value={s.onlineUrl ?? ""} onChange={(v) => setSession(idx, { onlineUrl: v.trim() || null })} />
                          )}
                          <p className="text-sm text-muted sm:col-span-2">Laissez vide pour utiliser les informations communes à toutes les séances.</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                onClick={addSession}
                className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-700 bg-brand-50/60 font-semibold text-brand-800 hover:bg-brand-50"
              >
                <IconPlus /> Ajouter une séance
              </button>
              <p className="mt-2 text-center text-sm text-muted">La nouvelle séance reprend l&apos;horaire de la dernière, une semaine plus tard. Il suffit d&apos;ajuster.</p>
              {multi && (
                <div className="mt-6">
                  <RadioCards
                    legend="Le participant peut-il choisir ses séances ?"
                    name="sel"
                    value={input.sessionSelection}
                    onChange={(v) => set("sessionSelection", v)}
                    options={[
                      { value: "all", label: "Non, toutes les séances", description: "Ex. un certificat suivi en entier." },
                      { value: "choose", label: "Oui, il peut choisir", description: "Il coche les séances qui l'intéressent." },
                    ]}
                  />
                </div>
              )}
            </section>

            <RadioCards<EventFormat>
              legend="Format"
              name="format"
              value={input.format}
              onChange={(v) => set("format", v)}
              options={[
                { value: "onsite", label: "Présentiel", icon: <IconPin className="size-4" /> },
                { value: "online", label: "En ligne", icon: <IconVideo className="size-4" /> },
                { value: "hybrid", label: "Hybride", icon: <><IconPin className="size-4" /><IconVideo className="size-4" /></> },
              ]}
            />

            {input.format !== "online" && (
              <section aria-labelledby="lieu-title" className="space-y-4">
                <h3 id="lieu-title" className="text-lg font-bold">
                  Lieu{multi ? " (commun aux séances)" : ""}
                </h3>
                <TextField label="Nom du lieu" value={input.locationName} onChange={(v) => set("locationName", v)} placeholder="Ex. EPHEC — Campus de Woluwe" optional />
                <TextField label="Adresse complète" value={input.address} onChange={(v) => set("address", v)} placeholder="Rue, numéro, code postal, commune" error={err("address", 1)} />
                <TextField label="Local" value={input.room} onChange={(v) => set("room", v)} placeholder="Ex. B.2.14" optional />
              </section>
            )}

            {input.format !== "onsite" && (
              <section aria-labelledby="online-title" className="space-y-4">
                <h3 id="online-title" className="text-lg font-bold">
                  Connexion en ligne
                </h3>
                <TextField
                  label="Lien de connexion (Teams, Zoom…)"
                  value={input.onlineUrl}
                  type="url"
                  inputMode="url"
                  onChange={(v) => {
                    const url = v.trim();
                    set("onlineUrl", url);
                    const p = detectPlatform(url);
                    if (p) set("onlinePlatform", p);
                  }}
                  placeholder="https://teams.microsoft.com/…"
                  hint="Collez le lien de la réunion. Vous pourrez l'ajouter ou le changer plus tard."
                  error={err("onlineUrl", 1)}
                  warning={warn("onlineUrl", 1)}
                />
                <Select
                  label="Plateforme"
                  value={input.onlinePlatform}
                  onChange={(v) => set("onlinePlatform", v)}
                  options={[
                    { value: "", label: "Non précisé" },
                    { value: "Microsoft Teams", label: "Microsoft Teams" },
                    { value: "Zoom", label: "Zoom" },
                    { value: "Google Meet", label: "Google Meet" },
                    { value: "Webex", label: "Webex" },
                  ]}
                />
              </section>
            )}

            <Select
              label="Rappel dans le calendrier"
              value={String(input.reminderMinutes ?? "")}
              onChange={(v) => set("reminderMinutes", v === "" ? null : Number(v))}
              options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value ?? ""), label: o.label }))}
              hint="Appliqué par Apple Calendrier, Outlook (fichier) et les agendas connectés. Les liens Google et Outlook web utilisent les rappels habituels du participant."
            />
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-8">
            {validation.errors.length > 0 ? (
              <div className="rounded-2xl bg-danger-50 p-4 text-danger" role="alert">
                <p className="font-bold">Quelques informations manquent avant de pouvoir publier :</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validation.errors.map((e) => (
                    <li key={e.field + e.message}>
                      <button type="button" className="text-left underline" onClick={() => go(STEP_FIELDS[0](e.field) ? 0 : 1)}>
                        {e.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex gap-3 rounded-2xl bg-ok-50 p-4 text-ok">
                <IconCheck className="size-6 shrink-0" />
                <p className="font-semibold">Tout est prêt{validation.warnings.length ? ", quelques suggestions ci-dessous" : ""}.</p>
              </div>
            )}
            {validation.warnings.length > 0 && (
              <ul className="space-y-1 text-sm text-warn">
                {validation.warnings.map((w) => (
                  <li key={w.field + w.message} className="flex gap-2">
                    <IconWarn className="mt-0.5 size-4 shrink-0" /> {w.message}
                  </li>
                ))}
              </ul>
            )}

            <section aria-labelledby="apercu-title">
              <h3 id="apercu-title" className="text-lg font-bold">
                Ce que verra le participant
              </h3>
              <div className="mt-3 overflow-hidden rounded-2xl border-2 border-line bg-canvas p-4">
                <div className="shape bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{EVENT_TYPE_LABELS[input.type]}</p>
                  <p className="mt-1 text-xl font-bold">{preview.title}</p>
                  {firstSession && (
                    <p className="mt-2">
                      {multi ? (
                        <>
                          <strong>{activeSessions.length} séances</strong> — de {formatLongDate(firstSession.date)} à{" "}
                          {formatLongDate(preview.sessions.filter((s) => s.status === "active").at(-1)!.date)}
                        </>
                      ) : (
                        <>
                          <strong>{capitalize(formatLongDate(firstSession.date))}</strong>, {formatTime(firstSession.startTime)} – {formatTime(firstSession.endTime)}
                        </>
                      )}
                    </p>
                  )}
                  <p className="text-muted">{input.format === "online" ? `En ligne${input.onlinePlatform ? ` · ${input.onlinePlatform}` : ""}` : [input.locationName, input.address].filter(Boolean).join(", ")}</p>
                  <p className="mt-4 font-semibold">Ajouter à mon calendrier</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-hidden="true">
                    {[
                      [<GoogleCalendarIcon key="g" className="size-6" />, "Google"],
                      [<OutlookIcon key="o" className="size-6" />, "Outlook"],
                      [<AppleIcon key="a" className="size-6" />, "Apple"],
                      [<FileCalendarIcon key="f" className="size-6" />, "Autre"],
                    ].map(([icon, l]) => (
                      <span key={l as string} className="flex items-center gap-2 rounded-xl border border-line px-2 py-2">
                        {icon}
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {firstSession && (
                <div className="mt-4 rounded-2xl border-2 border-line p-4">
                  <p className="text-sm font-semibold text-muted">Dans le calendrier du participant{multi ? " (1re séance)" : ""} :</p>
                  <p className="mt-2 font-bold">{buildSummary(preview, firstSession)}</p>
                  <p className="text-sm">
                    {capitalize(formatLongDate(firstSession.date))}, {formatTime(firstSession.startTime)} – {formatTime(firstSession.endTime)}
                  </p>
                  <p className="text-sm text-muted">{buildLocation(preview, firstSession)}</p>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 font-sans text-sm text-muted">
                    {buildDescription(preview, firstSession, { pageUrl })}
                  </pre>
                </div>
              )}
              {props.slug && (
                <a href={`/e/${props.slug}?preview=1`} target="_blank" rel="noopener" className="mt-3 inline-block font-semibold text-brand-700 underline underline-offset-4">
                  Ouvrir l&apos;aperçu complet de la dernière version enregistrée (nouvel onglet)
                </a>
              )}
            </section>
          </div>
        )}

        {serverError && (
          <p className="mt-6 rounded-xl bg-danger-50 p-4 font-medium text-danger" role="alert">
            {serverError}
          </p>
        )}

        {outcome && (
          <div className="mt-6 space-y-3 rounded-2xl bg-ok-50 p-4 sm:p-5" role="status">
            <p className="flex items-center gap-2 font-bold text-ok">
              <IconCheck /> Modifications enregistrées. La page d&apos;ajout est déjà à jour.
            </p>
            {outcome.changes.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-ink">
                {outcome.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            {outcome.sync && outcome.sync.connected > 0 && (
              <p className="text-sm text-ink">
                Calendriers connectés : <strong>{outcome.sync.updated}</strong> mis à jour automatiquement
                {outcome.sync.removedByUser > 0 && `, ${outcome.sync.removedByUser} déjà supprimé(s) par le participant`}
                {outcome.sync.failed > 0 && (
                  <strong className="text-danger">, {outcome.sync.failed} en échec (accès retiré ou service indisponible)</strong>
                )}
                .
              </p>
            )}
            {outcome.changes.length > 0 && (
              <div className="rounded-xl bg-white p-3 text-sm">
                <p className="font-semibold text-warn">Les participants qui ont utilisé un lien ou un fichier ne reçoivent pas ces changements automatiquement.</p>
                <p className="mt-1 text-muted">Prévenez-les par vos canaux habituels (ActiveCampaign). Texte prêt à l&apos;emploi :</p>
                {outcome.changeEmail && (
                  <>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 font-sans text-xs">{outcome.changeEmail}</pre>
                    <Button variant="secondary" className="mt-2" onClick={() => navigator.clipboard.writeText(outcome.changeEmail!)}>
                      Copier le texte
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={() => go(step - 1)}>
                ← Retour
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {step < 2 && (
              <>
                <Button variant="secondary" disabled={!!saving || draftValidation.errors.length > 0} onClick={() => save(isPublished ? "save" : "draft")}>
                  {saving ? "Enregistrement…" : isPublished ? "Enregistrer" : "Enregistrer le brouillon"}
                </Button>
                <Button onClick={() => go(step + 1)}>Continuer →</Button>
              </>
            )}
            {step === 2 &&
              (isPublished ? (
                <Button disabled={!!saving || validation.errors.length > 0} onClick={() => save("save")}>
                  {saving ? "Enregistrement…" : "Enregistrer les modifications"}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" disabled={!!saving || draftValidation.errors.length > 0} onClick={() => save("draft")}>
                    {saving === "draft" ? "Enregistrement…" : "Enregistrer comme brouillon"}
                  </Button>
                  <Button disabled={!!saving || validation.errors.length > 0} onClick={() => save("publish")}>
                    {saving === "publish" ? "Publication…" : "Publier l'événement"}
                  </Button>
                </>
              ))}
          </div>
        </div>
        {isPublished && props.connectedCount ? (
          <p className="mt-4 text-sm text-muted">
            {props.connectedCount} ajout(s) dans des calendriers connectés seront mis à jour automatiquement à l&apos;enregistrement.
          </p>
        ) : null}
      </div>
    </div>
  );
}
