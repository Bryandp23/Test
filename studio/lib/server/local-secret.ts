import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";

let cached: Buffer | undefined;
/** Secret du mode local : APP_SECRET, sinon généré une fois dans ./data/secret. */
export function localSecret(): Buffer {
  if (cached) return cached;
  if (process.env.APP_SECRET) return (cached = Buffer.from(process.env.APP_SECRET));
  const file = path.join(dataDir(), "secret");
  fs.mkdirSync(dataDir(), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  return (cached = Buffer.from(fs.readFileSync(file, "utf8").trim()));
}

export function sign(value: string): string {
  return createHmac("sha256", localSecret()).update(value).digest("base64url");
}
export function verify(value: string, sig: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
