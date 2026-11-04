import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { EphecLogo } from "@/components/icons";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion — équipe EPHEC" };

export default async function Page({ searchParams }: { searchParams: Promise<{ deconnecte?: string }> }) {
  if (await currentUser()) redirect("/admin");
  const sp = await searchParams;
  const demo = process.env.NODE_ENV !== "production" && !process.env.ADMIN_EMAIL;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <EphecLogo className="h-10" />
        <div className="shape-lg mt-8 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">Espace équipe</h1>
          <p className="mt-1 text-muted">EPHEC Calendar — Formation Continue</p>
          {sp.deconnecte && (
            <p className="mt-4 rounded-xl bg-brand-50 p-3 text-brand-900" role="status">
              Vous êtes déconnecté.
            </p>
          )}
          <LoginForm />
          {demo && (
            <div className="mt-6 rounded-xl bg-warn-50 p-3 text-sm text-warn">
              <p className="font-semibold">Comptes de démonstration (développement uniquement)</p>
              <p>Administrateur : admin@ephec.local / Demo-EPHEC-2026!</p>
              <p>Éditeur : editeur@ephec.local / Demo-Editeur-2026!</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
