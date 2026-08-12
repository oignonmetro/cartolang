import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  accuracyOf,
  bumpStreak,
  dayKey,
  isPassed,
  MAX_LEVEL,
  xpFor,
  type LessonProgressMap,
  type SessionOutcome,
  type Streak,
} from '@/engine/progress'
import { createCard, review, type CardState, type Rating } from '@/engine/srs'

/**
 * État de l'apprenant.
 *
 * Tout est local : rien ne sort de l'appareil. Le stockage passe par
 * `localStorage`, disponible aussi bien dans le navigateur que dans la WebView
 * de l'APK. La sauvegarde peut être exportée et réimportée depuis le profil.
 */

export const STORAGE_KEY = 'cartolang.progress.v1'
/**
 * Format 2 : les cartes suivent des « éléments » (mot, point de grammaire,
 * forme conjuguée) et non plus seulement des mots — `vocabId` est devenu
 * `itemId`. Les sauvegardes au format 1 sont converties à la lecture.
 */
export const SAVE_FORMAT = 2

export interface ProgressSnapshot {
  lessons: LessonProgressMap
  cards: Record<string, CardState>
  xp: number
  xpByDay: Record<string, number>
  dailyGoal: number
  streak: Streak
}

interface ProgressState extends ProgressSnapshot {
  /** Enregistre la réponse à un élément et met à jour sa carte de révision. */
  gradeItem: (itemId: string, rating: Rating, now?: number) => void
  /**
   * Clôt une session de leçon : étoiles, XP, série. `stars` est calculé par
   * l'appelant depuis la maîtrise des éléments — le magasin ne connaît pas le
   * contenu des leçons, seulement les cartes.
   */
  finishLesson: (
    lessonId: string,
    outcome: SessionOutcome,
    stars: number,
    now?: number,
  ) => { passed: boolean; xp: number; level: number }
  /**
   * Relève le plancher d'étoiles des leçons dont la maîtrise a progressé —
   * typiquement après une révision, qui touche des éléments de plusieurs
   * leçons à la fois. Sans effet si rien n'a monté.
   */
  raiseLessonStars: (stars: Record<string, number>, now?: number) => void
  /** Clôt une session de révision : XP et série, sans toucher au chemin. */
  finishReview: (outcome: SessionOutcome, now?: number) => { xp: number }
  setDailyGoal: (goal: number) => void
  exportSave: () => string
  importSave: (payload: string) => void
  reset: () => void
}

const initial: ProgressSnapshot = {
  lessons: {},
  cards: {},
  xp: 0,
  xpByDay: {},
  dailyGoal: 30,
  streak: { current: 0, best: 0, lastDay: null },
}

/** Convertit les cartes d'une sauvegarde au format 1 (`vocabId` → `itemId`). */
export function migrateCards(cards: Record<string, unknown>): Record<string, CardState> {
  const migrated: Record<string, CardState> = {}
  for (const [id, raw] of Object.entries(cards ?? {})) {
    if (typeof raw !== 'object' || raw === null) continue
    const { vocabId, ...rest } = raw as CardState & { vocabId?: string }
    migrated[id] = { ...(rest as CardState), itemId: (rest as CardState).itemId ?? vocabId ?? id }
  }
  return migrated
}

/** Enregistre l'activité du jour : XP cumulés et série. */
function withActivity(state: ProgressSnapshot, xp: number, now: number): Partial<ProgressSnapshot> {
  const today = dayKey(now)
  return {
    xp: state.xp + xp,
    xpByDay: { ...state.xpByDay, [today]: (state.xpByDay[today] ?? 0) + xp },
    streak: bumpStreak(state.streak, today),
  }
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initial,

      gradeItem: (itemId, rating, now = Date.now()) =>
        set((state) => {
          const card = state.cards[itemId] ?? createCard(itemId, now)
          return { cards: { ...state.cards, [itemId]: review(card, rating, now) } }
        }),

      finishLesson: (lessonId, outcome, stars, now = Date.now()) => {
        const state = get()
        const passed = isPassed(outcome)
        const previous = state.lessons[lessonId]
        // Le plancher ne descend jamais : une étoile déjà décrochée reste
        // acquise, même si un oubli fait momentanément baisser la maîtrise.
        const level = Math.min(MAX_LEVEL, Math.max(previous?.level ?? 0, stars))
        const xp = xpFor(outcome, passed)

        set({
          lessons: {
            ...state.lessons,
            [lessonId]: {
              level,
              completions: (previous?.completions ?? 0) + 1,
              lastAt: now,
              bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, accuracyOf(outcome)),
            },
          },
          ...withActivity(state, xp, now),
        })

        return { passed, xp, level }
      },

      raiseLessonStars: (stars, now = Date.now()) =>
        set((state) => {
          const lessons = { ...state.lessons }
          let changed = false
          for (const [lessonId, value] of Object.entries(stars)) {
            const previous = lessons[lessonId]
            const level = Math.min(MAX_LEVEL, value)
            if (level <= (previous?.level ?? 0)) continue
            lessons[lessonId] = {
              level,
              completions: previous?.completions ?? 0,
              lastAt: previous?.lastAt ?? now,
              bestAccuracy: previous?.bestAccuracy ?? 0,
            }
            changed = true
          }
          return changed ? { lessons } : {}
        }),

      finishReview: (outcome, now = Date.now()) => {
        const state = get()
        const xp = xpFor(outcome, isPassed(outcome))
        set(withActivity(state, xp, now))
        return { xp }
      },

      setDailyGoal: (goal) => set({ dailyGoal: Math.max(10, Math.round(goal)) }),

      exportSave: () => {
        const { lessons, cards, xp, xpByDay, dailyGoal, streak } = get()
        return JSON.stringify({ format: SAVE_FORMAT, savedAt: Date.now(), lessons, cards, xp, xpByDay, dailyGoal, streak }, null, 2)
      },

      importSave: (payload) => {
        const parsed = JSON.parse(payload) as Partial<ProgressSnapshot> & { format?: number }
        if (parsed.format !== SAVE_FORMAT && parsed.format !== 1) {
          throw new Error(`Format de sauvegarde inconnu (attendu ${SAVE_FORMAT}).`)
        }
        set({
          lessons: parsed.lessons ?? {},
          cards: migrateCards((parsed.cards ?? {}) as Record<string, unknown>),
          xp: parsed.xp ?? 0,
          xpByDay: parsed.xpByDay ?? {},
          dailyGoal: parsed.dailyGoal ?? initial.dailyGoal,
          streak: parsed.streak ?? initial.streak,
        })
      },

      reset: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEY,
      version: SAVE_FORMAT,
      migrate: (persisted) => {
        const state = persisted as ProgressSnapshot
        return { ...state, cards: migrateCards((state?.cards ?? {}) as Record<string, unknown>) }
      },
      partialize: ({ lessons, cards, xp, xpByDay, dailyGoal, streak }) => ({
        lessons,
        cards,
        xp,
        xpByDay,
        dailyGoal,
        streak,
      }),
    },
  ),
)
