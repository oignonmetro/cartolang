import type { Course, PracticeItem, Unit } from '@/content/schema'
import { itemsOfCourse, itemsOfUnit } from '@/content/course'
import type { GhostOptions, GhostState } from '@/engine/ghosts'
import { dayKey } from '@/engine/progress'
import { canSpeakExercises } from '@/lib/speech'
import { useProgress } from '@/store/progressStore'
import { isListeningMuted, useListeningMuteStore } from '@/store/listeningMuteStore'

/**
 * Ce que les routes de séance partagent pour former leurs places réservées
 * (voir `engine/ghosts.ts`).
 */

/**
 * Ce que l'apprenant sait, lu à l'instant : une place se forme après toutes
 * les réponses qui la précèdent, il ne faut surtout pas figer cet état à
 * l'ouverture de la séance.
 */
export function ghostStateOf(courseId: string): GhostState {
  const { links, cards } = useProgress.getState()
  return { progress: links[courseId] ?? {}, cards: cards[courseId] ?? {} }
}

/** L'écoute est-elle possible maintenant ? Coupée, aucun exercice à l'oreille ne se forme. */
export function canHearNow(): boolean {
  return canSpeakExercises() && !isListeningMuted(useListeningMuteStore.getState().mutedUntil)
}

/** Les options d'une séance, l'écoute étant relue à chaque formation. */
export function ghostOptionsFor(
  seed: number,
  served: Map<string, number>,
  rest: Pick<GhostOptions, 'mode' | 'allowIntro' | 'activeCount'> & { favorProduction?: boolean },
): GhostOptions {
  return { ...rest, canSpeak: canSpeakExercises(), canHear: canHearNow(), seed, day: dayKey(seed), served }
}

/**
 * Où prendre les leurres : les éléments de l'unité, plus proches de ce qu'on
 * travaille, et tout le cours quand l'unité n'en a pas assez de cette nature.
 */
export function distractorsFor(course: Course, unit: Unit): PracticeItem[] {
  const local = itemsOfUnit(unit)
  return local.length >= 6 ? local : itemsOfCourse(course).filter((item) => item.kind === unit.kind)
}
