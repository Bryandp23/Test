# Bilan technique

Situation au 4 novembre 2026, phase 1 complète et socle des phases 2 et 3 en place.

## Ce qui fonctionne immédiatement, sans clé ni compte externe

| Fonction | État |
| --- | --- |
| Back-office : connexion, rôles administrateur et éditeur, tableau de bord (recherche, filtres, onglets), assistant en 3 étapes, modèles, cycles, duplication, archivage, annulation, historique | ✅ |
| Validation : fin avant début, doublons, chevauchements, dates invalides, heures inexistantes ou ambiguës lors des changements d'heure | ✅ |
| Page participant responsive, détection de l'appareil, suggestion non exclusive, mémorisation du choix avec accord, incitation douce accessible | ✅ |
| Google Agenda, Outlook.com, Microsoft 365 (liens de fiche préremplie, une fiche par séance pour les cycles) | ✅ |
| Apple Calendrier et autres agendas (fichier `.ics` RFC 5545 avec VTIMEZONE Europe/Brussels, UID stables, SEQUENCE, DTSTAMP, VALARM, METHOD:CANCEL) | ✅ |
| Abonnement `webcal` par événement (les changements sont repris par le calendrier à son propre rythme) | ✅ |
| Lien court et stable, bouton HTML pour email, aperçu, instructions ActiveCampaign | ✅ |
| Statistiques agrégées sans données personnelles, filtrage des robots, export CSV | ✅ |
| Textes d'email de modification et d'annulation générés automatiquement | ✅ |

## Ce qui nécessite des identifiants externes (Mode B, « ajout direct »)

Le code est complet et testé contre un simulateur. Il reste à l'activer avec de vrais identifiants.

| Fournisseur | À fournir | Remarques |
| --- | --- | --- |
| Google Agenda | `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (Google Cloud, client OAuth « Application Web ») | Le scope `calendar.events` est **sensible** : Google impose une **vérification de l'application** (écran de consentement, politique de confidentialité, domaine vérifié) avant l'ouverture au public. Comptez plusieurs jours à quelques semaines. Avant cette vérification, 100 utilisateurs de test au maximum. |
| Microsoft (Outlook.com et Microsoft 365) | `MICROSOFT_CLIENT_ID` et `MICROSOFT_CLIENT_SECRET` (Microsoft Entra, inscription multi-locataire et comptes personnels) | Certaines organisations interdisent le consentement des utilisateurs à des applications tierces : leurs employés verront une demande d'approbation par leur administrateur. Il est recommandé de faire vérifier l'éditeur (« publisher verification »). |

Les boutons « Connecter… » n'apparaissent **que** si le fournisseur est configuré. Aucun bouton factice n'est affiché.

## À configurer avant la mise en production

1. **Hébergement** Node.js 20 ou plus (Vercel, Azure App Service, conteneur Docker…) et base **PostgreSQL** (`DATABASE_URL`, par exemple Supabase ou Azure Database for PostgreSQL). Les migrations s'appliquent automatiquement au démarrage.
2. **Domaine** : par exemple `agenda.ephec.be` en HTTPS, puis `PUBLIC_BASE_URL`. Ne plus le changer une fois des emails envoyés.
3. **Secrets** : `APP_SECRET` (32 octets aléatoires), plus `ADMIN_EMAIL` et `ADMIN_PASSWORD` pour le premier administrateur. Les comptes de démonstration sont désactivés en production.
4. `SEED_DEMO=false` pour ne pas créer les événements fictifs.
5. **Logo officiel** : renseigner son URL dans Réglages. Un logotype provisoire est affiché en attendant, car je n'avais pas le fichier officiel.
6. **Texte de confidentialité** : la page `/confidentialite` est un brouillon à faire valider par le DPO de l'EPHEC. Faire de même pour le registre des traitements.
7. **Tâche planifiée** (facultatif) : la purge RGPD tourne au plus une fois par heure lorsque le tableau de bord est consulté. Un cron est préférable en production.
8. Recommandé : brancher l'authentification du back-office sur le Microsoft 365 de l'EPHEC (SSO OIDC). L'architecture le permet, mais ce n'est pas implémenté. Aujourd'hui, il s'agit de comptes locaux avec mot de passe haché scrypt et limitation des tentatives.

## Limites dépendant des fournisseurs (à connaître)

- **Liens Google et Outlook web** : ils ouvrent une fiche préremplie, et le participant doit cliquer sur « Enregistrer ». Il est impossible de savoir s'il l'a fait. L'application affiche donc « Votre calendrier est prêt, il ne reste plus qu'à enregistrer l'événement », jamais « ajouté ».
- **Un lien égale une séance** : Google et Outlook n'acceptent pas plusieurs événements par lien. Pour un cycle, l'application propose un parcours séance par séance, un fichier unique ou l'ajout direct (une seule action).
- **Rappels** : appliqués par les fichiers `.ics` (Apple, Outlook bureau ; Google ignore souvent les alarmes à l'import) et par les agendas connectés. Les liens web Google et Outlook ne transmettent pas de rappel : l'interface ne le promet pas.
- **Mises à jour** : garanties pour les agendas connectés (API officielles) ; prises en compte avec délai pour les abonnements `webcal` (Google : jusqu'à 24 h ou plus) ; **impossibles** pour les ajouts par lien ou par fichier importé. Le back-office le dit explicitement et fournit le texte d'email à envoyer.
- **Annulation par fichier** : `METHOD:CANCEL` est compris par Outlook et parfois par Apple, pas par Google. Les agendas connectés, eux, affichent « ANNULÉ » et libèrent le créneau.
- **Doublons** : impossibles via les agendas connectés (identifiants déterministes chez Google, `transactionId` et propriété étendue chez Microsoft, verrou en base). Inévitables si un participant importe deux fois le même fichier, et l'interface l'en avertit.
- **Yahoo Agenda** : son lien d'ajout n'est pas documenté officiellement. L'option existe mais est **désactivée par défaut** (Réglages), à activer après un test réel.
- **Navigateurs intégrés** (applications Gmail, Outlook, Facebook…) : les téléchargements y sont parfois bloqués. La page le détecte, conseille d'ouvrir le navigateur et propose de copier le lien.
- **Microsoft Graph** : les fuseaux sont envoyés au format Windows (`Romance Standard Time` pour Bruxelles).

## Phase 3 : déjà en place, à intégrer

- **Liens personnalisés** : `POST /api/v1/registrations` (clé d'intégration générée dans Réglages) renvoie un lien `…/e/<id>?r=<jeton>` par inscription. L'email n'est jamais stocké en clair (empreinte HMAC).
- **Ajout automatique des futures inscriptions** : si le participant l'a explicitement accepté (« Mes calendriers connectés ») et que le système d'inscription transmet son inscription via cette API, l'événement est ajouté à son agenda.
- Points à décider : quel système d'inscription appelle l'API (webhook ActiveCampaign, formulaire du site) et quel champ personnalisé ActiveCampaign reçoit le lien.

## Arbitrages techniques

- **Next.js 16, React 19, TypeScript, Tailwind 4** comme proposé. Les pages publiques sont rendues côté serveur, sans script tiers, avec la police système (zéro téléchargement de police).
- **PostgreSQL** partout : `pg` en production, **PGlite** (PostgreSQL compilé en WebAssembly) en développement et pour les tests. On utilise le même SQL, sans service à installer pour essayer l'application.
- **Pas d'ORM** : environ dix tables et du SQL explicite, ce qui fait moins de dépendances et des migrations lisibles.
- **Dates stockées en heure locale + fuseau**, converties en UTC au dernier moment avec la base IANA du moteur JavaScript. C'est la seule représentation qui reste juste lors des changements d'heure.
- **Turquoise #27958F** pour l'identité et **#1D7A75** pour les boutons et le texte (contraste 5,1:1, contre 3,6:1 pour #27958F, insuffisant en WCAG AA pour du texte courant).
