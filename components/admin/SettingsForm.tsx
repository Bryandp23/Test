"use client";

import { useState } from "react";
import { REMINDER_OPTIONS } from "@/lib/types";
import { Button, Select, TextField } from "@/components/ui/fields";

interface S {
  publicBaseUrl: string;
  defaultReminderMinutes: number | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  logoUrl: string;
  enableYahoo: boolean;
  statsRetentionDays: number;
}

export default function SettingsForm({
  initial,
  envBaseUrl,
  hasIntegrationKey,
  providers,
}: {
  initial: S;
  envBaseUrl: string | null;
  hasIntegrationKey: boolean;
  providers: { google: boolean; microsoft: boolean };
}) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(hasIntegrationKey);

  async function save() {
    const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
    const d = await r.json();
    setMsg(r.ok ? { ok: true, text: "Réglages enregistrés." } : { ok: false, text: d.error });
  }
  async function newKey() {
    if (hasKey && !confirm("L'ancienne clé cessera immédiatement de fonctionner. Continuer ?")) return;
    const r = await fetch("/api/admin/integration-key", { method: "POST" });
    const d = await r.json();
    if (r.ok) {
      setKey(d.key);
      setHasKey(true);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="shape-lg space-y-5 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Adresse du site</h2>
        {envBaseUrl ? (
          <p className="text-muted">
            Définie par le serveur : <strong>{envBaseUrl}</strong> (variable PUBLIC_BASE_URL).
          </p>
        ) : (
          <TextField
            label="Adresse publique"
            value={s.publicBaseUrl}
            onChange={(v) => setS({ ...s, publicBaseUrl: v.trim() })}
            placeholder="https://agenda.ephec.be"
            hint="Utilisée dans les liens envoyés par email. Ne la changez pas après l'envoi d'emails : les anciens liens doivent continuer à fonctionner."
          />
        )}
      </section>
      <section className="shape-lg space-y-5 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Valeurs par défaut des nouveaux événements</h2>
        <Select
          label="Rappel par défaut"
          value={String(s.defaultReminderMinutes ?? "")}
          onChange={(v) => setS({ ...s, defaultReminderMinutes: v === "" ? null : Number(v) })}
          options={REMINDER_OPTIONS.map((o) => ({ value: String(o.value ?? ""), label: o.label }))}
        />
        <TextField label="Organisateur" value={s.organizerName} onChange={(v) => setS({ ...s, organizerName: v })} />
        <TextField label="Email de contact" optional type="email" value={s.organizerEmail} onChange={(v) => setS({ ...s, organizerEmail: v.trim() })} />
        <TextField label="Téléphone de contact" optional value={s.organizerPhone} onChange={(v) => setS({ ...s, organizerPhone: v })} />
        <TextField
          label="Logo officiel (lien vers le fichier SVG ou PNG)"
          optional
          value={s.logoUrl}
          onChange={(v) => setS({ ...s, logoUrl: v.trim() })}
          hint="Sans valeur, une version provisoire du logotype EPHEC est affichée."
        />
      </section>
      <section className="shape-lg space-y-4 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Calendriers proposés</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 accent-[#1d7a75]" checked={s.enableYahoo} onChange={(e) => setS({ ...s, enableYahoo: e.target.checked })} />
          <span>
            <span className="font-semibold">Proposer Yahoo Agenda</span>
            <span className="block text-sm text-muted">Désactivé par défaut : Yahoo ne documente pas officiellement son lien d&apos;ajout. À activer après un test réussi.</span>
          </span>
        </label>
        <div className="rounded-xl bg-canvas p-4 text-sm">
          <p className="font-semibold">Ajout direct (agendas connectés)</p>
          <p className="mt-1">
            Google Agenda : <strong>{providers.google ? "activé" : "non configuré"}</strong> · Microsoft (Outlook / 365) :{" "}
            <strong>{providers.microsoft ? "activé" : "non configuré"}</strong>
          </p>
          <p className="mt-1 text-muted">Ces connexions nécessitent des identifiants d&apos;application fournis par le service informatique (voir le bilan technique).</p>
        </div>
      </section>
      <section className="shape-lg space-y-4 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Confidentialité</h2>
        <TextField
          label="Conservation des statistiques (jours)"
          type="number"
          value={String(s.statsRetentionDays)}
          onChange={(v) => setS({ ...s, statsRetentionDays: Math.max(30, Math.min(1095, Number(v) || 395)) })}
          hint="395 jours = 13 mois, durée recommandée pour la mesure d'audience."
        />
      </section>
      <div className="flex items-center gap-4">
        <Button onClick={save}>Enregistrer les réglages</Button>
        <p aria-live="polite" className={msg?.ok ? "text-ok" : "text-danger"}>
          {msg?.text}
        </p>
      </div>
      <section className="shape-lg space-y-3 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Intégration avec le système d&apos;inscription (avancé)</h2>
        <p className="text-sm text-muted">
          Clé permettant au système d&apos;inscription de l&apos;EPHEC de demander un lien personnalisé par inscrit, et d&apos;ajouter automatiquement l&apos;événement aux agendas des participants qui l&apos;ont accepté. Réservé au service informatique.
        </p>
        <Button variant="secondary" onClick={newKey}>
          {hasKey ? "Générer une nouvelle clé" : "Générer une clé d'intégration"}
        </Button>
        {key && (
          <div className="rounded-xl bg-warn-50 p-3 text-sm text-warn" role="status">
            <p className="font-semibold">Copiez cette clé maintenant : elle ne sera plus jamais affichée.</p>
            <code className="mt-1 block break-all font-mono text-ink">{key}</code>
          </div>
        )}
      </section>
    </div>
  );
}
