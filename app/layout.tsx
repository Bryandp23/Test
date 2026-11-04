import type { Metadata, Viewport } from "next";
import "./globals.css";
import { configProblems } from "@/lib/server/config";
import { getDb } from "@/lib/server/db";
import SetupNeeded from "@/components/SetupNeeded";

// Rendu à la demande : la vérification de configuration doit se faire à l'exécution, pas à la construction.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "EPHEC Calendar", template: "%s · EPHEC" },
  description: "Ajoutez votre formation EPHEC à votre calendrier en quelques secondes.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#27958F",
};

async function setupState() {
  const problems = configProblems();
  if (problems.length) return { problems, dbError: null };
  try {
    await getDb();
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    // Message court, sans adresse ni identifiant de connexion.
    const msg = (err.code ? `${err.code} — ` : "") + String(err.message ?? "erreur inconnue").replace(/postgres(ql)?:\/\/\S+/gi, "[adresse masquée]").slice(0, 200);
    return { problems: [], dbError: msg };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const setup = await setupState();
  return (
    <html lang="fr-BE">
      <body className="min-h-dvh">{setup ? <SetupNeeded problems={setup.problems} dbError={setup.dbError} /> : children}</body>
    </html>
  );
}
