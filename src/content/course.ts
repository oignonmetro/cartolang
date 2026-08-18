import type {
  Course,
  Lesson,
  LessonKind,
  ManifestEntry,
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

/**
 * Même libellé, mais pour une leçon dont on connaît le contenu — « 6 lettres »
 * là où le compte générique dirait « 6 mots ».
 *
 * Une carte de vocabulaire peut porter une lettre plutôt qu'un mot (c'est
 * ainsi que le cours de russe enseigne l'alphabet), et une leçon de l'unité
 * d'alphabet n'en contient alors que. Annoncer « 6 mots » sous six lettres
 * cyrilliques décrirait mal ce qui attend l'apprenant ; une leçon mixte, elle,
 * reste comptée en mots.
 */
export function lessonCountLabel(lesson: Lesson): string {
  const items = itemsOfLesson(lesson)
  if (lesson.kind === 'vocab' && lesson.vocab.every((entry) => entry.pos === 'lettre')) {
    return `${items.length} ${items.length > 1 ? 'lettres' : 'lettre'}`
  }
  return countLabel(lesson.kind, items.length)
}

/**
 * `name` ne porte que la langue (« Anglais », « Russe ») ; ce qui identifiait
 * jusqu'ici un cours dans les libellés d'accessibilité — « Anglais B1» —
 * se recompose ici plutôt que de dupliquer le niveau dans `name`.
 */
export function courseLabel(course: { name: string; level?: string }): string {
  return course.level ? `${course.name} ${course.level}` : course.name
}

/** Un groupe de cours qui partagent la même langue apprise. */
export interface LanguageGroup {
  /** Code de la langue apprise (`learning`), qui distingue deux groupes. */
  learning: string
  name: string
  flag: string
  courses: ManifestEntry[]
}

/**
 * Regroupe les cours du sélecteur par langue apprise, sans réordonner : un
 * groupe apparaît à la position de son premier cours, et les cours d'un même
 * groupe gardent entre eux l'ordre du manifeste. C'est ce qui distingue les
 * niveaux d'une même langue (B1, B2, C1) sans dupliquer le drapeau et le nom
 * sur chaque ligne.
 */
export function groupCoursesByLanguage(courses: readonly ManifestEntry[]): LanguageGroup[] {
  const groups: LanguageGroup[] = []
  const byLearning = new Map<string, LanguageGroup>()

  for (const course of courses) {
    let group = byLearning.get(course.learning)
    if (!group) {
      group = { learning: course.learning, name: course.name, flag: course.flag, courses: [] }
      byLearning.set(course.learning, group)
      groups.push(group)
    }
    group.courses.push(course)
  }
  return groups
}
