import type { Exercise } from './exercises'
import { itemIdsOf } from './exercises'
import { isPassed, type SessionOutcome } from './progress'

/**
 * Ce que le retour haptique a le droit de dire, et quand.
 *
 * La vibration est le seul de nos trois canaux qu'on ne peut pas ignorer :
 * l'écran se regarde ou non, le son se coupe par le contexte (le train, une
 * salle d'attente), mais une vibration dans la main arrive toujours. C'est
 * une raison de s'en servir — elle atteint l'apprenant qui a les yeux
 * ailleurs — et une raison de s'en servir peu : ce qui ne peut pas être
 * ignoré devient vite du bruit.
 *
 * D'où la règle tenue ici : **on ne vibre jamais pour ce que l'écran dit
 * déjà**. Une bonne réponse est verte et sonne ; une mauvaise est rouge et
 * donne la réponse attendue. Rien de tout cela ne mérite la main. Ne
 * vibrent que les faits que l'écran ne montre pas, parce qu'ils portent sur
 * la *suite* des réponses et non sur la dernière : une série qui atteint un
 * palier, une série qui se casse, une session qui se conclut. Une session
 * ordinaire de vingt exercices en produit deux ou trois.
 */

/**
 * Une sensation, pas un évènement.
 *
 * Le vocabulaire est volontairement décrit par ce qui se sent et non par ce
 * qui l'a déclenché : c'est `lib/haptics.ts` qui le traduit en vibration, et
 * il n'a pas à savoir ce qu'est une série. Trois impulsions d'intensité
 * croissante, et deux motifs à deux temps qui s'opposent par leur sens de
 * lecture — c'est cette opposition qui rend les deux reconnaissables à
 * l'aveugle, là où deux impulsions de force voisine se confondraient.
 */
export type Buzz =
  /** Une impulsion brève et discrète. */
  | 'light'
  /** Une impulsion nette. */
  | 'medium'
  /** Une impulsion franche, le maximum du vocabulaire. */
  | 'heavy'
  /** Deux temps qui montent, faible puis fort : quelque chose s'est rompu. */
  | 'rising'
  /** Deux temps qui retombent, fort puis faible : quelque chose s'est conclu. */
  | 'falling'

/** Les trois impulsions, dans l'ordre où les paliers les servent. */
const IMPACTS = ['light', 'medium', 'heavy'] as const

/**
 * Ce qu'un exercice réussi rapporte à l'élan.
 *
 * Compter les exercices un par un rendrait la série bavarde là où elle est
 * facile : huit QCM d'affilée sur des mots qu'on vient de découvrir ne
 * valent pas huit traductions tapées de mémoire. On pèse donc chaque
 * réussite par ce qu'elle a demandé.
 *
 * Ce poids suit la difficulté **et** la progression de l'apprenant sans
 * avoir à consulter la moindre carte, parce que le constructeur de session
 * a déjà fait ce travail : c'est la maturité de l'élément qui décide de la
 * forme servie (voir `recallStage`, exercises.ts). Un mot fraîchement
 * rencontré revient en reconnaissance, le même mot mûr revient en
 * production libre. La forme de l'exercice est donc déjà le résumé de ce
 * que l'apprenant sait de cet élément-là — la relire ici suffit.
 *
 * Zéro pour ce qui ne se réussit ni ne se rate : une règle qu'on lit, un mot
 * qu'on découvre, une flashcard qu'on s'auto-évalue. La flashcard mérite
 * qu'on s'y arrête — elle a bien deux issues, mais c'est l'apprenant qui les
 * déclare. Une série qu'on peut monter en cliquant « je savais » ne mesure
 * plus rien ; et, symétriquement, s'avouer honnêtement ignorant ne doit pas
 * casser une série. Un poids nul rend ces exercices entièrement
 * transparents : ils ne font ni monter ni tomber.
 */
export function effortOf(exercise: Exercise): number {
  switch (exercise.kind) {
    case 'rule':
    case 'intro':
    case 'flashcard':
      return 0

    // Reconnaître parmi des options proposées : la forme la plus assistée.
    case 'choice':
    case 'grammar-choice':
    case 'conjugation-choice':
      return 1

    // Une manche d'association est de la reconnaissance, mais en gros : elle
    // liquide quatre à six éléments d'un coup. La compter pour un seul
    // exercice ferait stagner l'élan pendant la plus longue épreuve de la
    // session ; la compter par paire ferait franchir deux paliers en une
    // manche. La moitié tient les deux bouts.
    case 'match':
    case 'conjugation-match':
      return Math.ceil(itemIdsOf(exercise).length / 2)

    // Restituer, mais avec les mots sous les yeux.
    case 'cloze':
      return 2
    case 'grammar-gap':
      return exercise.bank ? 2 : 3

    // Produire sans filet, au clavier.
    case 'type':
    case 'conjugation':
      return 3
  }
}

/**
 * Élan à atteindre pour franchir le `tier`-ième palier.
 *
 * Les seuils sont triangulaires — 5, 15, 30, 50, 75… — et non réguliers :
 * l'écart entre deux paliers grandit avec eux, de sorte qu'une longue série
 * vibre de moins en moins souvent à mesure qu'elle s'allonge. C'est ce qui
 * garde le retour rare sans avoir à plafonner arbitrairement le nombre de
 * paliers. Sur un effort moyen d'environ 1,8, le premier palier tombe vers
 * le troisième exercice, le deuxième vers le huitième, le troisième vers le
 * dix-septième : trois vibrations au plus dans une leçon d'une vingtaine
 * d'exercices, et seulement pour qui ne se trompe pas.
 */
export function thresholdFor(tier: number): number {
  return (5 * tier * (tier + 1)) / 2
}

function tierAt(momentum: number): number {
  let tier = 0
  while (momentum >= thresholdFor(tier + 1)) tier += 1
  return tier
}

/** Une série de bonnes réponses en cours. */
export interface Combo {
  /** Élan accumulé depuis la dernière faute : la somme des efforts réussis. */
  momentum: number
  /** Dernier palier franchi, pour ne pas le refranchir à chaque réponse. */
  tier: number
}

export const NO_COMBO: Combo = { momentum: 0, tier: 0 }

/**
 * Fait avancer la série d'une réponse, et dit ce qui doit se sentir.
 *
 * Une faute ne vibre que si elle casse quelque chose — c'est-à-dire si la
 * série avait déjà franchi un palier. La règle n'est pas de la clémence
 * mais de la justesse : l'écran annonce déjà la faute, la seule chose qu'il
 * ne dit pas est ce qu'elle vient de coûter. Elle a l'effet secondaire
 * heureux d'être douce avec qui se trompe beaucoup — celui qui n'a jamais
 * de série ne sent jamais rien — et exigeante avec qui va bien, ce qui est
 * l'inverse d'un retour qui punirait.
 *
 * La montée, elle, se sent par crans et non en continu : `tier` retient le
 * dernier palier franchi, si bien qu'une réponse au milieu d'un cran ne
 * produit rien.
 */
export function afterAnswer(combo: Combo, effort: number, correct: boolean): { combo: Combo; buzz: Buzz | null } {
  if (effort <= 0) return { combo, buzz: null }

  if (!correct) {
    return { combo: NO_COMBO, buzz: combo.tier > 0 ? 'rising' : null }
  }

  const momentum = combo.momentum + effort
  const tier = tierAt(momentum)
  // Au-delà du troisième palier, l'intensité ne monte plus : le vocabulaire
  // n'a rien de plus fort à offrir, et prétendre le contraire ne ferait que
  // rendre les paliers hauts indiscernables les uns des autres.
  const buzz = tier > combo.tier ? IMPACTS[Math.min(tier, IMPACTS.length) - 1]! : null
  return { combo: { momentum, tier }, buzz }
}

/**
 * Le retour de fin de session : un seul, et seulement s'il y a lieu.
 *
 * Une session ratée ne vibre pas. L'écran de résultat le dit déjà
 * franchement, mascotte déçue comprise ; ajouter la vibration reviendrait à
 * en remettre une couche sur le seul moment de l'app où l'apprenant a besoin
 * qu'on le laisse tranquille.
 *
 * Une session réussie donne une impulsion franche ; une session sans la
 * moindre faute, le motif à deux temps, réservé à ce seul cas. C'est le
 * retour le plus riche du vocabulaire parce que c'est le plus rare — et
 * parce qu'il récompense exactement ce que le score affiché ne distingue
 * pas d'un coup d'œil : 100 % et 95 % se ressemblent à l'écran, pas dans la
 * main.
 */
export function endBuzz(outcome: SessionOutcome): Buzz | null {
  // Une leçon entièrement faite de présentations (une règle, des découvertes
  // de mots) ne note rien : il n'y a pas de réussite à saluer.
  if (outcome.total === 0) return null
  if (!isPassed(outcome)) return null
  return outcome.correct === outcome.total ? 'falling' : 'heavy'
}
