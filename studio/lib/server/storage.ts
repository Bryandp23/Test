import "server-only";
// Stockage des fichiers.
// - Supabase Storage : bucket privé `studio-files`, chemins préfixés par l'identifiant utilisateur
//   (politiques RLS sur storage.objects), envoi direct navigateur → Supabase par URL signée,
//   lecture par URLs temporaires signées.
// - Local : ./data/files, URLs signées HMAC servies par /api/local-files.
import fs from "node:fs";
import path from "node:path";
import { dataDir, mode, STORAGE_BUCKET, supabaseAnonKey } from "./config";
import { sign } from "./local-secret";
import { supabaseServer } from "./supabase";

export interface UploadTarget {
  path: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

const READ_TTL_S = 60 * 60 * 2;

export function localFilesRoot() {
  return path.resolve(dataDir(), "files");
}
export function safeLocalPath(p: string): string {
  const root = localFilesRoot();
  const full = path.resolve(root, p);
  if (!full.startsWith(root + path.sep)) throw new Error("Chemin invalide");
  return full;
}
function localSignedUrl(p: string, op: "get" | "put", ttl = READ_TTL_S, contentType?: string) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const enc = p.split("/").map(encodeURIComponent).join("/");
  const sig = sign(`${op}:${p}:${exp}`);
  const qs = new URLSearchParams({ e: String(exp), s: sig });
  if (contentType) qs.set("t", contentType);
  return `/api/local-files/${enc}?${qs}`;
}

export async function createUploadTarget(p: string, contentType: string): Promise<UploadTarget> {
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUploadUrl(p);
    if (error || !data) throw new Error("Impossible de préparer l'envoi : " + (error?.message ?? "erreur inconnue"));
    return {
      path: p,
      url: data.signedUrl,
      method: "PUT",
      headers: { "content-type": contentType, "x-upsert": "false", apikey: supabaseAnonKey()!, "cache-control": "max-age=31536000" },
    };
  }
  return { path: p, url: localSignedUrl(p, "put", 60 * 60), method: "PUT", headers: { "content-type": contentType } };
}

/** URLs de lecture temporaires, par lots. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(paths.filter(Boolean))];
  if (!uniq.length) return {};
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const out: Record<string, string> = {};
    for (let i = 0; i < uniq.length; i += 500) {
      const chunk = uniq.slice(i, i + 500);
      const { data } = await sb.storage.from(STORAGE_BUCKET).createSignedUrls(chunk, READ_TTL_S);
      for (const r of data ?? []) if (r.signedUrl && r.path) out[r.path] = r.signedUrl;
    }
    return out;
  }
  return Object.fromEntries(uniq.map((p) => [p, localSignedUrl(p, "get")]));
}

export async function signedDownloadUrl(p: string, filename: string): Promise<string> {
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(p, 600, { download: filename });
    if (error || !data) throw new Error("Fichier introuvable");
    return data.signedUrl;
  }
  return localSignedUrl(p, "get", 600) + "&d=" + encodeURIComponent(filename);
}

export async function fileExists(p: string): Promise<boolean> {
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const { data } = await sb.storage.from(STORAGE_BUCKET).exists(p);
    return Boolean(data);
  }
  return fs.existsSync(safeLocalPath(p));
}

export async function readFileText(p: string, maxBytes = 5 * 1024 * 1024): Promise<string> {
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(p);
    if (error || !data) throw new Error("Fichier introuvable");
    if (data.size > maxBytes) throw new Error("Fichier trop volumineux pour l'aperçu");
    return await data.text();
  }
  const full = safeLocalPath(p);
  if (fs.statSync(full).size > maxBytes) throw new Error("Fichier trop volumineux pour l'aperçu");
  return fs.readFileSync(full, "utf8");
}

export async function copyFile(from: string, to: string): Promise<void> {
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const { error } = await sb.storage.from(STORAGE_BUCKET).copy(from, to);
    if (error) throw new Error("Copie impossible : " + error.message);
    return;
  }
  const dst = safeLocalPath(to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(safeLocalPath(from), dst);
}

export async function removeFiles(paths: string[]): Promise<void> {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    await sb.storage.from(STORAGE_BUCKET).remove(list);
    return;
  }
  for (const p of list) {
    try {
      fs.rmSync(safeLocalPath(p), { force: true });
    } catch {
      /* ignoré */
    }
  }
}

/** Écriture côté serveur (données d'exemple). */
export async function putFile(p: string, body: Buffer, contentType: string): Promise<void> {
  if (mode() === "supabase") {
    const sb = await supabaseServer();
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(p, body, { contentType, upsert: true });
    if (error) throw new Error("Envoi impossible : " + error.message);
    return;
  }
  const full = safeLocalPath(p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}
