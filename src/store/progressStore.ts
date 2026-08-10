import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Vocab } from '@/content/schema'
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
export const SAVE_FORMAT = 1

export interface ProgressSnapshot {
  lessons: LessonProgressMap
  cards: Record<string, CardState>
  xp: number
  xpByDay: Record<string, number>
  dailyGoal: number
  streak: Streak
}

interface ProgressState extends ProgressSnapshot {
  /** Enregistre la réponse à un mot et met à jour sa carte de révision. */
  gradeVocab: (vocab: Vocab, rating: Rating, now?: number) => void
  /** Clôt une session de leçon : étoile, XP, série. */
  finishLesson: (lessonId: string, outcome: SessionOutcome, now?: number) => { passed: boolean; xp: number; level: number }
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

      gradeVocab: (vocab, rating, now = Date.now()) =>
        set((state) => {
          const card = state.cards[vocab.id] ?? createCard(vocab.id, now)
          return { cards: { ...state.cards, [vocab.id]: review(card, rating, now) } }
        }),

      finishLesson: (lessonId, outcome, now = Date.now()) => {
        const state = get()
        const passed = isPassed(outcome)
        const previous = state.lessons[lessonId]
        const level = passed ? Math.min(MAX_LEVEL, (previous?.level ?? 0) + 1) : (previous?.level ?? 0)
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
        if (parsed.format !== SAVE_FORMAT) {
          throw new Error(`Format de sauvegarde inconnu (attendu ${SAVE_FORMAT}).`)
        }
        set({
          lessons: parsed.lessons ?? {},
          cards: parsed.cards ?? {},
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
