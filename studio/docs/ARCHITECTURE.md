# Architecture

## Parcours utilisateur structurants

| Parcours | Où | Comment |
| --- | --- | --- |
| Démarrer la journée | Mon espace | Aujourd'hui, en retard, à programmer, en cours, à créer sous 3 semaines, prochains événements et cycles |
| Créer un cycle et ses sessions | Créer → Cycle | Un seul formulaire : dates, public, sessions (rangées par date) |
| Déposer des créations | Board : glisser des fichiers sur une ligne | Choix « une publication (carrousel) » ou « une par fichier », liée au bon cycle et à la bonne session |
| Compléter une publication | Panneau latéral | Fichiers (ordre, aperçu, téléchargement), texte + copie, statuts, dates, emplacement, métadonnées, liens, notes, historique |
| Confirmer une programmation | Panneau → Diffusion | Action explicite : date, heure (Bruxelles), outil utilisé |
| Réorganiser | Board | Glisser-déposer (souris, tactile, clavier) ou menu « Déplacer vers… » / « Décaler » |
| Retrouver | Barre supérieure | Recherche plein texte + filtres combinés + vues enregistrées, actifs dans toutes les vues |

## Composants

```
app/
  (app)/layout.tsx        session obligatoire, charge toutes les données du board (une requête par table)
  (app)/board|espace|mediatheque|parametres|calendrier|timeline|bilan
  actions/                actions serveur : board, cycles, sessions, publications, files, tags, demo
  api/preview/[id]        aperçu HTML isolé (CSP sandbox, aucun script)
  api/local-files/…       stockage du mode local (URLs signées HMAC)
  login/ auth/callback    connexion mot de passe ou lien email (Supabase)
proxy.ts                  rafraîchissement de session Supabase, redirection vers /login
components/
  shell/                  StudioRoot (hydratation), Sidebar, Topbar (recherche, filtres, vues, Créer), Toaster, UploadTray
  board/                  Board (DndContext), CycleBlock (en-tête + sous-lignes), PubCard
  panel/                  PublicationPanel, MediaSection, DiffusionSection, Activity
  dialogs/DialogHost      cycle, session, publication, dépôt de fichiers, déplacement, confirmation, dates de session
  views/                  MySpace, MediaLibrary, Settings, NotYet
lib/
  domain.ts               types, libellés, types de fichiers acceptés
  time.ts                 Europe/Bruxelles (heure d'été) sans dépendance
  filter.ts               recherche et filtres (partagés entre les vues)
  client/store.ts ops.ts  état (zustand), mises à jour optimistes, annulation, erreurs
  client/upload.ts        miniatures dans le navigateur, envoi direct avec progression, reprise
  server/                 db (pg / PGlite + RLS), auth, storage, repo (SQL), migrations
```

## Modèle de données

`cycles` → `sessions` → `publications` → `publication_attachments`, `publication_links`, `publication_tags` ; `tags` (dimensions canal, public, nature, format, libre), `saved_views`, `user_prefs`, `activity_log`, `retroplanning_templates` (phase 2). Toutes les tables portent `owner_id` (défaut `auth.uid()`) et une politique RLS.

Décisions :

- **Une publication possède ses fichiers.** Dupliquer recopie aussi les fichiers dans le stockage : les deux exemplaires sont indépendants.
- **Session et cycle cohérents par contrainte** : clé étrangère composite `(session_id, cycle_id)`. Supprimer une session renvoie ses publications dans les contenus généraux (`on delete set null (session_id)`).
- **« Programmé » n'existe pas sans date confirmée** : `check (diffusion_status <> 'programme' or scheduled_at is not null)`. Seule l'action `setDiffusion` change la diffusion.
- **Dates** : date cible et dates de session en `date` + `time` locales (ce que l'utilisateur saisit) ; programmation et publication réelles en `timestamptz`, converties depuis/vers Europe/Bruxelles.
- **Positions** en `double precision`, réécrites 1..n après chaque réordonnancement d'une ligne.
- **Changement de date d'une session** : les publications restent rattachées ; l'application propose de décaler leurs dates cibles, publications programmées décochées par défaut, `scheduled_at` jamais modifié.
- `retro_key` (unique par cycle) prépare la déduplication du rétroplanning.

## Fichiers

1. Le navigateur génère une miniature WebP (images > 720 px, GIF, première image des vidéos) et mesure les dimensions.
2. `prepareUploads` valide type et taille, crée des pièces jointes `pending` et renvoie des URLs d'envoi signées.
3. Envoi direct navigateur → Supabase Storage (pas de limite de taille des fonctions Vercel), trois en parallèle, progression affichée.
4. `completeUpload` vérifie la présence du fichier puis le rend visible. En cas d'échec : suppression de la pièce en attente et bouton « Réessayer ».

HTML importé : jamais servi depuis le stockage ; `/api/preview/[id]` le renvoie avec `Content-Security-Policy: sandbox` (origine opaque, scripts interdits) dans une iframe `sandbox`. Les liens externes ne sont pas intégrés en iframe : ils s'affichent comme des cartes de lien.

## Performances

Une seule charge initiale (rendue côté serveur), puis mises à jour optimistes. Miniatures légères et `loading="lazy"` ; `content-visibility: auto` sur les lignes du board ; cartes mémoïsées ; URLs signées par lots.
