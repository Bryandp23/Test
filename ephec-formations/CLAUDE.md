# Pages formation EPHEC — consignes

## Textes
- Le code source fourni (`source/`) est la seule référence éditoriale : aucun texte ne doit être modifié, raccourci, complété ou ajouté.
- Vérifier chaque livraison avec une comparaison automatique source / résultat.

## Direction artistique
- Police : toujours héritée du site (Borna), `font-family: inherit`.
- Titres de section sur une seule ligne (pas de largeur maximale qui les coupe).
- Jamais de paragraphe en parallèle d'un titre ni d'un autre paragraphe : le titre au-dessus, le texte en dessous.
- Étapes d'une progression (Bloc 1, 2, 3…) : même taille et même fond, aucune ne doit sembler plus importante.
- Pas de sommaire interne dans le bloc : la page Drupal a déjà sa barre d'onglets, et le lecteur parcourt le contenu en défilant.
- Pas de flèche décorative qui n'apporte pas d'information.
- Jamais de zéro devant un nombre : écrire 1, 2, 3 (et « 7 / 14 »), jamais 01, 02, 03 (ni « 07 / 14 »). Vaut pour toutes les maquettes et tous les projets.
- Couleurs : turquoise EPHEC #46C4BC (décor), couleur du secteur pour l'identité sectorielle (Business #007965, Transversal #27958F, Éducation #E6534E, Santé #65A858, Tech #0284C7), noir #111111. Contrastes WCAG AA pour tout texte.
- Codes visuels de la maquette : titres fins avec un mot-clé en couleur, dégradé menthe, cartes menthe / noire / grise, bandes diagonales, ✳, flèches EPHEC →, boutons pilule noirs en capitales avec flèche turquoise, pastilles avec point vert.

## Intégration Drupal
- Mises en page responsives en media queries (les container queries ne s'appliquent pas dans l'environnement Drupal testé).
- Classes préfixées `.efa`, aucun style global, JS isolé et facultatif (la page doit fonctionner sans).
