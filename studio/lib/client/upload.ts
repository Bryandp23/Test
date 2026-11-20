"use client";
// Envoi des fichiers : miniature générée dans le navigateur, envoi direct vers le stockage
// (URL signée, avec progression), puis confirmation côté serveur. Erreurs récupérables (Réessayer).
import { abortUpload, completeUpload, prepareUploads, type PreparedUpload } from "@/app/actions/files";
import { normalizeMime } from "@/lib/domain";
import { useStudio } from "./store";

interface Analysis {
  thumb: Blob | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
}

const THUMB_W = 720;

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", 0.82));
}

function drawScaled(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(1, THUMB_W / w);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

async function analyze(file: File, mime: string): Promise<Analysis> {
  const none: Analysis = { thumb: null, width: null, height: null, duration_s: null };
  try {
    if (mime === "image/svg+xml") {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const ok = await withTimeout(new Promise<boolean>((r) => ((img.onload = () => r(true)), (img.onerror = () => r(false)), (img.src = url))), 5000, false);
      URL.revokeObjectURL(url);
      return ok ? { ...none, width: img.naturalWidth || null, height: img.naturalHeight || null } : none;
    }
    if (mime.startsWith("image/")) {
      const bmp = await withTimeout(createImageBitmap(file), 8000, null as unknown as ImageBitmap);
      if (!bmp) return none;
      const { width, height } = bmp;
      const needThumb = width > THUMB_W * 1.2 || file.size > 400_000 || mime === "image/gif";
      const thumb = needThumb ? await canvasToWebp(drawScaled(bmp, width, height)) : null;
      bmp.close();
      return { thumb, width, height, duration_s: null };
    }
    if (mime.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = url;
      const loaded = await withTimeout(new Promise<boolean>((r) => ((v.onloadeddata = () => r(true)), (v.onerror = () => r(false)))), 10000, false);
      if (!loaded) {
        URL.revokeObjectURL(url);
        return none;
      }
      const duration = Number.isFinite(v.duration) ? v.duration : null;
      v.currentTime = Math.min(1, (duration ?? 2) / 3);
      await withTimeout(new Promise<void>((r) => (v.onseeked = () => r())), 6000, undefined);
      let thumb: Blob | null = null;
      if (v.videoWidth) thumb = await canvasToWebp(drawScaled(v, v.videoWidth, v.videoHeight));
      URL.revokeObjectURL(url);
      return { thumb, width: v.videoWidth || null, height: v.videoHeight || null, duration_s: duration };
    }
  } catch {
    /* miniature facultative */
  }
  return none;
}

function put(url: string, body: Blob, headers: Record<string, string>, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? "Fichier trop volumineux pour le stockage" : `Le stockage a refusé le fichier (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Connexion interrompue"));
    xhr.onabort = () => reject(new Error("Envoi annulé"));
    xhr.send(body);
  });
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

/** Envoie des fichiers dans une publication. Résout lorsque tous les envois sont terminés (réussis ou non). */
export async function uploadFiles(publicationId: string, files: File[]): Promise<{ ok: number; failed: number }> {
  const st = useStudio.getState();
  const accepted: { file: File; mime: string }[] = [];
  for (const f of files) {
    const mime = normalizeMime(f.name, f.type);
    if (!mime) st.toast({ kind: "error", message: `« ${f.name} » : type de fichier non pris en charge.` });
    else accepted.push({ file: f, mime });
  }
  if (!accepted.length) return { ok: 0, failed: files.length };

  const localIds = accepted.map(() => "local-" + Math.random().toString(36).slice(2));
  accepted.forEach((a, i) => st.upsertUpload({ id: localIds[i], publicationId, name: a.file.name, size: a.file.size, progress: 0, state: "preparing" }));

  const analyses = await Promise.all(accepted.map((a) => analyze(a.file, a.mime)));
  const prep = await prepareUploads(
    publicationId,
    accepted.map((a, i) => ({ name: a.file.name, mime: a.mime, size: a.file.size, withThumb: Boolean(analyses[i].thumb) })),
  );
  if (!prep.ok) {
    accepted.forEach((a, i) =>
      st.upsertUpload({ id: localIds[i], state: "error", error: prep.error, retry: () => retry(localIds[i], publicationId, a.file) }),
    );
    return { ok: 0, failed: accepted.length };
  }

  let ok = 0;
  let failed = 0;
  const jobs = prep.data.map((p, i) => ({ p, a: accepted[i], an: analyses[i], localId: localIds[i] }));
  await pool(jobs, 3, async ({ p, a, an, localId }) => {
    const success = await sendOne(localId, publicationId, p, a.file, an);
    if (success) ok++;
    else failed++;
  });
  return { ok, failed };
}

async function sendOne(jobId: string, publicationId: string, p: PreparedUpload, file: File, an: Analysis): Promise<boolean> {
  const st = useStudio.getState();
  try {
    st.upsertUpload({ id: jobId, state: "uploading", progress: 0 });
    await put(p.file.url, file, p.file.headers, (x) => useStudio.getState().upsertUpload({ id: jobId, progress: x * 0.95 }));
    let thumbUploaded = false;
    if (p.thumb && an.thumb) {
      try {
        await put(p.thumb.url, an.thumb, p.thumb.headers);
        thumbUploaded = true;
      } catch {
        /* la carte utilisera le fichier original */
      }
    }
    st.upsertUpload({ id: jobId, state: "finishing", progress: 0.97 });
    const done = await completeUpload(p.attachmentId, { width: an.width, height: an.height, duration_s: an.duration_s, thumbUploaded });
    if (!done.ok) throw new Error(done.error);
    const s = useStudio.getState();
    s.upsertPub(done.data.summary);
    const det = s.details[publicationId];
    if (det) s.setDetail({ ...det, ...done.data.summary, attachments: [...det.attachments.filter((x) => x.id !== done.data.attachment.id), done.data.attachment].sort((x, y) => x.position - y.position) });
    s.upsertUpload({ id: jobId, state: "done", progress: 1 });
    setTimeout(() => useStudio.setState((x) => ({ uploads: x.uploads.filter((u) => u.id !== jobId) })), 2500);
    return true;
  } catch (e) {
    await abortUpload(p.attachmentId);
    useStudio.getState().upsertUpload({ id: jobId, state: "error", error: (e as Error).message, retry: () => retry(jobId, publicationId, file) });
    return false;
  }
}

function retry(jobId: string, publicationId: string, file: File) {
  useStudio.setState((x) => ({ uploads: x.uploads.filter((u) => u.id !== jobId) }));
  void uploadFiles(publicationId, [file]);
}
