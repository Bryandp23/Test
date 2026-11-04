import type { Metadata } from "next";
import { EphecLogo } from "@/components/icons";

export const metadata: Metadata = { title: "Confidentialité" };

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 leading-relaxed">
      <EphecLogo className="h-9" />
      <h1 className="mt-8 text-2xl font-bold">Confidentialité et données</h1>
      <p className="mt-2 text-sm text-muted">Texte de travail à valider par le délégué à la protection des données de l&apos;EPHEC.</p>
      <h2 className="mt-6 text-lg font-bold">Ajout simple (lien ou fichier)</h2>
      <p className="mt-2">
        Aucun compte, aucun cookie, aucune donnée personnelle. Nous comptons uniquement, de façon agrégée par jour, les ouvertures de page et le calendrier choisi, ainsi que le type d&apos;appareil (mobile, tablette, ordinateur). Aucune adresse IP n&apos;est conservée.
      </p>
      <p className="mt-2">
        Si vous cochez « Retenir mon choix », ce choix est enregistré uniquement dans votre navigateur (stockage local) et peut être effacé à tout moment.
      </p>
      <h2 className="mt-6 text-lg font-bold">Ajout direct (agenda connecté)</h2>
      <p className="mt-2">
        Uniquement si vous le demandez. Nous conservons, chiffrés, les jetons d&apos;accès délivrés par Google ou Microsoft, l&apos;adresse du compte connecté, et la liste des événements EPHEC que nous avons ajoutés afin de les mettre à jour. Nous ne lisons pas vos autres rendez-vous : l&apos;autorisation demandée se limite à la gestion d&apos;événements. Un cookie technique relie ce navigateur à votre connexion.
      </p>
      <p className="mt-2">Vous pouvez tout supprimer à tout moment depuis « Mes calendriers connectés » : les jetons et l&apos;adresse sont alors effacés immédiatement.</p>
      <h2 className="mt-6 text-lg font-bold">Durées de conservation</h2>
      <ul className="mt-2 list-disc pl-5">
        <li>Statistiques agrégées : 13 mois (réglable par l&apos;EPHEC).</li>
        <li>Connexions d&apos;agenda : jusqu&apos;à leur déconnexion par vous, ou 12 mois sans utilisation.</li>
      </ul>
    </main>
  );
}
