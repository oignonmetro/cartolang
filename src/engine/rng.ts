/**
 * Générateur pseudo-aléatoire déterministe.
 *
 * Les sessions sont construites à partir d'une graine pour que la même leçon,
 * rejouée au même moment, produise la même suite d'exercices — ce qui rend le
 * générateur testable et évite qu'un rechargement de page rebatte les cartes.
 */
export interface Rng {
  (): number
}

/** mulberry32 : petit, rapide, suffisant pour mélanger des listes. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Graine stable dérivée d'une chaîne (identifiant de leçon, date du jour…). */
export function seedFrom(...parts: (string | number)[]): number {
  let hash = 2166136261
  for (const part of parts) {
    const text = String(part)
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }
  return hash >>> 0
}

/** Mélange de Fisher-Yates, sans modifier le tableau d'origine. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Tire `count` éléments distincts au hasard (ou tous, s'il y en a moins). */
export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, Math.max(0, count))
}
