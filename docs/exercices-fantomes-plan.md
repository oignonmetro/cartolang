# Exercices fantômes : intégration dans Cartolang

Référence : `C:\Users\Arthur\cartophilo\docs\exercices-fantomes.md` et
`cartophilo/src/engine/treatises.ts`. **Intégré le 2026-10-09** : moteur dans
`src/engine/ghosts.ts` (et `ghosts.test.ts`), notation dans
`src/screens/SessionScreen.tsx`, routes `LessonRoute`, `StepRoute` et
`ReviewRoute`, outils communs dans `src/screens/ghostSession.ts`, seau `links`
et action `gradeLinks` dans `src/store/progressStore.ts`.

## Décisions de l'utilisateur (2026-10-08)

- **Partout** : leçons, étapes du parcours d'unité, révision. La présentation
  d'un élément nouveau se forme quand il entre dans le lot.
- **Coexistence avec SM-2** : chaque réponse note la carte SM-2 *et* le couple
  (élément, lien). La maîtrise affichée vient des liens.
- **Liens du vocabulaire, tous exigés** : sens (mot ↔ traduction), oreille
  (si l'appareil sait prononcer), contexte (phrase à trou, si exemple),
  production (écrire le mot).

## Conception retenue

- **Liens** : vocabulaire `sens`, `oreille`, `contexte`, `production` ;
  grammaire et conjugaison `reconnaissance`, `production`. Prérequis :
  `oreille`, `contexte` et `production` attendent `sens` ; `production`
  attend `reconnaissance`.
- **Exercices par lien** : sens → association en texte, QCM `term` /
  `translation` ; oreille → association et QCM en audio ; contexte → `cloze`
  avec banque ; production → `type` (dictée possible une fois maîtrisé) ;
  grammaire → `grammar-choice` ou trou en banque, puis trou au clavier ;
  conjugaison → `conjugation-choice` ou association du verbe, puis
  `conjugation`. Réutiliser `choiceFor`, `clozeFor`, `grammarChoiceFor`,
  `conjugationChoiceFor`.
- **Store** : seau `links: CourseBucket<Record<itemId, ItemRecord>>`, avec
  `ItemRecord = { presented?, legacy?, links?: {right, wrong}, session?,
  days?, day? }`. Pas de changement de `SAVE_FORMAT` : l'absence vaut `{}`.
  L'ajouter à `exportSave`, `importSave` et `partialize`. Nouvelle action
  `gradeLinks`, appelée **avant** `gradeItem`.
- **Héritage** : un élément sans fiche dont la carte SM-2 a déjà gradué
  compte comme maîtrisé ; avec un intervalle de 7 jours ou plus, comme acquis.
  `legacy` est figé au premier passage dans `gradeLinks`.
- **Acquis** : maîtrisé et réussi du premier coup sur **2 jours distincts**
  (plutôt que 2 séances : sinon la révision juste après la leçon suffirait).
  La séance courante reste exclue des cibles de consolidation.
- **Lot** : `ACTIVE_COUNT = 4` (taille de bloc actuelle). Un élément nouveau est
  présenté (fiche `intro` ; pour la conjugaison, association du verbe entier ;
  pour la grammaire, entrée directe après le rappel) tant que le lot compte
  moins de 4 éléments.
- **Tirage pondéré** : besoin selon le document, divisé par
  `1 + nombre de fois servi dans la séance`.
- **Modes** : `learn` (lot et consolidation, place vide sautée quand il n'y a
  plus rien à faire, ce qui finit la séance plus tôt), `review` (toutes les
  cartes échues sont des cibles), `practice` (rien n'est noté côté liens).
- **Longueur** :
  - leçon : présentations + liens restants + 4, entre 8 et 60 places ;
  - révision et approfondissement : 10 (l'approfondissement favorise la production) ;
  - entraînement : 12, à l'échelle du cours ;
  - séance finale : entre 10 et 25.
- **Leçon réussie** : tous ses éléments maîtrisés (les liens d'oreille ne sont
  exigés que si l'écoute n'est pas coupée).
- **`SessionScreen`** :
  - prop `materialize` et cache `formed` par identifiant de place ;
  - une place qui ne forme rien est sautée ;
  - nature `ghost` à traiter dans `itemIdsOf` (renvoie `[]`) et `effortOf` ;
  - la barre compte les places franchies.
- **Bibliothèque** : anneau = acquis / total, arc clair = maîtrisés / total.
- **Code mort à supprimer ensuite**, avec ses tests : `buildLessonSession`,
  `buildVocabSession`, `buildGrammarSession`, `buildConjugationSession`, les
  échelles, `climb`, `serveLeastFirst`, `buildMixedSession`,
  `buildReviewSession`, `buildPracticeSession`, `consolidationEntries`,
  `lessonDifficulty`, `masteryOf`.

## Écarts avec la conception initiale

- Un élément à consolider pèse **une fois en tout** dans le tirage, et non une
  fois par lien : sinon un mot déjà maîtrisé, à quatre liens, pesait plus
  lourd qu'un mot entièrement à apprendre (défaut révélé par les tests).
- Étapes d'unité : lot de 8 éléments (`STEP_ACTIVE_COUNT`), puisque l'étape
  ne présente rien. Une leçon rejouée alors que tout y est acquis devient une
  remise à niveau de 10 places.
- La barre de progression d'une séance compte les places franchies (réussies,
  présentées ou sautées) : une place ne dit pas d'avance ce qu'elle sera.

## Vérification

- Tests du moteur (`ghosts.test.ts`) :
  - liens par nature, et maîtrise exigeant chacun d'eux ;
  - lot de 4, présentations dans l'ordre, entrée immédiate d'un nouvel élément ;
  - production après le sens, et lien manquant demandé d'abord ;
  - jamais deux fois le même élément dans une manche ;
  - consolidation sur deux jours, séance courante exclue ;
  - remise à niveau sans notation ;
  - héritage des cartes SM-2.
- Aperçu, leçon « Saludos » de l'espagnol A1 :
  - le rappel, puis 4 présentations dans l'ordre ;
  - puis un QCM sur le sens, avec des leurres pris parmi les mots déjà
    présentés, puis une manche sur le sens ;
  - une association fausse a noté une erreur pour les deux éléments concernés,
    une réussite pour les autres ;
  - les cartes SM-2 sont créées en parallèle.
