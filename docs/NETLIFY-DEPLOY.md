# Déploiement Netlify : détection de secrets

Le contrôle de secrets Netlify doit rester activé. Ne pas contourner un échec avec
`SECRETS_SCAN_ENABLED`, `SECRETS_SCAN_OMIT_KEYS` ou une exclusion générale de fichiers.

La liste des variables dans la configuration résolue n'indique pas lesquelles ont
déclenché le contrôle : les messages de détection précédents donnent les fichiers
concernés. Ne jamais copier les valeurs dans les journaux ou dans un ticket.

`APP_SECRET` doit être une valeur aléatoire propre à l'application, générée à partir
d'au moins 32 octets aléatoires. Un mot court ou courant peut être détecté dans de
nombreux fichiers sans qu'une clé ait été intégrée au code. Stocker la valeur
uniquement dans les variables d'environnement Netlify et dans un fichier local
ignoré pour le développement. `.env.example` doit conserver des valeurs secrètes
vides ; les autres variantes `.env.*` sont ignorées.

Si `APP_SECRET` est exposé ou trop faible, le remplacer dans les contextes de
déploiement concernés puis relancer le déploiement. Prévoir cette rotation : elle
invalide les signatures existantes et rend les jetons OAuth déjà chiffrés illisibles.
Les utilisateurs concernés devront reconnecter leurs agendas. Si des connexions
doivent être conservées, organiser une migration des jetons avant la rotation.

Vérifier séparément `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Ces variables servent à créer
le premier administrateur lorsque la table des utilisateurs est vide. Modifier
`ADMIN_PASSWORD` dans Netlify ne change pas le mot de passe d'un compte déjà créé.
Si un mot de passe réel a été exposé, changer aussi celui du compte existant.

Après correction, relancer le déploiement et vérifier que le contrôle de secrets
passe. Ne pas publier de fichiers `.env`, de sorties d'environnement ou de clés
pour diagnostiquer le problème.
