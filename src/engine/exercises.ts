import type { Vocab } from '@/content/schema'
import { findTerm, type TermSplit } from '@/content/text'
import { createRng, sample, seedFrom, shuffle, type Rng } from './rng'
import type { CardState } from './srs'

/**
 * Génération des exercices d'une session.
 *
 * Trois familles, choisies avec l'auteur du projet :
 *   - `flashcard` : la carte classique, avec auto-évaluation en trois boutons ;
 *   - `match`     : relier des mots à leurs traductions ;
 *   - `cloze`     : compléter une phrase, au clavier ou en piochant dans une banque ;
 *   - `type`      : traduire au clavier, sans contexte.
 *
 * Le mélange dépend du niveau de maîtrise de la leçon : on reconnaît d'abord,
 * on produit ensuite.
 */

export type Direction = 'to-known' | 'to-learning'

export interface IntroExercise {
  kind: 'intro'
  id: string
  vocab: Vocab
}

export interface FlashcardExercise {
  kind: 'flashcard'
  id: string
  vocab: Vocab
  direction: Direction
}

export interface MatchExercise {
  kind: 'match'
  id: string
  pairs: Vocab[]
}

export interface ClozeExercise {
  kind: 'cloze'
  id: string
  vocab: Vocab
  sentence: TermSplit
  /** Mots proposés quand l'exercice se joue en banque de mots. */
  bank: string[] | null
}

export interface TypeExercise {
  kind: 'type'
  id: string
  vocab: Vocab
  direction: Direction
}

export type Exercise = IntroExercise | FlashcardExercise | MatchExercise | ClozeExercise | TypeExercise

/** Nombre de paires par manche d'association. */
export const MATCH_SIZE = 4
/** Nombre de mots proposés dans une banque de cloze. */
const BANK_SIZE = 4

/** Les exercices qui notent automatiquement la réponse (par opposition à la flashcard). */
export function isAutoGraded(exercise: Exercise): boolean {
  return exercise.kind === 'cloze' || exercise.kind === 'type' || exercise.kind === 'match'
}

/** Les mots dont dépend un exercice : ce sont eux qui reçoivent la note. */
export function vocabOf(exercise: Exercise): Vocab[] {
  switch (exercise.kind) {
    case 'match':
      return exercise.pairs
    case 'intro':
      return []
    default:
      return [exercise.vocab]
  }
}

function clozeFor(vocab: Vocab, bank: string[] | null): ClozeExercise | null {
  if (!vocab.example) return null
  const sentence = findTerm(vocab.example.text, vocab.term)
  if (!sentence) return null
  return { kind: 'cloze', id: `cloze:${vocab.id}`, vocab, sentence, bank }
}

function buildBank(vocab: Vocab, pool: readonly Vocab[], rng: Rng): string[] {
  const distractors = sample(
    pool.filter((item) => item.id !== vocab.id),
    BANK_SIZE - 1,
    rng,
  ).map((item) => item.term)
  return shuffle([vocab.term, ...distractors], rng)
}

function matchRounds(pool: readonly Vocab[], rounds: number, rng: Rng): MatchExercise[] {
  if (pool.length < MATCH_SIZE) return []
  const result: MatchExercise[] = []
  for (let round = 0; round < rounds; round++) {
    const pairs = sample(pool, MATCH_SIZE, rng)
    result.push({ kind: 'match', id: `match:${round}:${pairs.map((p) => p.id).join('-')}`, pairs })
  }
  return result
}

/**
 * Session d'une leçon.
 *
 * `level` est le nombre d'étoiles déjà obtenues (0 à 2) : il détermine la
 * difficulté du passage suivant.
 *   niveau 0 — découverte : présentation puis reconnaissance
 *   niveau 1 — consolidation : association et phrases à trou guidées
 *   niveau 2 — production : saisie au clavier
 */
export function buildLessonSession(lessonId: string, vocab: readonly Vocab[], level: number, seed?: number): Exercise[] {
  const rng = createRng(seed ?? seedFrom(lessonId, level))
  const words = shuffle(vocab, rng)

  if (level <= 0) {
    const discovery = words.flatMap((word): Exercise[] => [
      { kind: 'intro', id: `intro:${word.id}`, vocab: word },
      { kind: 'flashcard', id: `flash:${word.id}`, vocab: word, direction: 'to-known' },
    ])
    const clozes = words
      .map((word) => clozeFor(word, buildBank(word, words, rng)))
      .filter((exercise): exercise is ClozeExercise => exercise !== null)
    return [...discovery, ...matchRounds(words, 1, rng), ...sample(clozes, 3, rng)]
  }

  if (level === 1) {
    const flashcards = sample(words, 3, rng).map(
      (word): FlashcardExercise => ({
        kind: 'flashcard',
        id: `flash:${word.id}`,
        vocab: word,
        direction: 'to-learning',
      }),
    )
    const clozes = words
      .map((word) => clozeFor(word, buildBank(word, words, rng)))
      .filter((exercise): exercise is ClozeExercise => exercise !== null)
    const typed = sample(words, 3, rng).map(
      (word): TypeExercise => ({ kind: 'type', id: `type:${word.id}`, vocab: word, direction: 'to-known' }),
    )
    return interleave([...flashcards, ...sample(clozes, 3, rng), ...typed], rng)
  }

  const clozes = words
    .map((word) => clozeFor(word, null))
    .filter((exercise): exercise is ClozeExercise => exercise !== null)
  const typed = words.map(
    (word): TypeExercise => ({ kind: 'type', id: `type:${word.id}`, vocab: word, direction: 'to-learning' }),
  )
  return interleave([...sample(clozes, 4, rng), ...sample(typed, 4, rng), ...matchRounds(words, 1, rng)], rng)
}

/**
 * Session de révision : construite à partir des cartes échues, tous cours
 * confondus. Les cartes encore fragiles restent en reconnaissance, les
 * cartes solides passent à la production.
 */
export function buildReviewSession(
  entries: readonly { card: CardState; vocab: Vocab }[],
  seed?: number,
): Exercise[] {
  if (entries.length === 0) return []
  const rng = createRng(seed ?? seedFrom('review', entries.length, entries[0]!.vocab.id))
  const pool = entries.map((entry) => entry.vocab)

  const exercises = entries.map(({ card, vocab }): Exercise => {
    const solid = card.step === null && card.interval >= 7
    if (solid) {
      const cloze = clozeFor(vocab, null)
      if (cloze && rng() < 0.5) return cloze
      return { kind: 'type', id: `type:${vocab.id}`, vocab, direction: 'to-learning' }
    }
    const cloze = clozeFor(vocab, buildBank(vocab, pool, rng))
    if (cloze && rng() < 0.4) return cloze
    return { kind: 'flashcard', id: `flash:${vocab.id}`, vocab, direction: 'to-known' }
  })

  const rounds = matchRounds(pool, pool.length >= MATCH_SIZE ? 1 : 0, rng)
  return [...shuffle(exercises, rng), ...rounds]
}

/** Mélange en évitant, autant que possible, deux exercices de suite sur le même mot. */
function interleave(exercises: readonly Exercise[], rng: Rng): Exercise[] {
  const shuffled = shuffle(exercises, rng)
  for (let i = 1; i < shuffled.length; i++) {
    if (!sharesVocab(shuffled[i - 1], shuffled[i])) continue
    const swap = shuffled.findIndex(
      (candidate, index) =>
        index > i &&
        !sharesVocab(shuffled[i - 1], candidate) &&
        (index + 1 >= shuffled.length || !sharesVocab(shuffled[i], shuffled[index + 1])),
    )
    if (swap !== -1) [shuffled[i], shuffled[swap]] = [shuffled[swap], shuffled[i]]
  }
  return shuffled
}

function sharesVocab(a: Exercise, b: Exercise): boolean {
  const idsA = new Set(vocabOf(a).map((item) => item.id))
  return vocabOf(b).some((item) => idsA.has(item.id))
}

/**
 * Comparaison d'une réponse saisie au clavier.
 * On ignore la casse, les accents, la ponctuation et les articles courants :
 * l'exercice porte sur le vocabulaire, pas sur l'orthographe du français.
 */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:"“”()]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/^(le |la |les |l'|un |une |des |to |the |a |an )/, '')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isAnswerCorrect(vocab: Vocab, direction: Direction, value: string): boolean {
  const expected =
    direction === 'to-known' ? [vocab.translation, ...vocab.alt] : [vocab.term]
  const given = normalizeAnswer(value)
  return given.length > 0 && expected.some((candidate) => normalizeAnswer(candidate) === given)
}
