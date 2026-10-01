# Brief : nouvelle DA EPHEC (blocs HTML/CSS pour Drupal)

Brief fourni par Bryan, recopié ici pour que chaque page suive les mêmes règles.

## 1. Contraintes techniques Drupal (obligatoires)

- Livrer un seul bloc : une `<div class="ep-[type]">` qui contient une balise `<style>`, puis le HTML, puis éventuellement un `<script>`.
- Tout le CSS est préfixé par la classe racine (`.ep-[type] ...`).
- Police : `font-family: inherit !important;` sur la racine et sur `.ep-[type] *`. Aucune police externe, aucun `@import`.
- Balises simples : `section`, `div`, `article`, `aside`, `nav`, `h2`–`h4`, `p`, `ul`, `li`, `a`, `strong`, `span`, `details`, `summary`, `svg`. Éviter `table`, `dl`, `time`, `figure`.
- Remettre `margin`, `padding`, `list-style` à zéro sur `ul` / `li` ; `!important` sur couleur et décoration des boutons.
- Les titres commencent en `h2` (Drupal affiche le `h1`).
- JS seulement s'il améliore l'usage, dans `(function () { ... })();`, sans dépendance, page lisible sans lui.
- Responsive : ordinateur, tablette (≤ 1000px), mobile (≤ 760px, ≤ 420px), sans défilement horizontal.
- Accessibilité : `aria-labelledby` sur les sections, focus visible, `prefers-reduced-motion`, `forced-colors`, contrastes suffisants.

## 2. Identité visuelle

- Titres grands et fins (400), interlignage ≈ 1.05, un mot clé en couleur du secteur (`<span class="...-accent">`).
- `--sector` unique ; nuances : `--sector-dark` (78 % + noir), `--sector-soft` (8 % + blanc), `--sector-tint` (22 % + blanc), `--sector-on-dark` (45 % + blanc).
- Secteurs : Business `#007965` · Santé / Tech / Éducation à compléter · Institutionnel EPHEC turquoise `#4cc6b8`.
- Neutres : noir `#1d1d1d`, gris `#f6f6f6`, blanc. Texte courant noir à ~75 %.
- Blocs signature : bloc noir arrondi avec diagonales en dégradé du secteur ; panneaux gris clairs (≈ 26px) sans bordure ni ombre ; cartes blanches (≈ 20px) à ombre très légère ; tiret secteur 34 × 5px au-dessus des titres importants ; icônes dans des pastilles rondes.
- Boutons pilule avec flèche : plein (secteur, texte blanc), contour blanc sur noir, ou noir. Flèches de lien dans des ronds noirs qui passent au secteur au survol.
- `→` lien interne, `↓` PDF (badge « PDF »), `↗` site externe. Dates `05.01.2027`.

## 3. À éviter

Cartes toutes identiques ; barre de couleur à gauche ; flèches comme puces ou emojis ; gras 800–950 ; icônes génériques ; survol qui soulève du non-cliquable ; accordéons pour du contenu court ; répétitions ; formules marketing creuses ; numérotation décorative sans vraie séquence.

## 4. UX

Info clé visible tout de suite ; action principale en haut et atteignable partout ; navigation interne collante avec section active (variable `--[prefix]-sticky-top`) pour les pages longues ; une seule zone forte par écran ; parcours en frise, tarifs comparés, listes longues regroupées.

## 5. Contenu

Ne modifier aucun texte fourni (ni reformulation, ni suppression, ni ajout). Ajouts d'interface autorisés mais listés. Contenu inventé → `<!-- TODO : ... -->` et signalé. Signaler les incohérences sans les corriger.

## 6. Livrable

Bloc complet prêt à coller + courte liste des changements UI/UX et des points à vérifier dans Drupal.

## Page contenu (institutionnelle)

Titre avec un mot coloré, chapô court, sommaire si la page est longue, sections alternant texte et blocs (carte menthe, bloc noir, cartes blanches), encadrés pour les infos importantes, liens et documents en listes avec flèche en rond, contact en fin de page.
