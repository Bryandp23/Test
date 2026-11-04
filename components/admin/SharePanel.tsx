"use client";

import { useState } from "react";
import { IconCheck, IconCopy, IconLink } from "@/components/icons";

export default function SharePanel({ url, html, title }: { url: string; html: string; title: string }) {
  const [copied, setCopied] = useState<null | "link" | "html">(null);
  const [preview, setPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);

  async function copy(kind: "link" | "html") {
    try {
      // Code HTML en texte brut : à coller dans le bloc « HTML » d'ActiveCampaign.
      await navigator.clipboard.writeText(kind === "link" ? url : html);
      setCopied(kind);
      setTimeout(() => setCopied(null), 3500);
    } catch {
      setShowCode(true);
    }
  }

  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;"><p style="margin:0 0 8px;font-size:15px;color:#111">Bonjour,</p><p style="margin:0 0 8px;font-size:15px;color:#111;line-height:22px">Votre inscription à « ${title.replace(/</g, "&lt;")} » est confirmée.</p>${html}<p style="margin:16px 0 0;font-size:13px;color:#6b7280">— Aperçu d'un email de confirmation (exemple)</p></div></body></html>`;

  return (
    <div className="mt-6 space-y-6">
      <section className="shape-lg bg-white p-5 shadow-sm sm:p-6" aria-labelledby="lien-title">
        <h2 id="lien-title" className="flex items-center gap-2 text-lg font-bold">
          <IconLink /> Lien de la page d&apos;ajout
        </h2>
        <p className="mt-1 text-sm text-muted">Stable : il reste le même même si vous modifiez l&apos;événement.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} aria-label="Lien de la page d'ajout" className="min-h-12 flex-1 rounded-xl border-2 border-line bg-canvas px-3 font-mono text-sm" onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => copy("link")} className="shape inline-flex min-h-12 items-center justify-center gap-2 bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">
            {copied === "link" ? <IconCheck /> : <IconCopy />} {copied === "link" ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
        <a href={url} target="_blank" rel="noopener" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline underline-offset-4">
          Ouvrir la page comme un participant ↗
        </a>
      </section>

      <section className="shape-lg bg-white p-5 shadow-sm sm:p-6" aria-labelledby="bouton-title">
        <h2 id="bouton-title" className="text-lg font-bold">
          Bouton pour l&apos;email
        </h2>
        <p className="mt-1 text-sm text-muted">Compatible ActiveCampaign, Outlook, Gmail et Apple Mail. Aucun code à modifier.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => copy("html")} className="shape inline-flex min-h-12 items-center justify-center gap-2 bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">
            {copied === "html" ? <IconCheck /> : <IconCopy />} {copied === "html" ? "Bouton copié" : "Copier le bouton HTML"}
          </button>
          <button type="button" onClick={() => setPreview((p) => !p)} aria-expanded={preview} className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-brand-700 px-5 font-semibold text-brand-800 hover:bg-brand-50">
            {preview ? "Masquer l'aperçu" : "Prévisualiser le bouton"}
          </button>
        </div>
        <div aria-live="polite" className="sr-only">
          {copied === "html" ? "Bouton copié dans le presse-papiers" : copied === "link" ? "Lien copié dans le presse-papiers" : ""}
        </div>
        {preview && (
          <iframe title="Aperçu du bouton dans un email" srcDoc={doc} sandbox="allow-popups allow-popups-to-escape-sandbox" className="mt-4 h-72 w-full rounded-xl border-2 border-line bg-canvas" />
        )}
        <button type="button" onClick={() => setShowCode((s) => !s)} className="mt-4 text-sm font-semibold text-muted underline underline-offset-4">
          {showCode ? "Masquer le code" : "Voir le code (pour le service informatique)"}
        </button>
        {showCode && <textarea readOnly value={html} rows={10} aria-label="Code HTML du bouton" className="mt-2 block w-full rounded-xl border-2 border-line bg-canvas p-3 font-mono text-xs" onFocus={(e) => e.target.select()} />}
      </section>

      <section className="shape-lg bg-white p-5 shadow-sm sm:p-6" aria-labelledby="ac-title">
        <h2 id="ac-title" className="text-lg font-bold">
          Dans ActiveCampaign, en 4 étapes
        </h2>
        <p className="mt-2 font-semibold">Méthode la plus simple : le bloc « Bouton » d&apos;ActiveCampaign</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ink/90">
          <li>Ouvrez l&apos;email de confirmation (ou l&apos;automatisation) dans ActiveCampaign.</li>
          <li>Faites glisser un bloc <strong>« Bouton »</strong> à l&apos;endroit voulu.</li>
          <li>
            Texte du bouton : <strong>Ajouter à mon calendrier</strong>. Lien : collez le lien copié ci-dessus. Couleur : <span className="rounded bg-[#1D7A75] px-1.5 font-mono text-white">#1D7A75</span>.
          </li>
          <li>Envoyez-vous un email de test et cliquez sur le bouton depuis votre téléphone.</li>
        </ol>
        <p className="mt-4 font-semibold">Ou : le bouton EPHEC prêt à l&apos;emploi</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ink/90">
          <li>Cliquez sur « Copier le bouton HTML ».</li>
          <li>Dans ActiveCampaign, ajoutez un bloc <strong>« HTML »</strong> (ou « Code personnalisé »).</li>
          <li>Collez (Ctrl+V ou ⌘+V) puis enregistrez.</li>
          <li>Envoyez-vous un email de test.</li>
        </ol>
        <p className="mt-4 rounded-xl bg-canvas p-3 text-sm text-muted">
          Le suivi des clics d&apos;ActiveCampaign peut rester activé : le lien fonctionne aussi après redirection. Les robots de sécurité des messageries qui « testent » les liens ne sont pas comptés dans les statistiques.
        </p>
      </section>
    </div>
  );
}
