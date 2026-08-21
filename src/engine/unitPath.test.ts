import { describe, expect, it } from 'vitest'
import type { ItemLocation } from '@/content/course'
import { indexItems } from '@/content/course'
import type { LibraryCourse, Unit, Vocab } from '@/content/schema'
import { createCard, DAY, type CardState } from './srs'
import type { LessonProgressMap } from './progress'
import {
  buildUnitPath,
  checkpointTestVocab,
  consolidationEntries,
  mistakesAllowed,
  nextNodeAfter,
  pathBefore,
  sectionRank,
  solidity,
  stepKey,
} from './unitPath'

function vocab(id: string): Vocab {
  return { id, term: id, translation: id, alt: [] }
}

function unit(id: string, lessonCount: number, checkpoints: readonly number[] = []): Unit {
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
      checkpoint: checkpoints.includes(index + 1),
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
})

describe('checkpoints du parcours', () => {
  const withCheckpoint = unit('c1', 3, [2])

  it('marque le nœud d’une leçon checkpoint, et lui seul', () => {
    const path = buildUnitPath(withCheckpoint, {}, {})
    const lessonNodes = path.filter((node) => node.kind === 'lesson')
    expect(lessonNodes.map((node) => node.checkpoint)).toEqual([false, true, false])
  })

  it('n’en marque aucun sans checkpoint déclaré', () => {
    const path = buildUnitPath(U3, {}, {})
    expect(path.every((node) => !node.checkpoint)).toBe(true)
    expect(path.every((node) => node.checkpointLabel === null)).toBe(true)
  })

  it('déduit le libellé du checkpoint des mots de sa leçon, pas d’un champ séparé', () => {
    const path = buildUnitPath(withCheckpoint, {}, {})
    const checkpoint = path.find((node) => node.checkpoint)!
    expect(checkpoint.checkpointLabel).toBe('c1-w2')
  })

  it('ne donne de libellé qu’au nœud checkpoint, jamais aux étapes qui l’entourent', () => {
    const path = buildUnitPath(withCheckpoint, {}, {})
    const others = path.filter((node) => !node.checkpoint)
    expect(others.every((node) => node.checkpointLabel === null)).toBe(true)
  })
})

describe('test de passage d’un checkpoint', () => {
  /**
   * Une unité d'alphabet, bâtie comme le russe : chaque section enseigne des
   * lettres, puis des mots composés de ces lettres. Toutes les sections sauf
   * la première ouvrent sur un checkpoint.
   */
  const letters = (ids: string[]): Vocab[] => ids.map((id) => ({ ...vocab(id), pos: 'lettre' as const }))
  const section = (rank: number, ids: string[]) => [
    {
      kind: 'vocab' as const,
      id: `s${rank}-lettres`,
      title: `Lettres ${rank}`,
      checkpoint: rank > 1,
      vocab: letters(ids),
    },
    {
      kind: 'vocab' as const,
      id: `s${rank}-mots`,
      title: `Mots ${rank}`,
      checkpoint: false,
      vocab: [vocab(`mot${rank}`)],
    },
  ]
  const ALPHABET: Unit = {
    id: 'alpha',
    title: 'alpha',
    icon: 'book',
    color: 'teal',
    kind: 'vocab',
    lessons: [
      ...section(1, ['а', 'к']),
      ...section(2, ['в', 'н']),
      ...section(3, ['б', 'д']),
      ...section(4, ['г', 'ж']),
    ],
  }
  const terms = (unit: Unit, id: string) => checkpointTestVocab(unit, id).map((word) => word.term)

  it('n’interroge que sur la section d’avant quand il n’y en a qu’une', () => {
    expect(terms(ALPHABET, 's2-lettres')).toEqual(['а', 'к'])
  })

  it('interroge sur les deux sections précédentes dès qu’elles existent', () => {
    expect(terms(ALPHABET, 's3-lettres')).toEqual(['а', 'к', 'в', 'н'])
  })

  it('ne remonte jamais plus haut que les deux sections précédentes', () => {
    // Sauter à la section 4 se mérite sur les sections 2 et 3 : redemander
    // l'alphabet entier depuis le début ferait du dernier checkpoint le plus
    // dur à franchir, alors que c'est le plus loin dans le parcours.
    expect(terms(ALPHABET, 's4-lettres')).toEqual(['в', 'н', 'б', 'д'])
  })

  it('écarte les mots pour ne garder que les lettres', () => {
    // Un mot mobilise en plus un lexique qu'on ne prétend pas connaître en
    // sautant l'alphabet : le rater ne dirait rien de la lecture.
    expect(terms(ALPHABET, 's3-lettres')).not.toContain('mot1')
    expect(terms(ALPHABET, 's3-lettres')).not.toContain('mot2')
  })

  it('ne teste rien sur une leçon qui n’ouvre pas de section', () => {
    expect(checkpointTestVocab(ALPHABET, 's2-mots')).toEqual([])
    expect(checkpointTestVocab(ALPHABET, 's1-lettres')).toEqual([])
  })

  it('retombe sur tout le vocabulaire quand la matière n’a pas de lettres', () => {
    // Filet pour une future unité sans alphabet : mieux vaut un test sur les
    // mots qu'un checkpoint qui s'ouvrirait sans rien demander.
    expect(terms(unit('v1', 4, [3]), 'v1-l3')).toEqual(['v1-w1', 'v1-w2'])
  })

  it('tolère un quart des fautes, entre une et trois', () => {
    expect(mistakesAllowed(16)).toBe(3)
    expect(mistakesAllowed(12)).toBe(3)
    expect(mistakesAllowed(8)).toBe(2)
    // Plancher : refuser le saut sur une seule erreur d'un test très court
    // serait décourageant plus qu'exigeant.
    expect(mistakesAllowed(3)).toBe(1)
  })

  it('rassemble tout ce qui précède un nœud, leçons et étapes', () => {
    const path = buildUnitPath(U3, {}, {})
    expect(pathBefore('v1', path, 'v1-l2')).toEqual({
      lessonIds: ['v1-l1'],
      stepIds: [stepKey('v1', 'review-0'), stepKey('v1', 'consolidate-0')],
    })
  })

  it('ne renvoie rien avant le premier nœud, ni pour un nœud inconnu', () => {
    const path = buildUnitPath(U3, {}, {})
    expect(pathBefore('v1', path, 'v1-l1')).toEqual({ lessonIds: [], stepIds: [] })
    expect(pathBefore('v1', path, 'inconnu')).toEqual({ lessonIds: [], stepIds: [] })
  })
})

describe('rang d’une leçon dans sa section', () => {
  // Trois sections de deux leçons, comme « Lire le russe » : des lettres, puis
  // des mots faits de ces lettres, et un checkpoint ouvre la suivante.
  const ALPHA = unit('a', 6, [3, 5])
  const ranks = (u: Unit) => u.lessons.map((lesson) => sectionRank(u, lesson.id))

  it('repart de zéro à chaque checkpoint', () => {
    expect(ranks(ALPHA)).toEqual([0, 1, 0, 1, 0, 1])
  })

  it('compte d’un bout à l’autre d’une unité sans checkpoint', () => {
    expect(ranks(unit('b', 4))).toEqual([0, 1, 2, 3])
  })

  it('retombe sur le plancher pour une leçon étrangère à l’unité', () => {
    expect(sectionRank(ALPHA, 'inconnue')).toBe(0)
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
