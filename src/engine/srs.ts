/**
 * Révision espacée — variante de SM-2 avec paliers d'apprentissage.
 *
 * Chaque mot rencontré devient une carte. La carte traverse deux phases :
 *
 *   apprentissage : paliers courts (1 min, 10 min) le jour de la découverte ;
 *   révision      : intervalles en jours, multipliés par un facteur de facilité.
 *
 * Une erreur pendant l'apprentissage renvoie la carte au premier palier.
 * Une rechute en révision réduit sa facilité et raccourcit son intervalle
 * sans la faire ressortir dans la minute : elle revient plus souvent tant
 * qu'elle n'est pas solide, mais reste espacée dans le temps.
 *
 * Fragilité et révision tardive. Une carte qui rechute devient fragile : elle
 * entre dans les séances finales et passe en tête des entraînements, et sa
 * facilité baissée resserre ses re-tests. La réussite qui suit l'échec, dans
 * la même séance, ne prouve rien (la réponse vient d'être vue) : seules les
 * révisions faites à échéance, donc des jours plus tard, comptent. Après
 * `CONFIRM_STREAK` d'entre elles réussies d'affilée, la maîtrise est jugée
 * durable : la carte cesse d'être fragile et regagne une part de sa facilité.
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
  /**
   * Nombre de rechutes : séances où la carte a été manquée, au plus une par
   * `LAPSE_WINDOW`. Le tout premier essai d'une carte neuve n'en est pas une
   * (on ne rechute pas sur ce qu'on n'a jamais su) ; un échec en apprentissage
   * après ce premier essai en est une.
   */
  lapses: number
  /**
   * Date de la dernière rechute, en millisecondes epoch. Absente tant que la
   * carte n'a jamais rechuté (et sur les cartes enregistrées avant que ce
   * champ existe) : sert à départager, par récence, les cartes les plus
   * fragiles (voir `finalEntries`).
   */
  lastLapse?: number
  /**
   * Révisions réussies d'affilée à échéance (phase de révision) depuis la
   * dernière rechute. Absent sur les cartes enregistrées avant que ce champ
   * existe, ce qui vaut zéro. Voir `isFragile`.
   */
  steady?: number
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
/** Fraction de l'ancien intervalle conservée après une rechute en révision. */
const LAPSE_FACTOR = 0.3
/** Facilité retirée par une rechute. */
const LAPSE_EASE = 0.2
/**
 * Facilité rendue par une maîtrise confirmée : la moitié de ce qu'une rechute
 * coûte. Simulée sur quatre mois (vingt cartes neuves par jour), la remontée
 * entière allégeait les révisions d'un quart mais laissait les cartes
 * difficiles s'oublier un peu plus ; la moitié les allège d'un dixième
 * environ par rapport à l'ancien moteur, à rétention égale.
 */
const CONFIRM_EASE = 0.1
/**
 * Durée d'une séance, pour le compte des rechutes : les échecs répétés d'une
 * même carte dans ce délai ne comptent que pour une. Une demi-journée plutôt
 * qu'une séance au sens strict, que le moteur ne connaît pas.
 */
export const LAPSE_WINDOW = 12 * 60 * MINUTE
/** Révisions à échéance réussies d'affilée qui font d'une carte fragile une carte maîtrisée. */
export const CONFIRM_STREAK = 3

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
 * Compte une rechute sur `next`, sauf si la carte en a déjà une dans la
 * séance (voir `LAPSE_WINDOW`) : rater trois fois de suite une carte, le temps
 * qu'elle revienne dans la file, est un seul oubli, pas trois. Sans cette
 * borne, une seule séance difficile faisait tomber la facilité au plancher
 * pour toujours et envoyait la carte en séance finale.
 */
function countLapse(card: CardState, next: CardState, now: number): boolean {
  if (card.lastLapse !== undefined && now - card.lastLapse < LAPSE_WINDOW) return false
  next.lapses = card.lapses + 1
  next.lastLapse = now
  next.ease = clampEase(card.ease - LAPSE_EASE)
  next.steady = 0
  return true
}

/**
 * La carte est-elle fragile ? Oui si elle a rechuté et n'a pas encore réussi
 * `CONFIRM_STREAK` révisions à échéance depuis : la maîtrise retrouvée dans
 * la séance de l'échec peut n'être que passagère, seule la révision tardive
 * dit si elle dure.
 */
export function isFragile(card: CardState): boolean {
  return card.lapses > 0 && (card.steady ?? 0) < CONFIRM_STREAK
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
      // Un échec au premier essai d'une carte neuve ne dit rien de sa
      // fragilité : on la découvre. La rater encore après l'avoir vue, si.
      if (card.lastReviewed !== null) countLapse(card, next, now)
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
    /*
     * Une rechute revenait tout droit au premier palier d'apprentissage,
     * donc due dans la minute : la carte ressurgissait avant même la fin de
     * la séance en cours, et les cartes ratées finissaient par tourner en
     * boucle sur elles-mêmes plutôt que d'être espacées dans le temps.
     *
     * On la garde en révision — pas de retour aux paliers minute par minute,
     * réservés à l'acquisition d'une carte neuve — avec un intervalle réduit
     * à une fraction du précédent : plus il était long, plus tard elle
     * revient, jamais moins d'un jour.
     *
     * Un échec de plus dans la même séance ne change rien : l'échéance est
     * déjà rapprochée, la rechute déjà comptée.
     */
    if (!countLapse(card, next, now)) return next
    next.interval = clampInterval(Math.max(1, card.interval) * LAPSE_FACTOR)
    next.due = now + next.interval * DAY
    return next
  }

  /*
   * Révision anticipée : la carte n'est pas encore échue.
   *
   * C'est le cas courant d'un même mot revu plusieurs fois dans la même
   * séance — une leçon l'enchaîne en présentation, en association, en QCM,
   * puis en phrase à trou. Chacun de ces passages est une bonne réponse,
   * mais ils ne sont espacés que de quelques secondes : les compter comme
   * autant de révisions multipliait l'échéance à chaque fois, si bien qu'un
   * mot découvert quatre minutes plus tôt ressortait de sa propre leçon
   * planifié à cinquante jours. Tout ce qui juge ensuite de sa maturité
   * était trompé, et réclamait de mémoire un mot jamais revu depuis.
   *
   * La répétition massée entretient, elle n'ancre pas : on note la réponse,
   * on laisse l'échéance où elle est. Seul le temps écoulé fait progresser
   * l'intervalle. Un échec, lui, compte toujours — oublier un mot qu'on
   * vient de voir est une information, et il repart plus haut.
   */
  if (card.due > now) return next

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

  // Révision tardive réussie. À la `CONFIRM_STREAK`-ième d'affilée depuis une
  // rechute, la maîtrise est jugée durable : la carte regagne une part de la
  // facilité qu'une rechute lui a coûtée, pour ses intervalles suivants. Sans
  // quoi la baisse serait définitive, les exercices notés automatiquement ne
  // donnant jamais « easy », la seule note qui la remonte.
  next.steady = (card.steady ?? 0) + 1
  if (card.lapses > 0 && next.steady === CONFIRM_STREAK) {
    next.ease = clampEase(Math.max(next.ease, Math.min(DEFAULT_EASE, next.ease + CONFIRM_EASE)))
  }
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

/**
 * Répartition affichée dans les statistiques.
 *
 * Clés stables, pas les mots affichés : l'accord (« nouveau » ou « nouvelle »)
 * dépend du nom qu'ils qualifient à l'affichage — c'est à l'écran de le
 * choisir, pas à cette fonction de le figer.
 */
export function cardStrength(card: CardState): 'new' | 'learning' | 'known' | 'mastered' {
  // `reps` ne compte que les révisions ; un mot vu aujourd'hui est déjà « en cours ».
  if (card.lastReviewed === null) return 'new'
  if (card.step !== null || card.interval < 7) return 'learning'
  if (card.interval < 30) return 'known'
  return 'mastered'
}
