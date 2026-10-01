# Trouver sa voie : notes d'intégration

Bloc à coller : `bloc.html` (préfixe `ep-voie`, secteur institutionnel `#4cc6b8`). Aperçu : `python3 tools/build-preview.py trouver-sa-voie "<h1>"` puis ouvrir `preview.html`.

## Ajouts d'interface (texte de la page inchangé)
- Boutons d'en-tête « Faire le quiz Tilt ↓ » et « Nos formations → ».
- Sommaire collant : Tes intérêts, Quiz Tilt, Portes ouvertes, Inscription, Ressources.
- Section Tilt (textes repris du site Tilt), cadre chargé au clic sur « Explorer ce secteur ».
- Bouton « Voir l'agenda → », liste de liens « Modalités d’inscriptions » et « Agenda des JPO et cours ouverts », bouton « Nous contacter → ».

## À compléter (TODO dans le code)
- URL de l'image, des pages formations, agenda, inscriptions, contact, réseaux sociaux.
- URL des trois sites recommandés.
- Lien direct vers le test Business dans Tilt, s'il existe.

## Incohérences repérées dans le contenu source (non corrigées)
- Dernière phrase incomplète : « Si tu as des questions ou besoin d'aide pour trouver le programme qui te convient le mieux » (il manque la suite, sans doute un lien de contact).
- Texte alternatif de l'image : « questionant » (orthographe : « questionnant »).
- Apostrophes mélangées (’ et ') dans le texte source.

## À vérifier dans Drupal
- `--ep-voie-sticky-top` : hauteur du menu collant du site.
- Que le format « Full HTML » garde le `<script>` et l'attribut `hidden`.
- Que le site Tilt accepte d'être affiché en iframe (en-têtes X-Frame-Options / CSP) ; sinon le bouton « Ouvrir Tilt ↗ » reste disponible.
