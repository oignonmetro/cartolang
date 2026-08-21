import type { ItemLocation } from '@/content/course'
import { lessonCountLabel } from '@/content/course'
import type { Lesson, PracticeItem, Unit, Vocab } from '@/content/schema'
import { dueCards, type CardState } from './srs'
import { levelOf, type LessonProgressMap } from './progress'

/**
 * Parcours d'une unité.
 *
 * Les unités restent en accès libre — c'est l'apprenant qui choisit par quoi
 * commencer. Mais une fois dans une unité, l'ordre compte : on découvre, on
 * consolide, on approfondit, et on va régulièrement travailler ses points
 * faibles, y compris ceux venus d'autres unités. Ce fichier décrit cette
 * suite et ce qui alimente chaque étape.
 */

export type UnitStepKind = 'review' | 'drill' | 'workout' | 'final'
export type UnitNodeKind = 'lesson' | UnitStepKind
export type UnitNodeStatus = 'done' | 'available' | 'locked'

export interface UnitPathNode {
  /** Stable : sert d'URL et de clé de persistance pour les étapes. */
  id: string
  kind: UnitNodeKind
  /** Renseignée pour les nœuds `lesson`, nulle pour les étapes. */
  lesson: Lesson | null
  title: string
  subtitle: string
  status: UnitNodeStatus
  /**
   * Bloc auquel le nœud appartient : une leçon et sa pratique portent le même
   * numéro, la séance finale a le sien. L'écran s'en sert pour séparer
   * visuellement les blocs — sans ça, le parcours n'est qu'une chaîne de dix
   * pastilles où rien ne dit que la structure se répète.
   */
  cycle: number
  /** Point d'entrée du parcours (voir `Lesson.checkpoint`) : peut se rejoindre sans jouer ce qui précède. */
  checkpoint: boolean
  /** Libellé du checkpoint, dérivé de son contenu ; nul hors checkpoint. */
  checkpointLabel: string | null
}

/**
 * Libellé d'un checkpoint : les lettres (ou mots) réellement travaillés dans
 * la section qu'il ouvre, plutôt qu'un titre à tenir à jour séparément — le
 * contenu de la leçon reste la seule source de vérité.
 */
function checkpointLabel(lesson: Lesson): string {
  return lesson.kind === 'vocab' ? lesson.vocab.map((word) => word.term).join(' ') : lesson.title
}

const STEP_LABELS: Record<UnitStepKind, { title: string; subtitle: string }> = {
  review: { title: 'Révision', subtitle: "Reprendre ce qui vient d'être vu" },
  drill: { title: 'Approfondissement', subtitle: 'Produire de mémoire, sans aide' },
  workout: { title: 'Entraînement', subtitle: 'Vos points les plus fragiles' },
  final: { title: 'Séance finale', subtitle: "Bilan complet de l'unité" },
}

/** Clé de persistance d'une étape : l'identifiant du nœud, préfixé par l'unité. */
export function stepKey(unitId: string, nodeId: string): string {
  return `${unitId}:${nodeId}`
}

/**
 * Suite des nœuds d'une unité, avant calcul des états.
 *
 * Chaque leçon est immédiatement suivie d'une révision puis d'une
 * consolidation, qui alterne entraînement (points fragiles, dans et hors de
 * l'unité) et approfondissement (production sur l'unité seule) — le cycle
 * s'ouvre par l'entraînement. Rien n'a le temps de s'oublier entre deux
 * leçons. L'unité se clôt par une séance finale unique, bilan complet une
 * fois toutes les leçons vues.
 */
function layout(unit: Unit): { id: string; kind: UnitNodeKind; lesson: Lesson | null; cycle: number }[] {
  const nodes: { id: string; kind: UnitNodeKind; lesson: Lesson | null; cycle: number }[] = []

  unit.lessons.forEach((lesson, index) => {
    nodes.push({ id: lesson.id, kind: 'lesson', lesson, cycle: index })
    nodes.push({ id: `review-${index}`, kind: 'review', lesson: null, cycle: index })
    nodes.push({
      id: `consolidate-${index}`,
      kind: index % 2 === 0 ? 'workout' : 'drill',
      lesson: null,
      cycle: index,
    })
  })
  nodes.push({ id: 'final', kind: 'final', lesson: null, cycle: unit.lessons.length })
  return nodes
}

export function buildUnitPath(
  unit: Unit,
  progress: LessonProgressMap,
  steps: Record<string, number>,
): UnitPathNode[] {
  let reached = false

  return layout(unit).map(({ id, kind, lesson, cycle }) => {
    const done = lesson
      ? levelOf(progress, lesson.id) >= 1
      : (steps[stepKey(unit.id, id)] ?? 0) >= 1

    // Le premier nœud non fait est l'étape courante ; tout ce qui suit attend.
    // Un nœud déjà fait reste jouable : on peut toujours revenir en arrière.
    let status: UnitNodeStatus = 'done'
    if (!done) {
      status = reached ? 'locked' : 'available'
      reached = true
    }

    return {
      id,
      kind,
      lesson,
      title: lesson ? lesson.title : STEP_LABELS[kind as UnitStepKind].title,
      subtitle: lesson ? lessonCountLabel(lesson) : STEP_LABELS[kind as UnitStepKind].subtitle,
      status,
      cycle,
      checkpoint: lesson?.checkpoint ?? false,
      checkpointLabel: lesson?.checkpoint ? checkpointLabel(lesson) : null,
    }
  })
}

/** Nœud suivant à faire après celui-ci, pour enchaîner en fin de session. */
export function nextNodeAfter(path: readonly UnitPathNode[], nodeId: string): UnitPathNode | null {
  const index = path.findIndex((node) => node.id === nodeId)
  if (index === -1) return null
  return path.slice(index + 1).find((node) => node.status !== 'locked') ?? path[index + 1] ?? null
}

/**
 * Ce qu'il faut marquer acquis pour atteindre un nœud sans l'avoir joué : les
 * leçons et les étapes qui le précèdent dans le parcours. Le saut lui-même est
 * confié au store (`skipTo`), qui ne redescend jamais ce qui est déjà fait.
 */
export function pathBefore(
  unitId: string,
  path: readonly UnitPathNode[],
  nodeId: string,
): { lessonIds: string[]; stepIds: string[] } {
  const index = path.findIndex((node) => node.id === nodeId)
  const before = index === -1 ? [] : path.slice(0, index)
  return {
    lessonIds: before.flatMap((node) => (node.lesson ? [node.lesson.id] : [])),
    stepIds: before.flatMap((node) => (node.lesson ? [] : [stepKey(unitId, node.id)])),
  }
}

/**
 * Sections d'une unité : sa liste de leçons, coupée à chaque checkpoint.
 *
 * Un checkpoint ouvre une section ; la première commence avec l'unité, et n'en
 * porte pas — on y arrive sans rien avoir à sauter.
 */
function sectionsOf(unit: Unit): Lesson[][] {
  const sections: Lesson[][] = []
  for (const lesson of unit.lessons) {
    if (lesson.checkpoint || sections.length === 0) sections.push([])
    sections[sections.length - 1]!.push(lesson)
  }
  return sections
}

/**
 * Rang d'une leçon dans sa section : zéro pour celle qui l'ouvre.
 *
 * C'est la mesure d'avancement dont les manches d'association tirent leur
 * difficulté (voir `buildLessonSession`) : elles grandissent au fil de la
 * section, puis retombent à leur plancher quand la suivante commence. Le
 * checkpoint qui l'ouvre enseigne un alphabet neuf, et relier six lettres
 * découvertes à l'écran précédent punirait ce passage au lieu de
 * l'accompagner — l'exigence doit suivre la familiarité, pas la précéder.
 *
 * Zéro pour une leçon étrangère à l'unité : c'est le plancher, donc le repli
 * le plus doux qu'un appel malformé puisse recevoir.
 */
export function sectionRank(unit: Unit, lessonId: string): number {
  for (const section of sectionsOf(unit)) {
    const rank = section.findIndex((lesson) => lesson.id === lessonId)
    if (rank !== -1) return rank
  }
  return 0
}

/** Nombre de sections sur lesquelles un test de passage interroge. */
const TESTED_SECTIONS = 2

/**
 * Ce sur quoi porte le test de passage d'un checkpoint : les lettres des deux
 * sections qui le précèdent — d'une seule quand il n'y en a qu'une avant lui.
 *
 * Les lettres, et pas les mots que ces sections enseignent aussi. Un mot russe
 * mobilise un lexique qu'on ne prétend pas connaître en sautant l'alphabet, et
 * le rater ne dirait rien de la lecture ; ce que la section suivante suppose
 * acquis, c'est le déchiffrage, et c'est donc lui seul qu'on vérifie.
 *
 * Le repli sur tout le vocabulaire ne sert pas au russe : il garde le test
 * praticable si une unité sans alphabet se dote un jour de checkpoints, plutôt
 * que d'y ouvrir un saut que rien ne viendrait mériter.
 */
export function checkpointTestVocab(unit: Unit, checkpointLessonId: string): Vocab[] {
  const sections = sectionsOf(unit)
  const index = sections.findIndex((section) => section[0]?.id === checkpointLessonId)
  if (index <= 0) return []

  const vocab = sections
    .slice(Math.max(0, index - TESTED_SECTIONS), index)
    .flatMap((section) => section.flatMap((lesson) => (lesson.kind === 'vocab' ? lesson.vocab : [])))

  const letters = vocab.filter((word) => word.pos === 'lettre')
  return letters.length > 0 ? letters : vocab
}

/**
 * Fautes tolérées dans un test de passage.
 *
 * Un quart des questions, plafonné à trois : sur une quinzaine de questions
 * ça laisse la place à l'étourderie sans laisser passer un alphabet à moitié
 * su. Le plancher à une faute garde un test court franchissable — refuser le
 * saut pour une seule erreur sur quatre questions serait décourageant plus
 * qu'exigeant. Le nombre s'annonce avant le test, il ne se découvre pas après.
 */
export function mistakesAllowed(questions: number): number {
  return Math.max(1, Math.min(3, Math.floor(questions / 4)))
}

export interface ConsolidationEntry {
  card: CardState
  item: PracticeItem
}

/**
 * Solidité d'une carte : plus le nombre est bas, plus elle est fragile.
 *
 * Une carte encore en apprentissage vaut zéro — rien n'est acquis tant qu'elle
 * n'a pas gradué. Au-delà, c'est l'intervalle qui mesure la solidité, divisé
 * par les rechutes : un mot repris trois fois n'est pas au même niveau qu'un
 * mot su du premier coup, même intervalle affiché.
 */
export function solidity(card: CardState): number {
  const base = card.step === null ? Math.max(card.interval, 1) : 0
  return base / (1 + card.lapses)
}

/**
 * Éléments d'une étape de consolidation.
 *
 * D'abord ce qui est échu — c'est la révision espacée qui décide de l'urgence,
 * et ce sont naturellement les autres unités déjà travaillées qui remontent
 * ici avec le temps. Puis, pour compléter, les cartes les plus fragiles : au
 * tout début, quand rien d'extérieur n'est encore échu, une étape
 * d'entraînement porte donc sur l'unité en cours et ses points faibles, ce
 * qui est exactement ce qu'on veut à ce moment-là.
 */
export function consolidationEntries(
  cards: Record<string, CardState>,
  itemsById: Map<string, ItemLocation>,
  options: { scope: 'unit' | 'course'; unitItemIds: readonly string[]; now: number; limit: number },
): ConsolidationEntry[] {
  const inUnit = new Set(options.unitItemIds)

  const pool = Object.values(cards).filter((card) => {
    if (!itemsById.has(card.itemId)) return false
    // Jamais répondu : il n'y a rien à consolider, seulement à découvrir.
    if (card.lastReviewed === null) return false
    return options.scope === 'course' || inUnit.has(card.itemId)
  })

  const due = dueCards(pool, options.now)
  const dueIds = new Set(due.map((card) => card.itemId))
  const rest = pool
    .filter((card) => !dueIds.has(card.itemId))
    .sort((a, b) => solidity(a) - solidity(b))

  return [...due, ...rest]
    .slice(0, options.limit)
    .map((card) => ({ card, item: itemsById.get(card.itemId)!.item }))
}
