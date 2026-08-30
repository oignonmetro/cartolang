# Parcours visuel et checkpoints — archivés

Ce dossier existe pour qu'on puisse revenir en arrière, pas parce que ce
qu'il contient est mauvais : les deux mécanismes archivés ici étaient
soignés et testés. Ils ont été retirés parce qu'ouvrir une unité mène
désormais directement à son étape courante (voir `currentDestination`,
`src/engine/unitPath.ts`) — il n'y a plus d'écran de parcours à traverser
pour la retrouver, donc plus rien à visualiser ni à sauter.

Il n'est pas exclu par le build : `tsconfig.json` et `vitest.config.ts` ne
regardent que `src/` et `tools/`, ce dossier n'y figure pas.

## Ce qui est déplacé tel quel

- `screens/UnitPathScreen.tsx` — l'écran de chemin d'une unité (cercles,
  trait, mascotte).
- `components/PathNode.tsx`, `components/PathTrail.tsx` — les nœuds et le
  fil du chemin.
- `components/pathTone.ts` — les teintes par couleur d'unité, utilisées
  uniquement par les deux composants ci-dessus.
- `engine/unitPathLayout.ts` (+ son test) — la géométrie du chemin
  (`placePath`, coordonnées des nœuds).
- `screens/CheckpointTestRoute.tsx` — le test de passage d'un checkpoint.

## Ce qui a été retiré de fichiers actifs

Ces fichiers restent utilisés (par d'autres écrans, ou par d'autres cours) ;
seule la partie listée ici, propre aux checkpoints, en a été retirée.

### `src/content/schema.ts`

Champ `checkpoint` sur `lessonBase`, juste avant la fermeture de l'objet :

```ts
/**
 * Point d'entrée du parcours d'unité (agencement `library`) : ce nœud peut
 * être rejoint directement, sans repasser par ce qui précède — voir
 * `UnitPathScreen`. Réservé aux leçons qui ouvrent une section cohérente de
 * l'unité ; l'alphabet russe en est l'exemple type, une leçon de lettres
 * par groupe. Son libellé sur le chemin se déduit du contenu de la leçon
 * (voir `checkpointLabel` dans `unitPath.ts`), pas d'un champ séparé à
 * tenir à jour.
 */
checkpoint: z.boolean().default(false),
```

### `src/engine/unitPath.ts`

- `UnitPathNode.checkpoint: boolean` et `.checkpointLabel: string | null`,
  et leur calcul dans `buildUnitPath` (`checkpoint: lesson?.checkpoint ?? false`,
  `checkpointLabel: lesson?.checkpoint ? checkpointLabel(lesson) : null`).
- La fonction privée `checkpointLabel(lesson)` (déduit le libellé du
  contenu de la leçon).
- `pathBefore(unitId, path, nodeId)` — ce qu'il faut marquer acquis pour
  atteindre un nœud sans le jouer.
- `checkpointTestVocab(unit, checkpointLessonId)` et la constante
  `TESTED_SECTIONS` — la matière du test de passage.
- `mistakesAllowed(questions)` — fautes tolérées dans un test de passage.
- `sectionsOf(unit)` : coupait `unit.lessons` à chaque checkpoint.
  `sectionRank` s'appuyait dessus ; il calcule maintenant directement
  `unit.lessons.findIndex(...)`, ce qui revient exactement au même une fois
  qu'une unité ne contient plus qu'une seule section (voir plus bas, côté
  contenu).

### `src/engine/exercises.ts`

`buildCheckpointTest(vocab, seed, canSpeak)` et la constante
`CHECKPOINT_MATCH_ROUNDS`, juste avant `splitGap`. S'appuie sur les
helpers génériques du fichier (`shuffle`, `sample`, `cuesFor`, `choiceFor`,
`matchRounds`, `rampEndingAtMax`, `createRng`), tous encore en place.

### `src/screens/SessionScreen.tsx`

La prop `exam?: { allowed: number }` et tout ce qui en dépendait :

- le calcul de `hearts`/`outOfHearts` à partir de `exam.allowed` ;
- les branches `if (!exam)` dans `answer`/`answerMatch` (un test ne note
  rien dans la révision espacée, et un exercice raté n'y repart pas en fin
  de file) ;
- l'arrêt anticipé de la session dès `outOfHearts` ;
- l'affichage des cœurs dans l'en-tête (remplacé par le compteur habituel
  `{attempt.seen.size}/{graded}`).

### `src/components/icons.tsx`

`SkipIcon` (double chevron, badge du checkpoint dans `PathNode`).

### `src/App.tsx`

Les routes `/unite/:unitId` (`UnitPathScreen`) et `/test/:unitId/:lessonId`
(`CheckpointTestRoute`), et leurs imports.

### Navigation vers une unité

`LibraryScreen.tsx` ouvrait une unité par `navigate('/unite/' + unit.id)`.
Elle appelle maintenant `currentDestination(unit.id, buildUnitPath(...))`
et navigue directement vers la leçon ou l'étape rendue. Pareil pour le
raccourci des pistes à une seule unité (`selectTrack`). Les écrans de fin
de leçon/étape (`LessonRoute.tsx`, `StepRoute.tsx`) qui ramenaient au
parcours (`backToPath`) ramènent maintenant à l'accueil (`backHome`,
`navigate('/')`).

## Contenu : l'alphabet russe redécoupé

`content/courses/fr-ru-a1/units/u1.yaml` contenait dix leçons dans une
seule unité, avec `checkpoint: true` sur la première leçon de chaque groupe
de lettres (sauf le premier). Il est redécoupé en cinq unités `u1` à `u5`
de deux leçons chacune (une de lettres, une de mots), sans marqueur
`checkpoint`. Les identifiants de leçon et de vocabulaire n'ont pas changé.

`content/courses/fr-ru-a1/course.yaml`, piste `alphabet` : `units: [u1]` →
`units: [u1, u2, u3, u4, u5]`.

Conséquence assumée : chaque nouvelle unité porte son propre bilan
(`final`), là où l'ancienne unité fusionnée n'en portait qu'un seul pour
les dix leçons. Il n'y a pas d'équivalent exact à migrer — voir
`migrateAlphabetSteps` dans `progressStore.ts`, qui reporte les étapes de
révision/consolidation vers les nouvelles unités mais laisse tomber
l'ancien `u1:final`.

Conséquence assumée aussi : les cinq unités de l'alphabet sont maintenant en
accès libre entre elles, comme n'importe quelle autre piste (rien
n'empêche techniquement d'ouvrir `u5` avant `u1`) — voir le commentaire de
`course.yaml`.

## Pour réintégrer

1. `git mv` les fichiers de `screens/`, `components/`, `engine/` de ce
   dossier vers leurs emplacements `src/` d'origine.
2. Restaurer les extraits ci-dessus dans `schema.ts`, `unitPath.ts`,
   `exercises.ts`, `SessionScreen.tsx`, `icons.tsx`.
3. Restaurer les routes dans `App.tsx` et la navigation vers `/unite/:id`
   dans `LibraryScreen.tsx` (et rétablir `backToPath` dans `LessonRoute.tsx`
   / `StepRoute.tsx` si on veut à nouveau un écran à rouvrir).
4. Recomposer `content/courses/fr-ru-a1/units/u1.yaml` en fusionnant u1 à
   u5, en réintroduisant les `checkpoint: true` (le git log d'avant cette
   archive donne l'état exact à restaurer).
5. `npm run content:build`, `tsc --noEmit`, `npm run test`.
