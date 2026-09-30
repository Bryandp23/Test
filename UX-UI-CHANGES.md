# Rank My League : passe UX/UI (étapes 1 et 2)

Tout le travail porte sur `app/globals.css`, plus un nouveau fichier `app/fonts.ts`.
Le premier commit (`Import current Rank My League globals.css as baseline`) est une copie
non modifiée de ta feuille de style. Les commits suivants montrent donc uniquement mes changements.

## Intégrer dans ton projet

1. Vérifie que la copie de référence est identique à ton fichier actuel :
   `diff <ton-projet>/app/globals.css <(git show dd5af30:app/globals.css)`.
   Si le diff est vide, tu peux remplacer ton `globals.css` par celui de cette branche.
   Si ton fichier a changé entre-temps, applique plutôt les commits un par un (`git format-patch` + `git am`).
2. Copie `app/fonts.ts` dans ton dossier `app/`.
3. Dans `app/layout.tsx`, ajoute les variables de police sur `<html>` :

   ```tsx
   import { fontVariables } from "./fonts";

   <html lang="fr" className={fontVariables}>
   ```

   Sans cette étape, le site garde Impact/Arial (le CSS retombe proprement dessus).

## Étape 1 : correctifs

| Problème | Correction |
|---|---|
| `.site-shell { overflow: hidden }` empêchait tous les `position: sticky` (bouton « Valider », barre de progression mobile, panneau Room, menu des pages légales) de rester fixés | `overflow-x: clip` (repli `overflow-x: hidden` pour les vieux navigateurs) |
| `var(--lime)` et `var(--font-display)` n'existaient pas | `--lime` remplacé par `--yellow`, `--font-display` défini |
| Aucun style de focus clavier | `:focus-visible` global (contour jaune de 2px) et focus sur le sélecteur de langue |
| Des dizaines de textes entre 5 et 8px | Minimum 10px : 5–7px → 10px, 8–9px → 11px, 10px → 12px (sauf le texte décoratif de l'orbe Ballon d'Or) |
| Textes gris trop peu contrastés | Les gris `#5f5a6d`, `#6c657a`, `#777180`… passent à `#948ea4` ; les blancs à 25–55 % d'opacité passent à 64 % |
| Zones tactiles trop petites | Flèches ↑↓ à 36px, filtres/dispositif/boutons de Room à 40px, pagination à 44px, zone cliquable invisible autour de « Voir l'effectif » |

## Étape 2 : typographie, tokens, couleurs

- **Polices** : Anton pour les titres (remplace Impact, absente sur Android) et Inter pour le texte,
  via `--font-display` et `--font-body`. Toutes les piles `Impact…` et `Arial…` passent par ces deux tokens.
  `font-synthesis: none` évite un faux gras sur Anton, qui n'a qu'une seule graisse.
- **Graisses** : 1000/950 → 900 et 850 → 800 (aucune police n'a de graisse au-delà de 900).
- **Tokens** ajoutés dans `:root` : échelle de texte (`--text-2xs` à `--text-lg`), espacements (`--space-*`),
  rayons (`--radius-*`) et couleurs de zones (`--ucl`, `--uel`, `--uecl`, `--playoff`, `--relegation`).
- **Un seul code couleur européen** dans le classement à faire, le classement live, les badges compacts,
  les groupes du verdict et la page Communauté : Ligue des champions en bleu, Europa en orange,
  Conference en vert, relégation en rouge.
  La page Europe garde son `--cup`, qui est lié à ses visuels de stade.
- **Noms de clubs en blanc** : dans le classement, le podium, le verdict et le résumé des stats.
  La couleur du club reste sur l'anneau du logo et la barre du verdict.

## Vérification

- Les deux versions de `globals.css` (avant et après) passent le parseur CSS lightningcss sans avertissement, et `app/fonts.ts` passe le typecheck avec `next`.
- Test dans Chromium (écran de 390 px) sur une page qui reprend le markup de l'étape « Classement » de `page.tsx` :
  avant, le bouton « Valider » est hors écran (y = 1618 px) ; après, il reste collé en bas et la barre de progression en haut.
  Pas de défilement horizontal. Voir `docs/avant-apres-mobile.png`.
- Pas testé sur le vrai site : il manque ici les composants (`season-started-home.tsx`, `weekend-challenge.tsx`, etc.), les images et `layout.tsx`.
  À vérifier chez toi, surtout les pages Accueil, Challenge et Ballon d'Or, où les textes agrandis peuvent passer à la ligne.

## Pas encore fait

- **Zones 5 et 6 du classement** : `page.tsx` les marque toutes les deux `europe`. Elles s'affichent
  donc en orange, même quand la place 6 donne la Conference League. Pour être exact, `page.tsx` devrait
  poser la classe de la compétition (`uel` / `uecl`) sur la ligne.
- **Réduire l'usage du jaune** aux actions principales : c'est un choix de direction artistique,
  à valider avant de le faire.
- **Étape 3** : supprimer les variantes mobiles non retenues (`rml-mobile-redesign`, `rml-webapp-preview`…),
  ramener les breakpoints à trois, supprimer le CSS mort et migrer les valeurs en dur vers les tokens.
- **Correctifs UX dans `page.tsx`** : URL par étape, brouillon sauvegardé, lien de verdict partageable.
