import type {
  Course,
  Lesson,
  LessonKind,
  PracticeItem,
  Track,
  Unit,
} from './schema'

/**
 * Accès au contenu d'un cours, indépendamment de son agencement.
 *
 * Le reste de l'application ne devrait jamais parcourir `sections` ou
 * `tracks` à la main : ces fonctions donnent la même vue des deux.
 */

export interface LessonEntry {
  lesson: Lesson
  unit: Unit
  /** Piste d'appartenance, seulement pour l'agencement `library`. */
  track: Track | null
}

/** Toutes les unités d'un cours, dans l'ordre de déclaration. */
export function unitsOf(course: Course): { unit: Unit; track: Track | null }[] {
  if (course.layout === 'library') {
    return course.tracks.flatMap((track) => track.units.map((unit) => ({ unit, track })))
  }
  return course.sections.flatMap((section) => section.units.map((unit) => ({ unit, track: null })))
}

/** Toutes les leçons d'un cours, dans l'ordre de déclaration. */
export function lessonsOf(course: Course): LessonEntry[] {
  return unitsOf(course).flatMap(({ unit, track }) =>
    unit.lessons.map((lesson) => ({ lesson, unit, track })),
  )
}

export function findLesson(course: Course, lessonId: string): LessonEntry | null {
  return lessonsOf(course).find((entry) => entry.lesson.id === lessonId) ?? null
}

/**
 * Les éléments pratiquables d'une leçon, à plat.
 * C'est cette liste qui alimente la révision espacée : un élément, une carte.
 */
export function itemsOfLesson(lesson: Lesson): PracticeItem[] {
  switch (lesson.kind) {
    case 'vocab':
      return lesson.vocab.map((vocab) => ({ kind: 'vocab' as const, id: vocab.id, vocab }))
    case 'grammar':
      return lesson.points.map((point) => ({ kind: 'grammar' as const, id: point.id, point }))
    case 'conjugation':
      return lesson.verbs.flatMap((verb) =>
        verb.forms.map((form) => ({ kind: 'conjugation' as const, id: form.id, form, verb })),
      )
  }
}

export function itemsOfUnit(unit: Unit): PracticeItem[] {
  return unit.lessons.flatMap(itemsOfLesson)
}

export function findUnit(course: Course, unitId: string): Unit | null {
  return unitsOf(course).find(({ unit }) => unit.id === unitId)?.unit ?? null
}

export function itemsOfCourse(course: Course): PracticeItem[] {
  return lessonsOf(course).flatMap((entry) => itemsOfLesson(entry.lesson))
}

/** Index élément → leçon, pour retrouver un élément depuis une carte de révision. */
export interface ItemLocation {
  item: PracticeItem
  lessonId: string
  unitId: string
  trackId: string | null
}

export function indexItems(course: Course): Map<string, ItemLocation> {
  const byId = new Map<string, ItemLocation>()
  for (const { lesson, unit, track } of lessonsOf(course)) {
    for (const item of itemsOfLesson(lesson)) {
      byId.set(item.id, { item, lessonId: lesson.id, unitId: unit.id, trackId: track?.id ?? null })
    }
  }
  return byId
}

/** Libellé d'une nature de contenu : « 12 règles », « 1 forme ». */
export const KIND_LABELS: Record<LessonKind, { one: string; many: string }> = {
  vocab: { one: 'mot', many: 'mots' },
  grammar: { one: 'règle', many: 'règles' },
  conjugation: { one: 'forme', many: 'formes' },
}

export function countLabel(kind: LessonKind, count: number): string {
  const { one, many } = KIND_LABELS[kind]
  return `${count} ${count > 1 ? many : one}`
}
