import { describe, expect, it } from 'vitest'
import { createCard, DAY, dueCards, MINUTE, review, ratingFromAnswer, type CardState } from './srs'

const T0 = Date.UTC(2026, 0, 1, 8, 0, 0)

function graduate(card: CardState, at = T0): CardState {
  // Deux « good » suffisent à sortir des deux paliers d'apprentissage.
  const first = review(card, 'good', at)
  return review(first, 'good', at + 10 * MINUTE)
}

describe('phase d’apprentissage', () => {
  it('démarre une carte neuve au premier palier, due immédiatement', () => {
    const card = createCard('hello', T0)
    expect(card.step).toBe(0)
    expect(card.due).toBe(T0)
    expect(card.reps).toBe(0)
  })

  it('avance d’un palier sur « good »', () => {
    const card = review(createCard('hello', T0), 'good', T0)
    expect(card.step).toBe(1)
    expect(card.due).toBe(T0 + 10 * MINUTE)
  })

  it('reste sur le palier courant sur « hard »', () => {
    const first = review(createCard('hello', T0), 'good', T0)
    const second = review(first, 'hard', T0 + 10 * MINUTE)
    expect(second.step).toBe(1)
  })

  it('sort en révision après le dernier palier', () => {
    const card = graduate(createCard('hello', T0))
    expect(card.step).toBeNull()
    expect(card.interval).toBe(1)
    expect(card.reps).toBe(1)
    expect(card.due).toBe(T0 + 10 * MINUTE + DAY)
  })

  it('« easy » fait sauter directement à quatre jours', () => {
    const card = review(createCard('hello', T0), 'easy', T0)
    expect(card.step).toBeNull()
    expect(card.interval).toBe(4)
  })

  it('« again » renvoie au premier palier', () => {
    const first = review(createCard('hello', T0), 'good', T0)
    const failed = review(first, 'again', T0 + MINUTE)
    expect(failed.step).toBe(0)
    expect(failed.due).toBe(T0 + MINUTE + MINUTE)
  })
})

describe('phase de révision', () => {
  it('multiplie l’intervalle par la facilité sur « good »', () => {
    const card = graduate(createCard('hello', T0))
    const next = review(card, 'good', card.due)
    expect(next.interval).toBe(Math.round(1 * 2.5))
    expect(next.ease).toBe(2.5)
  })

  it('allonge peu et baisse la facilité sur « hard »', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const next = review(card, 'hard', card.due)
    expect(next.ease).toBeCloseTo(2.35, 5)
    expect(next.interval).toBe(12)
  })

  it('remonte la facilité sur « easy »', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const next = review(card, 'easy', card.due)
    expect(next.ease).toBeCloseTo(2.65, 5)
    expect(next.interval).toBeGreaterThan(20)
  })

  it('renvoie en apprentissage et compte une rechute sur « again »', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 30 }
    const next = review(card, 'again', card.due)
    expect(next.step).toBe(0)
    expect(next.interval).toBe(0)
    expect(next.lapses).toBe(1)
    expect(next.ease).toBeCloseTo(2.3, 5)
  })

  it('garde la facilité dans ses bornes', () => {
    // Une rechute ne coûte de la facilité qu'une fois : la carte repasse
    // ensuite en apprentissage, où l'ease n'est plus touché. On la fait donc
    // ressortir en révision entre chaque échec.
    let card = { ...graduate(createCard('hello', T0)), interval: 5 }
    for (let i = 0; i < 20; i++) {
      card = review(card, 'again', card.due)
      card = { ...graduate(card, card.due), ease: card.ease }
    }
    expect(card.ease).toBe(1.3)

    let easy = { ...graduate(createCard('world', T0)), interval: 5 }
    for (let i = 0; i < 20; i++) easy = review(easy, 'easy', easy.due)
    expect(easy.ease).toBe(2.8)
  })

  it('ne pénalise pas deux fois une carte déjà retombée en apprentissage', () => {
    const lapsed = review({ ...graduate(createCard('hello', T0)), interval: 30 }, 'again', T0 + DAY)
    const again = review(lapsed, 'again', lapsed.due)
    expect(again.ease).toBe(lapsed.ease)
    expect(again.lapses).toBe(1)
  })

  it('plafonne l’intervalle à un an', () => {
    let card = { ...graduate(createCard('hello', T0)), interval: 300 }
    card = review(card, 'easy', card.due)
    expect(card.interval).toBe(365)
  })

  it('ne modifie pas la carte reçue', () => {
    const card = createCard('hello', T0)
    const snapshot = { ...card }
    review(card, 'good', T0)
    expect(card).toEqual(snapshot)
  })
})

describe('file de révision', () => {
  it('ne retient que les cartes échues, apprentissage en tête', () => {
    const learning: CardState = { ...createCard('a', T0), due: T0 + 5 * MINUTE }
    const overdue: CardState = { ...graduate(createCard('b', T0)), due: T0 - 3 * DAY }
    const recent: CardState = { ...graduate(createCard('c', T0)), due: T0 - DAY }
    const future: CardState = { ...graduate(createCard('d', T0)), due: T0 + 5 * DAY }

    const queue = dueCards([future, recent, overdue, learning], T0 + 10 * MINUTE)
    expect(queue.map((card) => card.vocabId)).toEqual(['a', 'b', 'c'])
  })

  it('respecte la limite demandée', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => createCard(id, T0))
    expect(dueCards(cards, T0, 2)).toHaveLength(2)
  })
})

describe('notation automatique', () => {
  it('distingue la réussite du premier coup', () => {
    expect(ratingFromAnswer(true, true)).toBe('good')
    expect(ratingFromAnswer(true, false)).toBe('hard')
    expect(ratingFromAnswer(false, true)).toBe('again')
  })
})
