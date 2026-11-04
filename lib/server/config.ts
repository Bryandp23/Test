import "server-only";

/** Hébergement « serverless » (Netlify, Vercel, AWS Lambda) : pas de disque persistant, une vraie base est obligatoire. */
export function isServerless() {
  return !!(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.SITE_ID);
}

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export interface ConfigProblem {
  name: string;
  help: string;
}

/** Réglages manquants qui empêcheraient l'application de démarrer en production. Ne lit que l'environnement. */
export function configProblems(): ConfigProblem[] {
  if (process.env.NODE_ENV !== "production") return [];
  const out: ConfigProblem[] = [];
  if (!process.env.APP_SECRET && !process.env.ALLOW_DEV_SECRET)
    out.push({ name: "APP_SECRET", help: "Une longue phrase secrète au hasard (40 caractères ou plus)." });
  if (!databaseUrl() && isServerless())
    out.push({
      name: "Base de données",
      help: "Activez Netlify DB (rubrique « Database » du projet) ou ajoutez la variable DATABASE_URL avec l'adresse d'une base PostgreSQL (par ex. Neon).",
    });
  if (!process.env.ADMIN_EMAIL && !process.env.ALLOW_DEMO_ACCOUNTS)
    out.push({ name: "ADMIN_EMAIL", help: "Votre adresse email : ce sera le compte administrateur." });
  if (!process.env.ADMIN_PASSWORD && !process.env.ALLOW_DEMO_ACCOUNTS)
    out.push({ name: "ADMIN_PASSWORD", help: "Le mot de passe de ce compte (12 caractères ou plus conseillés)." });
  return out;
}
