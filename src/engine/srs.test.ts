import { describe, expect, it } from 'vitest'
import {
  CONFIRM_STREAK,
  createCard,
  DAY,
  dueCards,
  isFragile,
  LAPSE_WINDOW,
  MINUTE,
  review,
  ratingFromAnswer,
  type CardState,
} from './srs'

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

  it('réduit l’intervalle à une fraction du précédent et compte une rechute sur « again »', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 30 }
    const next = review(card, 'again', card.due)
    expect(next.step).toBeNull()
    expect(next.interval).toBe(9)
    expect(next.due).toBe(card.due + 9 * DAY)
    expect(next.lapses).toBe(1)
    expect(next.ease).toBeCloseTo(2.3, 5)
  })

  it('garde la facilité dans ses bornes', () => {
    let card = { ...graduate(createCard('hello', T0)), interval: 5 }
    for (let i = 0; i < 20; i++) card = review(card, 'again', card.due)
    expect(card.ease).toBe(1.3)

    let easy = { ...graduate(createCard('world', T0)), interval: 5 }
    for (let i = 0; i < 20; i++) easy = review(easy, 'easy', easy.due)
    expect(easy.ease).toBe(2.8)
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

describe('révision anticipée', () => {
  it('n’allonge pas l’échéance d’une carte pas encore échue', () => {
    // Régression : une leçon enchaîne le même mot en présentation, en
    // association, en QCM puis en phrase à trou. Chaque passage comptait
    // pour une révision réussie et multipliait l'intervalle, si bien qu'un
    // mot découvert quatre minutes plus tôt ressortait planifié à cinquante
    // jours — et tout ce qui jugeait ensuite de sa maturité était trompé.
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const next = review(card, 'good', card.due - 2 * DAY)
    expect(next.interval).toBe(10)
    expect(next.due).toBe(card.due)
    expect(next.reps).toBe(card.reps)
    expect(next.ease).toBe(card.ease)
  })

  it('enregistre tout de même la réponse', () => {
    // Sans quoi la carte passerait pour jamais rencontrée : c'est ce drapeau
    // qui la fait entrer dans les étapes de consolidation.
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const early = card.due - 2 * DAY
    expect(review(card, 'good', early).lastReviewed).toBe(early)
  })

  it('compte quand même l’échec', () => {
    // Oublier un mot qu'on vient de voir est une information : la carte
    // revient plus vite même si son échéance était encore loin.
    const card = { ...graduate(createCard('hello', T0)), interval: 30 }
    const next = review(card, 'again', card.due - 10 * DAY)
    expect(next.step).toBeNull()
    expect(next.lapses).toBe(1)
    expect(next.interval).toBe(9)
  })

  it('reprend sa progression une fois l’échéance atteinte', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const held = review(card, 'good', card.due - 2 * DAY)
    const due = review(held, 'good', held.due)
    expect(due.interval).toBe(25)
    expect(due.reps).toBe(card.reps + 1)
  })

  it('laisse la phase d’apprentissage se terminer dans la séance', () => {
    // Les paliers courts sont faits pour être franchis le jour même : les
    // bloquer empêcherait toute carte de graduer pendant sa leçon.
    const card = createCard('hello', T0)
    const first = review(card, 'good', T0)
    expect(first.step).toBe(1)
    // Réponse donnée trente secondes plus tard, bien avant le palier de dix minutes.
    const second = review(first, 'good', T0 + 30_000)
    expect(second.step).toBeNull()
    expect(second.interval).toBe(1)
  })
})

describe('file de révision', () => {
  it('ne retient que les cartes échues, apprentissage en tête', () => {
    const learning: CardState = { ...createCard('a', T0), due: T0 + 5 * MINUTE }
    const overdue: CardState = { ...graduate(createCard('b', T0)), due: T0 - 3 * DAY }
    const recent: CardState = { ...graduate(createCard('c', T0)), due: T0 - DAY }
    const future: CardState = { ...graduate(createCard('d', T0)), due: T0 + 5 * DAY }

    const queue = dueCards([future, recent, overdue, learning], T0 + 10 * MINUTE)
    expect(queue.map((card) => card.itemId)).toEqual(['a', 'b', 'c'])
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

describe('fragilité et révision tardive', () => {
  it('ne compte pas l’échec au tout premier essai d’une carte neuve', () => {
    const failed = review(createCard('hello', T0), 'again', T0)
    expect(failed.lapses).toBe(0)
    expect(isFragile(failed)).toBe(false)
  })

  it('garde la trace d’une carte ratée encore pendant l’apprentissage', () => {
    // Régression : ratée trois fois dans sa première leçon puis réussie, une
    // carte sortait de l'apprentissage dans le même état qu'une carte sue du
    // premier coup, sa fragilité oubliée.
    let card = createCard('hello', T0)
    for (let i = 0; i < 3; i++) card = review(card, 'again', T0 + i * MINUTE)
    card = review(card, 'hard', T0 + 4 * MINUTE)
    card = review(card, 'good', T0 + DAY)
    card = review(card, 'good', T0 + DAY + 10 * MINUTE)
    expect(card.step).toBeNull()
    expect(card.lapses).toBe(1)
    expect(card.ease).toBeCloseTo(2.3, 5)
    expect(isFragile(card)).toBe(true)
  })

  it('ne compte qu’une rechute pour plusieurs échecs dans la même séance', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const at = card.due
    let next = review(card, 'again', at)
    next = review(next, 'again', at + 2 * MINUTE)
    next = review(next, 'again', at + 4 * MINUTE)
    expect(next.lapses).toBe(1)
    expect(next.ease).toBeCloseTo(2.3, 5)
    expect(next.interval).toBe(3)
    expect(next.due).toBe(at + 3 * DAY)
  })

  it('compte une nouvelle rechute dans une séance ultérieure', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const first = review(card, 'again', card.due)
    const second = review(first, 'again', card.due + LAPSE_WINDOW)
    expect(second.lapses).toBe(2)
  })

  it('ne prend pas la reprise réussie dans la séance pour une maîtrise', () => {
    const card = { ...graduate(createCard('hello', T0)), interval: 10 }
    const failed = review(card, 'again', card.due)
    const retried = review(failed, 'hard', card.due + 2 * MINUTE)
    expect(retried.steady).toBe(0)
    expect(isFragile(retried)).toBe(true)
  })

  it('juge la maîtrise durable après plusieurs révisions tardives réussies, et rend une part de la facilité', () => {
    let card: CardState = { ...graduate(createCard('hello', T0)), interval: 10 }
    card = review(card, 'again', card.due)
    expect(card.ease).toBeCloseTo(2.3, 5)
    for (let i = 1; i < CONFIRM_STREAK; i++) {
      card = review(card, 'good', card.due)
      expect(isFragile(card)).toBe(true)
    }
    card = review(card, 'good', card.due)
    expect(isFragile(card)).toBe(false)
    expect(card.ease).toBeCloseTo(2.4, 5)
    // Une nouvelle rechute la rend de nouveau fragile.
    card = review(card, 'again', card.due)
    expect(isFragile(card)).toBe(true)
    expect(card.lapses).toBe(2)
  })

  it('ne fait jamais baisser la facilité en confirmant la maîtrise', () => {
    let card: CardState = { ...graduate(createCard('hello', T0)), interval: 10, ease: 2.8 }
    card = review(card, 'again', card.due)
    card = review(card, 'easy', card.due)
    const before = card.ease
    for (let i = 1; i < CONFIRM_STREAK; i++) card = review(card, 'good', card.due)
    expect(card.ease).toBeGreaterThanOrEqual(before)
  })
})
