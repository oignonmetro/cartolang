import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Buzz } from '@/engine/combo'

/**
 * Le module lit la plateforme au chargement (`native`, `canVibrate`) : chaque
 * test réimporte donc un module neuf, sinon le premier figerait la plateforme
 * pour les suivants.
 */
async function withWebVibrate(vibrate?: unknown): Promise<{
  patterns: unknown[]
  haptics: typeof import('./haptics')
}> {
  const patterns: unknown[] = []
  vi.stubGlobal('navigator', {
    vibrate:
      vibrate === undefined
        ? (pattern: unknown) => {
            patterns.push(pattern)
            return true
          }
        : vibrate,
  })
  vi.resetModules()
  return { patterns, haptics: await import('./haptics') }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const ALL: Buzz[] = ['light', 'medium', 'heavy', 'rising', 'falling']

describe('retour haptique, chemin web', () => {
  it('sait rendre chaque sensation du vocabulaire', async () => {
    const { patterns, haptics } = await withWebVibrate()
    for (const buzz of ALL) haptics.vibrate(buzz)
    expect(patterns).toHaveLength(ALL.length)
  })

  it('distingue les trois impulsions par des durées franchement écartées', async () => {
    // L'API web ne règle pas l'amplitude : la durée est le seul levier, il
    // faut donc que l'écart s'y sente.
    const { patterns, haptics } = await withWebVibrate()
    for (const buzz of ['light', 'medium', 'heavy'] as const) haptics.vibrate(buzz)
    const durations = patterns.map((pattern) => (pattern as number[])[0]!)
    expect(durations[0]!).toBeLessThan(durations[1]!)
    expect(durations[1]!).toBeLessThan(durations[2]!)
  })

  it('donne aux deux motifs des sens de lecture opposés', async () => {
    // C'est ce qui les rend reconnaissables à l'aveugle : « rising » monte
    // vers son temps fort, « falling » en redescend.
    const { patterns, haptics } = await withWebVibrate()
    haptics.vibrate('rising')
    haptics.vibrate('falling')
    const [rising, falling] = patterns as number[][]
    expect(rising![0]!).toBeLessThan(rising![2]!)
    expect(falling![0]!).toBeGreaterThan(falling![2]!)
  })

  it('reste sans effet, sans jamais échouer, là où l’API manque', async () => {
    vi.stubGlobal('navigator', {})
    vi.resetModules()
    const haptics = await import('./haptics')
    expect(haptics.canVibrate).toBe(false)
    expect(() => haptics.vibrate('heavy')).not.toThrow()
  })

  it('avale l’erreur d’un appareil qui refuse de vibrer', async () => {
    // Android refuse la vibration dans certains modes d'économie : une
    // session ne doit pas s'arrêter là-dessus.
    const { haptics } = await withWebVibrate(() => {
      throw new Error('vibration interdite')
    })
    expect(() => haptics.vibrate('rising')).not.toThrow()
  })
})
