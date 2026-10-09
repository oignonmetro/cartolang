import { describe, expect, it } from 'vitest'
import type { Unit, Vocab } from '@/content/schema'
import { createCard, DAY, type CardState } from './srs'
import type { LessonProgressMap } from './progress'
import {
  buildUnitPath,
  currentDestination,
  nextNodeAfter,
  solidity,
  stepKey,
} from './unitPath'

function vocab(id: string): Vocab {
  return { id, term: id, translation: id, alt: [] }
}

function unit(id: string, lessonCount: number): Unit {
  return {
    id,
    title: id,
    icon: 'book',
    color: 'teal',
    kind: 'vocab',
    lessons: Array.from({ length: lessonCount }, (_, index) => ({
      kind: 'vocab' as const,
      id: `${id}-l${index + 1}`,
      title: `${id} leçon ${index + 1}`,
      vocab: [vocab(`${id}-w${index + 1}`)],
    })),
  }
}

const U3 = unit('v1', 3)
const U2 = unit('g1', 2)

const done: LessonProgressMap[string] = { level: 1, completions: 1, lastAt: 0, bestAccuracy: 1 }
const kinds = (nodes: ReturnType<typeof buildUnitPath>) => nodes.map((node) => node.kind)
const statuses = (nodes: ReturnType<typeof buildUnitPath>) => nodes.map((node) => node.status)

describe('composition du parcours', () => {
  it('suit chaque leçon d’une révision puis d’une consolidation alternée, et clôt par une séance finale', () => {
    expect(kinds(buildUnitPath(U3, {}, {}))).toEqual([
      'lesson',
      'review',
      'workout',
      'lesson',
      'review',
      'drill',
      'lesson',
      'review',
      'workout',
      'final',
    ])
  })

  it('alterne entraînement et approfondissement en commençant par l’entraînement', () => {
    expect(kinds(buildUnitPath(U2, {}, {}))).toEqual([
      'lesson',
      'review',
      'workout',
      'lesson',
      'review',
      'drill',
      'final',
    ])
  })

  it('regroupe chaque leçon avec sa pratique, et isole la séance finale', () => {
    expect(buildUnitPath(U2, {}, {}).map((node) => node.cycle)).toEqual([0, 0, 0, 1, 1, 1, 2])
  })
  it('laisse seules les leçons de rappel, sans révision ni consolidation', () => {
    const mixed: Unit = {
      ...U2,
      kind: 'grammar',
      lessons: [
        { kind: 'grammar', id: 'r1', title: 'Rappel', notes: 'Une règle.', points: [] },
        {
          kind: 'grammar',
          id: 'p1',
          title: 'Pratique',
          points: [{ id: 'p1-1', sentence: 'A ___ b', answer: 'x', alt: [], options: [] }],
        },
      ],
    }
    const path = buildUnitPath(mixed, {}, {})
    expect(kinds(path)).toEqual(['lesson', 'lesson', 'review', 'drill', 'final'])
    // L'indice de la leçon reste dans l'identifiant : les exercices ajoutés
    // plus tard ne renommeront pas les étapes déjà franchies.
    expect(path.map((node) => node.id)).toEqual(['r1', 'p1', 'review-1', 'consolidate-1', 'final'])
    expect(path[0].subtitle).toBe('Rappel de cours')
  })

  it('n’ajoute pas de séance finale à une unité de rappels seuls', () => {
    const reading: Unit = {
      ...U2,
      kind: 'conjugation',
      lessons: [
        { kind: 'conjugation', id: 'r1', title: 'Un', notes: 'Une règle.', verbs: [] },
        { kind: 'conjugation', id: 'r2', title: 'Deux', notes: 'Une autre.', verbs: [] },
      ],
    }
    const path = buildUnitPath(reading, { r1: done }, {})
    expect(kinds(path)).toEqual(['lesson', 'lesson'])
    expect(statuses(path)).toEqual(['done', 'available'])
  })
})

describe('destination courante d’une unité', () => {
  it('mène à la première leçon d’une unité vierge', () => {
    expect(currentDestination('v1', buildUnitPath(U3, {}, {}))).toEqual({ lessonId: 'v1-l1' })
  })

  it('mène à l’étape courante, révision ou consolidation comprise', () => {
    const path = buildUnitPath(U3, { 'v1-l1': done }, {})
    expect(currentDestination('v1', path)).toEqual({ unitId: 'v1', stepId: 'review-0' })
  })

  it('reprend la leçon suivante une fois l’étape franchie', () => {
    const path = buildUnitPath(U3, { 'v1-l1': done }, { [stepKey('v1', 'review-0')]: 1 })
    expect(currentDestination('v1', path)).toEqual({ unitId: 'v1', stepId: 'consolidate-0' })
  })

  it('retombe sur la dernière étape quand l’unité est entièrement faite', () => {
    const path = buildUnitPath(U2, {}, {}).map((node) => ({ ...node, status: 'done' as const }))
    expect(currentDestination('g1', path)).toEqual({ unitId: 'g1', stepId: 'final' })
  })

  it('ne renvoie rien pour une unité sans nœud', () => {
    expect(currentDestination('vide', [])).toBeNull()
  })
})

describe('progression dans le parcours', () => {
  it('n’ouvre que la première étape au démarrage', () => {
    expect(statuses(buildUnitPath(U2, {}, {}))).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ])
  })

  it('ouvre l’étape suivante quand la précédente est faite', () => {
    const path = buildUnitPath(U3, { 'v1-l1': done }, {})
    expect(statuses(path).slice(0, 3)).toEqual(['done', 'available', 'locked'])
  })

  it('reconnaît une étape de révision franchie', () => {
    const path = buildUnitPath(U3, { 'v1-l1': done }, {})
    expect(path[1]!.status).toBe('available')
    expect(path[2]!.status).toBe('locked')

    const opened = buildUnitPath(U3, { 'v1-l1': done }, { [stepKey('v1', path[1]!.id)]: 1 })
    expect(opened[1]!.status).toBe('done')
    expect(opened[2]!.status).toBe('available')
  })

  it('laisse une étape déjà faite accessible', () => {
    // Revenir en arrière doit rester possible : seul l'avenir est verrouillé.
    const path = buildUnitPath(U3, { 'v1-l1': done }, {})
    expect(path[0]!.status).toBe('done')
  })

  it('n’ouvre la séance finale qu’après la dernière consolidation', () => {
    const path = buildUnitPath(U2, {}, {})
    const final = path.find((node) => node.kind === 'final')!
    expect(final.status).toBe('locked')
  })
})

describe('étape suivante', () => {
  it('donne le nœud d’après, révision comprise', () => {
    const path = buildUnitPath(U3, { 'v1-l1': done }, {})
    expect(nextNodeAfter(path, 'v1-l1')?.kind).toBe('review')
  })

  it('renvoie null au bout du parcours', () => {
    const path = buildUnitPath(U3, {}, {})
    expect(nextNodeAfter(path, 'final')).toBeNull()
  })
})

describe('solidité d’une carte', () => {
  const now = Date.UTC(2026, 0, 10)

  function card(itemId: string, over: Partial<CardState>): CardState {
    return { ...createCard(itemId, 0), lastReviewed: now - DAY, step: null, interval: 10, due: now + DAY, ...over }
  }

  it('classe la carte la plus fragile en premier', () => {
    expect(solidity(card('a', { interval: 10, lapses: 0 }))).toBeGreaterThan(
      solidity(card('b', { interval: 10, lapses: 3 })),
    )
    expect(solidity(card('c', { step: 0 }))).toBe(0)
  })
})
