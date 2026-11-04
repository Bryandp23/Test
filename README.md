# EPHEC Calendar

Application web qui permet aux participants de la Formation Continue de l'EPHEC d'ajouter une formation, un webinaire ou un cycle de plusieurs séances au calendrier de leur choix, à partir du bouton « Ajouter à mon calendrier » de leur email de confirmation (ActiveCampaign).

- **Participants** : une page `/e/<identifiant>`, sans compte, qui ouvre Google Agenda, Outlook (personnel ou Microsoft 365), Apple Calendrier ou un fichier `.ics`, avec un ajout direct vérifié lorsque l'agenda est connecté (OAuth).
- **Équipe EPHEC** : un back-office `/admin` pour créer un événement en 3 étapes, gérer les cycles, publier, modifier, annuler, dupliquer et copier le bouton email.

## Démarrage rapide (développement)

```bash
npm install
```

```bash
npm run dev
```

Ouvrez http://localhost:3000/admin. Les comptes de démonstration sont affichés sur la page de connexion (développement uniquement) :

- administrateur : `admin@ephec.local` / `Demo-EPHEC-2026!`
- éditeur : `editeur@ephec.local` / `Demo-Editeur-2026!`

Trois événements de démonstration, clairement marqués comme fictifs, sont créés au premier démarrage. La base locale (PostgreSQL en WebAssembly, PGlite) se trouve dans `./data`. Supprimez ce dossier pour repartir de zéro.

## Déploiement Netlify : clé secrète

Définissez `APP_SECRET` uniquement dans les variables d'environnement Netlify, avec une valeur aléatoire générée par `openssl rand -base64 32`. Ne réutilisez pas un mot courant ni les valeurs de test. Les fichiers `.env.*` sont ignorés, sauf le modèle `.env.example` qui reste sans secrets.

Si le contrôle de secrets détecte cette valeur dans de nombreux fichiers ordinaires, remplacez la clé trop courte ou commune au lieu de désactiver le contrôle. Une rotation invalide les sessions signées et nécessite de reconnecter les agendas dont les jetons étaient chiffrés avec l'ancienne clé. Relancez ensuite le déploiement ; conservez le contrôle des secrets activé.

## Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

- `npm test` : 28 tests unitaires et d'intégration (fuseaux et changements d'heure, conformité RFC 5545 vérifiée par un parseur indépendant, liens fournisseurs, validation, SEQUENCE, idempotence, connecteur Microsoft Graph simulé, chiffrement).
- `npm run test:e2e` : 27 parcours réels dans Chromium sur un serveur de production isolé (participant ordinateur/iPhone/Android, cycle, back-office, annulation, agenda connecté via un **simulateur** d'API Google, accessibilité axe-core WCAG 2.2 AA, statistiques).

Ce qui a été testé, et ce qui reste à tester sur de vrais appareils et comptes, est détaillé dans [docs/TESTS.md](docs/TESTS.md).

## Documentation

| Document | Pour qui |
| --- | --- |
| [docs/GUIDE-COLLABORATEUR.md](docs/GUIDE-COLLABORATEUR.md) | Créer un événement et insérer le bouton dans ActiveCampaign |
| [docs/BILAN-TECHNIQUE.md](docs/BILAN-TECHNIQUE.md) | Ce qui fonctionne, ce qu'il faut configurer, les limites des fournisseurs |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, choix techniques, sécurité et RGPD |
| [docs/TESTS.md](docs/TESTS.md) | Matrice des 18 scénarios et procédures manuelles |
| [.env.example](.env.example) | Variables de configuration |
