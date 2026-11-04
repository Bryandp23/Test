import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Clé maîtresse : APP_SECRET (32 octets aléatoires min.) en production.
// En développement, une clé est générée une fois dans ./data/.app-secret (jamais commitée).
let cachedKey: Buffer | null = null;
function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  let raw = process.env.APP_SECRET;
  if (process.env.NODE_ENV === "production" && raw && raw.length < 32)
    throw new Error("APP_SECRET doit contenir au moins 32 caractères aléatoires.");
  if (!raw) {
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_SECRET)
      throw new Error("APP_SECRET doit être défini en production (ex. `openssl rand -base64 32`).");
    const file = path.resolve("./data/.app-secret");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
    raw = fs.readFileSync(file, "utf8").trim();
  }
  cachedKey = crypto.createHash("sha256").update(raw).digest();
  return cachedKey;
}

function subKey(purpose: string) {
  return crypto.createHmac("sha256", masterKey()).update(purpose).digest();
}

/** Chiffrement authentifié AES-256-GCM (jetons OAuth). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", subKey("token-encryption"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") throw new Error("Format de chiffrement inconnu");
  const d = crypto.createDecipheriv("aes-256-gcm", subKey("token-encryption"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

/** Empreinte d'email non réversible sans la clé (pseudonymisation RGPD). */
export function emailHmac(email: string) {
  return crypto.createHmac("sha256", subKey("email")).update(email.trim().toLowerCase()).digest("hex");
}

export function sign(value: string): string {
  const mac = crypto.createHmac("sha256", subKey("cookie")).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function unsign(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signed);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return value;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // sans caractères ambigus (l, 1, o, 0, i)
export function randomSlug(len = 8) {
  const bytes = crypto.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return s;
}

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(pw: string, salt: Buffer, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pw, salt, len, SCRYPT, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(pw, Buffer.from(salt, "base64url"), expected.length);
  return crypto.timingSafeEqual(key, expected);
}
