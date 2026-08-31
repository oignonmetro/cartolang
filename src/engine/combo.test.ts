import { describe, expect, it } from 'vitest'
import { afterAnswer, effortOf, endBuzz, NO_COMBO, thresholdFor, type Buzz, type Combo } from './combo'
import type { Exercise } from './exercises'
import type { Vocab } from '@/content/schema'

const VOCAB: Vocab = { id: 'w1', term: 'вот', translation: 'voici' } as Vocab

/** Un exercice minimal du genre demandé : seul son `kind` pèse sur l'élan. */
function exercise(kind: Exercise['kind'], extra: Record<string, unknown> = {}): Exercise {
  return { kind, id: `${kind}:1`, vocab: VOCAB, ...extra } as Exercise
}

/** Enchaîne des réponses et renvoie ce qui s'est senti, dans l'ordre. */
function run(steps: readonly { effort: number; correct: boolean }[]): (Buzz | null)[] {
  let combo: Combo = NO_COMBO
  return steps.map((step) => {
    const result = afterAnswer(combo, step.effort, step.correct)
    combo = result.combo
    return result.buzz
  })
}

describe('effort d’un exercice', () => {
  it('pèse la reconnaissance moins que la production', () => {
    expect(effortOf(exercise('choice', { cue: 'term', options: [] }))).toBe(1)
    expect(effortOf(exercise('cloze', { sentence: '…', bank: [] }))).toBe(2)
    expect(effortOf(exercise('type', { direction: 'to-learning' }))).toBe(3)
  })

  it('compte le trou de grammaire selon qu’il offre une banque de mots ou non', () => {
    const point = { id: 'g1' }
    expect(effortOf(exercise('grammar-gap', { point, bank: ['a', 'b'], cue: 'translation' }))).toBe(2)
    expect(effortOf(exercise('grammar-gap', { point, bank: null, cue: 'translation' }))).toBe(3)
  })

  it('compte une manche d’association pour la moitié de ses paires', () => {
    const pairs = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `w${index}`, left: 'a', right: 'b' }))
    expect(effortOf(exercise('match', { pairs: pairs(4) }))).toBe(2)
    expect(effortOf(exercise('match', { pairs: pairs(6) }))).toBe(3)
  })

  it('rend transparent ce qui ne se réussit ni ne se rate', () => {
    // Une règle et une découverte ne sont pas notées ; une flashcard l'est,
    // mais par l'apprenant lui-même — une série qu'on monte en cliquant
    // « je savais » ne mesurerait plus rien.
    expect(effortOf(exercise('rule', { title: 'T', notes: [], topic: 'vocab' }))).toBe(0)
    expect(effortOf(exercise('intro'))).toBe(0)
    expect(effortOf(exercise('flashcard', { direction: 'to-known' }))).toBe(0)
  })
})

describe('paliers de série', () => {
  it('espace les seuils de plus en plus', () => {
    expect([1, 2, 3, 4, 5].map(thresholdFor)).toEqual([5, 15, 30, 50, 75])
  })

  it('ne vibre qu’au franchissement, pas à chaque bonne réponse', () => {
    // Cinq exercices de production : le premier palier tombe au deuxième
    // (élan 6 ≥ 5), le deuxième au cinquième (élan 15).
    const buzzes = run(Array.from({ length: 5 }, () => ({ effort: 3, correct: true })))
    expect(buzzes).toEqual([null, 'light', null, null, 'medium'])
  })

  it('monte plus vite sur les exercices exigeants que sur les faciles', () => {
    const easy = run(Array.from({ length: 5 }, () => ({ effort: 1, correct: true })))
    const hard = run(Array.from({ length: 5 }, () => ({ effort: 3, correct: true })))
    expect(easy.filter(Boolean)).toEqual(['light'])
    expect(hard.filter(Boolean)).toEqual(['light', 'medium'])
  })

  it('plafonne l’intensité au troisième palier, faute de plus fort à offrir', () => {
    // Élan 90 sur trente exercices : cinq paliers franchis, et les trois
    // derniers se sentent pareil.
    const buzzes = run(Array.from({ length: 30 }, () => ({ effort: 3, correct: true })))
    expect(buzzes.filter(Boolean)).toEqual(['light', 'medium', 'heavy', 'heavy', 'heavy'])
  })
})

describe('rupture de série', () => {
  it('ne signale une faute que si elle casse une série déjà installée', () => {
    // La première faute arrive avant tout palier : rien à sentir, l'écran le
    // dit déjà. La seconde casse un palier acquis.
    const buzzes = run([
      { effort: 3, correct: true },
      { effort: 3, correct: false },
      { effort: 3, correct: true },
      { effort: 3, correct: true },
      { effort: 3, correct: false },
    ])
    expect(buzzes).toEqual([null, null, null, 'light', 'rising'])
  })

  it('repart de zéro après une faute', () => {
    let combo: Combo = NO_COMBO
    for (const correct of [true, true, true, false]) {
      combo = afterAnswer(combo, 3, correct).combo
    }
    expect(combo).toEqual(NO_COMBO)
  })

  it('laisse passer sans rien changer ce qui ne pèse rien', () => {
    const before: Combo = { momentum: 7, tier: 1 }
    // Une flashcard déclarée ratée ne doit pas casser la série : c'est un
    // aveu d'ignorance, pas une faute.
    expect(afterAnswer(before, 0, false)).toEqual({ combo: before, buzz: null })
    expect(afterAnswer(before, 0, true)).toEqual({ combo: before, buzz: null })
  })
})

describe('fin de session', () => {
  it('réserve le motif à deux temps à la session sans faute', () => {
    expect(endBuzz({ correct: 12, total: 12 })).toBe('falling')
    expect(endBuzz({ correct: 11, total: 12 })).toBe('heavy')
  })

  it('ne vibre pas sur une session ratée', () => {
    // 50 % : sous la barre des 70 %. L'écran de résultat est déjà assez
    // explicite, inutile d'en remettre une couche dans la main.
    expect(endBuzz({ correct: 6, total: 12 })).toBeNull()
  })

  it('ne vibre pas quand rien n’a été noté', () => {
    expect(endBuzz({ correct: 0, total: 0 })).toBeNull()
  })
})
