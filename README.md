# Cartolang

Application mobile d'apprentissage des langues, hors-ligne, en français.
Des flashcards, des exercices d'application, et une révision espacée qui fait
revenir au bon moment ce qui est fragile.

Trois niveaux d'anglais pour francophones — **B1**, **B2**, **C1** — choisis
depuis un sélecteur en un clic (le badge drapeau + niveau en haut de l'écran).
Chacun est structuré de la même façon : quinze unités réparties sur trois
pistes (vocabulaire, grammaire, conjugaison) que l'apprenant parcourt
librement, dans l'ordre qu'il veut. Environ 760 éléments en tout.

Le moteur est générique : un cours n'est qu'un jeu de fichiers YAML.

## État

| | |
|---|---|
| Cours | B1, B2, C1 (`fr-en-b1/b2/c1`), écrits et jouables ; B2 par défaut. Le cours grand débutant `fr-en` est archivé |
| Agencements | `library` — pistes en onglets, accès libre ; `path` — parcours guidé |
| Vocabulaire | flashcard auto-évaluée, association de paires, phrase à trou, saisie clavier |
| Grammaire | rappel de cours, phrase à trou avec banque de formes puis au clavier |
| Conjugaison | association personnes/formes, puis production de mémoire |
| Progression | révision espacée (SM-2), étoiles gagnées par la maîtrise réelle, anneaux, entraînement par unité |
| Motivation | série de jours, XP et niveaux, objectif quotidien |
| Hors-ligne | total — contenu, polices et interface embarqués |
| Cibles | PWA sur GitHub Pages, APK Android via Capacitor |

## Boucle d'apprentissage

Trois rôles distincts, qui ne se marchent pas dessus :

- **Les leçons font découvrir.** Un passage suffit. La difficulté d'une leçon
  suit ce que l'apprenant sait déjà de ses éléments : la redécouvrir donne la
  présentation, la reprendre une fois sue donne d'emblée de la production.
- **Les révisions font revenir et approfondir.** C'est la colonne vertébrale :
  échéances SM-2, toutes pistes mélangées, et montée automatique en exigence —
  reconnaissance tant que la carte est fragile, production dès qu'elle tient
  trois jours. L'appel à réviser est la première chose de l'écran d'accueil.
- **L'entraînement (`/entrainement/:unitId`) comble le reste.** Il reprend les
  éléments déjà rencontrés d'une unité, mélangés et tous en production, sans
  attendre les échéances : c'est l'alternative à rejouer une leçon à
  l'identique, et l'entrelacement y ancre mieux qu'une reprise en bloc.

Les étoiles ne comptent pas les passages mais mesurent ce qui est su : ★ leçon
parcourue, ★★ éléments installés (≥ 7 j), ★★★ solidement acquis (≥ 30 j). Ce
sont donc les révisions qui les font monter. Une étoile décrochée reste acquise
(le champ `level` sert de plancher) ; l'anneau, lui, montre l'état réel en
direct — les deux indicateurs se complètent au lieu de se répéter.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm test             # tests du moteur (SRS, exercices, progression)
npm run typecheck
npm run build        # valide le contenu, vérifie les types, compile
```

## Ajouter du contenu

Tout se passe dans `content/`, en YAML, sans toucher au code : vocabulaire,
points de grammaire et tableaux de conjugaison ont chacun leur format.
Voir **[content/README.md](content/README.md)** pour les règles complètes,
et pour archiver ou réactiver un cours.

```bash
npm run content:check   # valide (identifiants, doublons, phrases d'exemple)
```

## Construire l'APK

Le projet Android est versionné dans `android/`.

```bash
npm run android:sync            # build web + copie dans le projet Android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

En pratique, il n'y a rien à installer localement : le workflow
`.github/workflows/android.yml` produit l'APK sur GitHub (manuellement, ou
automatiquement sur un tag `v*`), et l'attache à la release.

## Déploiement

- **GitHub Pages** — chaque push sur `main` publie le site. Activer une fois
  Pages sur « GitHub Actions » dans les réglages du dépôt.

### Mises à jour : deux canaux distincts

- **Web (PWA)** — le service worker détecte la nouvelle version, la télécharge
  en arrière-plan et propose de l'appliquer (`UpdatePrompt.tsx`). Comme la PWA
  est servie directement depuis GitHub Pages, ce canal couvre à la fois le
  code et le contenu : incrémenter `version:` dans `course.yaml` suffit.

- **APK** — le **contenu des cours** se met à jour sans réinstallation : au
  démarrage, si l'app tourne en natif et qu'un réseau est disponible, elle
  vérifie en tâche de fond si GitHub Pages propose une version plus récente
  d'un cours, la télécharge et l'enregistre en local
  (`src/content/remoteSync.ts` + `contentCache.ts`). Le nouveau contenu est
  utilisé dès le prochain démarrage — rien à publier sur un store,
  incrémenter `version:` et pousser sur `main` suffit. Entièrement
  best-effort : hors-ligne ou origine injoignable, l'app continue sur le
  contenu déjà en cache, ou à défaut celui embarqué dans l'APK.

  Le **code** (JS/CSS), lui, est figé dans le binaire au moment du build et ne
  peut pas s'installer tout seul — Android exige toujours une confirmation de
  l'utilisateur pour un paquet en dehors d'un store. L'app vérifie donc aussi,
  au démarrage natif, si `app-version.json` sur GitHub Pages annonce un
  `versionCode` plus récent que celui installé (`src/content/appUpdate.ts`),
  et propose alors de télécharger le nouvel APK dans un bandeau
  (`AppUpdateBanner.tsx`) — un tap ouvre le navigateur système, l'installation
  reste un geste volontaire. `app-version.json` est republié automatiquement
  par `.github/workflows/android.yml` à chaque tag `v*`, avec le même
  `versionCode` que celui gravé dans l'APK correspondant.

## Architecture

```
content/          les cours, en YAML — la seule chose à éditer pour du contenu
tools/content/    validation et compilation YAML → JSON
tools/icons/      génération des icônes (web et lanceur Android) depuis le SVG
src/content/      schéma (zod), accès au contenu, chargement, texte partagé
src/engine/       logique pure et testée : SRS, exercices, progression
src/store/        état de l'apprenant, persisté localement
src/components/   mascotte, boutons en relief, anneaux, exercices
src/screens/      bibliothèque, chemin, session, résultat, profil
android/          projet Capacitor
```

Le moteur (`src/engine/`) ne dépend ni de React ni du DOM : c'est là que vivent
les règles, et c'est là que portent les tests.

## Données personnelles

Aucune. La progression reste dans le stockage local de l'appareil et peut être
exportée ou réimportée depuis l'écran Profil. L'application ne contacte le
réseau que pour vérifier l'existence d'une mise à jour.

## Licences

Code sous licence MIT. La police Nunito est distribuée sous SIL Open Font
License 1.1 (voir `src/assets/fonts/OFL.txt`).
