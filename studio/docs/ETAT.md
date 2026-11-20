# État de la version

## Livré (phase 1)

- Authentification (Supabase mot de passe ou lien email ; mode local en développement), données et fichiers persistés, RLS.
- Board visuel : colonne cycles/sessions fixe pendant le défilement horizontal, sous-lignes dépliables (état mémorisé), densité compacte/confortable (mémorisée sur le compte), aperçus réels, indicateur de fichiers supplémentaires, statistiques par cycle.
- Glisser-déposer dnd-kit : cycles, cartes dans une ligne, entre sessions, vers un autre cycle ; tactile (appui long) et clavier (Espace, flèches) ; menus « Déplacer vers… », « Décaler », « Monter/Descendre » ; annulation après déplacement.
- Dépôt de fichiers depuis l'ordinateur sur une ligne (création d'une publication liée) ou sur une carte (ajout), progression, erreurs, réessai.
- Cycles (création avec sessions, modification, duplication de structure, archivage, suppression, réordonnancement), projets sans sessions, sessions (création, modification, tri chronologique, réordonnancement, suppression).
- Publications : création rapide, panneau détaillé complet, duplication indépendante, archivage, suppression, historique des changements.
- Statuts de production et de diffusion séparés, programmation confirmée manuellement, publication réelle avec date et URL.
- Tags par dimension (création, renommage, couleur, suppression), recherche globale, filtres combinables, vues enregistrées.
- Mon espace, Médiathèque (grille de tous les fichiers, filtrable), Paramètres.
- Version mobile : navigation en tiroir, lignes qui défilent au doigt, panneau plein écran, envoi de fichiers depuis le téléphone.

## Pas encore implémenté (affiché comme tel dans l'application)

- **Phase 2** : calendrier (mois/semaine/jour, déplacement par date), timeline, rétroplanning automatique et modèles (table `retroplanning_templates` déjà créée), glisser-déposer de session.
- **Phase 3** : bilan, statistiques, portfolio et exports.
- Image de couverture des cycles (colonne `cover_path` prête, pas d'interface).
- Aperçu automatique Open Graph des URLs (choix de sécurité : pas de récupération de pages tierces côté serveur pour l'instant).

## Limites connues

- Pas de virtualisation des lignes : au-delà de quelques milliers de cartes visibles simultanément, préférer les filtres.
- Les fichiers en attente abandonnés sont nettoyés lors du prochain envoi dans la même publication (après 24 h), pas par une tâche planifiée.
- Testé en Chromium (ordinateur et profil iPhone 13). Safari et Firefox réels restent à vérifier, ainsi que le déploiement Supabase/Vercel avec de vrais identifiants.
