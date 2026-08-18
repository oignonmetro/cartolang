import { describe, expect, it } from 'vitest'
import type { LibraryCourse, Unit, Vocab } from './schema'
import { courseLabel, findUnit, groupCoursesByLanguage } from './course'
import type { ManifestEntry } from './schema'

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

function entry(partial: Partial<ManifestEntry> & Pick<ManifestEntry, 'id' | 'learning'>): ManifestEntry {
  return {
    name: 'Anglais',
    known: 'fr',
    flag: '🇬🇧',
    layout: 'library',
    status: 'available',
    default: false,
    version: 1,
    file: `${partial.id}.json`,
    itemCount: 0,
    lessonCount: 0,
    ...partial,
  }
}

describe('courseLabel', () => {
  it('compose la langue et le niveau', () => {
    expect(courseLabel({ name: 'Anglais', level: 'B1' })).toBe('Anglais B1')
  })

  it('se rabat sur la langue seule sans niveau', () => {
    expect(courseLabel({ name: 'Anglais' })).toBe('Anglais')
  })
})

describe('groupCoursesByLanguage', () => {
  it('regroupe les niveaux d’une même langue, dans l’ordre du manifeste', () => {
    const groups = groupCoursesByLanguage([
      entry({ id: 'fr-en-b1', learning: 'en', level: 'B1' }),
      entry({ id: 'fr-en-b2', learning: 'en', level: 'B2' }),
      entry({ id: 'fr-ru-a1', learning: 'ru', name: 'Russe', flag: '🇷🇺', level: 'A1' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ learning: 'en', name: 'Anglais', flag: '🇬🇧' })
    expect(groups[0].courses.map((c) => c.id)).toEqual(['fr-en-b1', 'fr-en-b2'])
    expect(groups[1]).toMatchObject({ learning: 'ru', name: 'Russe', flag: '🇷🇺' })
    expect(groups[1].courses.map((c) => c.id)).toEqual(['fr-ru-a1'])
  })

  it('place un groupe à la position de son premier cours, même entrelacé', () => {
    const groups = groupCoursesByLanguage([
      entry({ id: 'fr-en-b1', learning: 'en', level: 'B1' }),
      entry({ id: 'fr-ru-a1', learning: 'ru', name: 'Russe', flag: '🇷🇺', level: 'A1' }),
      entry({ id: 'fr-en-b2', learning: 'en', level: 'B2' }),
    ])
    expect(groups.map((g) => g.learning)).toEqual(['en', 'ru'])
    expect(groups[0].courses.map((c) => c.id)).toEqual(['fr-en-b1', 'fr-en-b2'])
  })

  it('renvoie un groupe par cours pour une seule langue', () => {
    const groups = groupCoursesByLanguage([entry({ id: 'fr-en-b1', learning: 'en', level: 'B1' })])
    expect(groups).toHaveLength(1)
    expect(groups[0].courses).toHaveLength(1)
  })

  it('ne casse rien sur une liste vide', () => {
    expect(groupCoursesByLanguage([])).toEqual([])
  })
})
