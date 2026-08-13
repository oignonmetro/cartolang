import type { ConjugationForm, ConjugationVerb, GrammarPoint, Lesson, PracticeItem, Vocab } from '@/content/schema'
import { GAP } from '@/content/schema'
import { itemsOfLesson } from '@/content/course'
import { findVocabGap, type TermSplit } from '@/content/text'
import { createRng, sample, seedFrom, shuffle, type Rng } from './rng'
import type { CardState } from './srs'

/**
 * Génération des exercices d'une session.
 *
 * Pour le vocabulaire, une leçon se découpe en blocs de trois-quatre mots
 * nouveaux : chaque bloc les présente, puis les fait travailler avant de
 * passer aux suivants, plutôt que de présenter tous les mots d'un coup pour
 * les noyer ensuite dans un grand mélange. Cinq familles d'exercices :
 *   - `intro`     : présentation d'un mot nouveau, avec auto-évaluation en trois
 *                   boutons — tout est déjà visible, inutile de le redemander
 *                   aussitôt dans une flashcard séparée ;
 *   - `match`     : relier des mots à leurs traductions ;
 *   - `choice`    : reconnaître la bonne traduction parmi des leurres (QCM) ;
 *   - `cloze`     : compléter une phrase en piochant dans une banque de mots ;
 *   - `flashcard` / `type` : réservés aux sessions de révision et
 *                   d'entraînement (`buildMixedSession`), qui reprennent des
 *                   mots déjà rencontrés plutôt qu'une leçon neuve.
 *
 * La grammaire et la conjugaison ne se ramènent pas à des paires
 * terme/traduction : elles ont leurs propres exercices, et suivent elles le
 * niveau de maîtrise de la leçon — on y reconnaît d'abord, on y produit
 * ensuite.
 *   - `rule`         : présentation d'un point de grammaire avant pratique ;
 *   - `grammar-gap`  : phrase trouée, au clavier ou parmi des formes proposées ;
 *   - `conjugation`  : produire une forme à partir du verbe, du temps, de la personne ;
 *   - `conjugation-match` : relier les personnes aux formes d'un même verbe.
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

export interface ChoiceExercise {
  kind: 'choice'
  id: string
  vocab: Vocab
  direction: Direction
  /** La bonne réponse et ses leurres, déjà mélangés. */
  options: string[]
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
  /** Nature de la leçon : l'écran s'accorde à la couleur de sa piste. */
  topic: 'grammar' | 'conjugation'
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
  | ChoiceExercise
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
/** Nombre d'options (bonne réponse comprise) proposées dans un QCM. */
const CHOICE_SIZE = 3

/** Les exercices qui présentent sans évaluer : ils ne comptent pas dans le score. */
export function isPresentation(exercise: Exercise): boolean {
  return exercise.kind === 'rule'
}

/** Les éléments dont dépend un exercice : ce sont eux qui reçoivent la note. */
export function itemIdsOf(exercise: Exercise): string[] {
  switch (exercise.kind) {
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
 * QCM : reconnaître la bonne traduction parmi des leurres piochés dans le
 * reste du bassin. `null` quand le bassin est trop petit pour offrir au
 * moins un leurre distinct de la réponse — un QCM à une seule option ne
 * teste rien.
 */
function choiceFor(vocab: Vocab, direction: Direction, pool: readonly Vocab[], rng: Rng): ChoiceExercise | null {
  const answer = direction === 'to-known' ? vocab.translation : vocab.term
  const candidates = shuffle(
    pool.filter((item) => item.id !== vocab.id),
    rng,
  )
  const distractors: string[] = []
  for (const item of candidates) {
    if (distractors.length >= CHOICE_SIZE - 1) break
    const word = direction === 'to-known' ? item.translation : item.term
    if (normalizeAnswer(word) === normalizeAnswer(answer)) continue
    if (distractors.some((seen) => normalizeAnswer(seen) === normalizeAnswer(word))) continue
    distractors.push(word)
  }
  if (distractors.length === 0) return null
  return { kind: 'choice', id: `choice:${vocab.id}`, vocab, direction, options: shuffle([answer, ...distractors], rng) }
}

function choiceRounds(pool: readonly Vocab[], count: number, rng: Rng): ChoiceExercise[] {
  return sample(pool, count, rng)
    .map((word) => choiceFor(word, 'to-learning', pool, rng))
    .filter((exercise): exercise is ChoiceExercise => exercise !== null)
}

/** Mots nouveaux présentés avant de les pratiquer, par bloc. */
const BLOCK_SIZE = 4

/**
 * Découpe une leçon en blocs de trois-quatre mots. Un reliquat d'un ou deux
 * mots rejoint le bloc précédent plutôt que de former son propre petit bloc
 * solitaire : mieux vaut un dernier bloc un peu plus riche qu'un bloc de un
 * seul mot qui n'aurait même pas de quoi remplir une manche d'association.
 */
function blocksOf(words: readonly Vocab[]): Vocab[][] {
  const blocks: Vocab[][] = []
  for (let i = 0; i < words.length; i += BLOCK_SIZE) blocks.push(words.slice(i, i + BLOCK_SIZE))
  const last = blocks[blocks.length - 1]
  if (blocks.length > 1 && last!.length < 3) {
    const previous = blocks[blocks.length - 2]!
    blocks.splice(blocks.length - 2, 2, [...previous, ...last!])
  }
  return blocks
}

/** Un nombre entier au hasard entre `min` et `max`, bornes comprises. */
function between(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/**
 * Session d'une leçon, quelle que soit sa nature.
 *
 * `level` ne joue que pour la grammaire et la conjugaison : c'est le nombre
 * d'étoiles déjà obtenues (0 à 2), qui détermine la difficulté du passage
 * suivant (présentation puis reconnaissance, puis production). Le
 * vocabulaire l'ignore : ses blocs suivent toujours la même progression,
 * quel que soit le nombre de passages sur la leçon.
 */
export function buildLessonSession(lesson: Lesson, level: number, seed?: number): Exercise[] {
  const resolved = seed ?? seedFrom(lesson.id, level)
  switch (lesson.kind) {
    case 'vocab':
      return buildVocabSession(lesson.vocab, resolved)
    case 'grammar':
      return buildGrammarSession(lesson.id, lesson.points, lesson.notes, lesson.title, level, resolved)
    case 'conjugation':
      return buildConjugationSession(lesson.id, lesson.verbs, lesson.notes, lesson.title, level, resolved)
  }
}

/** Manches d'association et de QCM par bloc — un peu de variété d'une leçon à l'autre. */
const MATCH_ROUNDS_PER_BLOCK = [2, 3] as const
const CHOICE_ROUNDS_PER_BLOCK = [2, 3] as const
/** Phrases à trou par bloc, toujours en banque de mots à ce stade. */
const CLOZE_PER_BLOCK = 2

/**
 * Session de vocabulaire, construite bloc par bloc plutôt qu'en présentant
 * la leçon entière d'un coup : trois-quatre mots nouveaux, puis quelques
 * manches d'association, quelques QCM, deux phrases à trou, et on
 * recommence avec les mots suivants s'il en reste. Les exercices d'un bloc
 * piochent dans tous les mots déjà présentés, pas seulement les siens — le
 * chemin révise en avançant plutôt que de cloisonner chaque bloc.
 */
function buildVocabSession(vocab: readonly Vocab[], seed: number): Exercise[] {
  const rng = createRng(seed)
  const blocks = blocksOf(shuffle(vocab, rng))

  const exercises: Exercise[] = []
  const pool: Vocab[] = []
  for (const block of blocks) {
    pool.push(...block)

    const blockExercises: Exercise[] = block.map(
      (word): IntroExercise => ({ kind: 'intro', id: `intro:${word.id}`, vocab: word }),
    )
    blockExercises.push(...matchRounds(pool, between(...MATCH_ROUNDS_PER_BLOCK, rng), rng))
    blockExercises.push(...choiceRounds(pool, between(...CHOICE_ROUNDS_PER_BLOCK, rng), rng))

    const clozes = pool
      .map((word) => clozeFor(word, pool, rng))
      .filter((exercise): exercise is ClozeExercise => exercise !== null)
    blockExercises.push(...sample(clozes, CLOZE_PER_BLOCK, rng))

    // Un QCM juste après une manche d'association peut retomber sur le même
    // mot, ou une phrase à trou reprendre celui du QCM qui la précède : ces
    // chocs locaux sont désamorcés à l'intérieur du bloc. La correction reste
    // bornée au bloc plutôt qu'à la session entière, sinon elle pourrait
    // aller chercher un mot du bloc suivant et faire apparaître sa
    // présentation en avance, avant même le reste de son propre bloc.
    exercises.push(...avoidAdjacentRepeats(blockExercises))
  }
  return exercises
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
    level <= 0 && notes ? [{ kind: 'rule', id: `rule:${lessonId}`, title, notes, topic: 'grammar' }] : []

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
    level <= 0 && notes ? [{ kind: 'rule', id: `rule:${lessonId}`, title, notes, topic: 'conjugation' }] : []

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
 * Intervalle à partir duquel on retire les aides : plus de banque de mots
 * sous la phrase à trou, la réponse se saisit. Trois jours, soit la première
 * révision réussie après la graduation.
 */
const UNAIDED_INTERVAL = 3

/**
 * Intervalle à partir duquel on demande le mot en production libre — voir la
 * traduction française et écrire le mot anglais, sans contexte.
 *
 * Sept jours, soit deux révisions réussies après la graduation. C'est le
 * rappel le plus coûteux qui soit : tant que la carte n'a pas tenu quelques
 * jours, le mot n'est simplement pas encore récupérable, et le demander ne
 * teste rien — ça ne fait qu'enseigner l'échec. La reconnaissance, puis la
 * traduction vers le français, préparent ce rappel-là au lieu de le brusquer.
 */
const PRODUCTION_INTERVAL = 7

/**
 * Échelon de rappel qu'une carte est en état de soutenir.
 *
 *   `recognize`  : la carte est encore en apprentissage, elle n'a pas passé
 *                  une nuit — on la reconnaît, on ne la produit pas ;
 *   `comprehend` : elle a gradué, on la rappelle dans le sens facile
 *                  (anglais → français : la réponse est dans sa langue) ;
 *   `produce`    : elle a tenu plusieurs jours, elle peut se produire de
 *                  mémoire dans la langue apprise.
 *
 * Une rechute remet l'intervalle à zéro et rend la carte à l'apprentissage :
 * un mot oublié redescend donc de lui-même à la reconnaissance.
 */
type RecallStage = 'recognize' | 'comprehend' | 'produce'

function recallStage(card: CardState): RecallStage {
  if (card.step !== null) return 'recognize'
  if (card.interval < PRODUCTION_INTERVAL) return 'comprehend'
  return 'produce'
}

/**
 * Session mélangée à partir de cartes existantes.
 *
 * `unaided` distingue les deux usages : la révision laisse les aides
 * (banque de mots, auto-évaluation), l'entraînement les retire et fait
 * réellement saisir la réponse — c'est ce qu'on vient y chercher.
 *
 * Ce qu'il ne fait pas, c'est décider du sens de traduction : celui-ci suit
 * la maturité de chaque carte et rien d'autre. Forcer la production libre
 * parce que l'étape s'appelle « approfondissement » revenait à réclamer des
 * mots vus quelques minutes plus tôt.
 */
function buildMixedSession(
  entries: readonly { card: CardState; item: PracticeItem }[],
  seed: number,
  drill: boolean,
): Exercise[] {
  if (entries.length === 0) return []
  const rng = createRng(seed)

  // Les distracteurs des banques de mots viennent des autres mots de la session.
  const vocabPool = entries
    .map((entry) => (entry.item.kind === 'vocab' ? entry.item.vocab : null))
    .filter((vocab): vocab is Vocab => vocab !== null)

  const exercises = entries.map(({ card, item }): Exercise => {
    const unaided = drill || card.interval >= UNAIDED_INTERVAL

    if (item.kind === 'grammar') {
      return {
        kind: 'grammar-gap',
        id: `gap:${item.id}`,
        point: item.point,
        bank: !unaided && item.point.options.length > 1 ? shuffle(item.point.options, rng) : null,
      }
    }

    if (item.kind === 'conjugation') {
      return { kind: 'conjugation', id: `conj:${item.id}`, verb: item.verb, form: item.form }
    }

    const vocab = item.vocab
    const stage = recallStage(card)

    if (stage === 'produce') {
      const cloze = clozeFor(vocab, null, rng)
      if (cloze && rng() < 0.5) return cloze
      return { kind: 'type', id: `type:${vocab.id}`, vocab, direction: 'to-learning' }
    }

    if (stage === 'comprehend') {
      // La phrase à trou porte le mot anglais : elle reste un rappel dans la
      // langue apprise, mais le contexte le tire, là où la page blanche ne
      // tire rien. À défaut, on demande le sens — réponse en français.
      const cloze = clozeFor(vocab, unaided ? null : vocabPool, rng)
      if (cloze && rng() < 0.5) return cloze
      return { kind: 'type', id: `type:${vocab.id}`, vocab, direction: 'to-known' }
    }

    // Carte encore en apprentissage : reconnaissance seulement, et la banque
    // de mots reste même à l'entraînement — retirer l'aide ici reviendrait à
    // réclamer de mémoire un mot rencontré quelques minutes plus tôt. Ce que
    // l'entraînement change, c'est la fréquence de la phrase à trou : un vrai
    // rappel, là où la flashcard se contente d'une auto-évaluation.
    const cloze = clozeFor(vocab, vocabPool, rng)
    if (cloze && rng() < (drill ? 0.7 : 0.4)) return cloze
    return { kind: 'flashcard', id: `flash:${vocab.id}`, vocab, direction: 'to-known' }
  })

  const rounds = matchRounds(vocabPool, vocabPool.length >= MATCH_SIZE ? 1 : 0, rng)
  return [...shuffle(exercises, rng), ...rounds]
}

/**
 * Session de révision : construite à partir des cartes échues, avec leurs
 * aides. Chaque carte est interrogée à l'échelon qu'elle a atteint — on
 * reconnaît, puis on traduit vers le français, puis on produit en anglais.
 */
export function buildReviewSession(
  entries: readonly { card: CardState; item: PracticeItem }[],
  seed?: number,
): Exercise[] {
  if (entries.length === 0) return []
  return buildMixedSession(entries, seed ?? seedFrom('review', entries.length, entries[0]!.item.id), false)
}

/**
 * Session d'entraînement : les éléments déjà rencontrés d'une unité, mélangés,
 * sans attendre les échéances et sans les aides — banque de mots retirée,
 * réponse réellement saisie plutôt qu'auto-évaluée.
 *
 * Ce n'est pas une révision anticipée : c'est l'alternative au fait de rejouer
 * une leçon à l'identique. Mélanger les éléments de toute l'unité ancre mieux
 * que de reprendre un bloc déjà vu dans le même ordre.
 *
 * L'exigence porte sur les aides, jamais sur le sens de traduction : celui-ci
 * suit la maturité de chaque carte, faute de quoi l'étape réclamerait en
 * production libre des mots vus le jour même.
 */
export function buildPracticeSession(
  entries: readonly { card: CardState; item: PracticeItem }[],
  seed?: number,
): Exercise[] {
  if (entries.length === 0) return []
  return buildMixedSession(entries, seed ?? seedFrom('practice', entries.length, entries[0]!.item.id), true)
}

/** Découpe une phrase de grammaire autour de son marqueur `___`. */
export function splitGap(sentence: string): { before: string; after: string } {
  const at = sentence.indexOf(GAP)
  if (at === -1) return { before: sentence, after: '' }
  return { before: sentence.slice(0, at), after: sentence.slice(at + GAP.length) }
}

/**
 * Vérifie une réponse de grammaire ou de conjugaison.
 *
 * Comparaison stricte sur l'article et le « to » : les variantes réellement
 * acceptables se déclarent dans `alt`, elles ne se devinent pas.
 */
export function matchesAnswer(expected: string, alt: readonly string[], value: string): boolean {
  const given = normalizeForm(value)
  return given.length > 0 && [expected, ...alt].some((candidate) => normalizeForm(candidate) === given)
}

/** Nombre d'éléments distincts qu'une leçon fera travailler. */
export function itemCountOf(lesson: Lesson): number {
  return itemsOfLesson(lesson).length
}

/** Mélange en évitant, autant que possible, deux exercices de suite sur le même mot. */
function interleave(exercises: readonly Exercise[], rng: Rng): Exercise[] {
  return avoidAdjacentRepeats(shuffle(exercises, rng))
}

/**
 * Réordonne localement pour qu'un exercice n'enchaîne pas, autant que
 * possible, sur le même mot que le précédent. Une manche d'association fait
 * exception des deux côtés : elle porte quatre mots à la fois, alors la
 * corriger déplacerait un exercice d'un autre type pour rien — et pour le
 * vocabulaire, ça romprait justement l'ordre mots → paires → QCM → trous
 * que les blocs veulent imposer.
 */
function avoidAdjacentRepeats(exercises: readonly Exercise[]): Exercise[] {
  const result = exercises.slice()
  for (let i = 1; i < result.length; i++) {
    if (result[i - 1].kind === 'match' || result[i].kind === 'match') continue
    if (!sharesVocab(result[i - 1], result[i])) continue
    const swap = result.findIndex(
      (candidate, index) =>
        index > i &&
        candidate.kind !== 'match' &&
        !sharesVocab(result[i - 1], candidate) &&
        (index + 1 >= result.length || !sharesVocab(result[i], result[index + 1])),
    )
    if (swap !== -1) [result[i], result[swap]] = [result[swap], result[i]]
  }
  return result
}

function sharesVocab(a: Exercise, b: Exercise): boolean {
  const idsA = new Set(itemIdsOf(a))
  return itemIdsOf(b).some((id) => idsA.has(id))
}

/** Casse, accents, ponctuation : ce qu'on ignore dans tous les cas. */
function normalizeCore(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:"“”()]/g, '')
    .replace(/[’‘]/g, "'")
}

function collapse(value: string): string {
  return value
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Forme exacte attendue — grammaire, conjugaison, phrase à trou.
 *
 * Ici l'article et le « to » de l'infinitif ne sont pas du bruit : ils sont
 * souvent l'objet même de l'exercice. Les ignorer reviendrait à accepter
 * « a little » là où la leçon enseigne « little », ou « postpone » là où elle
 * enseigne « to postpone » — soit exactement la distinction qu'on évalue.
 */
export function normalizeForm(value: string): string {
  return collapse(normalizeCore(value))
}

/**
 * Réponse de vocabulaire saisie au clavier.
 * On ignore en plus les articles courants et le « to » de l'infinitif :
 * l'exercice porte sur le mot, pas sur son déterminant.
 */
export function normalizeAnswer(value: string): string {
  return collapse(normalizeCore(value).replace(/^(le |la |les |l'|un |une |des |to |the |a |an )/, ''))
}

export function isAnswerCorrect(vocab: Vocab, direction: Direction, value: string): boolean {
  const expected =
    direction === 'to-known' ? [vocab.translation, ...vocab.alt] : [vocab.term]
  const given = normalizeAnswer(value)
  return given.length > 0 && expected.some((candidate) => normalizeAnswer(candidate) === given)
}
