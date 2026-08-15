import type { ItemLocation } from '@/content/course'
import { countLabel, itemsOfLesson } from '@/content/course'
import type { Lesson, PracticeItem, Unit } from '@/content/schema'
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
      subtitle: lesson
        ? countLabel(lesson.kind, itemsOfLesson(lesson).length)
        : STEP_LABELS[kind as UnitStepKind].subtitle,
      status,
      cycle,
    }
  })
}

/** Nœud suivant à faire après celui-ci, pour enchaîner en fin de session. */
export function nextNodeAfter(path: readonly UnitPathNode[], nodeId: string): UnitPathNode | null {
  const index = path.findIndex((node) => node.id === nodeId)
  if (index === -1) return null
  return path.slice(index + 1).find((node) => node.status !== 'locked') ?? path[index + 1] ?? null
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
