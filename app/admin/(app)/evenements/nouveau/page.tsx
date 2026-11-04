import type { Metadata } from "next";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates";
import { emptyEventInput } from "@/lib/validation";
import { getBaseUrl, getSettings } from "@/lib/server/settings";
import EventWizard from "@/components/admin/EventWizard";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Créer un événement" };

export default async function Page({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele } = await searchParams;
  const settings = await getSettings();
  const h = await headers();
  const base = await getBaseUrl(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`);

  if (!modele) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm font-semibold text-brand-700 underline underline-offset-4">
          ← Retour aux événements
        </Link>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Créer un événement</h1>
        <p className="mt-1 text-muted">Partez d&apos;un modèle : les réglages habituels sont déjà remplis. Tout reste modifiable.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <Link href={`?modele=${t.id}`} className="shape block h-full bg-white p-5 ring-1 ring-line transition hover:shadow-md hover:ring-brand">
                <span className="block text-lg font-bold">{t.label}</span>
                <span className="mt-1 block text-muted">{t.description}</span>
              </Link>
            </li>
          ))}
          <li className="sm:col-span-2">
            <Link href="?modele=vide" className="block rounded-2xl border-2 border-dashed border-line p-5 text-center font-semibold text-brand-800 hover:border-brand">
              Partir d&apos;une page vierge
            </Link>
          </li>
        </ul>
        <p className="mt-6 text-sm text-muted">
          Astuce : pour une formation qui revient chaque année, ouvrez l&apos;ancienne édition et cliquez sur « Dupliquer ».
        </p>
      </div>
    );
  }

  const tpl = TEMPLATES.find((t) => t.id === modele);
  const initial = tpl ? tpl.build() : emptyEventInput();
  initial.organizerName = settings.organizerName || initial.organizerName;
  initial.organizerEmail = settings.organizerEmail;
  initial.organizerPhone = settings.organizerPhone;
  if (!tpl) initial.reminderMinutes = settings.defaultReminderMinutes;

  return (
    <>
      <div className="mx-auto mb-6 max-w-3xl">
        <Link href="/admin/evenements/nouveau" className="text-sm font-semibold text-brand-700 underline underline-offset-4">
          ← Changer de modèle
        </Link>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
          Nouvel événement{tpl ? ` — ${tpl.label}` : ""}
        </h1>
      </div>
      <EventWizard mode="create" initial={initial} baseUrl={base} />
    </>
  );
}
