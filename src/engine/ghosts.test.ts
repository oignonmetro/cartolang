import { describe, expect, it } from 'vitest'
import type { ConjugationVerb, GrammarPoint, PracticeItem, Vocab } from '@/content/schema'
import type { Exercise, GhostExercise, LinkId } from './exercises'
import {
  ACTIVE_COUNT,
  applyLinkResult,
  ghostsFor,
  hasLearnWork,
  isAcquired,
  isValidated,
  lessonGhostCount,
  linkMastery,
  linkResultsOf,
  linksOf,
  materializeGhost,
  type GhostOptions,
  type GhostScope,
  type GhostState,
  type LinkProgress,
} from './ghosts'
import { createCard, type CardState } from './srs'

function vocab(id: string, example = true): PracticeItem {
  const word: Vocab = {
    id,
    term: `${id}o`,
    translation: `le ${id}`,
    alt: [],
    example: example ? { text: `Veo el ${id}o hoy.`, translation: '…' } : undefined,
  }
  return { kind: 'vocab', id, vocab: word }
}

const WORDS = ['gat', 'perr', 'libr', 'cas', 'mes', 'vas', 'pat', 'tor'].map((id) => vocab(id))
const SCOPE: GhostScope = { items: WORDS, distractors: WORDS }

function options(over: Partial<GhostOptions> = {}): GhostOptions {
  return {
    mode: 'learn',
    allowIntro: true,
    activeCount: ACTIVE_COUNT,
    canSpeak: false,
    canHear: false,
    seed: 1,
    day: '2026-10-09',
    served: new Map(),
    ...over,
  }
}

const EMPTY: GhostState = { progress: {}, cards: {} }

function form(index: number, state: GhostState, over: Partial<GhostOptions> = {}, scope = SCOPE): Exercise | null {
  const ghost: GhostExercise = { kind: 'ghost', id: `ghost:${index}`, shape: index % 3 === 0 ? 'match' : 'single' }
  return materializeGhost(ghost, scope, state, options(over))
}

/** Une fiche où les liens donnés ont été réussis une fois. */
function done(...links: LinkId[]): LinkProgress[string] {
  return { presented: true, links: Object.fromEntries(links.map((link) => [link, { right: 1, wrong: 0 }])) }
}

/** Tout ce qu'un mot de `WORDS` doit réussir, sans voix. */
const ALL: LinkId[] = ['sens', 'contexte', 'production']

function subjects(exercise: Exercise | null): string[] {
  return exercise ? linkResultsOf(exercise, true, true).map((result) => result.id) : []
}

describe('liens et maîtrise', () => {
  it('donne à un mot ses quatre liens, l’oreille seulement avec une voix et le contexte avec un exemple', () => {
    expect(linksOf(vocab('a'), true)).toEqual(['sens', 'oreille', 'contexte', 'production'])
    expect(linksOf(vocab('a'), false)).toEqual(['sens', 'contexte', 'production'])
    expect(linksOf(vocab('a', false), false)).toEqual(['sens', 'production'])
  })

  it('réduit à la production un point de grammaire sans formes proposées', () => {
    const point: GrammarPoint = { id: 'p', sentence: 'Lo ___', answer: 'sé', alt: [], options: [] }
    expect(linksOf({ kind: 'grammar', id: 'p', point }, false)).toEqual(['production'])
  })

  it('exige chacun des liens, un seul ne suffit pas', () => {
    const item = WORDS[0]!
    expect(isValidated(item, done('sens', 'production'), undefined, false)).toBe(false)
    expect(isValidated(item, done(...ALL), undefined, false)).toBe(true)
    // Avec une voix, l'oreille devient exigée.
    expect(isValidated(item, done(...ALL), undefined, true)).toBe(false)
  })

  it('ne compte une bonne réponse que du premier coup, mais toute erreur', () => {
    const exercise = form(1, { progress: { gat: done('sens') }, cards: {} }, {}, { items: [WORDS[0]!], distractors: WORDS })!
    expect(linkResultsOf(exercise, true, false)[0]!.link).toBeUndefined()
    expect(linkResultsOf(exercise, false, false)[0]).toMatchObject({ correct: false })
    expect(linkResultsOf(exercise, true, true)[0]).toMatchObject({ correct: true })
  })
})

describe('lot en cours et présentations', () => {
  it('présente les éléments nouveaux un à un, dans l’ordre, jusqu’à remplir le lot', () => {
    let progress: LinkProgress = {}
    const presented: string[] = []
    for (let index = 0; index < ACTIVE_COUNT; index++) {
      const exercise = form(index, { progress, cards: {} })!
      expect(exercise.kind).toBe('intro')
      presented.push(subjects(exercise)[0]!)
      progress = { ...progress, [presented.at(-1)!]: { presented: true } }
    }
    expect(presented).toEqual(['gat', 'perr', 'libr', 'cas'])
    // Le lot est plein : on pratique au lieu de présenter.
    expect(form(ACTIVE_COUNT, { progress, cards: {} })!.kind).not.toBe('intro')
  })

  it('fait entrer un élément nouveau dès qu’un autre est maîtrisé', () => {
    const progress: LinkProgress = { gat: done(...ALL), perr: done(), libr: done(), cas: done() }
    const exercise = form(1, { progress, cards: {} })!
    expect(exercise.kind).toBe('intro')
    expect(subjects(exercise)).toEqual(['mes'])
  })

  it('ne présente rien dans une étape', () => {
    expect(form(1, EMPTY, { allowIntro: false })).toBeNull()
  })

  it('présente un verbe par son tableau entier, noté en reconnaissance', () => {
    const verb: ConjugationVerb = {
      verb: 'hablar',
      tense: 'presente',
      forms: ['hablo', 'hablas', 'habla'].map((answer, index) => ({ id: `f${index}`, person: `p${index}`, answer, alt: [] })),
    }
    const items: PracticeItem[] = verb.forms.map((f) => ({ kind: 'conjugation', id: f.id, form: f, verb }))
    const exercise = form(1, EMPTY, {}, { items, distractors: items })!
    expect(exercise.kind).toBe('conjugation-match')
    expect(exercise.ghost?.link).toBe('reconnaissance')
  })
})

describe('hasard réglé', () => {
  const learning: LinkProgress = { gat: done(), perr: done(), libr: done(), cas: done() }

  it('ne demande la production qu’après le sens', () => {
    for (let seed = 0; seed < 40; seed++) {
      const exercise = form(1, { progress: learning, cards: {} }, { seed })!
      expect(exercise.ghost?.link).toBe('sens')
    }
  })

  it('fait passer d’abord le lien pas encore réussi', () => {
    const progress: LinkProgress = { gat: done('sens', 'contexte'), perr: done(...ALL), libr: done(...ALL), cas: done(...ALL) }
    let onGat = 0
    let production = 0
    for (let seed = 0; seed < 80; seed++) {
      const exercise = form(1, { progress, cards: {} }, { seed, allowIntro: false })!
      if (subjects(exercise)[0] !== 'gat') continue
      onGat += 1
      if (exercise.ghost?.link === 'production') production += 1
    }
    // L'élément qui reste à apprendre passe avant les trois à consolider…
    expect(onGat / 80).toBeGreaterThan(0.4)
    // … et c'est son lien manquant qu'on lui demande.
    expect(production / onGat).toBeGreaterThan(0.9)
  })

  it('ne met jamais deux fois le même élément dans une manche', () => {
    for (let seed = 0; seed < 30; seed++) {
      const exercise = form(0, { progress: learning, cards: {} }, { seed })!
      const ids = subjects(exercise)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('répartit la séance au lieu de retomber sur le même élément', () => {
    const served = new Map<string, number>()
    const seen = new Set<string>()
    for (let index = 1; index < 13; index++) {
      if (index % 3 === 0) continue
      for (const id of subjects(form(index, { progress: learning, cards: {} }, { served }))) seen.add(id)
    }
    expect(seen.size).toBe(4)
  })
})

describe('consolidation', () => {
  const item = WORDS[0]!

  it('n’acquiert un élément maîtrisé qu’après des réussites sur deux jours différents', () => {
    let record = applyLinkResult(undefined, { id: 'gat', link: 'sens', correct: true, session: 's1', day: 'j1' }, undefined)
    record = applyLinkResult(record, { id: 'gat', link: 'contexte', correct: true, session: 's1', day: 'j1' }, undefined)
    record = applyLinkResult(record, { id: 'gat', link: 'production', correct: true, session: 's2', day: 'j1' }, undefined)
    expect(isValidated(item, record, undefined, false)).toBe(true)
    expect(isAcquired(item, record, undefined, false)).toBe(false)
    record = applyLinkResult(record, { id: 'gat', link: 'sens', correct: true, session: 's3', day: 'j2' }, undefined)
    expect(isAcquired(item, record, undefined, false)).toBe(true)
  })

  it('ne reprend pas en consolidation ce que la séance vient de réussir', () => {
    const progress: LinkProgress = Object.fromEntries(
      WORDS.map((word) => [word.id, { ...done(...ALL), session: '1', day: 'j1', days: 1 }]),
    )
    expect(form(1, { progress, cards: {} }, { seed: 1 })).toBeNull()
    expect(form(1, { progress, cards: {} }, { seed: 2 })).not.toBeNull()
  })

  it('passe en remise à niveau, sans rien noter, quand tout est acquis', () => {
    const progress: LinkProgress = Object.fromEntries(WORDS.map((word) => [word.id, { ...done(...ALL), days: 2 }]))
    expect(hasLearnWork(SCOPE, { progress, cards: {} }, options())).toBe(false)
    const exercise = form(1, { progress, cards: {} }, { mode: 'practice' })!
    expect(exercise.ghost?.practice).toBe(true)
    expect(linkResultsOf(exercise, true, true).every((result) => result.link === undefined)).toBe(true)
  })
})

describe('héritage des cartes de révision', () => {
  const item = WORDS[0]!
  const graduated = (interval: number): CardState => ({ ...createCard('gat', 0), step: null, interval })

  it('compte comme maîtrisé un élément dont la carte avait gradué', () => {
    expect(isValidated(item, undefined, graduated(2), true)).toBe(true)
    expect(isAcquired(item, undefined, graduated(2), true)).toBe(false)
    expect(isAcquired(item, undefined, graduated(10), true)).toBe(true)
  })

  it('fige l’héritage au premier passage, sans régresser sur une erreur', () => {
    const record = applyLinkResult(undefined, { id: 'gat', link: 'sens', correct: false }, graduated(2))
    expect(record.legacy).toBe(1)
    expect(isValidated(item, record, graduated(2), true)).toBe(true)
  })

  it('n’hérite de rien quand l’élément a été appris lien par lien', () => {
    const record = applyLinkResult(undefined, { id: 'gat' }, undefined)
    expect(isValidated(item, record, graduated(2), false)).toBe(false)
  })
})

describe('séance et bibliothèque', () => {
  it('borne le nombre de places d’une leçon', () => {
    expect(lessonGhostCount(WORDS, EMPTY, true)).toBe(4 + 8 * 5)
    expect(lessonGhostCount(WORDS.slice(0, 1), EMPTY, false)).toBe(8)
  })

  it('numérote les places et alterne manche et exercice ciblé', () => {
    expect(ghostsFor(4).map((ghost) => ghost.shape)).toEqual(['match', 'single', 'single', 'match'])
  })

  it('compte les maîtrisés et les acquis', () => {
    const progress: LinkProgress = { gat: done(...ALL), perr: { ...done(...ALL), days: 2 } }
    expect(linkMastery(WORDS, { progress, cards: {} }, false)).toMatchObject({ total: 8, seen: 2, known: 1 })
  })
})
