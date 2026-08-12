import { describe, expect, it } from 'vitest'
import type { LibraryCourse, Unit, Vocab } from './schema'
import { findUnit, nextLessonAfter } from './course'

function vocab(id: string): Vocab {
  return { id, term: id, translation: id, alt: [] }
}

function lesson(id: string) {
  return { kind: 'vocab' as const, id, title: id, vocab: [vocab(`${id}-w`)] }
}

function unit(id: string, lessonIds: string[]): Unit {
  return { id, title: id, icon: 'book', color: 'teal', kind: 'vocab', lessons: lessonIds.map(lesson) }
}

const COURSE: LibraryCourse = {
  id: 'c',
  name: 'Cours',
  learning: 'en',
  known: 'fr',
  flag: '🇬🇧',
  status: 'available',
  default: false,
  version: 1,
  layout: 'library',
  tracks: [
    {
      id: 'vocabulaire',
      title: 'Vocabulaire',
      kind: 'vocab',
      color: 'teal',
      icon: 'book',
      units: [unit('v1', ['v1-l1', 'v1-l2']), unit('v2', ['v2-l1'])],
    },
    {
      id: 'grammaire',
      title: 'Grammaire',
      kind: 'vocab',
      color: 'violet',
      icon: 'compass',
      units: [unit('g1', ['g1-l1'])],
    },
  ],
}

describe('leçon suivante', () => {
  it('enchaîne à l’intérieur d’une unité', () => {
    expect(nextLessonAfter(COURSE, 'v1-l1')?.lesson.id).toBe('v1-l2')
  })

  it('passe à l’unité suivante de la même piste', () => {
    expect(nextLessonAfter(COURSE, 'v1-l2')?.lesson.id).toBe('v2-l1')
  })

  it('s’arrête au bout de la piste plutôt que de sauter à la suivante', () => {
    // Enchaîner du vocabulaire sur de la grammaire serait une rupture de
    // contexte, pas la suite de ce qu'on était en train de faire.
    expect(nextLessonAfter(COURSE, 'v2-l1')).toBeNull()
  })

  it('s’arrête à la dernière leçon du cours', () => {
    expect(nextLessonAfter(COURSE, 'g1-l1')).toBeNull()
  })

  it('ignore une leçon inconnue', () => {
    expect(nextLessonAfter(COURSE, 'inexistante')).toBeNull()
  })
})

describe('recherche d’unité', () => {
  it('retrouve une unité de n’importe quelle piste', () => {
    expect(findUnit(COURSE, 'g1')?.title).toBe('g1')
    expect(findUnit(COURSE, 'v2')?.title).toBe('v2')
  })

  it('renvoie null pour une unité inconnue', () => {
    expect(findUnit(COURSE, 'inexistante')).toBeNull()
  })
})
