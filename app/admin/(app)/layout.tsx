import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { EphecLogo } from "@/components/icons";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <a href="#contenu" className="sr-only-focusable fixed left-3 top-3 z-50 rounded bg-white px-4 py-2 font-semibold shadow">
        Aller au contenu
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <EphecLogo className="h-8" decorative />
            <span className="sr-only">EPHEC</span>
            <span className="border-l border-line pl-3 text-sm font-semibold text-muted">Calendar</span>
          </Link>
          <AdminNav isAdmin={user.role === "admin"} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted md:inline">
              {user.name} · {user.role === "admin" ? "Administrateur" : "Éditeur"}
            </span>
            <form action="/api/admin/logout" method="post">
              <button className="min-h-10 rounded-lg px-3 font-semibold text-brand-800 hover:bg-brand-50">Se déconnecter</button>
            </form>
          </div>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
