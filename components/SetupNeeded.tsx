import type { ConfigProblem } from "@/lib/server/config";

/** Écran affiché à la place de l'application quand la mise en ligne n'est pas terminée. */
export default function SetupNeeded({ problems, dbError }: { problems: ConfigProblem[]; dbError?: string | null }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-2xl font-bold">EPHEC Calendar : configuration à terminer</h1>
      <p className="mt-2 text-muted">L&apos;application est bien en ligne, mais il lui manque des réglages pour démarrer.</p>
      {problems.length > 0 && (
        <>
          <p className="mt-6 font-semibold">
            Sur Netlify : Project configuration → Environment variables, ajoutez :
          </p>
          <ul className="mt-3 space-y-3">
            {problems.map((p) => (
              <li key={p.name} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <code className="font-mono font-bold text-brand-800">{p.name}</code>
                <p className="mt-1 text-sm text-muted">{p.help}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {dbError && (
        <div className="mt-6 rounded-2xl bg-danger-50 p-4 text-danger">
          <p className="font-semibold">La base de données ne répond pas.</p>
          <p className="mt-1 text-sm">Détail : {dbError}</p>
          <p className="mt-1 text-sm">Vérifiez l&apos;adresse de la base (DATABASE_URL ou Netlify DB).</p>
        </div>
      )}
      <p className="mt-6 font-semibold">Puis : Deploys → Trigger deploy → Deploy site.</p>
    </main>
  );
}
