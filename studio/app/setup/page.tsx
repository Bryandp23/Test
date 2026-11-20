import { missingConfig, mode } from "@/lib/server/config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Setup() {
  if (mode() !== "unconfigured") redirect("/login");
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-[20px] font-semibold">Configuration requise</h1>
      <p className="mt-2 text-muted">
        L'application est déployée sans base de données ni stockage. Ajoutez ces variables d'environnement dans votre hébergeur, puis redéployez :
      </p>
      <ul className="mt-4 space-y-1.5 font-mono text-[12px]">
        {missingConfig().map((v) => (
          <li key={v} className="rounded border border-line bg-surface px-2 py-1">
            {v}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-muted">Procédure détaillée : docs/DEPLOIEMENT.md.</p>
    </main>
  );
}
