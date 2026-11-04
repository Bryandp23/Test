# Architecture

```
app/
  e/[slug]/            page participant (SSR) · ics/ (fichier) · feed.ics/ (abonnement webcal)
  connect/[provider]/  démarrage OAuth 2.0 (code + PKCE)
  mes-calendriers/     gestion des agendas connectés par le participant
  admin/               back-office (login + groupe (app) protégé)
  api/
    track/             mesure d'audience (beacon JS, robots filtrés)
    connected/         ajout direct, consentement « ajout automatique », déconnexion
    oauth/[provider]/callback
    admin/…            API du back-office (session + contrôle d'origine)
    v1/registrations   intégration système d'inscription (clé Bearer)
lib/
  time.ts              conversions fuseau / heure d'été (sans dépendance)
  ics.ts               générateur RFC 5545 · links.ts liens fournisseurs · content.ts textes communs
  validation.ts        règles partagées client/serveur · device.ts détection non intrusive
  server/
    db.ts schema.ts    PostgreSQL (pg ou PGlite) + migrations versionnées
    events.ts          dépôt événements/séances, empreintes de contenu, SEQUENCE, historique
    connections.ts     agendas connectés : jetons chiffrés, ajout idempotent, propagation
    providers/         Google Calendar v3, Microsoft Graph
    auth.ts crypto.ts  sessions back-office, scrypt, AES-256-GCM, HMAC
    stats.ts maintenance.ts
components/            participant/ (AddToCalendar, Nudge…) · admin/ (Wizard, Dashboard, Share…)
```

## Modèle de données

- `events` (statut draft/published/cancelled/archived, `slug` stable) → `sessions` (date et heures **locales** + `start_utc`/`end_utc` calculés, `status`, `sequence`, `content_hash`).
- Une séance publiée n'est jamais supprimée : elle passe à `cancelled` pour être retirée aussi des calendriers.
- `content_hash` est l'empreinte de tout ce qui finit dans le calendrier. `SEQUENCE` n'augmente que si elle change, et seules ces séances sont propagées aux agendas connectés.
- `calendar_connections` : jetons chiffrés, email du compte (affichage) et empreinte HMAC (correspondance avec les inscriptions), `auto_add` et date du consentement.
- `synced_events` : une ligne unique par (connexion, séance) → idempotence, mises à jour, détection d'un événement supprimé par le participant (`removed_by_user`, jamais recréé de force).
- `stats_daily` : compteurs agrégés (événement, jour, mesure, calendrier, type d'appareil). Aucun identifiant individuel.

## Sécurité

- Back-office : sessions aléatoires (seule l'empreinte SHA-256 est en base), cookie `httpOnly` `SameSite=Lax` `Secure`, expiration glissante de 12 h, limitation des tentatives, contrôle de l'en-tête `Origin` sur toute requête modifiante (CSRF), rôles vérifiés côté serveur.
- Jetons OAuth chiffrés AES-256-GCM (clé dérivée d'`APP_SECRET`), PKCE et `state` signé, scopes minimaux (`calendar.events`, `Calendars.ReadWrite`), révocation à la déconnexion (Google) et effacement immédiat des jetons.
- En-têtes : CSP restrictive, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Pages publiques en `noindex`.
- Les pages publiques n'exposent aucune donnée de participant.

## RGPD

- Ajout simple : ni cookie, ni compte, ni donnée personnelle. La préférence de calendrier est stockée **dans le navigateur** uniquement, sur demande.
- Ajout direct : uniquement sur action du participant. L'ajout automatique des futures inscriptions demande une case de consentement explicite et se retire en un clic.
- Conservation : statistiques 13 mois (réglable), connexions inutilisées effacées après 12 mois.
- Liens personnalisés : seule l'empreinte HMAC de l'email est stockée.

## Fiabilité et performances

- Requêtes `GET` sans effet de bord (pages, fichiers) : les robots de prévisualisation des emails n'ont aucun impact. Les statistiques ne comptent que du JavaScript exécuté dans un vrai navigateur, avec en plus un filtre sur les agents connus.
- Les tuiles sont de vrais liens HTML : l'ajout fonctionne même si le JavaScript échoue.
- Appels aux fournisseurs avec délai maximal (10 s) et erreurs classées (`auth`, `not_found`, `rate_limit`…). La page reste utilisable en Mode A si une API est indisponible.
- Évolution prévue : passer la propagation des modifications dans une file de tâches si le nombre d'agendas connectés par événement devient important. Elle est aujourd'hui exécutée pendant l'enregistrement.
