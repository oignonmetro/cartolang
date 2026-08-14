import { describe, expect, it } from 'vitest'
import { deflateSchedules, migrateCards, useProgress } from './progressStore'
import { createCard, DAY, review, type CardState } from '@/engine/srs'

const T0 = Date.UTC(2026, 0, 1, 9, 0)

function card(overrides: Partial<CardState>): CardState {
  return { ...createCard('w', T0), lastReviewed: T0, step: null, ...overrides }
}

describe('reprise des échéances gonflées', () => {
  it('ramène sous le seuil de production une carte planifiée trop loin', () => {
    // Une leçon suffisait à envoyer un mot à cinquante jours : il ne revenait
    // plus avant des semaines et passait pour assez mûr qu'on le réclame de
    // mémoire, alors qu'il venait d'être découvert.
    const inflated = { w: card({ interval: 50, due: T0 + 50 * DAY }) }
    const { w } = deflateSchedules(inflated, T0)
    expect(w.interval).toBe(3)
    expect(w.due).toBe(T0 + 3 * DAY)
  })

  it('conserve ce qui a été appris', () => {
    const inflated = { w: card({ interval: 50, due: T0 + 50 * DAY, ease: 1.7, lapses: 4, reps: 6 }) }
    const { w } = deflateSchedules(inflated, T0)
    expect(w.ease).toBe(1.7)
    expect(w.lapses).toBe(4)
    expect(w.reps).toBe(6)
    expect(w.itemId).toBe('w')
  })

  it('laisse tranquilles les échéances déjà raisonnables', () => {
    const sane = { a: card({ interval: 1, due: T0 + DAY }), b: card({ interval: 3, due: T0 + 3 * DAY }) }
    expect(deflateSchedules(sane, T0)).toEqual(sane)
  })

  it('ne touche pas aux cartes encore en apprentissage', () => {
    // Leurs paliers se comptent en minutes : la multiplication ne les a
    // jamais atteintes.
    const learning = { w: card({ step: 1, interval: 0, due: T0 + 600_000 }) }
    expect(deflateSchedules(learning, T0)).toEqual(learning)
  })

  it('rend immédiatement due une carte négligée depuis longtemps', () => {
    // L'échéance repart de la dernière réponse, pas de maintenant : un mot
    // laissé de côté trois semaines doit remonter tout de suite.
    const old = { w: card({ interval: 40, due: T0 + 40 * DAY, lastReviewed: T0 - 21 * DAY }) }
    const { w } = deflateSchedules(old, T0)
    expect(w.due).toBeLessThan(T0)
  })

  it('est sans effet une seconde fois', () => {
    const inflated = { w: card({ interval: 50, due: T0 + 50 * DAY }) }
    const once = deflateSchedules(inflated, T0)
    expect(deflateSchedules(once, T0)).toEqual(once)
  })

  it('laisse le calcul corrigé reconstruire un vrai calendrier', () => {
    // Le plafond n'enferme pas la carte : trois révisions espacées réussies
    // lui rendent sa maturité, et la production libre avec.
    let { w } = deflateSchedules({ w: card({ interval: 50, due: T0 + 50 * DAY }) }, T0)
    for (let i = 0; i < 3; i++) w = review(w, 'good', w.due)
    expect(w.interval).toBeGreaterThanOrEqual(7)
  })
})

describe('réglage de prononciation', () => {
  it('est activé par défaut', () => {
    expect(useProgress.getState().autoSpeak).toBe(true)
  })

  it('se coupe et revient', () => {
    useProgress.getState().setAutoSpeak(false)
    expect(useProgress.getState().autoSpeak).toBe(false)
    useProgress.getState().setAutoSpeak(true)
    expect(useProgress.getState().autoSpeak).toBe(true)
  })

  it('survit à un aller-retour export / import', () => {
    useProgress.getState().setAutoSpeak(false)
    const payload = useProgress.getState().exportSave()
    useProgress.getState().setAutoSpeak(true)
    useProgress.getState().importSave(payload)
    expect(useProgress.getState().autoSpeak).toBe(false)
  })

  it('reste activé en important une sauvegarde antérieure au réglage', () => {
    // Les formats 1 à 3 ne connaissent pas le champ : mieux vaut entendre le
    // mot que d'hériter d'un silence qu'on n'a jamais demandé.
    useProgress.getState().setAutoSpeak(false)
    useProgress.getState().importSave(JSON.stringify({ format: 3, cards: {}, lessons: {} }))
    expect(useProgress.getState().autoSpeak).toBe(true)
  })
})

describe('conversion des cartes anciennes', () => {
  it('renomme vocabId en itemId', () => {
    const migrated = migrateCards({ hello: { vocabId: 'hello', ease: 2.5, interval: 1 } })
    expect(migrated.hello.itemId).toBe('hello')
  })

  it('ignore les entrées illisibles', () => {
    expect(migrateCards({ a: null, b: 'x' } as Record<string, unknown>)).toEqual({})
  })
})
