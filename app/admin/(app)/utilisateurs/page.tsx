import type { Metadata } from "next";
import { requireUser } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import UsersManager from "@/components/admin/UsersManager";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function Page() {
  const me = await requireUser("admin");
  const users = await q<{ id: string; email: string; name: string; role: "admin" | "editor"; active: boolean; last_login_at: Date | null }>(
    `select id, email, name, role, active, last_login_at from users order by active desc, name`
  );
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Utilisateurs</h1>
      <p className="mt-1 text-muted">
        <strong>Éditeur</strong> : crée, modifie, publie, annule et partage les événements. <strong>Administrateur</strong> : en plus, gère les utilisateurs et les réglages.
      </p>
      <UsersManager
        meId={me.id}
        initial={users.map((u) => ({ ...u, lastLogin: u.last_login_at ? new Date(u.last_login_at).toISOString() : null }))}
      />
    </div>
  );
}
