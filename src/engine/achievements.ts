import type { ItemLocation } from '@/content/course'
import type { LessonProgressMap } from './progress'
import type { CardState } from './srs'

/**
 * Succès : des paliers qu'on débloque une fois pour toutes, à côté de la
 * série et du combo qui ne récompensent que l'instant présent. Trois natures
 * d'effort, chacune avec cinq paliers — mots rencontrés, série la plus
 * longue jamais tenue, leçons menées à leur terme.
 *
 * Propres au cours actif plutôt que cumulés sur tous les cours : le contenu
 * des cours qu'on n'a pas ouverts n'est pas chargé (voir `CourseProvider`),
 * impossible donc de savoir combien de cartes d'un autre cours sont des mots
 * plutôt que des points de grammaire. Et « 300 mots » veut de toute façon
 * mieux dire quelque chose rapporté à une seule langue qu'à un total qui
 * mélangerait anglais et russe. La série fait exception : elle porte sur les
 * jours pratiqués, pas sur un cours en particulier, et reste donc globale
 * (voir `ProgressSnapshot.streak`).
 *
 * Les seuils sont calés sur le contenu réel plutôt que ronds au hasard : le
 * russe A1, le plus fourni des cours actuels, compte environ 160 mots et 48
 * leçons — le dernier palier de chaque échelle suppose donc plusieurs cours
 * menés de front, pas un seul poussé à l'extrême.
 */
export interface AchievementTier {
  threshold: number
  label: string
}

export type AchievementId = 'words' | 'streak' | 'lessons'

export interface AchievementFamily {
  id: AchievementId
  title: string
  /** Unité affichée dans le texte de progression : « mots », « jours »… */
  unit: string
  /** Croissants : `achievementStatus` s'arrête au premier seuil non atteint. */
  tiers: readonly AchievementTier[]
}

export const ACHIEVEMENTS: readonly AchievementFamily[] = [
  {
    id: 'words',
    title: 'Mots appris',
    unit: 'mots',
    tiers: [
      { threshold: 10, label: 'Premiers mots' },
      { threshold: 50, label: 'Ça prend racine' },
      { threshold: 150, label: 'Bon bagage' },
      { threshold: 300, label: 'Riche vocabulaire' },
      { threshold: 600, label: 'Mémoire d’éléphant' },
    ],
  },
  {
    id: 'streak',
    title: 'Série la plus longue',
    unit: 'jours',
    tiers: [
      { threshold: 3, label: 'Bon départ' },
      { threshold: 7, label: 'Une semaine tenue' },
      { threshold: 14, label: 'Ancré dans la routine' },
      { threshold: 30, label: 'Un mois sans faillir' },
      { threshold: 100, label: 'Increvable' },
    ],
  },
  {
    id: 'lessons',
    title: 'Leçons terminées',
    unit: 'leçons',
    tiers: [
      { threshold: 5, label: 'Premiers pas' },
      { threshold: 15, label: 'Bonne cadence' },
      { threshold: 40, label: 'Grand chemin' },
      { threshold: 80, label: 'Marathonien' },
      { threshold: 150, label: 'Tout un parcours' },
    ],
  },
]

export interface AchievementStatus {
  family: AchievementFamily
  value: number
  /** Nombre de paliers débloqués, 0 si aucun. */
  unlocked: number
  /** Premier palier non débloqué, `null` une fois l'échelle épuisée. */
  next: AchievementTier | null
}

/** Où en est un cours sur une échelle de paliers, `value` déjà calculée. */
export function achievementStatus(family: AchievementFamily, value: number): AchievementStatus {
  let unlocked = 0
  for (const tier of family.tiers) {
    if (value < tier.threshold) break
    unlocked += 1
  }
  return { family, value, unlocked, next: family.tiers[unlocked] ?? null }
}

/**
 * Mots du cours actif effectivement rencontrés : les cartes qui portent sur
 * un élément de vocabulaire, pas une règle de grammaire ni une forme
 * conjuguée — les deux autres piliers d'un cours, mais qu'« appris » ne
 * décrit pas de la même manière.
 */
export function wordsLearnedCount(
  cards: Record<string, CardState>,
  itemsById: ReadonlyMap<string, ItemLocation>,
): number {
  let count = 0
  for (const id of Object.keys(cards)) {
    if (itemsById.get(id)?.item.kind === 'vocab') count += 1
  }
  return count
}

/** Leçons du cours actif menées à leur terme au moins une fois. */
export function lessonsCompletedCount(lessons: LessonProgressMap): number {
  return Object.values(lessons).filter((entry) => entry.level >= 1).length
}
