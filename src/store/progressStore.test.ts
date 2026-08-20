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

describe('progression isolée par cours', () => {
  // Plusieurs cours réutilisent les mêmes identifiants de leçon et d'unité
  // (chaque piste suit le même gabarit d'un niveau à l'autre) : sans cette
  // isolation, terminer « v1-l1 » en B1 le marquait fait en B2 et en C1.
  it('ne fait pas déborder une leçon terminée d’un cours à l’autre', () => {
    useProgress.getState().reset()
    useProgress.getState().finishLesson('fr-en-b1', 'v1-l1', { correct: 4, total: 4 })
    expect(useProgress.getState().lessons['fr-en-b1']?.['v1-l1']?.level).toBe(1)
    expect(useProgress.getState().lessons['fr-en-b2']?.['v1-l1']).toBeUndefined()
  })

  it('ne fait pas déborder une carte de révision d’un cours à l’autre', () => {
    useProgress.getState().reset()
    useProgress.getState().gradeItem('fr-en-b1', 'v1-word', 'good', Date.UTC(2026, 0, 1))
    expect(useProgress.getState().cards['fr-en-b1']?.['v1-word']).toBeDefined()
    expect(useProgress.getState().cards['fr-en-b2']?.['v1-word']).toBeUndefined()
  })

  it('ne fait pas déborder une étape de parcours d’un cours à l’autre', () => {
    useProgress.getState().reset()
    useProgress.getState().finishStep('fr-en-b1', 'v1:review-0', { correct: 3, total: 3 })
    expect(useProgress.getState().steps['fr-en-b1']?.['v1:review-0']).toBe(1)
    expect(useProgress.getState().steps['fr-en-b2']?.['v1:review-0']).toBeUndefined()
  })

  it('compte les passages séparément pour chaque cours', () => {
    useProgress.getState().reset()
    useProgress.getState().finishLesson('fr-en-b1', 'v1-l1', { correct: 4, total: 4 })
    useProgress.getState().finishLesson('fr-en-b2', 'v1-l1', { correct: 2, total: 4 })
    expect(useProgress.getState().lessons['fr-en-b1']?.['v1-l1']?.level).toBe(1)
    // Échouée en B2 : niveau resté à 0, sans toucher au niveau acquis en B1.
    expect(useProgress.getState().lessons['fr-en-b2']?.['v1-l1']?.level).toBe(0)
  })
})

describe('saut vers un checkpoint du parcours', () => {
  it('acquiert plusieurs leçons d’un coup, sans créer la moindre carte de révision', () => {
    useProgress.getState().reset()
    useProgress.getState().skipTo('fr-ru-a1', ['u1-l1', 'u1-l2'], ['u1:review-0'])
    expect(useProgress.getState().lessons['fr-ru-a1']?.['u1-l1']?.level).toBe(1)
    expect(useProgress.getState().lessons['fr-ru-a1']?.['u1-l2']?.level).toBe(1)
    expect(useProgress.getState().steps['fr-ru-a1']?.['u1:review-0']).toBe(1)
    expect(useProgress.getState().cards['fr-ru-a1'] ?? {}).toEqual({})
  })

  it('ne redescend pas une leçon déjà acquise en la sautant', () => {
    useProgress.getState().reset()
    useProgress.getState().finishLesson('fr-ru-a1', 'u1-l1', { correct: 4, total: 4 })
    const before = useProgress.getState().lessons['fr-ru-a1']!['u1-l1']!
    useProgress.getState().skipTo('fr-ru-a1', ['u1-l1'], [])
    expect(useProgress.getState().lessons['fr-ru-a1']!['u1-l1']).toEqual(before)
  })

  it('reste isolé par cours, comme les autres actions de progression', () => {
    useProgress.getState().reset()
    useProgress.getState().skipTo('fr-ru-a1', ['u1-l1'], ['u1:review-0'])
    expect(useProgress.getState().lessons['fr-en-b1']?.['u1-l1']).toBeUndefined()
    expect(useProgress.getState().steps['fr-en-b1']?.['u1:review-0']).toBeUndefined()
  })

  it('marque une seule étape franchie sans exiger de résultat de session (révision devenue vide)', () => {
    useProgress.getState().reset()
    useProgress.getState().skipTo('fr-ru-a1', [], ['u1:review-0'])
    expect(useProgress.getState().steps['fr-ru-a1']?.['u1:review-0']).toBe(1)
    expect(useProgress.getState().lessons['fr-ru-a1'] ?? {}).toEqual({})
  })
})

describe('conversion d’une sauvegarde antérieure au format 5', () => {
  // `localStorage` est absent de l'environnement de test (`legacyCourseId`
  // s'y replie sur 'legacy') : la sauvegarde à plat doit se retrouver
  // intégralement sous ce cours, et nulle part ailleurs.
  it('range les leçons, cartes et étapes à plat sous un seul cours', () => {
    useProgress.getState().reset()
    useProgress.getState().importSave(
      JSON.stringify({
        format: 4,
        lessons: { 'v1-l1': { level: 1, completions: 1, lastAt: 0, bestAccuracy: 1 } },
        cards: { 'v1-word': { itemId: 'v1-word', ease: 2.5, interval: 1, step: null, lapses: 0, reps: 1, due: 0, lastReviewed: 0 } },
        steps: { 'v1:review-0': 2 },
      }),
    )
    const state = useProgress.getState()
    expect(state.lessons.legacy?.['v1-l1']?.level).toBe(1)
    expect(state.cards.legacy?.['v1-word']).toBeDefined()
    expect(state.steps.legacy?.['v1:review-0']).toBe(2)
  })

  it('laisse un cours vide plutôt qu’un objet superflu quand il n’y a rien à ranger', () => {
    useProgress.getState().reset()
    useProgress.getState().importSave(JSON.stringify({ format: 4, lessons: {}, cards: {}, steps: {} }))
    expect(useProgress.getState().lessons).toEqual({})
  })

  it('lit directement une sauvegarde déjà au format 5, sans la replier', () => {
    useProgress.getState().reset()
    useProgress.getState().importSave(
      JSON.stringify({
        format: 5,
        lessons: { 'fr-en-b1': { 'v1-l1': { level: 1, completions: 1, lastAt: 0, bestAccuracy: 1 } } },
        cards: {},
        steps: {},
      }),
    )
    const state = useProgress.getState()
    expect(state.lessons['fr-en-b1']?.['v1-l1']?.level).toBe(1)
    expect(state.lessons.legacy).toBeUndefined()
  })
})
