# Écrire du contenu

Tout le vocabulaire vit ici, en YAML. Aucun code à toucher pour ajouter des
mots, des leçons ou des unités.

```
content/courses/fr-en/
├── course.yaml        métadonnées du cours et ordre du parcours
└── units/
    ├── u1.yaml        une unité par fichier, le nom du fichier = son id
    ├── u2.yaml
    └── …
```

Après toute modification :

```bash
npm run content:check   # valide sans rien écrire (ce que fait la CI)
npm run content:build   # compile vers public/content/
```

## Ajouter un mot

Dans la leçon voulue, sous `vocab:` :

```yaml
- id: bread              # identifiant unique dans tout le cours, en minuscules
  term: bread            # le mot en anglais
  translation: pain      # la traduction française affichée
  alt:                   # autres réponses acceptées à la saisie clavier
    - le pain
  pos: nom               # facultatif : nature du mot
  hint: …                # facultatif : remarque affichée à la découverte
  example:               # facultatif mais recommandé
    text: We buy bread every day.
    translation: Nous achetons du pain tous les jours.
```

La phrase d'exemple **doit contenir le terme**, en mot entier : c'est elle qui
produit l'exercice à trou. Le validateur refuse le fichier sinon, plutôt que de
laisser un mot sans exercice.

## Ajouter une leçon

Sous `lessons:` d'une unité. Une leçon a besoin d'**au moins quatre mots** :
en dessous, l'exercice d'association ne peut pas se construire.

```yaml
- id: u3-l5
  title: Les desserts
  vocab:
    - …
```

## Ajouter une unité

1. Créer `units/u6.yaml` — le nom du fichier doit être l'`id` de l'unité.
2. Référencer `u6` dans la liste `units:` de la section, dans `course.yaml`.

Une unité oubliée dans `course.yaml`, ou référencée sans fichier, fait échouer
la validation : le parcours ne peut pas contenir de trou.

```yaml
id: u6
title: Le travail
subtitle: Bureau, métiers, horaires    # facultatif
icon: book                              # wave, people, cup, clock, compass, book
color: violet                           # teal, violet, coral, amber, sky
lessons: …
```

## Ajouter un cours

Créer `content/courses/<id>/` avec le même agencement. Le `manifest.json`
généré liste automatiquement tous les cours ; l'application charge le premier
par défaut.

## Publier une mise à jour de contenu

Incrémenter `version:` dans `course.yaml`, puis pousser sur `main`. Le
déploiement GitHub Pages régénère les fichiers, et les installations existantes
proposent la mise à jour au prochain démarrage avec du réseau.

## Ce que la validation vérifie

- identifiants uniques (mots et leçons) sur tout le cours ;
- nom de fichier d'unité cohérent avec son `id` ;
- toute unité référencée existe, et toute unité existante est référencée ;
- au moins quatre mots par leçon ;
- pas de terme en double dans une même leçon ;
- phrases d'exemple contenant réellement leur terme.
