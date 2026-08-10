import type { Course, Lesson, Unit } from '@/content/schema'

/**
 * Règles de progression du chemin.
 *
 * Une leçon se maîtrise en trois passages : chaque passage réussi ajoute une
 * étoile (niveau 0 → 3). Une étoile suffit à débloquer la suite ; les deux
 * autres sont là pour approfondir.
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

/** Toutes les leçons d'un cours, dans l'ordre du chemin. */
export function lessonsOf(course: Course): { lesson: Lesson; unit: Unit }[] {
  return course.sections.flatMap((section) =>
    section.units.flatMap((unit) => unit.lessons.map((lesson) => ({ lesson, unit }))),
  )
}

export function findLesson(course: Course, lessonId: string): { lesson: Lesson; unit: Unit } | null {
  return lessonsOf(course).find((entry) => entry.lesson.id === lessonId) ?? null
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
