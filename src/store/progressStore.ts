import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SELECTED_COURSE_KEY } from '@/content/CourseProvider'
import {
  accuracyOf,
  bumpStreak,
  dayKey,
  isPassed,
  xpFor,
  type LessonProgressMap,
  type SessionOutcome,
  type Streak,
} from '@/engine/progress'
import { createCard, DAY, review, type CardState, type Rating } from '@/engine/srs'

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
 * `itemId`.
 * Format 3 : `steps` enregistre les étapes de parcours qui ne sont pas des
 * leçons (révision, approfondissement, entraînement).
 * Format 4 : les échéances gonflées par la répétition massée sont ramenées
 * à une valeur réaliste (voir `deflateSchedules`).
 * Format 5 : `lessons`, `cards` et `steps` sont imbriqués par identifiant de
 * cours. Plusieurs cours réutilisent les mêmes identifiants de leçon et
 * d'unité (`v1-l1`, `v1:review-0`…) — c'est voulu, chaque piste suit le même
 * gabarit d'un niveau à l'autre — mais à plat, terminer une leçon dans l'un
 * la marquait faite dans tous les autres qui partagent l'identifiant. Voir
 * `legacyCourseId` pour le rattachement des sauvegardes antérieures.
 * Les sauvegardes plus anciennes sont converties à la lecture.
 */
export const SAVE_FORMAT = 5

/** Le nécessaire d'un cours pour suivre sa propre progression. */
export interface CourseBucket<T> {
  [courseId: string]: T
}

export interface ProgressSnapshot {
  lessons: CourseBucket<LessonProgressMap>
  cards: CourseBucket<Record<string, CardState>>
  /** Étapes de parcours franchies : clé `unité:nœud` → nombre de passages. */
  steps: CourseBucket<Record<string, number>>
  xp: number
  xpByDay: Record<string, number>
  dailyGoal: number
  streak: Streak
  /**
   * Prononcer le mot tout seul à sa découverte. Se coupe : on révise aussi
   * dans le train, et un son qui part sans qu'on l'ait demandé y est un
   * défaut, pas un service. Le bouton, lui, reste toujours disponible.
   */
  autoSpeak: boolean
}

interface ProgressState extends ProgressSnapshot {
  /** Enregistre la réponse à un élément et met à jour sa carte de révision. */
  gradeItem: (courseId: string, itemId: string, rating: Rating, now?: number) => void
  /** Clôt une session de leçon : plancher d'acquisition, XP, série. */
  finishLesson: (
    courseId: string,
    lessonId: string,
    outcome: SessionOutcome,
    now?: number,
  ) => { passed: boolean; xp: number }
  /** Clôt une session de révision : XP et série, sans toucher au chemin. */
  finishReview: (outcome: SessionOutcome, now?: number) => { xp: number }
  /**
   * Clôt une étape de parcours qui n'est pas une leçon. Même comptage qu'une
   * révision, plus la marque qui fait avancer le parcours de l'unité.
   */
  finishStep: (courseId: string, stepId: string, outcome: SessionOutcome, now?: number) => { xp: number }
  setDailyGoal: (goal: number) => void
  setAutoSpeak: (on: boolean) => void
  exportSave: () => string
  importSave: (payload: string) => void
  reset: () => void
}

/**
 * Bloc vide, partagé, à renvoyer quand un cours n'a encore aucune
 * progression — plutôt qu'un `{}` neuf à chaque rendu.
 *
 * Un sélecteur zustand qui renvoie un objet différent à chaque appel casse
 * la comparaison par référence de l'abonnement : le composant se croit à
 * chaque fois changé, se re-rend, ce qui relit le sélecteur, qui renvoie de
 * nouveau un objet différent — une boucle de rendu infinie. Une seule
 * instance, réutilisée, rend le résultat stable tant que le cours reste vide.
 */
export const EMPTY_LESSON_PROGRESS: LessonProgressMap = {}
export const EMPTY_CARDS: Record<string, CardState> = {}
export const EMPTY_STEPS: Record<string, number> = {}

const initial: ProgressSnapshot = {
  lessons: {},
  cards: {},
  steps: {},
  xp: 0,
  xpByDay: {},
  dailyGoal: 30,
  autoSpeak: true,
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

/**
 * Plafond appliqué aux échéances héritées, en jours.
 *
 * Trois jours : sous le seuil à partir duquel un mot est réclamé en
 * production libre, de sorte qu'aucune carte ne conserve par héritage une
 * maturité qu'elle n'a pas gagnée. Elle la regagne en trois révisions
 * espacées si elle le mérite — sa facilité est préservée, elle remonte donc
 * aussi vite qu'avant.
 */
const INHERITED_CEILING = 3

/**
 * Ramène les échéances gonflées à une valeur réaliste.
 *
 * Jusqu'au format 3, chaque exercice d'une même séance comptait pour une
 * révision espacée réussie et multipliait l'intervalle par la facilité. Un
 * mot enchaîné en présentation, en association, en QCM puis en phrase à trou
 * ressortait de sa propre leçon planifié à cinquante jours : il ne revenait
 * plus avant des semaines, et passait entre-temps pour assez mûr qu'on lui
 * réclame le mot de mémoire.
 *
 * L'historique ne permet pas de démêler les vraies révisions des répétitions
 * de séance — `reps` a été gonflé de la même façon. On ne cherche donc pas à
 * reconstituer l'échéance exacte : on plafonne, et le calcul corrigé
 * reconstruit ensuite un vrai calendrier à partir des réponses réelles.
 *
 * Ce qui a été appris est conservé : les rechutes, la facilité, le nombre de
 * révisions, les leçons faites, l'XP et la série ne bougent pas. Les cartes
 * encore en apprentissage non plus — leurs paliers se comptent en minutes,
 * la multiplication ne les a jamais touchées.
 */
export function deflateSchedules(
  cards: Record<string, CardState>,
  now = Date.now(),
): Record<string, CardState> {
  const result: Record<string, CardState> = {}
  for (const [id, card] of Object.entries(cards)) {
    if (card.step !== null || card.interval <= INHERITED_CEILING) {
      result[id] = card
      continue
    }
    const interval = INHERITED_CEILING
    // L'échéance repart de la dernière réponse : une carte négligée depuis
    // longtemps redevient due tout de suite, comme elle aurait dû l'être.
    const due = (card.lastReviewed ?? now) + interval * DAY
    result[id] = { ...card, interval, due }
  }
  return result
}

/**
 * Cours auquel rattacher une sauvegarde antérieure au format 5.
 *
 * Une sauvegarde à plat ne dit pas de quel cours vient chaque leçon — c'est
 * précisément ce que le format 5 corrige. On ne peut donc pas répartir
 * l'historique correctement ; le rattacher au cours actif au moment de la
 * conversion est la meilleure approximation possible sans rien connaître du
 * contenu des cours à cet instant (la conversion est synchrone, le contenu se
 * charge par le réseau). Les autres cours repartent de zéro, ce qui reste
 * moins faux que de leur prêter une progression qui n'était pas la leur.
 */
function legacyCourseId(): string {
  if (typeof localStorage === 'undefined') return 'legacy'
  return localStorage.getItem(SELECTED_COURSE_KEY) ?? 'legacy'
}

/** Range un bloc à plat sous un seul cours ; `{}` si le bloc est vide. */
function nestByCourse<T>(flat: Record<string, T> | undefined, courseId: string): CourseBucket<Record<string, T>> {
  if (!flat || Object.keys(flat).length === 0) return {}
  return { [courseId]: flat }
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

      gradeItem: (courseId, itemId, rating, now = Date.now()) =>
        set((state) => {
          const bucket = state.cards[courseId] ?? {}
          const card = bucket[itemId] ?? createCard(itemId, now)
          return { cards: { ...state.cards, [courseId]: { ...bucket, [itemId]: review(card, rating, now) } } }
        }),

      finishLesson: (courseId, lessonId, outcome, now = Date.now()) => {
        const state = get()
        const passed = isPassed(outcome)
        const bucket = state.lessons[courseId] ?? {}
        const previous = bucket[lessonId]
        // Le plancher ne descend jamais : une fois réussie, une leçon reste
        // acquise même si un oubli fait momentanément baisser la maîtrise.
        const level = Math.max(previous?.level ?? 0, passed ? 1 : 0)
        const xp = xpFor(outcome, passed)

        set({
          lessons: {
            ...state.lessons,
            [courseId]: {
              ...bucket,
              [lessonId]: {
                level,
                completions: (previous?.completions ?? 0) + 1,
                lastAt: now,
                bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, accuracyOf(outcome)),
              },
            },
          },
          ...withActivity(state, xp, now),
        })

        return { passed, xp }
      },

      finishReview: (outcome, now = Date.now()) => {
        const state = get()
        const xp = xpFor(outcome, isPassed(outcome))
        set(withActivity(state, xp, now))
        return { xp }
      },

      finishStep: (courseId, stepId, outcome, now = Date.now()) => {
        const state = get()
        const xp = xpFor(outcome, isPassed(outcome))
        const bucket = state.steps[courseId] ?? {}
        set({
          steps: { ...state.steps, [courseId]: { ...bucket, [stepId]: (bucket[stepId] ?? 0) + 1 } },
          ...withActivity(state, xp, now),
        })
        return { xp }
      },

      setDailyGoal: (goal) => set({ dailyGoal: Math.max(10, Math.round(goal)) }),

      setAutoSpeak: (on) => set({ autoSpeak: on }),

      exportSave: () => {
        const { lessons, cards, steps, xp, xpByDay, dailyGoal, streak, autoSpeak } = get()
        return JSON.stringify(
          { format: SAVE_FORMAT, savedAt: Date.now(), lessons, cards, steps, xp, xpByDay, dailyGoal, streak, autoSpeak },
          null,
          2,
        )
      },

      importSave: (payload) => {
        const parsed = JSON.parse(payload) as {
          format?: number
          lessons?: unknown
          cards?: unknown
          steps?: unknown
          xp?: number
          xpByDay?: Record<string, number>
          dailyGoal?: number
          autoSpeak?: boolean
          streak?: Streak
        }
        // Les formats antérieurs n'ont rien perdu : leurs champs manquants
        // prennent simplement leur valeur par défaut ci-dessous.
        const format = parsed.format ?? 0
        if (![1, 2, 3, 4, SAVE_FORMAT].includes(format)) {
          throw new Error(`Format de sauvegarde inconnu (attendu ${SAVE_FORMAT}).`)
        }

        let lessons: ProgressSnapshot['lessons']
        let cards: ProgressSnapshot['cards']
        let steps: ProgressSnapshot['steps']

        if (format < SAVE_FORMAT) {
          // Formats 1 à 4 : lessons/cards/steps sont à plat, sans cours — voir
          // `legacyCourseId` et le commentaire du format 5 ci-dessus.
          const rawCards = migrateCards((parsed.cards ?? {}) as Record<string, unknown>)
          const flatCards = format < 4 ? deflateSchedules(rawCards) : rawCards
          const courseId = legacyCourseId()
          lessons = nestByCourse(parsed.lessons as LessonProgressMap | undefined, courseId)
          cards = nestByCourse(flatCards, courseId)
          steps = nestByCourse(parsed.steps as Record<string, number> | undefined, courseId)
        } else {
          lessons = (parsed.lessons as ProgressSnapshot['lessons']) ?? {}
          cards = (parsed.cards as ProgressSnapshot['cards']) ?? {}
          steps = (parsed.steps as ProgressSnapshot['steps']) ?? {}
        }

        set({
          lessons,
          cards,
          steps,
          xp: parsed.xp ?? 0,
          xpByDay: parsed.xpByDay ?? {},
          dailyGoal: parsed.dailyGoal ?? initial.dailyGoal,
          autoSpeak: parsed.autoSpeak ?? initial.autoSpeak,
          streak: parsed.streak ?? initial.streak,
        })
      },

      reset: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEY,
      version: SAVE_FORMAT,
      migrate: (persisted, version): ProgressSnapshot => {
        const state = (persisted ?? {}) as Record<string, unknown> & Partial<ProgressSnapshot>
        if (version >= SAVE_FORMAT) return state as ProgressSnapshot

        const rawCards = migrateCards((state.cards ?? {}) as Record<string, unknown>)
        const cards = version < 4 ? deflateSchedules(rawCards) : rawCards
        const courseId = legacyCourseId()

        return {
          ...initial,
          ...state,
          lessons: nestByCourse(state.lessons as unknown as LessonProgressMap | undefined, courseId),
          cards: nestByCourse(cards, courseId),
          // Absent avant le format 3 : un parcours vierge, les leçons déjà
          // faites restant reconnues par `lessons`.
          steps: nestByCourse(state.steps as unknown as Record<string, number> | undefined, courseId),
        }
      },
      partialize: ({ lessons, cards, steps, xp, xpByDay, dailyGoal, streak, autoSpeak }) => ({
        lessons,
        cards,
        steps,
        xp,
        xpByDay,
        dailyGoal,
        autoSpeak,
        streak,
      }),
    },
  ),
)
