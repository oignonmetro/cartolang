import { describe, expect, it } from 'vitest'
import type { PathCourse, Vocab, VocabLesson } from '@/content/schema'
import { createCard, type CardState } from './srs'
import {
  buildPath,
  bumpStreak,
  dayKey,
  displayedStreak,
  isUnitComplete,
  lessonDifficulty,
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
            { kind: 'vocab', id: 'l1', title: 'A', checkpoint: false, vocab: [vocab('a')] },
            { kind: 'vocab', id: 'l2', title: 'B', checkpoint: false, vocab: [vocab('b')] },
          ],
        },
        {
          id: 'u2',
          title: 'Unité 2',
          icon: 'book',
          color: 'violet',
          kind: 'vocab',
          lessons: [{ kind: 'vocab', id: 'l3', title: 'C', checkpoint: false, vocab: [vocab('c')] }],
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

  it('débloque la suivante dès que la leçon est faite', () => {
    expect(statuses({ l1: at(1) })).toEqual(['done', 'available', 'locked'])
  })

  it('franchit les unités sans traitement particulier', () => {
    expect(statuses({ l1: at(1), l2: at(1) })).toEqual(['done', 'done', 'available'])
  })

  it('propose la première leçon jouable', () => {
    const path = buildPath(COURSE, { l1: at(1) })
    expect(nextLesson(path)?.lesson.id).toBe('l2')
  })

  it('ne propose plus rien quand tout est fait', () => {
    expect(nextLesson(buildPath(COURSE, { l1: at(1), l2: at(1), l3: at(1) }))).toBeNull()
  })

  it('reconnaît une unité terminée', () => {
    const unit = COURSE.sections[0].units[0]
    expect(isUnitComplete(unit, { l1: at(1) })).toBe(false)
    expect(isUnitComplete(unit, { l1: at(1), l2: at(1) })).toBe(true)
  })
})

describe('difficulté d’une leçon', () => {
  const LESSON: VocabLesson = {
    kind: 'vocab',
    id: 'l',
    title: 'L',
    checkpoint: false,
    vocab: ['a', 'b', 'c', 'd', 'e'].map(vocab),
  }

  /** Carte sortie d'apprentissage, avec l'intervalle voulu (en jours). */
  function seen(itemId: string, interval: number): CardState {
    return { ...createCard(itemId, 0), interval, step: null, lastReviewed: 1 }
  }

  const cardsOf = (...entries: CardState[]) => Object.fromEntries(entries.map((card) => [card.itemId, card]))

  it('reste en découverte tant qu’un élément n’a pas été vu', () => {
    const partial = cardsOf(seen('a', 1), seen('b', 1), seen('c', 1), seen('d', 1))
    expect(lessonDifficulty(LESSON, partial)).toBe(0)
    // Une carte créée mais jamais répondue ne compte pas comme vue.
    expect(lessonDifficulty(LESSON, { ...partial, e: createCard('e', 0) })).toBe(0)
  })

  it('passe en consolidation dès que tout a été vu, sans être encore su', () => {
    const all = cardsOf(...['a', 'b', 'c', 'd', 'e'].map((id) => seen(id, 1)))
    expect(lessonDifficulty(LESSON, all)).toBe(1)
  })

  it('passe en production quand 80 % des éléments tiennent au moins une semaine', () => {
    const four = ['a', 'b', 'c', 'd'].map((id) => seen(id, 7))
    expect(lessonDifficulty(LESSON, cardsOf(...four, seen('e', 1)))).toBe(2)
    // Trois sur cinq restent sous le seuil de 80 %.
    expect(lessonDifficulty(LESSON, cardsOf(...four.slice(0, 3), seen('d', 1), seen('e', 1)))).toBe(1)
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
