import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { connectionsForBrowser, configuredProviders } from "@/lib/server/connections";
import { BROWSER_COOKIE, readBrowserKey } from "@/lib/server/browser";
import { EphecLogo } from "@/components/icons";
import ConnectionsManager from "@/components/participant/ConnectionsManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mes calendriers connectés" };

export default async function Page() {
  const jar = await cookies();
  const conns = await connectionsForBrowser(readBrowserKey(jar.get(BROWSER_COOKIE)?.value));
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <EphecLogo className="h-9" />
      <h1 className="mt-8 text-2xl font-bold">Mes calendriers connectés</h1>
      <p className="mt-2 text-muted">
        Ici, vous gérez l&apos;accès que vous avez donné à l&apos;EPHEC pour ajouter et mettre à jour ses événements dans votre agenda. Rien n&apos;est activé sans votre accord.
      </p>
      <ConnectionsManager
        initial={conns.map((c) => ({ id: c.id, provider: c.provider, email: c.account_email, autoAdd: c.auto_add, since: new Date(c.created_at).toISOString() }))}
        apiConfigured={configuredProviders().length > 0}
      />
      <p className="mt-10 text-sm text-muted">
        <Link href="/confidentialite" className="underline">
          Confidentialité et données
        </Link>
      </p>
    </main>
  );
}
