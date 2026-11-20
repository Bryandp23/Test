import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, localCredentials } from "@/lib/server/auth";
import { mode } from "@/lib/server/config";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const m = mode();
  if (m === "unconfigured") redirect("/setup");
  if (await getUser()) redirect("/board");
  const sp = await searchParams;
  const local = m === "local";
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo />
          <div>
            <div className="text-[14px] font-semibold tracking-tight">Content Studio</div>
            <div className="text-2xs text-faint">EPHEC · Communication</div>
          </div>
        </div>
        <h1 className="text-[20px] font-semibold tracking-tight">Connexion</h1>
        <p className="mt-1 text-muted">Retrouvez vos cycles, publications et fichiers sur tous vos appareils.</p>
        <LoginForm next={sp.next ?? "/board"} supabase={m === "supabase"} initialError={sp.error === "lien" ? "Lien de connexion expiré ou invalide." : undefined} />
        {local && (
          <div className="mt-6 rounded-md border border-line bg-surface px-3 py-2.5 text-2xs text-muted">
            <div className="mb-1 font-medium text-fg">Mode local (développement)</div>
            Base PGlite et fichiers dans <code className="font-mono">./data</code>. Identifiants :{" "}
            <code className="font-mono text-fg">{localCredentials().email}</code> /{" "}
            <code className="font-mono text-fg">{process.env.STUDIO_LOCAL_PASSWORD ? "(STUDIO_LOCAL_PASSWORD)" : localCredentials().password}</code>
          </div>
        )}
      </div>
    </main>
  );
}
