import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getEventRowById } from "@/lib/server/events";
import { getBaseUrl } from "@/lib/server/settings";
import { emailButtonHtml } from "@/lib/email";
import SharePanel from "@/components/admin/SharePanel";
import { IconCheck } from "@/components/icons";

export const metadata: Metadata = { title: "Partager" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ publie?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const r = await getEventRowById(id);
  if (!r) notFound();
  const h = await headers();
  const base = await getBaseUrl(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`);
  const url = `${base}/e/${r.row.slug}`;
  const isLocal = /localhost|127\.0\.0\.1|\.local\b/.test(base);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/admin/evenements/${id}`} className="text-sm font-semibold text-brand-700 underline underline-offset-4">
        ← Retour à l&apos;événement
      </Link>
      {sp.publie && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-ok-50 p-4 text-ok" role="status">
          <IconCheck className="size-6 shrink-0" />
          <div>
            <p className="font-bold">Événement publié.</p>
            <p className="text-ink/80">Il ne reste plus qu&apos;à ajouter le bouton dans votre email de confirmation.</p>
          </div>
        </div>
      )}
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Partager « {r.row.title} »</h1>
      {r.row.status === "draft" && (
        <p className="mt-4 rounded-xl bg-warn-50 p-3 text-warn">Cet événement est encore un brouillon : le lien ne fonctionnera pour les participants qu&apos;après publication.</p>
      )}
      {isLocal && (
        <p className="mt-4 rounded-xl bg-warn-50 p-3 text-sm text-warn">
          L&apos;adresse publique n&apos;est pas encore configurée ({base}). Avant d&apos;envoyer de vrais emails, un administrateur doit définir l&apos;adresse du site (ex. https://agenda.ephec.be) dans les Réglages.
        </p>
      )}
      <SharePanel url={url} html={emailButtonHtml({ url })} title={r.row.title} />
    </div>
  );
}
