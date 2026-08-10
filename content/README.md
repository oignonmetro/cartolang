# Écrire du contenu

Tout le contenu vit ici, en YAML. Aucun code à toucher pour ajouter du
vocabulaire, des règles ou des tableaux de conjugaison.

```
content/courses/<id>/
├── course.yaml        métadonnées, agencement, et ordre des unités
└── units/
    ├── v1.yaml        une unité par fichier, le nom du fichier = son id
    └── …
```

Après toute modification :

```bash
npm run content:check   # valide sans rien écrire (ce que fait la CI)
npm run content:build   # compile vers public/content/
```

## Les deux agencements

`course.yaml` déclare un `layout`, qui décide de l'écran d'accueil.

- **`path`** — parcours guidé : les leçons se suivent, la première étoile
  débloque la suivante. C'est le cours grand débutant (`fr-en`, archivé).
- **`library`** — accès libre : des **pistes** s'affichent en onglets, et
  l'apprenant choisit ses unités dans l'ordre qu'il veut. C'est le cours B2
  (`fr-en-b2`).

## Les trois natures de contenu

Une piste déclare son `kind` une seule fois ; le compilateur le propage aux
unités puis aux leçons. Les fichiers d'unités n'ont donc pas à le répéter.

| `kind` | Données | Exercices générés |
|---|---|---|
| `vocab` | `vocab:` — mots et traductions | flashcard, association, phrase à trou, saisie |
| `grammar` | `points:` — phrases trouées | rappel de cours, phrase à trou (banque puis clavier) |
| `conjugation` | `verbs:` — verbes et leurs formes | rappel, association personnes/formes, production |

## Ajouter un mot (`kind: vocab`)

```yaml
- id: b2-to-tackle        # identifiant unique dans tout le cours
  term: to tackle         # le mot en anglais
  translation: s'attaquer à
  alt:                    # autres réponses acceptées au clavier
    - aborder
  pos: verbe              # facultatif
  hint: …                 # facultatif : remarque affichée à la découverte
  gap: tackled            # facultatif : voir ci-dessous
  example:
    text: No government has seriously tackled the issue.
    translation: Aucun gouvernement ne s'est sérieusement attaqué à la question.
```

La phrase d'exemple sert à générer l'exercice à trou. Le compilateur y cherche
le terme, puis sa forme sans « to ». Quand le verbe est conjugué de façon
irrégulière dans l'exemple (`fell through` pour `to fall through`), indiquez la
forme exacte à masquer avec **`gap`**. Sans cela, la validation échoue plutôt
que de laisser un mot sans exercice.

Une leçon de vocabulaire a besoin d'**au moins quatre mots** : en dessous,
l'exercice d'association ne peut pas se construire.

## Ajouter un point de grammaire (`kind: grammar`)

```yaml
- id: g1-l1
  title: Le conditionnel mixte
  notes: |                       # rappel affiché avant la pratique
    Le conditionnel mixte relie une hypothèse passée à une conséquence présente.
    — Hypothèse passée : If + past perfect
    — Conséquence présente : would + base verbale
  points:
    - id: g1-mixed-1
      sentence: If I had taken that job, I ___ in Berlin now.   # ___ obligatoire
      answer: would be
      alt: []                    # autres formulations acceptées
      options:                   # facultatif : joue en banque de formes
        - would be
        - would have been
        - will be
      translation: Si j'avais accepté ce poste, je serais à Berlin maintenant.
      explanation: Hypothèse passée mais conséquence présente.
```

Dans `notes`, une ligne commençant par `—` est mise en valeur comme exemple.
Quand `options` est fourni, l'exercice se joue en choisissant parmi ces formes
au premier passage, puis au clavier ensuite ; sans `options`, il est au clavier
d'emblée. Une leçon a besoin d'au moins trois points.

## Ajouter un tableau de conjugaison (`kind: conjugation`)

```yaml
- id: c1-l2
  title: Present perfect
  notes: |
    have / has + participe passé.
  verbs:
    - verb: to see
      translation: voir
      tense: present perfect     # titre du paradigme, affiché comme étiquette
      note: have / has + seen, jamais « have saw ».
      forms:
        - id: c1-see-pp-1
          person: I / you / we / they   # libellé de la forme demandée
          answer: have seen
          alt: ["'ve seen"]
        - id: c1-see-pp-3
          person: he / she / it
          answer: has seen
```

`person` est le libellé de la forme demandée : ce peut être une personne, mais
aussi « prétérit » ou « participe passé ». Chaque verbe a besoin d'au moins
deux formes, et la leçon d'au moins quatre au total.

Deux formes identiques dans un même verbe (`sought` / `sought`) ne posent pas
de problème : l'association compare les libellés, pas les identifiants.

## Ajouter une unité

1. Créer `units/v5.yaml` — le nom du fichier doit être l'`id` de l'unité.
2. Référencer `v5` dans la liste `units:` de la piste (ou de la section).

```yaml
id: v5
title: Le monde universitaire
subtitle: Lire un article de recherche    # facultatif
icon: book                                 # wave, people, cup, clock, compass, book
color: teal                                # teal, violet, coral, amber, sky
level: B2.2                                # facultatif : repère affiché, n'impose rien
lessons: …
```

Une unité oubliée dans `course.yaml`, ou référencée sans fichier, fait échouer
la validation : le contenu ne peut pas contenir de trou.

## Archiver un cours

`status: archived` dans `course.yaml` retire le cours de la sélection sans rien
supprimer : le contenu reste versionné et validé par la CI, et il suffit de
repasser le champ à `available` pour le remettre en service. Un apprenant qui
avait ce cours sélectionné bascule automatiquement sur un cours disponible.

La compilation échoue si **tous** les cours sont archivés.

## Publier une mise à jour de contenu

Incrémenter `version:` dans `course.yaml`, puis pousser sur `main`. Le
déploiement GitHub Pages régénère les fichiers, et les installations existantes
proposent la mise à jour au prochain démarrage avec du réseau.

## Ce que la validation vérifie

- identifiants uniques (éléments et leçons) sur tout le cours ;
- nom de fichier d'unité cohérent avec son `id` ;
- toute unité référencée existe, et toute unité existante est référencée ;
- au moins 4 mots par leçon de vocabulaire, 3 points par leçon de grammaire,
  4 formes par leçon de conjugaison ;
- pas de terme en double dans une leçon, ni de personne en double dans un verbe ;
- phrases d'exemple dont la forme à masquer est réellement présente ;
- phrases de grammaire contenant le marqueur `___`, et réponse figurant bien
  parmi les `options` quand il y en a.
