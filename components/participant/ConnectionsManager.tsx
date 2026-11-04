"use client";

import { useState } from "react";
import { GoogleCalendarIcon, OutlookIcon } from "@/components/icons";

interface C {
  id: string;
  provider: "google" | "microsoft";
  email: string | null;
  autoAdd: boolean;
  since: string;
}

const NAME = { google: "Google Agenda", microsoft: "Outlook / Microsoft 365" } as const;

export default function ConnectionsManager({ initial, apiConfigured }: { initial: C[]; apiConfigured: boolean }) {
  const [list, setList] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [consent, setConsent] = useState<Record<string, boolean>>({});

  async function toggle(c: C, on: boolean) {
    const r = await fetch("/api/connected", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: c.id, autoAdd: on, consent: on ? consent[c.id] === true : undefined }),
    });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error);
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, autoAdd: on } : x)));
    setMsg(on ? "Ajout automatique activé. Vous pouvez le désactiver à tout moment ici." : "Ajout automatique désactivé.");
  }

  async function remove(c: C) {
    const r = await fetch("/api/connected", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectionId: c.id }) });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error);
    setList((l) => l.filter((x) => x.id !== c.id));
    setMsg(
      d.revokedAtProvider
        ? `${NAME[c.provider]} est déconnecté et l'autorisation a été retirée chez Google. Les événements déjà ajoutés restent dans votre agenda mais ne seront plus mis à jour.`
        : `${NAME[c.provider]} est déconnecté et nos accès ont été effacés. Pour retirer aussi l'autorisation côté Microsoft : account.microsoft.com → Confidentialité → Applications et services (ou myapps.microsoft.com pour un compte professionnel). Les événements déjà ajoutés restent dans votre agenda.`
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div aria-live="polite">{msg && <p className="rounded-xl bg-brand-50 p-4 text-brand-900">{msg}</p>}</div>
      {list.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-muted">
          Aucun calendrier n&apos;est connecté sur cet appareil.
          {!apiConfigured && " (L'ajout direct n'est pas encore activé par l'EPHEC : l'ajout par lien ou fichier reste disponible sur chaque page d'événement.)"}
        </p>
      )}
      {list.map((c) => (
        <section key={c.id} className="shape bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            {c.provider === "google" ? <GoogleCalendarIcon /> : <OutlookIcon />}
            <div>
              <h2 className="font-bold">{NAME[c.provider]}</h2>
              <p className="text-sm text-muted">
                {c.email ?? "Compte connecté"} · depuis le {new Date(c.since).toLocaleDateString("fr-BE")}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-canvas p-4">
            <h3 className="font-semibold">Ajout automatique de mes prochaines formations</h3>
            <p className="mt-1 text-sm text-muted">
              Lorsque vous vous inscrirez à une autre formation EPHEC avec l&apos;adresse <strong>{c.email ?? "de ce compte"}</strong>, elle sera ajoutée directement dans cet agenda. Cette option nécessite que le système d&apos;inscription de l&apos;EPHEC nous transmette votre inscription.
            </p>
            {c.autoAdd ? (
              <button type="button" onClick={() => toggle(c, false)} className="mt-3 min-h-11 rounded-xl border-2 border-line px-4 font-semibold hover:border-brand">
                Désactiver l&apos;ajout automatique
              </button>
            ) : (
              <>
                <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-5 accent-[#1d7a75]" checked={!!consent[c.id]} onChange={(e) => setConsent({ ...consent, [c.id]: e.target.checked })} />
                  J&apos;accepte que l&apos;EPHEC ajoute automatiquement à cet agenda les formations auxquelles je m&apos;inscris. Je peux retirer cet accord à tout moment.
                </label>
                <button
                  type="button"
                  disabled={!consent[c.id]}
                  onClick={() => toggle(c, true)}
                  className="shape mt-3 min-h-11 bg-brand-700 px-5 font-semibold text-white disabled:opacity-50"
                >
                  Activer l&apos;ajout automatique
                </button>
              </>
            )}
          </div>
          <button type="button" onClick={() => remove(c)} className="mt-4 min-h-11 font-semibold text-danger underline underline-offset-4">
            Déconnecter ce calendrier
          </button>
        </section>
      ))}
    </div>
  );
}
