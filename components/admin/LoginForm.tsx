"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui/fields";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok) setError(d.error);
      else router.replace("/admin");
    } catch {
      setError("Connexion impossible. Vérifiez votre accès Internet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
      <TextField label="Adresse email" type="email" name="email" autoComplete="username" inputMode="email" value={email} onChange={setEmail} required />
      <TextField label="Mot de passe" type="password" name="password" autoComplete="current-password" value={password} onChange={setPassword} required />
      {error && (
        <p className="rounded-xl bg-danger-50 p-3 font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
