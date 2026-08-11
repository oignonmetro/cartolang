/**
 * Révision espacée — variante de SM-2 avec paliers d'apprentissage.
 *
 * Chaque mot rencontré devient une carte. La carte traverse deux phases :
 *
 *   apprentissage : paliers courts (1 min, 10 min) le jour de la découverte ;
 *   révision      : intervalles en jours, multipliés par un facteur de facilité.
 *
 * Une erreur renvoie la carte au premier palier et réduit sa facilité, ce qui
 * la fait revenir plus souvent tant qu'elle n'est pas solide.
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface CardState {
  /** Identifiant de l'élément suivi : un mot, un point de grammaire, une forme. */
  itemId: string
  /** Facteur de facilité SM-2, entre 1.3 et 2.8. */
  ease: number
  /** Intervalle courant en jours (0 tant que la carte est en apprentissage). */
  interval: number
  /** Nombre de révisions réussies. */
  reps: number
  /** Nombre de rechutes depuis la phase de révision. */
  lapses: number
  /** Prochaine échéance, en millisecondes epoch. */
  due: number
  /** Index dans LEARNING_STEPS ; `null` quand la carte est passée en révision. */
  step: number | null
  /** Dernière réponse, en millisecondes epoch. */
  lastReviewed: number | null
}

export const MINUTE = 60_000
export const DAY = 24 * 60 * MINUTE

/** Paliers d'apprentissage, en minutes. */
export const LEARNING_STEPS = [1, 10]
const GRADUATING_INTERVAL = 1
const EASY_INTERVAL = 4
const MIN_EASE = 1.3
const MAX_EASE = 2.8
const DEFAULT_EASE = 2.5
/** Plafond volontairement bas : un cours de vocabulaire n'a pas besoin de plus. */
const MAX_INTERVAL = 365

export function createCard(itemId: string, now: number): CardState {
  return {
    itemId,
    ease: DEFAULT_EASE,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: now,
    step: 0,
    lastReviewed: null,
  }
}

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number(ease.toFixed(4))))
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)))
}

/**
 * Applique une réponse à une carte et renvoie son nouvel état.
 * La fonction est pure : elle ne modifie pas la carte reçue.
 */
export function review(card: CardState, rating: Rating, now: number): CardState {
  const next: CardState = { ...card, lastReviewed: now }

  // Phase d'apprentissage : on progresse de palier en palier.
  if (card.step !== null) {
    if (rating === 'again') {
      next.step = 0
      next.due = now + LEARNING_STEPS[0] * MINUTE
      return next
    }

    if (rating === 'easy') {
      next.step = null
      next.interval = EASY_INTERVAL
      next.reps = card.reps + 1
      next.due = now + EASY_INTERVAL * DAY
      return next
    }

    // « hard » fait patienter sur le palier courant, « good » fait avancer.
    const step = rating === 'hard' ? card.step : card.step + 1
    if (step >= LEARNING_STEPS.length) {
      next.step = null
      next.interval = GRADUATING_INTERVAL
      next.reps = card.reps + 1
      next.due = now + GRADUATING_INTERVAL * DAY
      return next
    }
    next.step = step
    next.due = now + LEARNING_STEPS[step] * MINUTE
    return next
  }

  // Phase de révision.
  if (rating === 'again') {
    next.lapses = card.lapses + 1
    next.ease = clampEase(card.ease - 0.2)
    next.interval = 0
    next.step = 0
    next.due = now + LEARNING_STEPS[0] * MINUTE
    return next
  }

  const base = Math.max(1, card.interval)
  let interval: number
  if (rating === 'hard') {
    next.ease = clampEase(card.ease - 0.15)
    interval = base * 1.2
  } else if (rating === 'easy') {
    next.ease = clampEase(card.ease + 0.15)
    interval = base * next.ease * 1.3
  } else {
    interval = base * card.ease
  }

  next.interval = clampInterval(interval)
  next.reps = card.reps + 1
  next.due = now + next.interval * DAY
  return next
}

/** Traduit la justesse d'un exercice en note, pour les exercices sans auto-évaluation. */
export function ratingFromAnswer(correct: boolean, firstTry: boolean): Rating {
  if (!correct) return 'again'
  return firstTry ? 'good' : 'hard'
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now
}

/**
 * Cartes à réviser, les plus en retard d'abord.
 * Les cartes encore en apprentissage passent devant : elles sont fragiles.
 */
export function dueCards(cards: readonly CardState[], now: number, limit = Infinity): CardState[] {
  return cards
    .filter((card) => isDue(card, now))
    .sort((a, b) => {
      const learning = Number(b.step !== null) - Number(a.step !== null)
      if (learning !== 0) return learning
      return a.due - b.due
    })
    .slice(0, limit)
}

/** Répartition affichée dans les statistiques. */
export function cardStrength(card: CardState): 'nouvelle' | 'en cours' | 'connue' | 'maîtrisée' {
  // `reps` ne compte que les révisions ; un mot vu aujourd'hui est déjà « en cours ».
  if (card.lastReviewed === null) return 'nouvelle'
  if (card.step !== null || card.interval < 7) return 'en cours'
  if (card.interval < 30) return 'connue'
  return 'maîtrisée'
}
