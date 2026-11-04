"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, TextField } from "@/components/ui/fields";

interface U {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  active: boolean;
  lastLogin: string | null;
}

export default function UsersManager({ initial, meId }: { initial: U[]; meId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "editor" as "admin" | "editor", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: d.error });
    setMsg({ ok: true, text: `Compte créé pour ${form.email}. Transmettez-lui son mot de passe provisoire par un canal sûr.` });
    setForm({ name: "", email: "", role: "editor", password: "" });
    router.refresh();
  }
  async function patch(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setMsg(r.ok ? { ok: true, text: "Modification enregistrée." } : { ok: false, text: d.error });
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <ul className="space-y-3">
        {initial.map((u) => (
          <li key={u.id} className={`shape flex flex-wrap items-center gap-3 bg-white p-4 ring-1 ring-line ${u.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {u.name} {u.id === meId && <span className="text-sm font-normal text-muted">(vous)</span>}
              </p>
              <p className="text-sm text-muted">
                {u.email} · {u.role === "admin" ? "Administrateur" : "Éditeur"}
                {!u.active && " · désactivé"}
                {u.lastLogin && ` · dernière connexion ${new Date(u.lastLogin).toLocaleDateString("fr-BE")}`}
              </p>
            </div>
            {u.id !== meId && (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => patch(u.id, { role: u.role === "admin" ? "editor" : "admin" })}>
                  {u.role === "admin" ? "Passer éditeur" : "Passer administrateur"}
                </Button>
                <Button variant={u.active ? "danger" : "secondary"} onClick={() => patch(u.id, { active: !u.active })}>
                  {u.active ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="shape-lg space-y-4 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Ajouter un collaborateur</h2>
        <TextField label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v.trim() })} required />
        <Select
          label="Rôle"
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v })}
          options={[
            { value: "editor", label: "Éditeur" },
            { value: "admin", label: "Administrateur" },
          ]}
        />
        <TextField label="Mot de passe provisoire" type="text" value={form.password} onChange={(v) => setForm({ ...form, password: v })} hint="12 caractères minimum." required />
        <Button type="submit">Créer le compte</Button>
        <p aria-live="polite" className={msg?.ok ? "text-ok" : "text-danger"}>
          {msg?.text}
        </p>
      </form>
      <p className="text-sm text-muted">
        En production, l&apos;authentification peut être reliée au compte Microsoft 365 de l&apos;EPHEC (connexion unique) : voir le bilan technique.
      </p>
    </div>
  );
}
