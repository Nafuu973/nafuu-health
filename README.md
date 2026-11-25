# Nafuu Health

Application de suivi coach / pax, à la répétition. Tout reste sur le téléphone : pas de serveur, pas de compte.

- `docs/` : l'application (version web installable, publiée avec GitHub Pages). C'est la source unique de l'interface.
- `app/` : l'enveloppe Android (APK), qui embarque le contenu de `docs/`.
- `build.sh` : compile l'APK sans Gradle (SDK Android : platforms;android-35, build-tools;35.0.0).

## Mettre à jour la version web
Après chaque modification de `docs/`, changer `VERSION` dans `docs/sw.js`, sinon les téléphones gardent l'ancienne version en cache.

## Règles
- Ne jamais déposer ici la clé de signature (`.jks`), son mot de passe, ni des fichiers de pax (programmes, rapports, sauvegardes).
- Les données de santé des pax ne transitent jamais par ce dépôt.
