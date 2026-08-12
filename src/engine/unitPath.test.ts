import { describe, expect, it } from 'vitest'
import type { ItemLocation } from '@/content/course'
import { indexItems } from '@/content/course'
import type { LibraryCourse, Unit, Vocab } from '@/content/schema'
import { createCard, DAY, type CardState } from './srs'
import type { LessonProgressMap } from './progress'
import { buildUnitPath, consolidationEntries, nextNodeAfter, solidity, stepKey } from './unitPath'

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
    { id: 'vocabulaire', title: 'Vocabulaire', kind: 'vocab', color: 'teal', icon: 'book', units: [U3] },
    { id: 'grammaire', title: 'Grammaire', kind: 'vocab', color: 'violet', icon: 'compass', units: [U2] },
  ],
}

const done: LessonProgressMap[string] = { level: 1, completions: 1, lastAt: 0, bestAccuracy: 1 }
const kinds = (nodes: ReturnType<typeof buildUnitPath>) => nodes.map((node) => node.kind)
const statuses = (nodes: ReturnType<typeof buildUnitPath>) => nodes.map((node) => node.status)

describe('composition du parcours', () => {
  it('intercale une révision toutes les deux leçons, puis clôt par approfondissement et entraînement', () => {
    expect(kinds(buildUnitPath(U3, {}, {}))).toEqual([
      'lesson',
      'lesson',
      'review',
      'lesson',
      'review',
      'drill',
      'workout',
    ])
  })

  it('n’ajoute pas de révision finale quand la dernière leçon vient d’en déclencher une', () => {
    expect(kinds(buildUnitPath(U2, {}, {}))).toEqual(['lesson', 'lesson', 'review', 'drill', 'workout'])
  })
})

describe('progression dans le parcours', () => {
  it('n’ouvre que la première étape au démarrage', () => {
    expect(statuses(buildUnitPath(U3, {}, {}))).toEqual([
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
    const progress = { 'v1-l1': done, 'v1-l2': done }
    const locked = buildUnitPath(U3, progress, {})
    expect(locked[2]!.status).toBe('available')
    expect(locked[3]!.status).toBe('locked')

    const opened = buildUnitPath(U3, progress, { [stepKey('v1', locked[2]!.id)]: 1 })
    expect(opened[2]!.status).toBe('done')
    expect(opened[3]!.status).toBe('available')
  })

  it('laisse une étape déjà faite accessible', () => {
    // Revenir en arrière doit rester possible : seul l'avenir est verrouillé.
    const path = buildUnitPath(U3, { 'v1-l1': done }, {})
    expect(path[0]!.status).toBe('done')
  })
})

describe('étape suivante', () => {
  it('donne le nœud d’après, révision comprise', () => {
    const path = buildUnitPath(U3, { 'v1-l1': done, 'v1-l2': done }, {})
    expect(nextNodeAfter(path, 'v1-l2')?.kind).toBe('review')
  })

  it('renvoie null au bout du parcours', () => {
    const path = buildUnitPath(U3, {}, {})
    expect(nextNodeAfter(path, 'workout')).toBeNull()
  })
})

describe('sélection des éléments à consolider', () => {
  const itemsById: Map<string, ItemLocation> = indexItems(COURSE)
  const now = Date.UTC(2026, 0, 10)
  const unitItemIds = ['v1-w1', 'v1-w2', 'v1-w3']

  function card(itemId: string, over: Partial<CardState>): CardState {
    return { ...createCard(itemId, 0), lastReviewed: now - DAY, step: null, interval: 10, due: now + DAY, ...over }
  }

  it('classe la carte la plus fragile en premier', () => {
    // Même intervalle affiché, mais l'une a rechuté trois fois.
    expect(solidity(card('a', { interval: 10, lapses: 0 }))).toBeGreaterThan(
      solidity(card('b', { interval: 10, lapses: 3 })),
    )
    // Une carte encore en apprentissage n'a rien d'acquis.
    expect(solidity(card('c', { step: 0 }))).toBe(0)
  })

  it('ignore ce qui n’a jamais été répondu', () => {
    const cards = { 'v1-w1': card('v1-w1', { lastReviewed: null, step: 0 }) }
    expect(consolidationEntries(cards, itemsById, { scope: 'unit', unitItemIds, now, limit: 10 })).toEqual([])
  })

  it('sert d’abord les cartes échues', () => {
    const cards = {
      'v1-w1': card('v1-w1', { due: now + 5 * DAY }),
      'v1-w2': card('v1-w2', { due: now - 3 * DAY }),
      'v1-w3': card('v1-w3', { due: now + 2 * DAY }),
    }
    const picked = consolidationEntries(cards, itemsById, { scope: 'unit', unitItemIds, now, limit: 10 })
    expect(picked[0]!.item.id).toBe('v1-w2')
  })

  it('complète avec les plus fragiles quand rien n’est échu', () => {
    const cards = {
      'v1-w1': card('v1-w1', { due: now + 5 * DAY, interval: 30 }),
      'v1-w2': card('v1-w2', { due: now + 5 * DAY, interval: 30, lapses: 4 }),
      'v1-w3': card('v1-w3', { due: now + 5 * DAY, interval: 2 }),
    }
    const picked = consolidationEntries(cards, itemsById, { scope: 'unit', unitItemIds, now, limit: 2 })
    // w3 (intervalle 2) puis w2 (30 mais quatre rechutes) ; w1 est le plus solide.
    expect(picked.map((entry) => entry.item.id)).toEqual(['v1-w3', 'v1-w2'])
  })

  it('reste dans l’unité en portée « unit », l’ouvre en portée « course »', () => {
    const cards = {
      'v1-w1': card('v1-w1', { due: now + 5 * DAY }),
      'g1-w1': card('g1-w1', { due: now - 2 * DAY }),
    }
    const inUnit = consolidationEntries(cards, itemsById, { scope: 'unit', unitItemIds, now, limit: 10 })
    expect(inUnit.map((entry) => entry.item.id)).toEqual(['v1-w1'])

    // Portée cours : l'élément échu d'une autre unité passe devant, ce qui est
    // tout l'intérêt de l'étape d'entraînement.
    const wide = consolidationEntries(cards, itemsById, { scope: 'course', unitItemIds, now, limit: 10 })
    expect(wide[0]!.item.id).toBe('g1-w1')
    expect(wide).toHaveLength(2)
  })

  it('respecte le plafond', () => {
    const cards = Object.fromEntries(unitItemIds.map((id) => [id, card(id, { due: now - DAY })]))
    expect(consolidationEntries(cards, itemsById, { scope: 'unit', unitItemIds, now, limit: 2 })).toHaveLength(2)
  })
})
