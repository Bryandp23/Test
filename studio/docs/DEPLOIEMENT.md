# Déploiement

## 1. Supabase

1. Créez un projet sur supabase.com en choisissant une **région européenne** (Frankfurt `eu-central-1` ou Paris `eu-west-3`).
2. **Authentication → Providers → Email** : laissez l'email activé, **désactivez « Allow new users to sign up »** (application mono-utilisateur).
3. **Authentication → Users → Add user** : créez le compte du chargé de communication (email + mot de passe, « Auto confirm »).
4. **Authentication → URL Configuration** : *Site URL* = l'adresse de production ; ajoutez `https://<votre-domaine>/auth/callback` aux *Redirect URLs* (connexion par lien email).
5. **Base de données** : les migrations s'appliquent automatiquement au premier démarrage. Pour les appliquer à la main, collez dans le *SQL Editor*, dans l'ordre :
   - `supabase/migrations/20261120000001_init.sql` (tables, index, contraintes, RLS)
   - `supabase/migrations/20261120000002_storage.sql` (bucket privé `studio-files` + politiques)

   Ou avec la CLI : `supabase link` puis `supabase db push`.
6. **Storage → Settings** : vérifiez la limite globale de taille de fichier (50 Mo sur le plan gratuit). Elle s'ajoute à `STUDIO_MAX_UPLOAD_MB`.

## 2. Vercel

1. Importez le dépôt et réglez **Root Directory = `studio`**.
2. Variables d'environnement (Production et Preview) :

| Variable | Où la trouver | Secrète |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API (clé *publishable* ou *anon*) | non |
| `DATABASE_URL` | Project Settings → Database → *Transaction pooler* (port **6543**) | **oui** |
| `STUDIO_MAX_UPLOAD_MB` | facultatif (défaut 200) | non |

3. **Settings → Functions → Region** : choisissez `fra1` (Francfort) pour rester proche de la base.
4. Déployez. Sans ces variables, l'application affiche une page « Configuration requise » au lieu de démarrer en mode local.

## 3. Comment les données sont protégées

- Chaque requête SQL s'exécute dans une transaction avec le rôle `authenticated` et les claims de l'utilisateur connecté : les politiques RLS (`owner_id = auth.uid()`) filtrent réellement les lignes.
- Les fichiers sont dans un bucket **privé**, sous `<id utilisateur>/<id publication>/…` ; les politiques Storage n'autorisent que le dossier de l'utilisateur. Les navigateurs reçoivent des URLs signées valables 2 h (lecture) ou un jeton d'envoi à usage unique.
- `DATABASE_URL` n'est lue que côté serveur. Aucune clé *service_role* n'est utilisée.

## 4. Sauvegardes

- Supabase effectue des sauvegardes quotidiennes de la base (7 jours sur le plan Pro ; activez le *Point-in-Time Recovery* si nécessaire).
- **Les fichiers Storage ne sont pas inclus** dans ces sauvegardes. Export ponctuel :
  `supabase storage cp -r ss:///studio-files ./sauvegarde-fichiers --experimental`
- Export SQL manuel : `pg_dump "$DATABASE_URL" --schema=public > sauvegarde.sql` (utilisez la connexion directe, port 5432).

## 5. Ajouter une migration

1. Ajoutez une entrée à la fin de `MIGRATIONS` dans `lib/server/migrations.ts` (numéro de version suivant, instructions séparées par `-- ;;`).
2. `npm run db:export` pour régénérer `supabase/migrations/`.
3. Au déploiement suivant, la migration s'applique au démarrage (table `studio_migrations`).
