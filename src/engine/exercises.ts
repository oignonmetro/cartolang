import type { ConjugationForm, ConjugationVerb, GrammarPoint, Lesson, PracticeItem, Vocab } from '@/content/schema'
import { GAP } from '@/content/schema'
import { itemsOfLesson } from '@/content/course'
import { findVocabGap, type TermSplit } from '@/content/text'
import { createRng, sample, seedFrom, shuffle, type Rng } from './rng'
import type { CardState } from './srs'

/**
 * Génération des exercices d'une session.
 *
 * Pour le vocabulaire, quatre familles choisies avec l'auteur du projet :
 *   - `flashcard` : la carte classique, avec auto-évaluation en trois boutons ;
 *   - `match`     : relier des mots à leurs traductions ;
 *   - `cloze`     : compléter une phrase, au clavier ou en piochant dans une banque ;
 *   - `type`      : traduire au clavier, sans contexte.
 *
 * La grammaire et la conjugaison ne se ramènent pas à des paires
 * terme/traduction : elles ont leurs propres exercices.
 *   - `rule`         : présentation d'un point de grammaire avant pratique ;
 *   - `grammar-gap`  : phrase trouée, au clavier ou parmi des formes proposées ;
 *   - `conjugation`  : produire une forme à partir du verbe, du temps, de la personne ;
 *   - `conjugation-match` : relier les personnes aux formes d'un même verbe.
 *
 * Dans tous les cas le mélange dépend du niveau de maîtrise de la leçon : on
 * reconnaît d'abord, on produit ensuite.
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

/** Rappel de cours affiché avant la pratique d'un point de grammaire. */
export interface RuleExercise {
  kind: 'rule'
  id: string
  title: string
  notes: string
}

export interface GrammarGapExercise {
  kind: 'grammar-gap'
  id: string
  point: GrammarPoint
  /** Formes proposées, ou `null` quand la réponse se saisit au clavier. */
  bank: string[] | null
}

export interface ConjugationExercise {
  kind: 'conjugation'
  id: string
  verb: ConjugationVerb
  form: ConjugationForm
}

export interface ConjugationMatchExercise {
  kind: 'conjugation-match'
  id: string
  verb: ConjugationVerb
  forms: ConjugationForm[]
}

export type Exercise =
  | IntroExercise
  | FlashcardExercise
  | MatchExercise
  | ClozeExercise
  | TypeExercise
  | RuleExercise
  | GrammarGapExercise
  | ConjugationExercise
  | ConjugationMatchExercise

/** Nombre de paires par manche d'association. */
export const MATCH_SIZE = 4
/** Nombre de mots proposés dans une banque de cloze. */
const BANK_SIZE = 4

/** Les exercices qui présentent sans évaluer : ils ne comptent pas dans le score. */
export function isPresentation(exercise: Exercise): boolean {
  return exercise.kind === 'intro' || exercise.kind === 'rule'
}

/** Les éléments dont dépend un exercice : ce sont eux qui reçoivent la note. */
export function itemIdsOf(exercise: Exercise): string[] {
  switch (exercise.kind) {
    case 'intro':
    case 'rule':
      return []
    case 'match':
      return exercise.pairs.map((pair) => pair.id)
    case 'conjugation-match':
      return exercise.forms.map((form) => form.id)
    case 'grammar-gap':
      return [exercise.point.id]
    case 'conjugation':
      return [exercise.form.id]
    default:
      return [exercise.vocab.id]
  }
}

/**
 * Forme sous laquelle un mot apparaît réellement dans une phrase : la forme
 * fléchie donnée par l'auteur (`gap`) quand elle existe, sinon le terme
 * débarrassé de son « to » d'infinitif.
 */
function surfaceForm(vocab: Vocab): string {
  return vocab.gap ?? vocab.term.replace(/^to\s+/i, '')
}

/**
 * Phrase à trou. La banque, quand il y en a une, est construite autour de la
 * portion réellement masquée : proposer « to book » alors que la phrase
 * attend « booked » rendrait l'exercice impossible à réussir.
 */
function clozeFor(vocab: Vocab, pool: readonly Vocab[] | null, rng: Rng): ClozeExercise | null {
  if (!vocab.example) return null
  const sentence = findVocabGap(vocab.example.text, vocab.term, vocab.gap)
  if (!sentence) return null
  const bank = pool ? buildBank(sentence.match, vocab, pool, rng) : null
  return { kind: 'cloze', id: `cloze:${vocab.id}`, vocab, sentence, bank }
}

function buildBank(match: string, vocab: Vocab, pool: readonly Vocab[], rng: Rng): string[] {
  const distractors = sample(
    pool.filter((item) => item.id !== vocab.id),
    BANK_SIZE - 1,
    rng,
  )
    .map(surfaceForm)
    // Un leurre qui vaudrait la réponse offrirait deux bonnes cases.
    .filter((word) => normalizeAnswer(word) !== normalizeAnswer(match))
  return shuffle([match, ...distractors], rng)
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
 * Session d'une leçon, quelle que soit sa nature.
 *
 * `level` est le nombre d'étoiles déjà obtenues (0 à 2) : il détermine la
 * difficulté du passage suivant.
 *   niveau 0 — découverte : présentation puis reconnaissance
 *   niveau 1 — consolidation : association et exercices guidés
 *   niveau 2 — production : saisie au clavier
 */
export function buildLessonSession(lesson: Lesson, level: number, seed?: number): Exercise[] {
  const resolved = seed ?? seedFrom(lesson.id, level)
  switch (lesson.kind) {
    case 'vocab':
      return buildVocabSession(lesson.vocab, level, resolved)
    case 'grammar':
      return buildGrammarSession(lesson.id, lesson.points, lesson.notes, lesson.title, level, resolved)
    case 'conjugation':
      return buildConjugationSession(lesson.id, lesson.verbs, lesson.notes, lesson.title, level, resolved)
  }
}

function buildVocabSession(vocab: readonly Vocab[], level: number, seed: number): Exercise[] {
  const rng = createRng(seed)
  const words = shuffle(vocab, rng)

  if (level <= 0) {
    const discovery = words.flatMap((word): Exercise[] => [
      { kind: 'intro', id: `intro:${word.id}`, vocab: word },
      { kind: 'flashcard', id: `flash:${word.id}`, vocab: word, direction: 'to-known' },
    ])
    const clozes = words
      .map((word) => clozeFor(word, words, rng))
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
      .map((word) => clozeFor(word, words, rng))
      .filter((exercise): exercise is ClozeExercise => exercise !== null)
    const typed = sample(words, 3, rng).map(
      (word): TypeExercise => ({ kind: 'type', id: `type:${word.id}`, vocab: word, direction: 'to-known' }),
    )
    return interleave([...flashcards, ...sample(clozes, 3, rng), ...typed], rng)
  }

  const clozes = words
    .map((word) => clozeFor(word, null, rng))
    .filter((exercise): exercise is ClozeExercise => exercise !== null)
  const typed = words.map(
    (word): TypeExercise => ({ kind: 'type', id: `type:${word.id}`, vocab: word, direction: 'to-learning' }),
  )
  return interleave([...sample(clozes, 4, rng), ...sample(typed, 4, rng), ...matchRounds(words, 1, rng)], rng)
}

/**
 * Grammaire : on relit la règle, puis on l'applique.
 *
 * Aux premiers passages la phrase se complète en choisissant parmi les formes
 * proposées (quand l'auteur en a fourni) ; ensuite la réponse se saisit, ce
 * qui interdit de reconnaître sans produire.
 */
function buildGrammarSession(
  lessonId: string,
  points: readonly GrammarPoint[],
  notes: string | undefined,
  title: string,
  level: number,
  seed: number,
): Exercise[] {
  const rng = createRng(seed)
  const shuffled = shuffle(points, rng)
  const guided = level <= 0

  const gaps = shuffled.map(
    (point): GrammarGapExercise => ({
      kind: 'grammar-gap',
      id: `gap:${point.id}`,
      point,
      bank: guided && point.options.length > 1 ? shuffle(point.options, rng) : null,
    }),
  )

  // Le rappel de cours n'apparaît qu'à la découverte : au-delà, il donnerait
  // la réponse avant même la question.
  const preamble: Exercise[] =
    level <= 0 && notes ? [{ kind: 'rule', id: `rule:${lessonId}`, title, notes }] : []

  return [...preamble, ...gaps]
}

/**
 * Conjugaison : on relie d'abord les personnes aux formes, puis on produit
 * les formes de mémoire.
 */
function buildConjugationSession(
  lessonId: string,
  verbs: readonly ConjugationVerb[],
  notes: string | undefined,
  title: string,
  level: number,
  seed: number,
): Exercise[] {
  const rng = createRng(seed)
  const preamble: Exercise[] =
    level <= 0 && notes ? [{ kind: 'rule', id: `rule:${lessonId}`, title, notes }] : []

  const matches = verbs
    .filter((verb) => verb.forms.length >= 2)
    .map(
      (verb): ConjugationMatchExercise => ({
        kind: 'conjugation-match',
        id: `cmatch:${verb.verb}:${verb.tense}`,
        verb,
        forms: verb.forms,
      }),
    )

  const typed = shuffle(
    verbs.flatMap((verb) =>
      verb.forms.map(
        (form): ConjugationExercise => ({ kind: 'conjugation', id: `conj:${form.id}`, verb, form }),
      ),
    ),
    rng,
  )

  // À la découverte, l'association sert de présentation du tableau ; ensuite
  // on va droit à la production.
  if (level <= 0) return [...preamble, ...shuffle(matches, rng), ...typed]
  if (level === 1) return interleave([...sample(matches, 1, rng), ...typed], rng)
  return typed
}

/**
 * Session de révision : construite à partir des cartes échues, tous cours
 * confondus. Les cartes encore fragiles restent en reconnaissance, les
 * cartes solides passent à la production.
 */
export function buildReviewSession(
  entries: readonly { card: CardState; item: PracticeItem }[],
  seed?: number,
): Exercise[] {
  if (entries.length === 0) return []
  const rng = createRng(seed ?? seedFrom('review', entries.length, entries[0]!.item.id))

  // Les distracteurs des banques de mots viennent des autres mots à réviser.
  const vocabPool = entries
    .map((entry) => (entry.item.kind === 'vocab' ? entry.item.vocab : null))
    .filter((vocab): vocab is Vocab => vocab !== null)

  const exercises = entries.map(({ card, item }): Exercise => {
    const solid = card.step === null && card.interval >= 7

    if (item.kind === 'grammar') {
      return {
        kind: 'grammar-gap',
        id: `gap:${item.id}`,
        point: item.point,
        bank: !solid && item.point.options.length > 1 ? shuffle(item.point.options, rng) : null,
      }
    }

    if (item.kind === 'conjugation') {
      return { kind: 'conjugation', id: `conj:${item.id}`, verb: item.verb, form: item.form }
    }

    const vocab = item.vocab
    if (solid) {
      const cloze = clozeFor(vocab, null, rng)
      if (cloze && rng() < 0.5) return cloze
      return { kind: 'type', id: `type:${vocab.id}`, vocab, direction: 'to-learning' }
    }
    const cloze = clozeFor(vocab, vocabPool, rng)
    if (cloze && rng() < 0.4) return cloze
    return { kind: 'flashcard', id: `flash:${vocab.id}`, vocab, direction: 'to-known' }
  })

  const rounds = matchRounds(vocabPool, vocabPool.length >= MATCH_SIZE ? 1 : 0, rng)
  return [...shuffle(exercises, rng), ...rounds]
}

/** Découpe une phrase de grammaire autour de son marqueur `___`. */
export function splitGap(sentence: string): { before: string; after: string } {
  const at = sentence.indexOf(GAP)
  if (at === -1) return { before: sentence, after: '' }
  return { before: sentence.slice(0, at), after: sentence.slice(at + GAP.length) }
}

/** Vérifie une réponse de grammaire ou de conjugaison. */
export function matchesAnswer(expected: string, alt: readonly string[], value: string): boolean {
  const given = normalizeAnswer(value)
  return given.length > 0 && [expected, ...alt].some((candidate) => normalizeAnswer(candidate) === given)
}

/** Nombre d'éléments distincts qu'une leçon fera travailler. */
export function itemCountOf(lesson: Lesson): number {
  return itemsOfLesson(lesson).length
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
  const idsA = new Set(itemIdsOf(a))
  return itemIdsOf(b).some((id) => idsA.has(id))
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
