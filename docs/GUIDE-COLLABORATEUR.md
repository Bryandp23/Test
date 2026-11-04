# Guide collaborateur : créer un événement et l'ajouter à un email

Aucune compétence technique n'est nécessaire. Comptez 2 à 5 minutes pour un événement simple.

## 1. Se connecter

Ouvrez l'adresse de l'espace équipe (par exemple `https://agenda.ephec.be/admin`) et connectez-vous avec votre email et votre mot de passe.

## 2. Créer l'événement

1. Cliquez sur **« Créer un événement »**.
2. Choisissez un modèle : *Webinaire Teams*, *Conférence en présentiel*, *Séance d'information* ou *Cycle de plusieurs séances*. Les réglages habituels sont déjà remplis.
3. **Étape 1 – Informations générales** : nom de l'événement, courte description (2 ou 3 phrases), lien vers la page ephec.be.
   - N'écrivez pas « EPHEC | » dans le nom : il est ajouté automatiquement dans les calendriers.
4. **Étape 2 – Dates et infos pratiques** :
   - indiquez la date, l'heure de début et l'heure de fin ;
   - pour un cycle, cliquez sur **« Ajouter une séance »** : la nouvelle séance reprend l'horaire de la précédente, une semaine plus tard ; il suffit d'ajuster ;
   - si une séance a lieu ailleurs, cliquez sur « Cette séance a lieu ailleurs ou a un autre lien ? » ;
   - choisissez le format (présentiel, en ligne, hybride), puis indiquez l'adresse ou collez le lien Teams ou Zoom ;
   - choisissez si le participant ajoute toutes les séances ou peut choisir les siennes.
5. **Étape 3 – Vérification** : relisez l'aperçu, qui montre exactement ce que verra le participant. Cliquez ensuite sur **« Publier l'événement »** (ou « Enregistrer comme brouillon » pour continuer plus tard).

Les erreurs sont signalées en clair avant la publication : fin avant le début, date en double, horaire manquant, heure qui n'existe pas la nuit du passage à l'heure d'été, etc.

## 3. Mettre le bouton dans l'email ActiveCampaign

Après la publication, l'écran de partage s'affiche.

**Méthode la plus simple :**

1. Cliquez sur **« Copier le lien »**.
2. Dans ActiveCampaign, ouvrez l'email de confirmation et ajoutez un bloc **Bouton**.
3. Texte du bouton : `Ajouter à mon calendrier`. Lien : collez le lien. Couleur : `#1D7A75` (turquoise EPHEC, contraste conforme).
4. Envoyez-vous un email de test et cliquez sur le bouton depuis votre téléphone.

**Ou, avec le bouton EPHEC prêt à l'emploi :** cliquez sur « Copier le bouton HTML », ajoutez un bloc **HTML** dans ActiveCampaign, collez, puis enregistrez. « Prévisualiser le bouton » vous montre le rendu avant de coller.

Le suivi des clics d'ActiveCampaign peut rester activé.

## 4. Modifier, annuler, réutiliser

- **Changer l'heure, le lieu ou le lien Teams** : ouvrez l'événement (« Modifier »), changez l'information, puis cliquez sur « Enregistrer ». La page d'ajout est à jour tout de suite. Les agendas connectés sont mis à jour automatiquement. Pour les autres participants, un texte d'email prêt à copier vous est proposé : envoyez-le via ActiveCampaign.
- **Annuler** : bouton « Annuler l'événement ». Un texte d'email d'annulation vous est proposé.
- **Réutiliser** : « Dupliquer » crée une copie en brouillon. Changez les dates, puis publiez.
- **Archiver** : l'événement est rangé dans l'onglet « Archivés ». Vous pouvez le restaurer à tout moment.

## 5. Bon à savoir

- Le lien d'un événement ne change jamais, même si vous modifiez l'événement.
- Un brouillon n'est visible par personne d'autre que l'équipe (bouton « Aperçu »).
- Les statistiques distinguent les **clics** (le participant a ouvert son calendrier) des **ajouts confirmés** (vérifiés par Google ou Microsoft, uniquement pour les agendas connectés).
