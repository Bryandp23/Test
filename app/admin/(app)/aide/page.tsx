import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aide" };

const faq: [string, React.ReactNode][] = [
  [
    "Je dois changer l'heure ou le lien Teams après l'envoi des emails",
    <>
      Ouvrez l&apos;événement, modifiez, cliquez sur « Enregistrer ». La page d&apos;ajout est à jour immédiatement et les agendas connectés sont mis à jour automatiquement. Les participants ayant utilisé un lien ou un fichier doivent être prévenus par email : un texte prêt à copier vous est proposé.
    </>,
  ],
  [
    "Une séance d'un cycle est supprimée",
    <>Dans l&apos;étape 2, cliquez sur « Annuler la séance ». Elle reste visible, barrée, pour que les participants comprennent le changement.</>,
  ],
  [
    "Le participant me dit que l'événement « n'a pas été ajouté »",
    <>
      Avec Google ou Outlook en ligne, une fiche préremplie s&apos;ouvre : le participant doit encore cliquer sur « Enregistrer ». La page le lui indique clairement. Sur iPhone, il doit toucher « Ajouter ». S&apos;il utilise une application de messagerie, conseillez-lui d&apos;ouvrir le lien dans Safari ou Chrome.
    </>,
  ],
  [
    "Pourquoi les statistiques distinguent « clic » et « ajout confirmé » ?",
    <>Un clic ouvre le calendrier, mais nous ne pouvons pas savoir si le participant a enregistré. Seuls les agendas connectés (Google, Microsoft) nous confirment l&apos;ajout.</>,
  ],
  [
    "Puis-je réutiliser une formation de l'an dernier ?",
    <>Oui : ouvrez-la (onglet « Passés »), cliquez sur « Dupliquer », changez les dates et publiez.</>,
  ],
];

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Aide</h1>
      <section className="shape-lg mt-6 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Créer et partager un événement en 5 étapes</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Cliquez sur <Link href="/admin/evenements/nouveau" className="font-semibold text-brand-700 underline">« Créer un événement »</Link> et choisissez un modèle (webinaire Teams, conférence, séance d&apos;information, cycle).
          </li>
          <li>Étape 1 : donnez un nom, une courte description et le lien vers la page ephec.be.</li>
          <li>
            Étape 2 : indiquez la date et les horaires. Pour un cycle, cliquez sur <strong>« Ajouter une séance »</strong> autant de fois que nécessaire (chaque nouvelle séance reprend l&apos;horaire de la précédente, une semaine plus tard). Indiquez l&apos;adresse ou collez le lien Teams.
          </li>
          <li>Étape 3 : vérifiez l&apos;aperçu puis cliquez sur <strong>« Publier l&apos;événement »</strong>.</li>
          <li>
            Sur l&apos;écran de partage, cliquez sur <strong>« Copier le lien »</strong> et collez-le dans un bloc « Bouton » de votre email ActiveCampaign (texte : « Ajouter à mon calendrier »). Envoyez-vous un test.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted">Les erreurs (fin avant le début, date en double, heure qui n&apos;existe pas lors du changement d&apos;heure…) sont signalées automatiquement avant la publication.</p>
      </section>
      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold">Questions fréquentes</h2>
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-ink/85">{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
