# Politique de sécurité

## Périmètre

Nafuu Health est une application de suivi sportif coach / pax. Elle n'a ni serveur, ni base de données en ligne,
ni compte utilisateur, ni cookie, ni mesure d'audience. Les données (séances, tests, douleurs, mesures) restent
sur le téléphone de chaque utilisateur. Les échanges coach / pax passent par des fichiers que l'utilisateur
choisit lui-même d'envoyer (WhatsApp).

## Signaler une vulnérabilité

Utiliser le signalement privé de GitHub : onglet **Security** → **Report a vulnerability**.
Ne pas ouvrir de ticket public pour une faille.

Sont notamment pertinents : fuite de données de santé, injection de contenu (XSS) via un fichier importé,
contournement de la CSP, action GitHub compromise, reprise de domaine.

## Mesures en place

- CSP stricte par balise meta : aucun script ni style inline, aucun hôte externe, aucun appel réseau depuis l'app.
- Tout le contenu affiché passe par `textContent` : un fichier importé ne peut pas injecter de HTML.
- Fichiers importés : taille limitée à 2 Mo, champs filtrés et tronqués, clés `__proto__` / `constructor` refusées.
- APK : pages servies depuis l'APK, accès aux fichiers coupé, navigation externe bloquée, pont JavaScript limité à
  4 fonctions, sauvegarde automatique Android désactivée.
- `tools/check.py` bloque la publication en cas d'écart (voir README).

## Limites connues

- **Domaine partagé** : `nafuu973.github.io` héberge aussi le site photo. Deux pages du même domaine partagent le même
  stockage navigateur. Le site photo ne lit pas ce stockage, mais une faille sur l'un exposerait l'autre.
  Solution : un domaine ou sous-domaine dédié à l'app (par exemple `app.` sur le futur nom de domaine).
- **Données non chiffrées sur le téléphone** : elles sont protégées par le verrouillage du téléphone, pas par l'app.
  Un téléphone sans code de verrouillage expose les données.
- **CSP par balise meta** : GitHub Pages ne permet pas d'en-têtes HTTP, donc `frame-ancestors` est ignoré.
  Une page tierce peut afficher l'app dans un cadre, mais n'accède pas à ses données (stockage cloisonné).
- **Fichiers échangés** : un programme ou un rapport envoyé sur WhatsApp sort de l'app. Il contient des données
  de santé : ne pas le transférer à d'autres personnes, le supprimer de la conversation si besoin.
