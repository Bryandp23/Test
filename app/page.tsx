import Link from "next/link";
import { EphecLogo } from "@/components/icons";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center px-6 py-16">
      <EphecLogo className="h-10" />
      <h1 className="mt-10 text-3xl font-bold leading-tight">EPHEC Calendar</h1>
      <p className="mt-3 text-lg text-muted">
        Vous avez reçu un email de confirmation ? Utilisez le bouton « Ajouter à mon calendrier » qu&apos;il contient : il ouvre directement la page de votre formation.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/admin" className="shape inline-flex min-h-12 items-center bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800">
          Espace équipe EPHEC
        </Link>
        <a href="https://www.ephec.be" className="inline-flex min-h-12 items-center rounded-xl px-4 font-semibold text-brand-800 hover:bg-brand-50">
          Site de l&apos;EPHEC
        </a>
      </div>
    </main>
  );
}
