# Tests : ce qui est validé et ce qui reste à faire

Les résultats ci-dessous sont ceux réellement obtenus le 4 novembre 2026 (`npm test` : 28/28, `npm run test:e2e` : 27/27, Chromium 1.63). **Aucun test n'a été réalisé sur un vrai téléphone, ni avec un vrai compte Google, Microsoft ou Apple, ni dans un vrai envoi ActiveCampaign** : ces environnements n'étaient pas disponibles. Les procédures manuelles sont fournies pour cela.

Légende : ✅ validé automatiquement · 🟡 partiellement validé (format ou émulation), test réel à faire · ⬜ non testé, procédure manuelle fournie.

| # | Scénario | État | Ce qui a été vérifié |
| --- | --- | --- | --- |
| 1 | Google Agenda sur ordinateur | 🟡 | URL `calendar/render?action=TEMPLATE` : dates UTC exactes, titre, lieu, description, ouverture dans un nouvel onglet, message « prêt » (jamais « ajouté »). Enregistrement réel non testé. |
| 2 | Google Agenda sur Android | 🟡 | Émulation Pixel 7 : Google suggéré en premier. Webview d'application détectée, avec conseil et copie du lien. |
| 3 | Outlook.com | 🟡 | URL `outlook.live.com/calendar/0/action/compose` et paramètres vérifiés. |
| 4 | Microsoft 365 professionnel | 🟡 | URL `outlook.office.com/…` vérifiée. Requêtes Graph (fuseau Windows, rappel, `transactionId`, anti-doublon) vérifiées avec des réponses simulées. |
| 5 | Apple Calendrier sur iPhone | 🟡 | Émulation iPhone 13 : Apple suggéré sans masquer les autres options, lien `.ics` sans attribut `download`, tuiles de 56 px ou plus. |
| 6 | Apple Calendrier sur Mac | ⬜ | Fichier conforme (voir #7). |
| 7 | Export ICS | ✅ / 🟡 | Fichier relu par `ical.js` : VTIMEZONE, heures été et hiver, UID uniques, SEQUENCE, VALARM, accents et caractères spéciaux, lignes de 75 octets maximum. Import dans de vraies applications à faire. |
| 8 | Événement à plusieurs séances | ✅ | Création par l'assistant (rôle éditeur), 7 séances, publication, page participant. |
| 9 | Cycle avec dates, horaires et lieux différents | ✅ | Séance de Louvain-la-Neuve à 9 h dans le cycle Sports Business, séance de 9 h dans le cycle créé. Toujours des événements distincts, jamais un bloc continu. |
| 10 | Modification d'une séance après publication | ✅ | Page à jour, SEQUENCE +1 uniquement pour la séance modifiée, résumé et texte d'email. Agenda connecté (simulé) mis à jour. |
| 11 | Annulation | ✅ | Page « annulé », fichier `METHOD:CANCEL`, texte d'email. Agenda connecté (simulé) : « ANNULÉ » et créneau libéré. |
| 12 | Clics répétés et doublons | ✅ (simulé) | Double clic et nouvelle tentative : 9 événements, jamais 11. Appels concurrents en base : aucune création en double. Avec la vraie API Google : ⬜. |
| 13 | Bouton dans un email ActiveCampaign | 🟡 | HTML en tableau avec styles en ligne et texte de secours, aperçu, redirection de suivi simulée (302) suivie correctement. Envoi réel ⬜. |
| 14 | Ouverture depuis Gmail et Outlook mobiles | 🟡 | Agents utilisateurs de webview émulés : avertissement affiché. Applications réelles ⬜. |
| 15 | Fuseaux horaires et changements d'heure | ✅ | 28 mars et 31 octobre 2027, heures inexistantes ou ambiguës, navigateur réglé sur New York : heure belge et UTC corrects. |
| 16 | Erreurs OAuth et déconnexion | ✅ (simulé) | Refus du consentement (simulateur), jeton refusé classé « auth » (Graph simulé), déconnexion avec révocation. Avec les vrais fournisseurs : ⬜. |
| 17 | Collaborateur peu expérimenté | 🟡 | Parcours scripté avec erreurs guidées (nom manquant, fin avant début, doublon). Un vrai test utilisateur chronométré reste à faire (objectif : moins de 2 minutes). |
| 18 | Clavier et accessibilité mobile | ✅ / 🟡 | axe-core WCAG 2.2 AA : 0 violation (page participant ordinateur et mobile, tableau de bord, assistant, partage). Lien d'évitement, tuiles et sous-menu Outlook au clavier. Lecteurs d'écran réels (VoiceOver, NVDA, TalkBack) ⬜. |

## Procédures manuelles

Préparation : déployer sur une URL HTTPS de recette, définir `PUBLIC_BASE_URL`, utiliser l'événement de démonstration « Webinaire gratuit » et le cycle « Cycle IA & Humain ».

**A. Ajout par lien (1, 2, 3, 4)** : sur chaque appareil, ouvrir la page, choisir le calendrier, cliquer sur « Enregistrer » dans le calendrier, puis vérifier dans l'agenda : titre « EPHEC | … », jeudi 19 novembre 2026 de 12 h à 13 h (heure de Belgique), lien Teams fictif dans le lieu, description avec le lien de la page. Refaire avec un appareil réglé sur un autre fuseau.

**B. Fichier (5, 6, 7)** : iPhone (Safari) → « Apple Calendrier » → la fiche système s'ouvre → « Tout ajouter » pour le cycle (9 séances). Mac → ouvrir le fichier téléchargé. Outlook Windows → « Application Outlook sur ordinateur ». Thunderbird → « Autre calendrier ». Contrôler l'heure de la séance du 1er avril 2027 (18 h 30) et le rappel.

**C. Agenda connecté (12, 16)** : configurer les identifiants Google et Microsoft de recette, « Connecter Google Agenda », accepter, vérifier « 9 séances ajoutées » et leur présence dans l'agenda. Recliquer et vérifier qu'aucun doublon n'apparaît. Modifier une heure dans le back-office et vérifier la mise à jour dans l'agenda. Supprimer un événement dans l'agenda, modifier de nouveau, et vérifier le message « supprimé par le participant ». Révoquer l'accès dans le compte Google, puis cliquer sur « Ajouter » et vérifier le message de reconnexion. Refaire avec un compte Microsoft 365 professionnel et un compte Outlook.com.

**D. ActiveCampaign (13, 14)** : coller le bouton dans un email de test, suivi des clics activé. L'ouvrir dans Gmail web, Outlook web, Outlook Windows, Apple Mail, l'application Gmail (Android et iOS) et l'application Outlook (Android et iOS). Vérifier l'affichage du bouton et l'ouverture de la page. Contrôler que les statistiques n'augmentent pas à la simple réception de l'email (robots de sécurité).

**E. Test utilisateur (17)** : demander à deux collègues non techniques de créer « Séance d'information » puis un cycle de 6 séances, et de copier le bouton. Chronométrer et noter les hésitations, sans aide.

**F. Lecteurs d'écran (18)** : VoiceOver (iPhone), TalkBack (Android) et NVDA (Windows) sur la page participant, l'incitation et l'assistant.
