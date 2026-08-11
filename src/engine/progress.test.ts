import { describe, expect, it } from 'vitest'
import type { PathCourse, Vocab } from '@/content/schema'
import {
  buildPath,
  bumpStreak,
  dayKey,
  displayedStreak,
  isUnitComplete,
  levelFromXp,
  nextLesson,
  xpFor,
  type LessonProgressMap,
} from './progress'

function vocab(id: string): Vocab {
  return { id, term: id, translation: id, alt: [] }
}

const COURSE: PathCourse = {
  id: 'fr-en',
  name: 'Anglais',
  learning: 'en',
  known: 'fr',
  flag: '🇬🇧',
  status: 'available',
  default: false,
  version: 1,
  layout: 'path',
  sections: [
    {
      id: 's1',
      title: 'Section 1',
      units: [
        {
          id: 'u1',
          title: 'Unité 1',
          icon: 'book',
          color: 'teal',
          kind: 'vocab',
          lessons: [
            { kind: 'vocab', id: 'l1', title: 'A', vocab: [vocab('a')] },
            { kind: 'vocab', id: 'l2', title: 'B', vocab: [vocab('b')] },
          ],
        },
        {
          id: 'u2',
          title: 'Unité 2',
          icon: 'book',
          color: 'violet',
          kind: 'vocab',
          lessons: [{ kind: 'vocab', id: 'l3', title: 'C', vocab: [vocab('c')] }],
        },
      ],
    },
  ],
}

const statuses = (progress: LessonProgressMap) => buildPath(COURSE, progress).map((node) => node.status)

function at(level: number): LessonProgressMap[string] {
  return { level, completions: level, lastAt: 0, bestAccuracy: 1 }
}

describe('chemin', () => {
  it('n’ouvre que la première leçon au démarrage', () => {
    expect(statuses({})).toEqual(['available', 'locked', 'locked'])
  })

  it('débloque la suivante dès la première étoile', () => {
    expect(statuses({ l1: at(1) })).toEqual(['partial', 'available', 'locked'])
  })

  it('marque une leçon maîtrisée à trois étoiles', () => {
    expect(statuses({ l1: at(3) })).toEqual(['mastered', 'available', 'locked'])
  })

  it('franchit les unités sans traitement particulier', () => {
    expect(statuses({ l1: at(1), l2: at(2) })).toEqual(['partial', 'partial', 'available'])
  })

  it('propose la première leçon jouable', () => {
    const path = buildPath(COURSE, { l1: at(3) })
    expect(nextLesson(path)?.lesson.id).toBe('l2')
  })

  it('ne propose plus rien quand tout est maîtrisé', () => {
    expect(nextLesson(buildPath(COURSE, { l1: at(3), l2: at(3), l3: at(3) }))).toBeNull()
  })

  it('reconnaît une unité terminée', () => {
    const unit = COURSE.sections[0].units[0]
    expect(isUnitComplete(unit, { l1: at(1) })).toBe(false)
    expect(isUnitComplete(unit, { l1: at(1), l2: at(1) })).toBe(true)
  })
})

describe('XP et niveaux', () => {
  it('récompense la session réussie et le sans-faute', () => {
    expect(xpFor({ correct: 8, total: 10 }, true)).toBe(13)
    expect(xpFor({ correct: 10, total: 10 }, true)).toBe(20)
  })

  it('donne un lot de consolation quand la session échoue', () => {
    expect(xpFor({ correct: 4, total: 10 }, false)).toBe(2)
    expect(xpFor({ correct: 0, total: 10 }, false)).toBe(1)
  })

  it('découpe la courbe de niveaux', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, span: 100 })
    expect(levelFromXp(99)).toEqual({ level: 1, into: 99, span: 100 })
    expect(levelFromXp(100)).toEqual({ level: 2, into: 0, span: 150 })
    expect(levelFromXp(260)).toEqual({ level: 3, into: 10, span: 200 })
  })
})

describe('série de jours', () => {
  const day = (iso: string) => dayKey(new Date(`${iso}T10:00:00`).getTime())

  it('démarre à un', () => {
    expect(bumpStreak({ current: 0, best: 0, lastDay: null }, day('2026-03-01'))).toEqual({
      current: 1,
      best: 1,
      lastDay: '2026-03-01',
    })
  })

  it('s’allonge d’un jour à l’autre', () => {
    const first = bumpStreak({ current: 0, best: 0, lastDay: null }, day('2026-03-01'))
    expect(bumpStreak(first, day('2026-03-02')).current).toBe(2)
  })

  it('ne compte qu’une fois par jour', () => {
    const first = bumpStreak({ current: 3, best: 5, lastDay: '2026-03-01' }, day('2026-03-01'))
    expect(first.current).toBe(3)
  })

  it('repart à un après un jour manqué et garde le record', () => {
    const broken = bumpStreak({ current: 7, best: 7, lastDay: '2026-03-01' }, day('2026-03-03'))
    expect(broken).toEqual({ current: 1, best: 7, lastDay: '2026-03-03' })
  })

  it('franchit un changement de mois', () => {
    const end = bumpStreak({ current: 4, best: 4, lastDay: '2026-03-31' }, day('2026-04-01'))
    expect(end.current).toBe(5)
  })

  it('affiche zéro quand la série est déjà rompue', () => {
    const streak = { current: 9, best: 9, lastDay: '2026-03-01' }
    expect(displayedStreak(streak, '2026-03-02')).toBe(9)
    expect(displayedStreak(streak, '2026-03-03')).toBe(0)
  })
})
