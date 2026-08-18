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
 *                   aussitôt dans une flashcard séparée. Réservée aux mots
 *                   sans carte de révision : rejouer une leçon déjà sue ne
 *                   la réintroduit pas ;
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
 * ensuite. Elles se découpent elles aussi en blocs, et chaque élément y
 * gravit une échelle d'exigence (voir `grammarLadder`, `conjugationLadder`)
 * au lieu de recevoir toujours le même exercice.
 *   - `rule`         : présentation d'un point de grammaire avant pratique ;
 *   - `grammar-choice` : choisir la phrase entière correcte parmi ses variantes ;
 *   - `grammar-gap`  : phrase trouée, au clavier ou parmi des formes proposées ;
 *   - `conjugation-choice` : reconnaître une forme parmi celles du paradigme ;
 *   - `conjugation`  : produire une forme à partir du verbe, du temps, de la personne ;
 *   - `conjugation-match` : relier les personnes aux formes, d'un verbe ou de plusieurs mélangés.
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

/**
 * Ce qu'un QCM montre comme énoncé.
 *
 * Un mot n'a qu'une traduction et qu'une phrase d'exemple, mais il a plusieurs
 * façons d'être demandé — et c'est ce qui manquait : la leçon ne posait qu'une
 * seule question par mot, toujours la même (« voici le français, trouvez
 * l'anglais »), si bien que vingt-trois exercices se ramenaient à quatre
 * gabarits.
 *
 *   `term`        : le mot anglais, on choisit son sens ;
 *   `translation` : le mot français, on choisit la forme anglaise ;
 *   `hint`        : la note d'usage, on retrouve le mot sans que le français
 *                   ne serve de béquille — c'est le rappel le plus exigeant
 *                   des cinq, mais peu de mots en ont une ;
 *   `sentence`    : la phrase d'exemple traduite, on choisit le mot anglais
 *                   qui convient là. Le sens se lit dans le contexte plutôt
 *                   que dans une paire de mots isolés ;
 *   `audio`       : le mot prononcé, on choisit son orthographe. L'anglais
 *                   ne s'écrit pas comme il se dit : sans ça, la moitié du
 *                   mot reste non apprise.
 */
export type ChoiceCue = 'term' | 'translation' | 'hint' | 'sentence' | 'audio'

export interface ChoiceExercise {
  kind: 'choice'
  id: string
  vocab: Vocab
  cue: ChoiceCue
  /** La bonne réponse et ses leurres, déjà mélangés. */
  options: string[]
}

/** La réponse attendue : le sens quand on montre le mot, la forme sinon. */
export function choiceAnswer(vocab: Vocab, cue: ChoiceCue): string {
  return cue === 'term' ? vocab.translation : vocab.term
}

/**
 * L'énoncé affiché. Les replis (`??`) ne servent qu'à garder la fonction
 * totale : `cuesFor` n'a proposé `hint` et `sentence` que si le contenu existe.
 */
export function choicePrompt(vocab: Vocab, cue: ChoiceCue): string {
  switch (cue) {
    case 'term':
      return vocab.term
    case 'translation':
      return vocab.translation
    case 'hint':
      return vocab.hint ?? vocab.translation
    case 'sentence':
      return vocab.example?.translation ?? vocab.translation
    case 'audio':
      return vocab.term
  }
}

/** L'énoncé est-il dans la langue apprise ? Sert à l'attribut `lang`. */
export function choicePromptIsEnglish(cue: ChoiceCue): boolean {
  return cue === 'term'
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

/**
 * L'aide affichée sous une phrase de grammaire.
 *
 *   `translation` : la traduction française de la phrase est donnée — le sens
 *                   visé est acquis, il ne reste qu'à trouver la forme ;
 *   `sentence`    : la phrase anglaise seule. C'est la grammaire qui doit
 *                   trancher, sans que le français ne désigne la réponse.
 *
 * C'est l'écart entre les deux qui manquait : la traduction était affichée à
 * tous les coups, si bien qu'un point ne pouvait jamais être demandé deux fois
 * sans être demandé deux fois de la même façon.
 */
export type GrammarCue = 'translation' | 'sentence'

export interface GrammarGapExercise {
  kind: 'grammar-gap'
  id: string
  point: GrammarPoint
  cue: GrammarCue
  /** Formes proposées, ou `null` quand la réponse se saisit au clavier. */
  bank: string[] | null
}

/**
 * Choisir la phrase entière correcte plutôt que la forme isolée : chaque
 * option est la phrase complétée par l'une des formes plausibles. Le trou seul
 * se traite parfois par élimination mécanique ; la phrase entière oblige à la
 * relire, et c'est là que la règle s'entend.
 */
export interface GrammarChoiceExercise {
  kind: 'grammar-choice'
  id: string
  point: GrammarPoint
  /** Phrases complètes — la bonne et ses variantes fautives, déjà mélangées. */
  options: string[]
}

/**
 * Sous quelle forme le verbe est donné.
 *
 *   `verb`        : l'infinitif anglais (« to work ») ;
 *   `translation` : l'infinitif français (« travailler »). Il faut alors
 *                   retrouver le verbe anglais *avant* de le conjuguer, ce qui
 *                   est le rappel réellement utile pour parler.
 */
export type ConjugationCue = 'verb' | 'translation'

export interface ConjugationExercise {
  kind: 'conjugation'
  id: string
  verb: ConjugationVerb
  form: ConjugationForm
  cue: ConjugationCue
}

/**
 * Reconnaître une forme parmi celles du paradigme. Les leurres sont d'abord
 * les autres personnes du même verbe — « have been working » contre « has been
 * working » est exactement la confusion que la leçon veut lever.
 */
export interface ConjugationChoiceExercise {
  kind: 'conjugation-choice'
  id: string
  verb: ConjugationVerb
  form: ConjugationForm
  cue: ConjugationCue
  options: string[]
}

/**
 * Association personnes ↔ formes. Un seul verbe présente son tableau
 * complet ; plusieurs verbes — toujours du même temps, puisqu'une leçon de
 * conjugaison n'en couvre qu'un — mélangent leurs paradigmes dans une seule
 * manche, ce qui teste une discrimination que le tableau isolé ne teste pas :
 * savoir à quel verbe appartient telle forme, pas seulement à quelle personne.
 */
export interface ConjugationMatchExercise {
  kind: 'conjugation-match'
  id: string
  verbs: ConjugationVerb[]
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
  | GrammarChoiceExercise
  | ConjugationExercise
  | ConjugationChoiceExercise
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
      return exercise.verbs.flatMap((verb) => verb.forms.map((form) => form.id))
    case 'grammar-gap':
    case 'grammar-choice':
      return [exercise.point.id]
    case 'conjugation':
    case 'conjugation-choice':
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

/**
 * Manches d'association.
 *
 * Le nombre demandé est plafonné par ce que le bassin peut réellement offrir
 * de manches *différentes* : avec exactement quatre mots disponibles, tirer
 * quatre paires rend toujours les mêmes quatre, et l'on enchaînait trois fois
 * de suite la même grille à l'ordre près — la répétition la plus visible de
 * toute la leçon.
 */
function matchRounds(pool: readonly Vocab[], rounds: number, rng: Rng): MatchExercise[] {
  if (pool.length < MATCH_SIZE) return []

  const result: MatchExercise[] = []
  const seen = new Set<string>()
  // Le tirage peut retomber sur la même grille : on redemande quelques fois
  // plutôt que d'accepter un doublon. La borne évite de tourner en rond quand
  // le bassin ne peut tout simplement plus offrir de composition inédite.
  for (let round = 0; round < rounds; round++) {
    let pairs: Vocab[] | null = null
    for (let attempt = 0; attempt < 8 && !pairs; attempt++) {
      const draw = sample(pool, MATCH_SIZE, rng)
      const composition = draw
        .map((word) => word.id)
        .sort()
        .join()
      if (!seen.has(composition)) {
        seen.add(composition)
        pairs = draw
      }
    }
    if (!pairs) break
    result.push({ kind: 'match', id: `match:${round}:${pairs.map((p) => p.id).join('-')}`, pairs })
  }
  return result
}

/**
 * QCM : reconnaître la bonne réponse parmi des leurres piochés dans le reste
 * du bassin. `null` quand le bassin est trop petit pour offrir au moins un
 * leurre distinct de la réponse — un QCM à une seule option ne teste rien.
 */
function choiceFor(vocab: Vocab, cue: ChoiceCue, pool: readonly Vocab[], rng: Rng): ChoiceExercise | null {
  const answer = choiceAnswer(vocab, cue)
  const candidates = shuffle(
    pool.filter((item) => item.id !== vocab.id),
    rng,
  )
  const distractors: string[] = []
  for (const item of candidates) {
    if (distractors.length >= CHOICE_SIZE - 1) break
    // Les leurres se prennent du même côté que la réponse : proposer des sens
    // français en face d'un énoncé qui attend une forme anglaise donnerait un
    // QCM où la bonne case se repère à la langue.
    const word = choiceAnswer(item, cue)
    if (normalizeAnswer(word) === normalizeAnswer(answer)) continue
    if (distractors.some((seen) => normalizeAnswer(seen) === normalizeAnswer(word))) continue
    distractors.push(word)
  }
  if (distractors.length === 0) return null
  return {
    kind: 'choice',
    // L'énoncé entre dans l'identifiant : deux QCM sur le même mot sont deux
    // exercices distincts, pas deux rendus du même.
    id: `choice:${cue}:${vocab.id}`,
    vocab,
    cue,
    options: shuffle([answer, ...distractors], rng),
  }
}

/** Les énoncés qu'un mot peut réellement soutenir, selon ce que l'auteur a écrit. */
function cuesFor(vocab: Vocab, canSpeak: boolean): ChoiceCue[] {
  const cues: ChoiceCue[] = ['term', 'translation']
  // `hint` est une remarque sur le mot (prononciation, faux ami…), pas un
  // indice conçu pour désigner un mot parmi d'autres. Pour une lettre, cette
  // remarque décrit souvent un trait partagé par plusieurs lettres à la fois
  // (« même forme, même son qu'en français ») : le QCM redeviendrait un choix
  // au hasard entre elles. Les mots ordinaires y échappent, une remarque de
  // vocabulaire visant en pratique à distinguer le mot qu'elle décrit.
  if (vocab.hint && vocab.pos !== 'lettre') cues.push('hint')
  if (vocab.example) cues.push('sentence')
  if (canSpeak) cues.push('audio')
  return cues
}

/**
 * N'importe quel exercice encore inédit pour ce mot, pour le rattrapage de
 * couverture. On tente le QCM d'abord — il marche pour tout mot, là où la
 * phrase à trou demande un exemple exploitable.
 */
function firstAvailableExercise(
  word: Vocab,
  pool: readonly Vocab[],
  served: Served,
  canSpeak: boolean,
  rng: Rng,
): Exercise | null {
  for (const cue of shuffle(cuesFor(word, canSpeak), rng)) {
    if (hasServed(served, word.id, `choice:${cue}`)) continue
    const exercise = choiceFor(word, cue, pool, rng)
    if (!exercise) continue
    markServed(served, word.id, `choice:${cue}`)
    return exercise
  }
  if (!hasServed(served, word.id, 'cloze')) {
    const exercise = clozeFor(word, pool, rng)
    if (exercise) {
      markServed(served, word.id, 'cloze')
      return exercise
    }
  }
  return null
}

/** Mots nouveaux présentés avant de les pratiquer, par bloc. */
const BLOCK_SIZE = 4

/**
 * Découpe une leçon en blocs. Un reliquat trop maigre rejoint le bloc
 * précédent plutôt que de former son propre petit bloc solitaire : mieux vaut
 * un dernier bloc un peu plus riche qu'un bloc de un seul élément, qui n'aurait
 * même pas de quoi remplir une manche d'association.
 */
function blocksOf<T>(items: readonly T[], size = BLOCK_SIZE): T[][] {
  const blocks: T[][] = []
  for (let i = 0; i < items.length; i += size) blocks.push(items.slice(i, i + size))
  const last = blocks[blocks.length - 1]
  if (blocks.length > 1 && last!.length < size - 1) {
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
 * quel que soit le nombre de passages sur la leçon — sauf pour la
 * présentation elle-même, qui suit `cards` plutôt que `level` (voir
 * `buildVocabSession`).
 */
export function buildLessonSession(
  lesson: Lesson,
  level: number,
  seed?: number,
  cards: Record<string, CardState> = {},
  /**
   * L'appareil sait-il prononcer ? Passé en paramètre plutôt que lu depuis
   * `lib/speech` : le moteur reste pur, testable sans navigateur, et une
   * session ne dépend pas d'un import à effet de bord.
   */
  canSpeak = false,
): Exercise[] {
  const resolved = seed ?? seedFrom(lesson.id, level)
  switch (lesson.kind) {
    case 'vocab':
      return buildVocabSession(lesson.vocab, cards, resolved, canSpeak)
    case 'grammar':
      return buildGrammarSession(lesson.id, lesson.points, lesson.notes, lesson.title, level, resolved)
    case 'conjugation':
      return buildConjugationSession(lesson.id, lesson.verbs, lesson.notes, lesson.title, level, resolved)
  }
}

/** Manches d'association et de QCM par bloc — un peu de variété d'une leçon à l'autre. */
const MATCH_ROUNDS_PER_BLOCK = [1, 2] as const
const CHOICE_ROUNDS_PER_BLOCK = [3, 4] as const
/** Phrases à trou par bloc, toujours en banque de mots à ce stade. */
const CLOZE_PER_BLOCK = 2

/**
 * Ce qu'un mot a déjà reçu dans la session en cours.
 *
 * Sans cette mémoire, un mot pouvait recevoir deux fois sa phrase à trou —
 * la même phrase, le même trou — parce que chaque bloc repioche dans tout le
 * bassin sans savoir ce que les blocs précédents ont déjà servi.
 */
type Served = Map<string, Set<string>>

function hasServed(served: Served, wordId: string, signature: string): boolean {
  return served.get(wordId)?.has(signature) ?? false
}

function markServed(served: Served, wordId: string, signature: string): void {
  const seen = served.get(wordId) ?? new Set<string>()
  seen.add(signature)
  served.set(wordId, seen)
}

/** Combien d'exercices ciblés ce mot a déjà reçus (les manches d'association exclues). */
function servedCount(served: Served, wordId: string): number {
  return served.get(wordId)?.size ?? 0
}

/**
 * Ordonne le bassin du moins servi au plus servi, à égalité au hasard.
 *
 * Le tirage uniforme laissait des mots sans le moindre exercice ciblé de toute
 * la leçon — vus une fois à la présentation, noyés ensuite dans les manches
 * d'association, jamais interrogés seuls.
 */
function leastServedFirst(pool: readonly Vocab[], served: Served, rng: Rng): Vocab[] {
  return shuffle(pool, rng).sort((a, b) => servedCount(served, a.id) - servedCount(served, b.id))
}

/**
 * Remplit un budget d'exercices en servant, à chaque tour, l'élément le moins
 * servi jusque-là.
 *
 * Le recalcul à chaque tour n'est pas un détail : un tri unique en début de
 * bloc épuisait l'échelle d'exigence des points déjà rencontrés avant d'avoir
 * donné le moindre second exercice aux nouveaux — les premiers points d'une
 * leçon en recevaient trois, les derniers un seul.
 *
 * `next` rend l'exercice suivant que l'élément peut encore soutenir, ou `null`
 * quand il a tout reçu ; c'est lui qui tient à jour `served`. Un élément épuisé
 * sort du tirage plutôt que d'être redemandé à chaque tour.
 */
function serveLeastFirst<T>(
  pool: readonly T[],
  idOf: (item: T) => string,
  served: Served,
  budget: number,
  next: (item: T) => Exercise | null,
  rng: Rng,
): Exercise[] {
  const result: Exercise[] = []
  const exhausted = new Set<string>()

  while (result.length < budget) {
    const candidates = pool.filter((item) => !exhausted.has(idOf(item)))
    if (candidates.length === 0) break

    const item = shuffle(candidates, rng).reduce((best, candidate) =>
      servedCount(served, idOf(candidate)) < servedCount(served, idOf(best)) ? candidate : best,
    )
    const exercise = next(item)
    if (exercise) result.push(exercise)
    else exhausted.add(idOf(item))
  }
  return result
}

/**
 * Session de vocabulaire, construite bloc par bloc plutôt qu'en présentant
 * la leçon entière d'un coup : trois-quatre mots nouveaux, puis quelques
 * manches d'association, quelques QCM, deux phrases à trou, et on
 * recommence avec les mots suivants s'il en reste. Les exercices d'un bloc
 * piochent dans tous les mots déjà présentés, pas seulement les siens — le
 * chemin révise en avançant plutôt que de cloisonner chaque bloc.
 *
 * `cards` dit quels mots ont déjà une carte de révision, donc ont déjà été
 * présentés au moins une fois — dans cette leçon lors d'un essai précédent,
 * ou ailleurs si le même mot est enseigné à deux endroits. Un mot connu ne
 * reçoit pas de nouvel écran de présentation : rejouer une leçon déjà sue ne
 * doit pas rouvrir son cours du premier jour, seulement remettre ses mots au
 * travail dans les blocs qui suivent.
 */
function buildVocabSession(
  vocab: readonly Vocab[],
  cards: Record<string, CardState>,
  seed: number,
  canSpeak: boolean,
): Exercise[] {
  const rng = createRng(seed)
  const blocks = blocksOf(shuffle(vocab, rng))

  const exercises: Exercise[] = []
  const pool: Vocab[] = []
  const served: Served = new Map()

  for (const block of blocks) {
    pool.push(...block)

    const blockExercises: Exercise[] = block
      .filter((word) => !cards[word.id])
      .map((word): IntroExercise => ({ kind: 'intro', id: `intro:${word.id}`, vocab: word }))

    blockExercises.push(...matchRounds(pool, between(...MATCH_ROUNDS_PER_BLOCK, rng), rng))

    // Les QCM vont d'abord aux mots les moins servis, et chacun reçoit un
    // énoncé qu'il n'a pas encore eu : c'est ce qui multiplie les questions
    // par mot au lieu de reposer toujours la même.
    let remaining = between(...CHOICE_ROUNDS_PER_BLOCK, rng)
    for (const word of leastServedFirst(pool, served, rng)) {
      if (remaining === 0) break
      const cue = sample(
        cuesFor(word, canSpeak).filter((candidate) => !hasServed(served, word.id, `choice:${candidate}`)),
        1,
        rng,
      )[0]
      if (!cue) continue
      const exercise = choiceFor(word, cue, pool, rng)
      if (!exercise) continue
      markServed(served, word.id, `choice:${cue}`)
      blockExercises.push(exercise)
      remaining -= 1
    }

    let clozesLeft = CLOZE_PER_BLOCK
    for (const word of leastServedFirst(pool, served, rng)) {
      if (clozesLeft === 0) break
      if (hasServed(served, word.id, 'cloze')) continue
      const exercise = clozeFor(word, pool, rng)
      if (!exercise) continue
      markServed(served, word.id, 'cloze')
      blockExercises.push(exercise)
      clozesLeft -= 1
    }

    // Rattrapage : un bloc peut compter plus de mots que de créneaux, et le
    // budget fixe laissait alors un mot sans le moindre exercice ciblé — vu à
    // la présentation, noyé ensuite dans les manches d'association, jamais
    // interrogé seul. Chaque mot du bloc en reçoit donc au moins un.
    for (const word of block) {
      if (servedCount(served, word.id) > 0) continue
      const exercise = firstAvailableExercise(word, pool, served, canSpeak, rng)
      if (!exercise) continue
      blockExercises.push(exercise)
    }

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

/** Remplit le trou d'une phrase de grammaire par la forme donnée. */
export function fillGap(sentence: string, form: string): string {
  return sentence.replace(GAP, form)
}

/** Nombre de phrases proposées (la bonne comprise) dans un QCM de grammaire. */
const GRAMMAR_CHOICE_SIZE = 3

/**
 * QCM sur la phrase entière : chaque option est la phrase complétée par l'une
 * des formes plausibles fournies par l'auteur. `null` quand la phrase n'a pas
 * de trou à remplir, ou pas une seule forme fautive à opposer — un QCM à une
 * option ne teste rien.
 */
function grammarChoiceFor(point: GrammarPoint, rng: Rng): GrammarChoiceExercise | null {
  if (!point.sentence.includes(GAP)) return null

  const distractors: string[] = []
  for (const option of shuffle(point.options, rng)) {
    if (distractors.length >= GRAMMAR_CHOICE_SIZE - 1) break
    // Une variante qui vaudrait la réponse offrirait deux bonnes cases.
    if (matchesAnswer(point.answer, point.alt, option)) continue
    distractors.push(fillGap(point.sentence, option))
  }
  if (distractors.length === 0) return null

  return {
    kind: 'grammar-choice',
    id: `sentence:${point.id}`,
    point,
    options: shuffle([fillGap(point.sentence, point.answer), ...distractors], rng),
  }
}

/**
 * L'échelle d'exigence d'un point de grammaire.
 *
 * C'est ce qui remplace l'exercice unique : la leçon ne posait qu'une phrase à
 * trou par point, si bien que six points faisaient six exercices, tous du même
 * gabarit, et qu'un second passage les reposait à l'identique. Un point gravit
 * maintenant cette échelle, échelon par échelon, et deux exercices sur un même
 * point ne se ressemblent plus.
 *
 * Un échelon peut proposer plusieurs formulations de difficulté équivalente :
 * on en tire une, ce qui fait qu'une leçon rejouée au même niveau ne repose
 * pas exactement les mêmes questions.
 */
interface GrammarVariant {
  stage: 'choice' | 'bank' | 'typed'
  cue: GrammarCue
}

type Ladder<T> = readonly (readonly T[])[]

/**
 * L'échelle suivie selon la maîtrise déjà acquise. Elle glisse plutôt qu'elle
 * ne s'allonge : à la découverte on ne réclame pas la phrase nue au clavier,
 * et une fois la leçon sue on ne redonne pas le QCM qui la déchiffrait.
 *
 * Un point ne reçoit en pratique que les deux premiers échelons d'une leçon de
 * six points (voir `GRAMMAR_PER_POINT_PER_BLOCK`) : le troisième sert aux
 * leçons courtes, où chaque point revient plus souvent.
 */
function grammarLadder(level: number): Ladder<GrammarVariant> {
  if (level <= 0)
    return [
      [{ stage: 'choice', cue: 'translation' }],
      [
        { stage: 'bank', cue: 'translation' },
        { stage: 'bank', cue: 'sentence' },
      ],
      [{ stage: 'typed', cue: 'translation' }],
      // Un point sans formes proposées ne peut ni QCM ni banque de mots : sans
      // ce dernier échelon il traverserait la découverte avec un seul exercice,
      // exactement le défaut qu'on répare.
      [{ stage: 'typed', cue: 'sentence' }],
    ]
  if (level === 1)
    return [
      [
        { stage: 'bank', cue: 'sentence' },
        { stage: 'choice', cue: 'translation' },
      ],
      [{ stage: 'typed', cue: 'translation' }],
      [{ stage: 'typed', cue: 'sentence' }],
    ]
  return [
    [{ stage: 'typed', cue: 'translation' }],
    [{ stage: 'typed', cue: 'sentence' }],
    [{ stage: 'bank', cue: 'sentence' }],
  ]
}

function grammarExercise(point: GrammarPoint, variant: GrammarVariant, rng: Rng): Exercise | null {
  if (variant.stage === 'choice') return grammarChoiceFor(point, rng)
  if (variant.stage === 'bank' && point.options.length < 2) return null
  // Retirer une traduction que l'auteur n'a pas écrite ne durcit rien : c'est
  // le même exercice sous un autre nom.
  const cue = point.translation ? variant.cue : 'sentence'
  return {
    kind: 'grammar-gap',
    // L'exigence entre dans l'identifiant : la même phrase au clavier et en
    // banque de mots sont deux exercices, pas deux rendus du même.
    id: `gap:${variant.stage}:${cue}:${point.id}`,
    point,
    cue,
    bank: variant.stage === 'bank' ? shuffle(point.options, rng) : null,
  }
}

/**
 * Le premier échelon que cet élément n'a pas encore gravi.
 *
 * La marque porte sur l'échelon, pas sur la formulation tirée : c'est ce qui
 * fait avancer sur l'échelle plutôt que de tourner à l'intérieur d'un échelon
 * dont plusieurs formulations restent disponibles.
 *
 * L'exercice construit est marqué lui aussi, et un échelon qui retombe dessus
 * passe son tour. Deux échelons peuvent en effet produire le même exercice
 * quand la matière manque : sans traduction, « pars du français » et « pars de
 * l'anglais » sont le même énoncé, et l'échelle poserait deux fois la même
 * question en croyant l'avoir durcie.
 */
function climb<T>(
  itemId: string,
  ladder: Ladder<T>,
  served: Served,
  rng: Rng,
  build: (variant: T) => Exercise | null,
): Exercise | null {
  for (const [rung, variants] of ladder.entries()) {
    if (hasServed(served, itemId, `rung:${rung}`)) continue
    for (const variant of shuffle(variants, rng)) {
      const exercise = build(variant)
      if (!exercise || hasServed(served, itemId, exercise.id)) continue
      markServed(served, itemId, `rung:${rung}`)
      markServed(served, itemId, exercise.id)
      return exercise
    }
  }
  return null
}

/** Points par bloc, et échelons servis à chacun par bloc. */
const GRAMMAR_BLOCK_SIZE = 3
const GRAMMAR_PER_POINT_PER_BLOCK = 2

/**
 * Grammaire : on relit la règle, puis on l'applique — par blocs de trois
 * points, comme le vocabulaire, chaque bloc reprenant aussi les points déjà
 * rencontrés pour les faire monter d'un échelon plutôt que de les abandonner
 * derrière lui.
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
  const ladder = grammarLadder(level)
  const blocks = blocksOf(shuffle(points, rng), GRAMMAR_BLOCK_SIZE)

  // Le rappel de cours n'apparaît qu'à la découverte : au-delà, il donnerait
  // la réponse avant même la question.
  const exercises: Exercise[] =
    level <= 0 && notes ? [{ kind: 'rule', id: `rule:${lessonId}`, title, notes, topic: 'grammar' }] : []

  const served: Served = new Map()
  const pool: GrammarPoint[] = []

  for (const block of blocks) {
    pool.push(...block)

    const blockExercises = serveLeastFirst(
      pool,
      (point) => point.id,
      served,
      block.length * GRAMMAR_PER_POINT_PER_BLOCK,
      (point) =>
        climb(point.id, ladder, served, rng, (variant) => grammarExercise(point, variant, rng)),
      rng,
    )

    // Rattrapage : un point dont aucun échelon n'a pu être construit — formes
    // proposées manquantes, phrase sans trou — se rabat sur la saisie plutôt
    // que de traverser la leçon sans jamais être interrogé.
    for (const point of block) {
      if (servedCount(served, point.id) > 0) continue
      const fallback = climb(point.id, ladder, served, rng, (variant) =>
        grammarExercise(point, variant, rng),
      )
      if (fallback) blockExercises.push(fallback)
    }

    exercises.push(...avoidAdjacentRepeats(blockExercises))
  }
  return exercises
}

/** Nombre de formes proposées (la bonne comprise) dans un QCM de conjugaison. */
const CONJUGATION_CHOICE_SIZE = 3

/**
 * QCM de conjugaison. Les leurres viennent d'abord des autres personnes du
 * même verbe : c'est là que se joue la confusion réelle (« have been working »
 * contre « has been working »). Les autres verbes du bassin complètent quand
 * le paradigme est trop court.
 */
function conjugationChoiceFor(
  verb: ConjugationVerb,
  form: ConjugationForm,
  cue: ConjugationCue,
  pool: readonly ConjugationVerb[],
  rng: Rng,
): ConjugationChoiceExercise | null {
  const siblings = verb.forms.filter((other) => other.id !== form.id).map((other) => other.answer)
  const strangers = shuffle(
    pool.filter((other) => other !== verb),
    rng,
  ).flatMap((other) => other.forms.map((otherForm) => otherForm.answer))

  const distractors: string[] = []
  for (const candidate of [...shuffle(siblings, rng), ...strangers]) {
    if (distractors.length >= CONJUGATION_CHOICE_SIZE - 1) break
    if (matchesAnswer(form.answer, form.alt, candidate)) continue
    if (distractors.some((seen) => normalizeForm(seen) === normalizeForm(candidate))) continue
    distractors.push(candidate)
  }
  if (distractors.length === 0) return null

  return {
    kind: 'conjugation-choice',
    id: `cchoice:${cue}:${form.id}`,
    verb,
    form,
    cue,
    options: shuffle([form.answer, ...distractors], rng),
  }
}

interface ConjugationVariant {
  stage: 'choice' | 'typed'
  cue: ConjugationCue
}

/**
 * L'échelle d'exigence d'une forme conjuguée. La piste n'avait qu'un seul
 * exercice ciblé — écrire la forme — donné une fois par forme et à l'identique
 * à chaque passage ; il manquait l'échelon de reconnaissance en dessous, et
 * au-dessus le rappel qui part du français, celui dont on a réellement besoin
 * pour parler.
 */
function conjugationLadder(level: number): Ladder<ConjugationVariant> {
  if (level <= 0)
    return [
      [{ stage: 'choice', cue: 'verb' }],
      [
        { stage: 'typed', cue: 'verb' },
        { stage: 'choice', cue: 'translation' },
      ],
      [{ stage: 'typed', cue: 'translation' }],
    ]
  if (level === 1)
    return [
      [{ stage: 'choice', cue: 'translation' }],
      [{ stage: 'typed', cue: 'verb' }],
      [{ stage: 'typed', cue: 'translation' }],
    ]
  return [
    [{ stage: 'typed', cue: 'verb' }],
    [{ stage: 'typed', cue: 'translation' }],
    [{ stage: 'choice', cue: 'translation' }],
  ]
}

function conjugationExercise(
  verb: ConjugationVerb,
  form: ConjugationForm,
  variant: ConjugationVariant,
  pool: readonly ConjugationVerb[],
  rng: Rng,
): Exercise | null {
  // Partir du français suppose que l'auteur l'ait écrit ; sans traduction,
  // l'énoncé n'aurait pas de verbe à montrer et retomberait sur l'anglais.
  // `climb` écarte alors l'échelon, qui ferait doublon.
  const cue = verb.translation ? variant.cue : 'verb'
  if (variant.stage === 'choice') return conjugationChoiceFor(verb, form, cue, pool, rng)
  return { kind: 'conjugation', id: `conj:${cue}:${form.id}`, verb, form, cue }
}

/** Verbes par bloc, et échelons servis à chaque forme par bloc. */
const CONJUGATION_BLOCK_SIZE = 2
const CONJUGATION_PER_FORM_PER_BLOCK = 2

function conjugationMatchOf(verbs: readonly ConjugationVerb[]): ConjugationMatchExercise {
  return {
    kind: 'conjugation-match',
    id: `cmatch:${verbs.map((verb) => verb.verb).join('+')}:${verbs[0]!.tense}`,
    verbs: [...verbs],
  }
}

/**
 * Conjugaison : on relie d'abord les personnes aux formes — le tableau entier
 * d'un coup —, puis on reconnaît chaque forme, puis on la produit. Par blocs de
 * deux verbes, les blocs suivants reprenant les formes déjà vues pour les faire
 * monter d'un échelon.
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
  const ladder = conjugationLadder(level)
  const blocks = blocksOf(shuffle(verbs, rng), CONJUGATION_BLOCK_SIZE)

  const exercises: Exercise[] =
    level <= 0 && notes ? [{ kind: 'rule', id: `rule:${lessonId}`, title, notes, topic: 'conjugation' }] : []

  const served: Served = new Map()
  const pool: ConjugationVerb[] = []

  for (const block of blocks) {
    pool.push(...block)

    // À la découverte, l'association présente le tableau de chaque verbe neuf
    // isolément — mélanger déroulerait la présentation avant qu'elle soit
    // faite. Au passage suivant, une seule manche qui mélange tout le bloc :
    // plus qu'un rappel de tableau, elle demande de reconnaître à quel verbe
    // appartient telle forme, une confusion que le tableau isolé ne teste
    // pas. Ensuite on va droit à la pratique.
    const pairable = block.filter((verb) => verb.forms.length >= 2)
    // Un nombre impair de verbes laisse le dernier bloc à un seul verbe : sans
    // partenaire dans son propre bloc, il resterait condamné à une manche
    // solitaire pour toute la leçon. On va lui en chercher un dans les blocs
    // déjà vus plutôt que de le priver du mélange.
    const crossVerbPool =
      level === 1 && pairable.length === 1
        ? [...pairable, ...sample(pool.filter((verb) => verb !== pairable[0]), 1, rng)]
        : pairable
    const rounds: ConjugationVerb[][] =
      level <= 0
        ? shuffle(pairable, rng).map((verb) => [verb])
        : level === 1 && crossVerbPool.length > 0
          ? [crossVerbPool]
          : []
    const blockExercises: Exercise[] = rounds.map(conjugationMatchOf)

    const budget =
      block.reduce((total, verb) => total + verb.forms.length, 0) * CONJUGATION_PER_FORM_PER_BLOCK
    blockExercises.push(
      ...serveLeastFirst(
        pool.flatMap((verb) => verb.forms.map((form) => ({ verb, form }))),
        (entry) => entry.form.id,
        served,
        budget,
        (entry) =>
          climb(entry.form.id, ladder, served, rng, (variant) =>
            conjugationExercise(entry.verb, entry.form, variant, pool, rng),
          ),
        rng,
      ),
    )

    for (const verb of block) {
      for (const form of verb.forms) {
        if (servedCount(served, form.id) > 0) continue
        const fallback = climb(form.id, ladder, served, rng, (variant) =>
          conjugationExercise(verb, form, variant, pool, rng),
        )
        if (fallback) blockExercises.push(fallback)
      }
    }

    exercises.push(...avoidAdjacentRepeats(blockExercises))
  }
  return exercises
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
 *
 * Dans chaque échelon, plusieurs énoncés restent possibles plutôt qu'un seul :
 * sans quoi une carte revue chaque jour poserait indéfiniment la même
 * question, quand la leçon d'origine en offrait déjà plusieurs.
 */
function buildMixedSession(
  entries: readonly { card: CardState; item: PracticeItem }[],
  seed: number,
  drill: boolean,
  canSpeak: boolean,
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
      // Reconnaître avant de produire : tant que la carte est jeune, la
      // phrase entière (QCM) et la phrase à trou en banque se relaient au
      // hasard plutôt que de retomber toujours sur le même gabarit — la carte
      // mûre, elle, reste sur la production, sans repli vers le plus facile.
      if (!unaided) {
        const choice = rng() < 0.5 ? grammarChoiceFor(item.point, rng) : null
        if (choice) return choice
      }
      return {
        kind: 'grammar-gap',
        id: `gap:${item.id}`,
        point: item.point,
        // La traduction française reste tant que la carte est jeune : c'est
        // l'aide qu'on retire en dernier, quand la forme est déjà su.
        cue: unaided ? 'sentence' : 'translation',
        bank: !unaided && item.point.options.length > 1 ? shuffle(item.point.options, rng) : null,
      }
    }

    if (item.kind === 'conjugation') {
      const fromFrench = Boolean(item.verb.translation) && rng() < 0.35
      // Une carte encore en apprentissage se reconnaît, elle ne se produit
      // pas : réclamer une forme rencontrée le jour même n'enseigne que
      // l'échec. C'est ce que le vocabulaire fait déjà avec sa flashcard.
      if (!unaided && recallStage(card) === 'recognize') {
        const choice = conjugationChoiceFor(
          item.verb,
          item.form,
          fromFrench ? 'translation' : 'verb',
          [item.verb],
          rng,
        )
        if (choice) return choice
      }
      // Sur une carte mûre, partir du français de temps en temps : c'est le
      // rappel réellement utile pour parler, personne ne partant en
      // conversation d'un infinitif anglais déjà trouvé.
      return {
        kind: 'conjugation',
        id: `conj:${item.id}`,
        verb: item.verb,
        form: item.form,
        cue: fromFrench ? 'translation' : 'verb',
      }
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
    if (cloze && rng() < (drill ? 0.55 : 0.35)) return cloze

    // Le QCM est une deuxième façon de reconnaître, à côté de la flashcard —
    // sans lui, la reconnaissance se ramenait toujours à la même
    // auto-évaluation, quand la leçon d'origine variait déjà l'énoncé.
    //
    // `hint` en est exclu ici : c'est une note d'usage, pas un indice pensé
    // pour désigner un mot sans ambiguïté, et elle ne le fait que par rapport
    // aux autres mots de la même leçon (« hitherto » se distingue de
    // « henceforth », son opposé, écrit dans la même leçon). Or `vocabPool`
    // mélange ici tout le cours : les distracteurs peuvent venir d'une leçon
    // sans rapport, et deviner devient un pari sur l'association plutôt
    // qu'un rappel du sens.
    const cue = sample(
      cuesFor(vocab, canSpeak).filter((candidate) => candidate !== 'hint'),
      1,
      rng,
    )[0]
    const choice = cue ? choiceFor(vocab, cue, vocabPool, rng) : null
    if (choice && rng() < 0.55) return choice

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
  canSpeak = false,
): Exercise[] {
  if (entries.length === 0) return []
  return buildMixedSession(
    entries,
    seed ?? seedFrom('review', entries.length, entries[0]!.item.id),
    false,
    canSpeak,
  )
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
  canSpeak = false,
): Exercise[] {
  if (entries.length === 0) return []
  return buildMixedSession(
    entries,
    seed ?? seedFrom('practice', entries.length, entries[0]!.item.id),
    true,
    canSpeak,
  )
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

/**
 * Une manche d'association : elle porte plusieurs éléments à la fois, et sert
 * de présentation au bloc qu'elle ouvre.
 */
function isRound(exercise: Exercise): boolean {
  return exercise.kind === 'match' || exercise.kind === 'conjugation-match'
}

/**
 * Réordonne localement pour qu'un exercice n'enchaîne pas, autant que
 * possible, sur le même élément que le précédent. Une manche d'association
 * fait exception des deux côtés : elle porte plusieurs éléments à la fois,
 * alors la corriger déplacerait un exercice d'un autre type pour rien — et
 * ça romprait justement l'ordre présentation → reconnaissance → production
 * que les blocs veulent imposer.
 */
function avoidAdjacentRepeats(exercises: readonly Exercise[]): Exercise[] {
  const result = exercises.slice()
  for (let i = 1; i < result.length; i++) {
    if (isRound(result[i - 1]) || isRound(result[i])) continue
    if (!sharesVocab(result[i - 1], result[i])) continue
    const swap = result.findIndex(
      (candidate, index) =>
        index > i &&
        !isRound(candidate) &&
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
