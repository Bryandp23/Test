"use client";
import { useMemo, useState } from "react";
import { CalendarPlus, Images, Loader2, Trash2, TriangleAlert, Files } from "lucide-react";
import { useStudio } from "@/lib/client/store";
import {
  createCycleOp,
  createPub,
  createSessionOp,
  movePub,
  placeLabel,
  shiftDatesOp,
  updateCycleOp,
  updateSessionOp,
} from "@/lib/client/ops";
import { uploadFiles } from "@/lib/client/upload";
import { CYCLE_STATUS, PRODUCTION, SESSION_KIND, diffusionLabel, formatBytes, type CycleStatus, type DiffusionStatus, type SessionKind } from "@/lib/domain";
import { Button, cx, Dialog, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { fmtDM, fmtShort } from "@/lib/time";

export function DialogHost() {
  const dialog = useStudio((s) => s.dialog);
  const close = () => useStudio.getState().openDialog(null);
  if (!dialog) return null;
  switch (dialog.kind) {
    case "cycle":
      return <CycleDialog key={dialog.cycleId ?? "new"} cycleId={dialog.cycleId} projet={dialog.projet} onClose={close} />;
    case "session":
      return <SessionDialog key={dialog.sessionId ?? "new"} cycleId={dialog.cycleId} sessionId={dialog.sessionId} onClose={close} />;
    case "publication":
      return <PublicationDialog cycleId={dialog.cycleId} sessionId={dialog.sessionId} onClose={close} />;
    case "drop":
      return <DropDialog cycleId={dialog.cycleId} sessionId={dialog.sessionId} files={dialog.files} onClose={close} />;
    case "move":
      return <MoveDialog publicationId={dialog.publicationId} onClose={close} />;
    case "confirm":
      return <ConfirmDialog {...dialog} onClose={close} />;
    case "dateImpact":
      return <DateImpactDialog {...dialog} onClose={close} />;
  }
}

// --- Cycle ----------------------------------------------------------------------

interface DraftSession {
  key: number;
  title: string;
  kind: SessionKind;
  date: string;
  start_time: string;
}

function CycleDialog({ cycleId, projet, onClose }: { cycleId?: string; projet?: boolean; onClose: () => void }) {
  const existing = useStudio((s) => s.cycles.find((c) => c.id === cycleId));
  const tags = useStudio((s) => s.tags);
  const audiences = tags.filter((t) => t.dimension === "public");
  const [kind, setKind] = useState<"cycle" | "projet">(existing?.kind ?? (projet ? "projet" : "cycle"));
  const [name, setName] = useState(existing?.name ?? "");
  const [audience, setAudience] = useState(existing?.audience_tag_id ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [start, setStart] = useState(existing?.start_date ?? "");
  const [end, setEnd] = useState(existing?.end_date ?? "");
  const [status, setStatus] = useState<CycleStatus>(existing?.status ?? "a_venir");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [links, setLinks] = useState((existing?.links ?? []).map((l) => `${l.url}${l.title ? " " + l.title : ""}`).join("\n"));
  const [sessions, setSessions] = useState<DraftSession[]>(
    existing ? [] : [{ key: 1, title: "Séance d'information", kind: "info", date: "", start_time: "" }, { key: 2, title: "Session 1", kind: "session", date: "", start_time: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addSession = () => {
    const n = sessions.filter((s) => s.kind === "session").length + 1;
    setSessions([...sessions, { key: Date.now(), title: `Session ${n}`, kind: "session", date: "", start_time: "" }]);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Le nom est requis.");
    if (start && end && end < start) return setErr("La date de fin précède la date de début.");
    const parsedLinks = links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [url, ...rest] = l.split(/\s+/);
        return { url: /^https?:\/\//i.test(url) ? url : `https://${url}`, title: rest.join(" ") };
      });
    const payload = {
      kind,
      name: name.trim(),
      audience_tag_id: audience || null,
      category,
      start_date: start || null,
      end_date: end || null,
      status,
      description,
      notes,
      links: parsedLinks,
    };
    setBusy(true);
    const ok = existing
      ? await updateCycleOp(existing.id, payload)
      : await createCycleOp({
          ...payload,
          sessions:
            kind === "cycle"
              ? sessions.filter((s) => s.title.trim()).map((s) => ({ title: s.title.trim(), kind: s.kind, date: s.date || null, start_time: s.start_time || null }))
              : [],
        });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={640}
      title={existing ? `Modifier « ${existing.name} »` : kind === "projet" ? "Nouveau projet" : "Nouveau cycle"}
      description={existing ? undefined : kind === "projet" ? "Une communication ponctuelle, sans sessions." : "Un cycle et ses premières sessions. Vous pourrez en ajouter d'autres à tout moment."}
      footer={
        <>
          {err && <span className="mr-auto text-[12px] text-danger">{err}</span>}
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" form="cycle-form" disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {existing ? "Enregistrer" : kind === "projet" ? "Créer le projet" : "Créer le cycle"}
          </Button>
        </>
      }
    >
      <form id="cycle-form" onSubmit={submit} className="space-y-4">
        {!existing && (
          <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-lg border border-line-soft bg-bg/60 p-1">
            {(["cycle", "projet"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cx("h-8 rounded-md text-[12.5px]", kind === k ? "bg-raised text-fg" : "text-muted hover:text-fg")}>
                {k === "cycle" ? "Cycle avec sessions" : "Projet ponctuel"}
              </button>
            ))}
          </div>
        )}
        <Field label="Nom">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "projet" ? "Gala Alumni 2027" : "Humains.ia"} maxLength={120} required />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Public" className="col-span-2">
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">—</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Statut" className="col-span-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value as CycleStatus)}>
              {Object.entries(CYCLE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Début" className="col-span-1 sm:col-span-1">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fin" className="col-span-1 sm:col-span-1">
            <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Catégorie" className="col-span-2">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Certificat, webinaire, événement…" maxLength={80} />
          </Field>
        </div>

        {!existing && kind === "cycle" && (
          <fieldset>
            <legend className="mb-1.5 flex w-full items-center justify-between text-2xs font-medium text-muted">Sessions</legend>
            <div className="space-y-1.5">
              {sessions.map((s, i) => (
                <div key={s.key} className="grid grid-cols-[1fr_auto] items-center gap-1.5 sm:grid-cols-[130px_1fr_130px_92px_auto]">
                  <Select
                    aria-label="Type de session"
                    value={s.kind}
                    onChange={(e) => setSessions(sessions.map((x, j) => (j === i ? { ...x, kind: e.target.value as SessionKind } : x)))}
                    className="hidden sm:block"
                  >
                    {Object.entries(SESSION_KIND).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Titre de la session" value={s.title} onChange={(e) => setSessions(sessions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input aria-label="Date de la session" type="date" value={s.date} onChange={(e) => setSessions(sessions.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="max-sm:col-start-1" />
                  <Input aria-label="Heure de début" type="time" value={s.start_time} onChange={(e) => setSessions(sessions.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} className="max-sm:hidden" />
                  <button type="button" aria-label="Retirer la session" onClick={() => setSessions(sessions.filter((_, j) => j !== i))} className="inline-flex size-8 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-danger max-sm:row-span-2 max-sm:row-start-1 max-sm:col-start-2">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="ghost" className="mt-1.5 -ml-2" onClick={addSession}>
              <CalendarPlus className="size-3.5" /> Ajouter une session
            </Button>
            <p className="text-2xs text-faint">Les sessions sont rangées par date ; celles sans date se placent à la fin. Une session peut rester sans date.</p>
          </fieldset>
        )}

        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={5000} />
        </Field>
        <Field label="Liens utiles" hint="Un lien par ligne, suivi éventuellement d'un titre.">
          <Textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="https://www.ephec.be/humains-ia Page du programme" className="font-mono text-[12px]" />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={20000} />
        </Field>
      </form>
    </Dialog>
  );
}

// --- Session --------------------------------------------------------------------

function SessionDialog({ cycleId, sessionId, onClose }: { cycleId?: string; sessionId?: string; onClose: () => void }) {
  const existing = useStudio((s) => s.sessions.find((x) => x.id === sessionId));
  const cycles = useStudio((s) => s.cycles);
  const active = [...cycles].filter((c) => c.status !== "archive").sort((a, b) => a.position - b.position);
  const [cid, setCid] = useState(existing?.cycle_id ?? cycleId ?? active[0]?.id ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState<SessionKind>(existing?.kind ?? "session");
  const [date, setDate] = useState(existing?.date ?? "");
  const [startT, setStartT] = useState(existing?.start_time ?? "");
  const [endT, setEndT] = useState(existing?.end_time ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !cid) return;
    const payload = { title: title.trim(), kind, date: date || null, start_time: startT || null, end_time: endT || null, location, description };
    setBusy(true);
    const ok = existing ? await updateSessionOp(existing.id, payload) : await createSessionOp(cid, payload);
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "Modifier la session" : "Nouvelle session"}
      description={existing ? "Les publications restent rattachées à la session si sa date change." : undefined}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" form="session-form" disabled={busy || !title.trim() || !cid}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {existing ? "Enregistrer" : "Créer la session"}
          </Button>
        </>
      }
    >
      <form id="session-form" onSubmit={submit} className="space-y-3">
        {!existing && (
          <Field label="Cycle">
            <Select value={cid} onChange={(e) => setCid(e.target.value)} required>
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Titre" className="col-span-2">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session 2" maxLength={120} required />
          </Field>
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>
              {Object.entries(SESSION_KIND).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Début">
            <Input type="time" value={startT} onChange={(e) => setStartT(e.target.value)} />
          </Field>
          <Field label="Fin">
            <Input type="time" value={endT} onChange={(e) => setEndT(e.target.value)} />
          </Field>
        </div>
        <Field label="Lieu">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="EPHEC Woluwe, en ligne…" maxLength={200} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000} />
        </Field>
      </form>
    </Dialog>
  );
}

// --- Publication (création) -------------------------------------------------------

function PlacementFields({ cid, setCid, sid, setSid }: { cid: string; setCid: (v: string) => void; sid: string; setSid: (v: string) => void }) {
  const cycles = useStudio((s) => s.cycles);
  const sessions = useStudio((s) => s.sessions);
  const list = [...cycles].filter((c) => c.status !== "archive" || c.id === cid).sort((a, b) => a.position - b.position);
  const own = sessions.filter((s) => s.cycle_id === cid).sort((a, b) => a.position - b.position);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Cycle ou projet">
        <Select
          value={cid}
          onChange={(e) => {
            setCid(e.target.value);
            setSid("");
          }}
          required
        >
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Session">
        <Select value={sid} onChange={(e) => setSid(e.target.value)}>
          <option value="">Contenus généraux</option>
          {own.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
              {s.date ? ` — ${fmtDM(s.date)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function PublicationDialog({ cycleId, sessionId, onClose }: { cycleId?: string; sessionId?: string | null; onClose: () => void }) {
  const cycles = useStudio((s) => s.cycles);
  const tags = useStudio((s) => s.tags);
  const first = [...cycles].filter((c) => c.status !== "archive").sort((a, b) => a.position - b.position)[0];
  const [cid, setCid] = useState(cycleId ?? first?.id ?? "");
  const [sid, setSid] = useState(sessionId ?? "");
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [prod, setProd] = useState("a_creer");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  if (!cycles.length) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} title="Nouvelle publication" description="Une publication appartient toujours à un cycle ou à un projet.">
        <p className="text-muted">Créez d'abord un cycle ou un projet.</p>
        <Button
          className="mt-3"
          variant="primary"
          onClick={() => useStudio.getState().openDialog({ kind: "cycle" })}
        >
          Créer un cycle
        </Button>
      </Dialog>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nouvelle publication"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" form="pub-form" disabled={busy || !title.trim() || !cid}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Créer et ouvrir
          </Button>
        </>
      }
    >
      <form
        id="pub-form"
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const p = await createPub({ cycle_id: cid, session_id: sid || null, title: title.trim(), channel_tag_id: channel || null, production_status: prod, target_date: date || null });
          setBusy(false);
          if (p) onClose();
        }}
      >
        <Field label="Titre">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carrousel LinkedIn — présentation du programme" maxLength={200} required />
        </Field>
        <PlacementFields cid={cid} setCid={setCid} sid={sid} setSid={setSid} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Canal">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">—</option>
              {tags
                .filter((t) => t.dimension === "canal")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Production">
            <Select value={prod} onChange={(e) => setProd(e.target.value)}>
              {PRODUCTION.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date cible">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

// --- Dépôt de fichiers sur une ligne ------------------------------------------------

function DropDialog({ cycleId, sessionId, files, onClose }: { cycleId: string; sessionId: string | null; files: File[]; onClose: () => void }) {
  const tags = useStudio((s) => s.tags);
  const [mode, setMode] = useState<"one" | "many">("one");
  const base = files[0]?.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") ?? "";
  const [title, setTitle] = useState(files.length > 1 ? "" : base);
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const total = files.reduce((s, f) => s + f.size, 0);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`Créer à partir de ${files.length} fichier${files.length > 1 ? "s" : ""}`}
      description={placeLabel(cycleId, sessionId)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="primary" form="drop-form" disabled={busy || (mode === "one" && !title.trim())}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {mode === "one" ? "Créer la publication" : `Créer ${files.length} publications`}
          </Button>
        </>
      }
    >
      <form
        id="drop-form"
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (mode === "one") {
            const p = await createPub({ cycle_id: cycleId, session_id: sessionId, title: title.trim(), channel_tag_id: channel || null, production_status: "en_cours" });
            setBusy(false);
            if (p) {
              onClose();
              void uploadFiles(p.id, files);
            }
          } else {
            const created: { id: string; f: File }[] = [];
            for (const f of files) {
              const p = await createPub({ cycle_id: cycleId, session_id: sessionId, title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 200) || "Sans titre", channel_tag_id: channel || null, production_status: "en_cours" }, false);
              if (p) created.push({ id: p.id, f });
            }
            setBusy(false);
            onClose();
            for (const c of created) void uploadFiles(c.id, [c.f]);
          }
        }}
      >
        {files.length > 1 && (
          <div role="radiogroup" aria-label="Organisation" className="grid grid-cols-2 gap-2">
            {(
              [
                ["one", Images, "Une seule publication", "Carrousel ou série : les fichiers restent ensemble, dans l'ordre."],
                ["many", Files, "Une publication par fichier", "Chaque fichier devient une carte indépendante."],
              ] as const
            ).map(([k, Icon, t, d]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={mode === k}
                onClick={() => setMode(k)}
                className={cx("rounded-lg border p-3 text-left transition-colors", mode === k ? "border-accent bg-accent/[0.07]" : "border-line hover:border-faint")}
              >
                <Icon className={cx("size-4", mode === k ? "text-accent" : "text-faint")} />
                <div className="mt-1.5 text-[13px] font-medium">{t}</div>
                <div className="mt-0.5 text-[12px] text-muted">{d}</div>
              </button>
            ))}
          </div>
        )}
        {mode === "one" && (
          <Field label="Titre de la publication">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carrousel LinkedIn — Session 1" maxLength={200} required />
          </Field>
        )}
        <Field label="Canal">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">—</option>
            {tags
              .filter((t) => t.dimension === "canal")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
          </Select>
        </Field>
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line-soft p-2 text-[12px]">
          {files.map((f, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate text-muted">
                {i + 1}. {f.name}
              </span>
              <span className="tabular shrink-0 text-faint">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
        <p className="text-2xs text-faint">Total {formatBytes(total)}. L'ordre pourra être modifié dans le panneau de la publication.</p>
      </form>
    </Dialog>
  );
}

// --- Déplacer (alternative accessible au glisser-déposer) -----------------------------

function MoveDialog({ publicationId, onClose }: { publicationId: string; onClose: () => void }) {
  const p = useStudio((s) => s.pubs.find((x) => x.id === publicationId));
  const [cid, setCid] = useState(p?.cycle_id ?? "");
  const [sid, setSid] = useState(p?.session_id ?? "");
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Déplacer la publication"
      description={`« ${p.title} » · actuellement dans ${placeLabel(p.cycle_id, p.session_id)}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={busy || (cid === p.cycle_id && (sid || null) === p.session_id)}
            onClick={async () => {
              setBusy(true);
              const ok = await movePub(p.id, cid, sid || null);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            Déplacer
          </Button>
        </>
      }
    >
      <PlacementFields cid={cid} setCid={setCid} sid={sid} setSid={setSid} />
      <p className="mt-3 text-2xs text-faint">Vers un autre cycle, la publication rejoint les contenus généraux sauf si vous choisissez une de ses sessions.</p>
    </Dialog>
  );
}

// --- Confirmation -----------------------------------------------------------------

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onClose();
            }}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-muted">{message}</p>
    </Dialog>
  );
}

// --- Date de session modifiée ----------------------------------------------------------

function DateImpactDialog({ sessionTitle, delta, items, onClose }: { sessionTitle: string; delta: number; items: { id: string; title: string; target_date: string; diffusion_status: string }[]; onClose: () => void }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(items.filter((i) => i.diffusion_status !== "programme").map((i) => i.id)));
  const scheduled = useMemo(() => items.filter((i) => i.diffusion_status === "programme"), [items]);
  const [busy, setBusy] = useState(false);
  const sign = delta > 0 ? "+" : "";
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Recalculer les dates de publication ?"
      description={`La session « ${sessionTitle} » a été décalée de ${sign}${delta} jour${Math.abs(delta) > 1 ? "s" : ""}. Les publications restent rattachées à la session.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Garder les dates actuelles
          </Button>
          <Button
            variant="primary"
            disabled={busy || sel.size === 0}
            onClick={async () => {
              setBusy(true);
              await shiftDatesOp([...sel], delta);
              setBusy(false);
              onClose();
            }}
          >
            Décaler {sel.size} date{sel.size > 1 ? "s" : ""} de {sign}
            {delta} j
          </Button>
        </>
      }
    >
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-raised">
              <input
                type="checkbox"
                checked={sel.has(i.id)}
                onChange={(e) => {
                  const n = new Set(sel);
                  if (e.target.checked) n.add(i.id);
                  else n.delete(i.id);
                  setSel(n);
                }}
                className="accent-[var(--color-accent)]"
              />
              <span className="min-w-0 flex-1 truncate">{i.title}</span>
              <span className="tabular shrink-0 text-[12px] text-faint">{fmtShort(i.target_date)}</span>
              {i.diffusion_status === "programme" && <span className="shrink-0 text-[11px] text-[var(--color-s-programme)]">{diffusionLabel(i.diffusion_status as DiffusionStatus)}</span>}
            </label>
          </li>
        ))}
      </ul>
      {scheduled.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-2 text-[12px]">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" />
          {scheduled.length} publication{scheduled.length > 1 ? "s sont officiellement programmées" : " est officiellement programmée"} : décochée{scheduled.length > 1 ? "s" : ""} par défaut. Si vous les cochez, seule la date cible change ; la programmation réelle sur la plateforme externe doit être modifiée par vous.
        </p>
      )}
    </Dialog>
  );
}
