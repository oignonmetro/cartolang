import { describe, expect, it } from 'vitest'
import type { LibraryCourse, Unit, Vocab } from './schema'
import { findUnit } from './course'

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

describe('recherche d’unité', () => {
  it('retrouve une unité de n’importe quelle piste', () => {
    expect(findUnit(COURSE, 'g1')?.title).toBe('g1')
    expect(findUnit(COURSE, 'v2')?.title).toBe('v2')
  })

  it('renvoie null pour une unité inconnue', () => {
    expect(findUnit(COURSE, 'inexistante')).toBeNull()
  })
})
