import "server-only";
// Configuration lue côté serveur uniquement. Aucun secret n'est exposé au navigateur
// (seules les variables NEXT_PUBLIC_* le sont, et elles ne contiennent pas de secret).

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}
export function supabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export type Mode = "supabase" | "local" | "unconfigured";

/** supabase : Auth + PostgreSQL + Storage Supabase. local : PGlite + disque (développement, démonstration). */
export function mode(): Mode {
  if (supabaseUrl() && supabaseAnonKey() && databaseUrl()) return "supabase";
  if (isServerless()) return "unconfigured";
  return "local";
}

export function missingConfig(): string[] {
  const out: string[] = [];
  if (!supabaseUrl()) out.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey()) out.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  if (!databaseUrl()) out.push("DATABASE_URL");
  return out;
}

export const STORAGE_BUCKET = "studio-files";
export const MAX_UPLOAD_MB = Number(process.env.STUDIO_MAX_UPLOAD_MB ?? 200);
export const dataDir = () => process.env.STUDIO_DATA_DIR ?? "./data";
