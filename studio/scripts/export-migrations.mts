// Exporte les migrations (lib/server/migrations.ts) en fichiers SQL pour Supabase.
// Usage : npm run db:export
import fs from "node:fs";
import { MIGRATIONS, splitSql } from "../lib/server/migrations.ts";

fs.mkdirSync("supabase/migrations", { recursive: true });
for (const m of MIGRATIONS) {
  const file = `supabase/migrations/2026112000000${m.version}_${m.name}.sql`;
  const body = splitSql(m.sql).join(";\n\n") + ";\n";
  fs.writeFileSync(file, `-- EPHEC Content Studio — migration ${m.version} (${m.name}). Généré depuis lib/server/migrations.ts\n\n${body}`);
  console.log("écrit", file);
}
