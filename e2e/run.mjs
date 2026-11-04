// Lance un serveur de production isolé (base neuve) + le simulateur Google, puis exécute les tests Playwright.
// Usage : npm run test:e2e   (nécessite `npm run build` au préalable)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { startMockGoogle } from "./mock-google.mjs";

const APP_PORT = 3210;
const MOCK_PORT = 3211;
const dbDir = path.resolve(`./data/e2e-${Date.now()}`);
const mock = `http://localhost:${MOCK_PORT}`;

const { server: mockServer } = await startMockGoogle(MOCK_PORT);
const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(APP_PORT),
  PGLITE_DIR: dbDir,
  APP_SECRET: "e2e-secret-not-for-production-0123456789",
  ALLOW_DEMO_ACCOUNTS: "1",
  GOOGLE_CLIENT_ID: "e2e-client",
  GOOGLE_CLIENT_SECRET: "e2e-secret",
  GOOGLE_AUTH_URL: `${mock}/auth`,
  GOOGLE_TOKEN_URL: `${mock}/token`,
  GOOGLE_USERINFO_URL: `${mock}/userinfo`,
  GOOGLE_REVOKE_URL: `${mock}/revoke`,
  GOOGLE_EVENTS_URL: `${mock}/events`,
};
delete env.PUBLIC_BASE_URL;
delete env.DATABASE_URL;

const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT)], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let out = "";
app.stdout.on("data", (d) => (out += d));
app.stderr.on("data", (d) => (out += d));

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://localhost:${APP_PORT}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Le serveur n'a pas démarré :\n" + out);
}

let code = 1;
try {
  await waitReady();
  const t = spawn("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, E2E_BASE: `http://localhost:${APP_PORT}`, E2E_MOCK: mock },
  });
  code = await new Promise((r) => t.on("exit", r));
} finally {
  try {
    process.kill(-app.pid, "SIGTERM"); // tout le groupe de processus (next start + next-server)
  } catch {
    app.kill("SIGTERM");
  }
  await new Promise((r) => setTimeout(r, 500));
  mockServer.close();
  fs.writeFileSync(path.resolve("./e2e/artifacts-server.log"), out);
  fs.rmSync(dbDir, { recursive: true, force: true });
}
process.exit(code ?? 1);
