import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  achievementStatus,
  lessonsCompletedCount,
  wordsLearnedCount,
  type AchievementFamily,
} from './achievements'
import type { ItemLocation } from '@/content/course'
import type { CardState } from './srs'
import { createCard } from './srs'

const FAMILY: AchievementFamily = {
  id: 'words',
  title: 'Test',
  unit: 'mots',
  tiers: [
    { threshold: 10, label: 'A' },
    { threshold: 50, label: 'B' },
    { threshold: 150, label: 'C' },
  ],
}

describe('statut d’une échelle de paliers', () => {
  it('ne débloque rien avant le premier seuil', () => {
    expect(achievementStatus(FAMILY, 0)).toMatchObject({ unlocked: 0, next: { threshold: 10, label: 'A' } })
    expect(achievementStatus(FAMILY, 9)).toMatchObject({ unlocked: 0 })
  })

  it('débloque un palier pile à son seuil', () => {
    expect(achievementStatus(FAMILY, 10)).toMatchObject({ unlocked: 1, next: { threshold: 50, label: 'B' } })
  })

  it('débloque plusieurs paliers d’un coup', () => {
    expect(achievementStatus(FAMILY, 200)).toMatchObject({ unlocked: 3, next: null })
  })

  it('reste cohérent pour chaque échelle vraiment servie par l’écran', () => {
    // Régression : des seuils mal ordonnés casseraient l'arrêt au premier
    // manquant (voir `achievementStatus`).
    for (const family of ACHIEVEMENTS) {
      const thresholds = family.tiers.map((tier) => tier.threshold)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
      expect(new Set(thresholds).size).toBe(thresholds.length)
    }
  })
})

describe('mots appris', () => {
  const items = new Map<string, ItemLocation>([
    ['v1', { item: { kind: 'vocab', id: 'v1', vocab: {} as never }, lessonId: 'l1', unitId: 'u1', trackId: null }],
    ['v2', { item: { kind: 'vocab', id: 'v2', vocab: {} as never }, lessonId: 'l1', unitId: 'u1', trackId: null }],
    ['g1', { item: { kind: 'grammar', id: 'g1', point: {} as never }, lessonId: 'l2', unitId: 'u2', trackId: null }],
  ])

  it('ne compte que les cartes de vocabulaire', () => {
    const cards: Record<string, CardState> = {
      v1: createCard('v1', 0),
      v2: createCard('v2', 0),
      g1: createCard('g1', 0),
    }
    expect(wordsLearnedCount(cards, items)).toBe(2)
  })

  it('ignore une carte dont l’élément n’existe plus dans le cours actif', () => {
    // Peut arriver après un changement de contenu : la carte reste dans la
    // sauvegarde, l'élément qu'elle notait a disparu du cours.
    const cards: Record<string, CardState> = { ghost: createCard('ghost', 0) }
    expect(wordsLearnedCount(cards, items)).toBe(0)
  })

  it('vaut zéro sans aucune carte', () => {
    expect(wordsLearnedCount({}, items)).toBe(0)
  })
})

describe('leçons terminées', () => {
  it('ne compte que les leçons réussies au moins une fois', () => {
    const lessons = {
      l1: { level: 1, completions: 3, lastAt: 0, bestAccuracy: 1 },
      l2: { level: 0, completions: 1, lastAt: 0, bestAccuracy: 0.4 },
      l3: { level: 1, completions: 1, lastAt: 0, bestAccuracy: 0.8 },
    }
    expect(lessonsCompletedCount(lessons)).toBe(2)
  })

  it('vaut zéro sans progression', () => {
    expect(lessonsCompletedCount({})).toBe(0)
  })
})
