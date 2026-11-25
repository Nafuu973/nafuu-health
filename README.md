# Nafuu Health

Application de suivi coach / pax, à la répétition. Tout reste sur le téléphone : pas de serveur, pas de compte.

- `docs/` : l'application (version web installable, publiée avec GitHub Pages). C'est la source unique de l'interface.
- `app/` : l'enveloppe Android (APK), qui embarque le contenu de `docs/`.
- `build.sh` : compile l'APK sans Gradle (SDK Android : platforms;android-35, build-tools;35.0.0).

## Avant chaque publication

```
python3 -I tools/check.py
```

GitHub Actions l'exécute à chaque modification et **bloque la publication** s'il échoue. Il vérifie :
- `docs/` : CSP stricte, rien d'inline, références valides, aucune ressource externe, aucun fichier sensible ou > 1,5 Mo ;
- code : pas d'injection HTML (`innerHTML`, `eval`...), aucun appel réseau, seul lien externe `wa.me` ;
- service worker : chaque fichier de l'app est bien disponible hors connexion ;
- dépôt : aucune clé de signature, mot de passe, APK ou fichier de pax versionné ;
- workflows : actions épinglées par SHA, permissions déclarées, pas d'injection.

Après chaque modification de `docs/`, augmenter `VERSION` dans `docs/sw.js`, sinon les téléphones gardent l'ancienne version.

## Mise en ligne (GitHub Pages par GitHub Actions)

1. Settings → **Pages** → Build and deployment → Source : **GitHub Actions**.
2. Onglet **Actions** : les étapes `verifier`, `construire`, `deployer` doivent passer.
3. Adresse : https://nafuu973.github.io/nafuu-health/

## Réglages GitHub à activer (une fois)

Les mêmes que pour le dépôt PHOTOGRAPHY :
1. **Ruleset** : Settings → Rules → Rulesets → New ruleset → Import a ruleset → `.github/rulesets/main.json`.
2. **Sécurité** : Settings → Advanced Security : *Private vulnerability reporting*, *Dependabot alerts*,
   *Dependabot security updates*, *Secret scanning*, *Push protection*.
3. **Actions** : Settings → Actions → General : *Allow actions created by GitHub*, *Require actions to be pinned to a full-length commit SHA*,
   Workflow permissions en lecture seule, approbation obligatoire pour les forks.
4. **Pages** : cocher *Enforce HTTPS*.

## Règles
- Ne jamais déposer ici la clé de signature (`.jks`), son mot de passe, ni des fichiers de pax (programmes, rapports, sauvegardes).
- Les données de santé des pax ne transitent jamais par ce dépôt.
