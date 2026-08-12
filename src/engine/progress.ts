import { itemsOfLesson, itemsOfUnit, lessonsOf } from '@/content/course'
import type { Course, Lesson, Unit } from '@/content/schema'
import { cardStrength, type CardState } from './srs'

/**
 * Règles de progression.
 *
 * Une leçon se maîtrise en la sachant, pas en la rejouant : ses étoiles
 * viennent de l'état des cartes de révision de ses éléments (voir
 * `starsFromMastery`). Le champ `level` n'est plus qu'un plancher — la
 * meilleure valeur déjà atteinte — pour qu'une étoile reste acquise même
 * après un oubli passager.
 *
 * Dans l'agencement `path`, la première étoile débloque la leçon suivante ;
 * terminer une leçon suffit à l'obtenir.
 */

export const MAX_LEVEL = 3
/** Part de bonnes réponses exigée pour valider un passage. */
export const PASS_ACCURACY = 0.7

export interface LessonProgress {
  level: number
  completions: number
  lastAt: number
  bestAccuracy: number
}

export type LessonProgressMap = Record<string, LessonProgress>

export type LessonStatus = 'locked' | 'available' | 'partial' | 'mastered'

export interface LessonNode {
  lesson: Lesson
  unit: Unit
  index: number
  level: number
  status: LessonStatus
}

export function levelOf(progress: LessonProgressMap, lessonId: string): number {
  return progress[lessonId]?.level ?? 0
}

/**
 * Le chemin est strictement linéaire : une leçon s'ouvre dès que la
 * précédente a sa première étoile. La toute première est toujours ouverte.
 */
export function buildPath(course: Course, progress: LessonProgressMap): LessonNode[] {
  let previousUnlocked = true
  return lessonsOf(course).map(({ lesson, unit }, index) => {
    const level = levelOf(progress, lesson.id)
    const unlocked = previousUnlocked
    previousUnlocked = level >= 1
    return {
      lesson,
      unit,
      index,
      level,
      status: !unlocked ? 'locked' : level >= MAX_LEVEL ? 'mastered' : level > 0 ? 'partial' : 'available',
    }
  })
}

export function isUnitComplete(unit: Unit, progress: LessonProgressMap): boolean {
  return unit.lessons.every((lesson) => levelOf(progress, lesson.id) >= 1)
}

/** Prochaine leçon à jouer : la première non maîtrisée et débloquée. */
export function nextLesson(path: readonly LessonNode[]): LessonNode | null {
  return path.find((node) => node.status === 'available' || node.status === 'partial') ?? null
}

/**
 * Résumé de maîtrise d'un ensemble d'éléments.
 *
 * C'est l'indicateur central de l'agencement `library` : sans parcours
 * imposé, l'apprenant a besoin de voir d'un coup d'œil ce qu'il a déjà
 * solidifié dans chaque unité.
 */
export interface Mastery {
  /** Nombre d'éléments de l'ensemble. */
  total: number
  /** Éléments déjà rencontrés au moins une fois. */
  seen: number
  /** Éléments installés durablement (intervalle d'au moins une semaine). */
  known: number
  /** Part maîtrisée, entre 0 et 1 — c'est ce que montrent les anneaux. */
  ratio: number
}

export function masteryOf(itemIds: readonly string[], cards: Record<string, CardState>): Mastery {
  let seen = 0
  let known = 0
  for (const id of itemIds) {
    const card = cards[id]
    if (!card) continue
    const strength = cardStrength(card)
    if (strength !== 'new') seen += 1
    if (strength === 'known' || strength === 'mastered') known += 1
  }
  const total = itemIds.length
  return { total, seen, known, ratio: total === 0 ? 0 : known / total }
}

export function lessonMastery(lesson: Lesson, cards: Record<string, CardState>): Mastery {
  return masteryOf(itemsOfLesson(lesson).map((item) => item.id), cards)
}

/** Part des éléments à atteindre pour décrocher une étoile. */
export const STAR_RATIO = 0.8

/**
 * Étoiles méritées par ce qui est su aujourd'hui.
 *
 * ★ la leçon a été parcourue en entier ; ★★ ses éléments tiennent une semaine ;
 * ★★★ ils tiennent un mois. Les étoiles mesuraient auparavant le nombre de
 * passages : elles récompensaient donc de rejouer une leçon déjà sue, seul
 * moyen de débloquer les exercices de production — exactement l'inverse de ce
 * qu'il faut faire. Ici, ce sont les révisions qui les font monter.
 */
export function starsFromMastery(lesson: Lesson, cards: Record<string, CardState>): number {
  const items = itemsOfLesson(lesson)
  if (items.length === 0) return 0

  let seen = 0
  let known = 0
  let mastered = 0
  for (const item of items) {
    const card = cards[item.id]
    if (!card) continue
    const strength = cardStrength(card)
    if (strength !== 'new') seen += 1
    if (strength === 'known' || strength === 'mastered') known += 1
    if (strength === 'mastered') mastered += 1
  }

  if (seen < items.length) return 0
  if (mastered / items.length >= STAR_RATIO) return MAX_LEVEL
  if (known / items.length >= STAR_RATIO) return 2
  return 1
}

/**
 * Étoiles affichées : le maximum entre ce qui est su aujourd'hui et le
 * plancher déjà atteint. Une étoile est un acquis et ne redescend pas ;
 * l'anneau de maîtrise, lui, montre l'état réel en direct — les deux
 * indicateurs se complètent au lieu de se répéter.
 */
export function lessonStars(lesson: Lesson, cards: Record<string, CardState>, floor: number): number {
  return Math.max(floor, starsFromMastery(lesson, cards))
}

export function unitMastery(unit: Unit, cards: Record<string, CardState>): Mastery {
  return masteryOf(itemsOfUnit(unit).map((item) => item.id), cards)
}

/** Dernière leçon travaillée, pour proposer de reprendre où l'on s'est arrêté. */
export function lastVisitedLesson(course: Course, progress: LessonProgressMap): Lesson | null {
  let best: { lesson: Lesson; at: number } | null = null
  for (const { lesson } of lessonsOf(course)) {
    const at = progress[lesson.id]?.lastAt ?? 0
    if (at > 0 && (!best || at > best.at)) best = { lesson, at }
  }
  return best?.lesson ?? null
}

export interface SessionOutcome {
  correct: number
  total: number
}

export function accuracyOf({ correct, total }: SessionOutcome): number {
  return total === 0 ? 0 : correct / total
}

export function isPassed(outcome: SessionOutcome): boolean {
  return accuracyOf(outcome) >= PASS_ACCURACY
}

/**
 * XP d'une session : un point par bonne réponse, plus un bonus de série
 * quand la session est réussie sans faute.
 */
export function xpFor(outcome: SessionOutcome, passed: boolean): number {
  if (!passed) return Math.max(1, Math.round(outcome.correct / 2))
  const perfect = outcome.total > 0 && outcome.correct === outcome.total
  return outcome.correct + 5 + (perfect ? 5 : 0)
}

/** Niveau du profil : la courbe s'allonge doucement (100, 250, 450, 700…). */
export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  let level = 1
  let remaining = xp
  let span = 100
  while (remaining >= span) {
    remaining -= span
    level += 1
    span += 50
  }
  return { level, into: remaining, span }
}

/** Clé de jour locale, base du calcul de série. */
export function dayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export interface Streak {
  current: number
  best: number
  lastDay: string | null
}

/** Met à jour la série après une activité. Deux sessions le même jour ne comptent qu'une fois. */
export function bumpStreak(streak: Streak, today: string): Streak {
  if (streak.lastDay === today) return streak
  const consecutive = streak.lastDay !== null && dayNumber(today) - dayNumber(streak.lastDay) === 1
  const current = consecutive ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastDay: today }
}

/** Série affichée : elle retombe à zéro si le dernier jour actif n'est ni aujourd'hui ni hier. */
export function displayedStreak(streak: Streak, today: string): number {
  if (streak.lastDay === null) return 0
  const gap = dayNumber(today) - dayNumber(streak.lastDay)
  return gap <= 1 ? streak.current : 0
}
