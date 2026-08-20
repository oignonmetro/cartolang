import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le module retient son contexte audio d'un appel à l'autre : chaque test
 * réimporte donc un module neuf, sinon le faux contexte du premier resterait
 * en place pour les suivants.
 */
async function withFakeAudio(): Promise<{
  notes: number[]
  sound: typeof import('./sound')
}> {
  const notes: number[] = []

  class FakeGainParam {
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeNode {
    connect(next: unknown) {
      return next
    }
  }
  class FakeOscillator extends FakeNode {
    type = ''
    frequency = { value: 0 }
    start() {
      notes.push(Math.round(this.frequency.value))
    }
    stop() {}
  }

  vi.stubGlobal('window', {
    AudioContext: class {
      state = 'running'
      currentTime = 0
      destination = new FakeNode()
      createOscillator() {
        return new FakeOscillator()
      }
      createGain() {
        return Object.assign(new FakeNode(), { gain: new FakeGainParam() })
      }
      resume() {}
    },
  })

  vi.resetModules()
  return { notes, sound: await import('./sound') }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sons de réussite', () => {
  it('monte l’accord majeur au fil des réussites d’un même exercice', async () => {
    const { notes, sound } = await withFakeAudio()
    for (let index = 0; index < 3; index++) sound.playSuccessNote(index)
    // Do, mi, sol : la fondamentale, la tierce, la quinte.
    expect(notes).toEqual([523, 659, 784])
  })

  it('poursuit l’accord à l’octave plutôt que de reprendre à zéro', async () => {
    const { notes, sound } = await withFakeAudio()
    for (let index = 3; index < 6; index++) sound.playSuccessNote(index)
    expect(notes).toEqual([1047, 1319, 1568])
  })

  it('s’arrête au sommet quand la manche compte plus de paires que l’accord', async () => {
    // Une manche de conjugaison peut compter douze paires : continuer à monter
    // finirait dans les fréquences qui font grincer.
    const { notes, sound } = await withFakeAudio()
    for (let index = 6; index < 12; index++) sound.playSuccessNote(index)
    expect(new Set(notes)).toEqual(new Set([1568]))
  })

  it('joue deux notes qui montent pour un exercice réussi', async () => {
    const { notes, sound } = await withFakeAudio()
    sound.playSuccess()
    expect(notes).toEqual([784, 1047])
  })

  it('reste muet, sans jamais échouer, là où le navigateur n’a pas de Web Audio', async () => {
    vi.stubGlobal('window', {})
    vi.resetModules()
    const sound = await import('./sound')
    expect(() => {
      sound.playSuccess()
      sound.playSuccessNote(0)
    }).not.toThrow()
  })
})
