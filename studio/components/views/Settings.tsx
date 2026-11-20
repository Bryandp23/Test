"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStudio } from "@/lib/client/store";
import { createTagOp, deleteTagOp, updatePrefs, updateTagOp } from "@/lib/client/ops";
import { DIMENSIONS, TAG_COLORS, TAG_COLOR_LABEL, type Tag, type TagColor, type TagDimension } from "@/lib/domain";
import { Button, cx, IconButton, Input, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { COLOR_VAR, Swatch } from "@/components/ui/badges";

function ColorPicker({ value, onChange, label }: { value: TagColor; onChange: (c: TagColor) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={`Couleur de ${label} : ${TAG_COLOR_LABEL[value]}`} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-raised">
          <Swatch color={value} className="size-3 rounded-[3px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Couleur">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={c === value}
              aria-label={TAG_COLOR_LABEL[c]}
              title={TAG_COLOR_LABEL[c]}
              onClick={() => onChange(c)}
              className={cx("size-7 rounded-md border-2", c === value ? "border-fg" : "border-transparent")}
              style={{ background: COLOR_VAR[c] }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagRow({ t, usage }: { t: Tag; usage: number }) {
  const [label, setLabel] = useState(t.label);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-surface">
      <ColorPicker value={t.color} label={t.label} onChange={(c) => updateTagOp(t.id, { color: c })} />
      <input
        value={label}
        aria-label={`Libellé de ${t.label}`}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (!label.trim()) setLabel(t.label);
          else if (label.trim() !== t.label) void updateTagOp(t.id, { label: label.trim() });
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        maxLength={60}
        className="h-7 min-w-0 flex-1 rounded bg-transparent px-1.5 text-[13px] outline-none focus:bg-bg focus:ring-1 focus:ring-line"
      />
      <span className="tabular w-16 text-right text-2xs text-faint">{usage ? `${usage} util.` : ""}</span>
      {confirm ? (
        <span className="flex items-center gap-1">
          <Button size="sm" variant="danger" onClick={() => deleteTagOp(t.id)}>
            Supprimer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Non
          </Button>
        </span>
      ) : (
        <IconButton label={`Supprimer ${t.label}`} size="sm" onClick={() => setConfirm(true)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100">
          <Trash2 className="size-3.5" />
        </IconButton>
      )}
    </li>
  );
}

function DimensionCard({ dim, label }: { dim: TagDimension; label: string }) {
  const all = useStudio((s) => s.tags);
  const tags = useMemo(() => all.filter((t) => t.dimension === dim).sort((a, b) => a.position - b.position), [all, dim]);
  const pubs = useStudio((s) => s.pubs);
  const cycles = useStudio((s) => s.cycles);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("blue");
  const usage = (id: string) =>
    pubs.filter((p) => p.channel_tag_id === id || p.audience_tag_id === id || p.nature_tag_id === id || p.format_tag_id === id || p.tag_ids.includes(id)).length +
    cycles.filter((c) => c.audience_tag_id === id).length;
  return (
    <section className="rounded-lg border border-line-soft bg-bg p-3">
      <h3 className="mb-2 px-1 text-[13px] font-semibold tracking-tight">{label}</h3>
      <ul className="space-y-0.5">
        {tags.map((t) => (
          <TagRow key={t.id} t={t} usage={usage(t.id)} />
        ))}
      </ul>
      <form
        className="mt-2 flex items-center gap-1 px-1"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          if (await createTagOp(dim, name.trim(), color)) setName("");
        }}
      >
        <ColorPicker value={color} label="nouveau tag" onChange={setColor} />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ajouter…" maxLength={60} className="h-7" aria-label={`Nouveau : ${label}`} />
        <IconButton label="Ajouter" size="sm" type="submit" disabled={!name.trim()}>
          <Plus className="size-4" />
        </IconButton>
      </form>
    </section>
  );
}

export function Settings() {
  const density = useStudio((s) => s.prefs.density ?? "confortable");
  const mode = useStudio((s) => s.mode);
  const email = useStudio((s) => s.user.email);
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-10 px-4 pt-6 pb-24 md:px-8">
        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Métadonnées</h2>
          <p className="mt-1 max-w-2xl text-muted">
            Canaux, publics, natures de communication, formats et tags libres sont des dimensions séparées. Renommer ou recolorer un tag met à jour toutes les publications ; le
            supprimer le retire des publications sans les supprimer.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIMENSIONS.map((d) => (
              <DimensionCard key={d.id} dim={d.id} label={d.plural} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Affichage</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-muted">Densité du board</span>
            <div role="radiogroup" className="inline-flex rounded-md border border-line p-0.5">
              {(["compact", "confortable"] as const).map((d) => (
                <button key={d} role="radio" aria-checked={density === d} onClick={() => updatePrefs({ density: d })} className={cx("h-7 rounded px-3 text-[12px]", density === d ? "bg-raised text-fg" : "text-muted")}>
                  {d === "compact" ? "Compact" : "Confortable"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-2xs text-faint">Préférences enregistrées sur votre compte : elles vous suivent sur tous vos appareils.</p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Compte et données</h2>
          <dl className="mt-3 grid max-w-xl grid-cols-[160px_1fr] gap-y-2 text-[13px]">
            <dt className="text-muted">Compte</dt>
            <dd>{email}</dd>
            <dt className="text-muted">Stockage</dt>
            <dd>{mode === "supabase" ? "Supabase (PostgreSQL + Storage privé, RLS)" : "Local : PGlite + disque (développement uniquement)"}</dd>
            <dt className="text-muted">Fuseau horaire</dt>
            <dd>Europe/Bruxelles (heure d'été gérée)</dd>
          </dl>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">Pas encore disponible</h2>
          <ul className="mt-2 max-w-2xl list-disc space-y-1 pl-5 text-muted">
            <li>Calendrier éditorial (mois / semaine / jour) et déplacement par date — phase 2.</li>
            <li>Timeline des cycles et sessions — phase 2.</li>
            <li>Rétroplanning automatique et modèles réutilisables — phase 2 (la table des modèles existe déjà).</li>
            <li>Bilan, statistiques, portfolio et exports — phase 3.</li>
            <li>Aperçu automatique des pages web (Open Graph) : les liens s'affichent sous forme de carte claire.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
