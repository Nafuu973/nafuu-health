"""Contrôle du dépôt avant publication (bibliothèque standard uniquement).

Usage : python3 -I tools/check.py
Code de sortie 0 si tout est conforme, 1 sinon. Exécuté automatiquement par GitHub Actions.

Vérifie :
- docs/ : CSP stricte (rien d'inline, aucun hôte externe), références locales valides, aucune ressource externe,
  aucun fichier sensible ou trop lourd, liste hors connexion du service worker complète ;
- code JavaScript : pas d'injection HTML (innerHTML, eval...), pas d'appel réseau, seul lien externe : wa.me ;
- dépôt : aucune clé de signature, mot de passe, APK ou fichier de pax versionné ;
- .github/workflows/ : actions épinglées par SHA, permissions déclarées, pas de pull_request_target,
  pas d'injection via le contexte github.event, identifiants de checkout non conservés.
"""
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DOCS = RACINE / "docs"
SENSIBLE = re.compile(r"(\.env|\.pdf$|\.key$|\.pem$|\.jks$|\.keystore$|\.apk$|\.zip$|mot-de-passe|sauvegarde-|rapport-|programme-)", re.I)
POIDS_MAX = 1_500_000
CSP_ATTENDUE = {
    "default-src": "'none'", "script-src": "'self'", "style-src": "'self'", "font-src": "'self'", "img-src": "'self'",
    "manifest-src": "'self'", "worker-src": "'self'", "connect-src": "'none'", "base-uri": "'none'",
    "form-action": "'none'", "object-src": "'none'",
}
JS_INTERDIT = [
    (r"\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML", "injection HTML possible"),
    (r"\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*[\"']|setInterval\s*\(\s*[\"']", "exécution de texte comme code"),
    (r"document\.write", "document.write"),
    (r"XMLHttpRequest|WebSocket|EventSource|sendBeacon", "appel réseau"),
]
erreurs = []


def err(msg):
    erreurs.append(msg)


def lire(chemin):
    return chemin.read_text(encoding="utf-8")


class Page(HTMLParser):
    def __init__(self, fichier):
        super().__init__()
        self.fichier = fichier

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        nom = self.fichier.relative_to(DOCS)
        if tag == "script" and "src" not in a:
            err(f"{nom}: <script> inline interdit par la CSP")
        if tag == "style":
            err(f"{nom}: <style> inline interdit par la CSP")
        if "style" in a:
            err(f"{nom}: attribut style= interdit par la CSP")
        for k in a:
            if k.startswith("on"):
                err(f"{nom}: gestionnaire {k}= interdit par la CSP")
        for cle in ("src", "href"):
            url = a.get(cle)
            if not url or url.startswith("#"):
                continue
            if re.match(r"^[a-z]+:", url, re.I):
                err(f"{nom}: ressource ou lien externe : {url}")
                continue
            if not (self.fichier.parent / url).resolve().exists():
                err(f"{nom}: référence cassée : {url}")


# --- docs/ : pages ---------------------------------------------------------------------------
for page in sorted(DOCS.rglob("*.html")):
    texte = lire(page)
    m = re.search(r'Content-Security-Policy" content="([^"]*)"', texte)
    if not m:
        err(f"{page.relative_to(DOCS)}: balise meta CSP absente")
    else:
        regles = {}
        for bloc in m.group(1).split(";"):
            mots = bloc.split()
            if mots:
                regles[mots[0]] = " ".join(mots[1:])
        for k, v in CSP_ATTENDUE.items():
            if regles.get(k) != v:
                err(f"{page.relative_to(DOCS)}: CSP {k} doit valoir {v} (trouvé : {regles.get(k)})")
        if re.search(r"unsafe-|https?:|\*", m.group(1)):
            err(f"{page.relative_to(DOCS)}: CSP assouplie (unsafe-, hôte ou *)")
    Page(page).feed(texte)

# --- docs/ : fichiers ------------------------------------------------------------------------
for f in DOCS.rglob("*"):
    if not f.is_file():
        continue
    if SENSIBLE.search(f.name):
        err(f"fichier sensible dans docs/ : {f.relative_to(DOCS)}")
    if f.stat().st_size > POIDS_MAX:
        err(f"fichier trop lourd (> 1,5 Mo) : {f.relative_to(DOCS)}")

# --- code JavaScript -------------------------------------------------------------------------
for js in sorted(DOCS.rglob("*.js")):
    t, nom = lire(js), js.relative_to(DOCS)
    for motif, raison in JS_INTERDIT:
        if re.search(motif, t):
            err(f"{nom}: {raison} ({motif})")
    for url in re.findall(r"https?://[^\s\"'`)]+", t):
        if not url.startswith("https://wa.me/"):
            err(f"{nom}: adresse externe non prévue : {url}")
    if js.name != "sw.js" and re.search(r"\bfetch\s*\(", t):
        err(f"{nom}: appel réseau fetch() interdit hors du service worker")

# --- service worker : liste hors connexion complète ----------------------------------------
sw = lire(DOCS / "sw.js")
liste = re.search(r"const SHELL = \[(.*?)\];", sw, re.S)
if not liste:
    err("sw.js: liste SHELL introuvable")
else:
    declares = {x.strip().strip('"') for x in liste.group(1).split(",") if x.strip()}
    for d in declares:
        if d != "./" and not (DOCS / d[2:]).is_file():
            err(f"sw.js: fichier hors connexion absent : {d}")
    for f in DOCS.rglob("*"):
        rel = "./" + f.relative_to(DOCS).as_posix()
        if f.is_file() and f.suffix in (".html", ".css", ".js", ".ttf", ".png", ".webmanifest") and f.name != "sw.js" and rel not in declares:
            err(f"sw.js: {rel} manque dans SHELL (l'app ne marcherait pas hors connexion)")
if not re.search(r'const VERSION = "nafuu-health-v\d+"', sw):
    err("sw.js: VERSION absente ou mal formée")

# --- manifeste -------------------------------------------------------------------------------
try:
    man = json.loads(lire(DOCS / "manifest.webmanifest"))
    for icone in man.get("icons", []):
        if not (DOCS / icone["src"]).is_file():
            err(f"manifest: icône absente : {icone['src']}")
    if man.get("start_url") != "./" or man.get("scope") != "./":
        err("manifest: start_url et scope doivent valoir ./")
except (ValueError, KeyError) as e:
    err(f"manifest illisible : {e}")

# --- dépôt : aucun secret versionné ---------------------------------------------------------
try:
    suivis = subprocess.run(["git", "-C", str(RACINE), "ls-files"], capture_output=True, text=True, check=True).stdout.split()
    for f in suivis:
        if re.search(r"(\.jks|\.keystore|\.apk|\.pem|\.key|\.env|mot-de-passe|ks-pass)", f, re.I):
            err(f"fichier secret ou binaire versionné : {f}")
except (OSError, subprocess.CalledProcessError):
    pass

# --- workflows -------------------------------------------------------------------------------
for wf in sorted((RACINE / ".github" / "workflows").glob("*.y*ml")):
    t, nom = lire(wf), wf.name
    if not re.search(r"^permissions:", t, re.M):
        err(f"{nom}: permissions de premier niveau absentes (mettre permissions: {{}})")
    for u in re.findall(r"^\s*-?\s*uses:\s*(\S+)", t, re.M):
        if not u.startswith("./") and not re.search(r"@[0-9a-f]{40}$", u):
            err(f"{nom}: action non épinglée par SHA : {u}")
    if "pull_request_target" in t:
        err(f"{nom}: pull_request_target interdit")
    if re.search(r"\$\{\{\s*github\.(event\.|head_ref)", t):
        err(f"{nom}: injection possible via le contexte github.event / head_ref")
    if t.count("actions/checkout") != t.count("persist-credentials: false"):
        err(f"{nom}: chaque checkout doit avoir persist-credentials: false")

if erreurs:
    print("\n".join("ERREUR " + e for e in erreurs))
    sys.exit(1)
print("OK : docs/, le code et les workflows sont conformes.")
