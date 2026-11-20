// Stockage local (mode développement/démonstration uniquement) : URLs signées HMAC à durée limitée.
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { mode, MAX_UPLOAD_MB } from "@/lib/server/config";
import { verify } from "@/lib/server/local-secret";
import { safeLocalPath } from "@/lib/server/storage";
import { normalizeMime } from "@/lib/domain";

export const runtime = "nodejs";

function check(req: NextRequest, p: string, op: "get" | "put"): boolean {
  if (mode() !== "local") return false;
  const e = req.nextUrl.searchParams.get("e") ?? "";
  const s = req.nextUrl.searchParams.get("s") ?? "";
  if (!e || !s || Number(e) < Date.now() / 1000) return false;
  return verify(`${op}:${p}:${e}`, s);
}

async function filePath(ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  return parts.map(decodeURIComponent).join("/");
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = await filePath(ctx);
  if (!check(req, p, "get")) return new Response("Lien expiré ou invalide", { status: 403 });
  let full: string;
  try {
    full = safeLocalPath(p);
  } catch {
    return new Response("Chemin invalide", { status: 400 });
  }
  if (!fs.existsSync(full)) return new Response("Introuvable", { status: 404 });
  const stat = fs.statSync(full);
  const type = p.endsWith(".thumb.webp") ? "image/webp" : (normalizeMime(p, "") ?? "application/octet-stream");
  const headers: Record<string, string> = {
    "content-type": type,
    "cache-control": "private, max-age=3600",
    "accept-ranges": "bytes",
    // Aucun script ne s'exécute si le fichier est ouvert directement (SVG, HTML…).
    "content-security-policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'",
    "x-content-type-options": "nosniff",
  };
  const d = req.nextUrl.searchParams.get("d");
  if (d) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(d)}`;
  // Requêtes partielles (lecture vidéo).
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      if (start <= end && start < stat.size) {
        const stream = Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream;
        return new Response(stream, {
          status: 206,
          headers: { ...headers, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": String(end - start + 1) },
        });
      }
    }
  }
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "content-length": String(stat.size) } });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = await filePath(ctx);
  if (!check(req, p, "put")) return new Response("Lien expiré ou invalide", { status: 403 });
  let full: string;
  try {
    full = safeLocalPath(p);
  } catch {
    return new Response("Chemin invalide", { status: 400 });
  }
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_MB * 1024 * 1024) return new Response("Fichier trop volumineux", { status: 413 });
  if (!req.body) return new Response("Corps vide", { status: 400 });
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const tmp = full + ".part";
  const out = fs.createWriteStream(tmp);
  let size = 0;
  try {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error("too_large");
      if (!out.write(value)) await new Promise((r) => out.once("drain", r));
    }
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
    fs.renameSync(tmp, full);
  } catch (e) {
    out.destroy();
    fs.rmSync(tmp, { force: true });
    return new Response((e as Error).message === "too_large" ? "Fichier trop volumineux" : "Envoi interrompu", { status: 400 });
  }
  return Response.json({ ok: true, size });
}
