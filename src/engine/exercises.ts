import type { ConjugationForm, ConjugationVerb, GrammarPoint, Vocab } from '@/content/schema'
import { GAP } from '@/content/schema'
import { findVocabGap, type TermSplit } from '@/content/text'
import { sample, shuffle, type Rng } from './rng'
import { foldSpelling } from './spelling'

/**
 * Les exercices, et de quoi les construire un par un.
 *
 * Une séance ne se construit plus d'avance : elle réserve des places, et
 * chacune se forme au moment de l'ouvrir, selon le lien qui reste le plus à
 * réussir (voir `ghosts.ts`). Ce fichier fournit les exercices eux-mêmes :
 *   - `intro`     : présentation d'un mot nouveau, avec auto-évaluation en trois
 *                   boutons, qui amorce sa carte de révision ;
 *   - `match`     : relier des mots à leurs traductions, à l'écrit ou à l'oreille ;
 *   - `choice`    : reconnaître la bonne réponse parmi des leurres (QCM) ;
 *   - `cloze`     : compléter une phrase en piochant dans une banque de mots ;
 *   - `type`      : écrire le mot, sous un énoncé écrit ou sous la dictée ;
 *   - `flashcard` : auto-évaluation, quand aucun test n'est constructible ;
 *   - `rule`      : rappel de cours avant la pratique ;
 *   - `grammar-choice` : choisir la phrase entière correcte parmi ses variantes ;
 *   - `grammar-gap`  : phrase trouée, au clavier ou parmi des formes proposées ;
 *   - `conjugation-choice` : reconnaître une forme parmi celles du paradigme ;
 *   - `conjugation`  : produire une forme à partir du verbe, du temps, de la personne ;
 *   - `conjugation-match` : relier les personnes aux formes d'un verbe ;
 *   - `ghost`     : place réservée, remplacée par l'exercice formé à son ouverture.
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
  /**
   * `text` : les jetons montrent le mot appris et sa traduction, à lire.
   * `audio` : le jeton de la langue apprise ne s'écrit plus, il se prononce
   * au toucher — pendant du `audio` de `ChoiceCue`, pour une manche entière
   * plutôt qu'un seul mot. Sans cette variante, l'association ne teste
   * jamais l'oreille : la même manche pouvait revenir plusieurs fois par
   * leçon sans jamais changer de nature, toujours la lecture.
   */
  cue: 'text' | 'audio'
}

/**
 * Ce qu'un QCM montre comme énoncé.
 *
 * Un mot n'a qu'une traduction, mais il a plusieurs façons d'être demandé —
 * et c'est ce qui manquait : la leçon ne posait qu'une seule question par
 * mot, toujours la même (« voici le français, trouvez l'anglais »), si bien
 * que vingt-trois exercices se ramenaient à deux gabarits.
 *
 *   `term`        : le mot anglais, on choisit son sens ;
 *   `translation` : le mot français, on choisit la forme anglaise ;
 *   `audio`       : le mot prononcé, on choisit son orthographe. L'anglais
 *                   ne s'écrit pas comme il se dit : sans ça, la moitié du
 *                   mot reste non apprise.
 *
 * Deux autres énoncés ont existé.
 *
 * `hint` : la note d'usage du mot (« regarde en arrière », « faux ami »…)
 * comme énoncé à deviner. Retiré : cette note ne désigne un mot sans
 * ambiguïté que par rapport aux autres mots de sa leçon d'origine
 * (« hitherto » s'y distingue de « henceforth », son opposé, écrit juste à
 * côté) ; dès que les distracteurs viennent d'ailleurs — une lettre qui
 * partage sa note avec une autre, une leçon qui n'a pas son mot-miroir, un
 * pool mêlant tout le cours en révision — deviner devient un pari sur une
 * association, plus un rappel du sens. Le champ `hint` lui-même reste : une
 * remarque affichée à la découverte d'un mot reste utile, seul son usage
 * comme énoncé de QCM a été supprimé.
 *
 * `sentence` : la phrase d'exemple traduite comme énoncé, en choisissant
 * toujours parmi des mots isolés. Retiré aussi : les options ne portant pas
 * la phrase, rien dans son contexte ne pesait sur le choix — deviner
 * revenait exactement à `translation`, avec plus de texte à lire pour la
 * même décision. La reconnaissance en contexte que ce cue visait existe déjà,
 * en le testant vraiment : voir l'exercice `cloze`, où c'est la phrase
 * elle-même, trouée, qui porte l'épreuve.
 */
export type ChoiceCue = 'term' | 'translation' | 'audio'

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

/** L'énoncé affiché. */
export function choicePrompt(vocab: Vocab, cue: ChoiceCue): string {
  switch (cue) {
    case 'term':
      return vocab.term
    case 'translation':
      return vocab.translation
    case 'audio':
      return vocab.term
  }
}

/** L'énoncé est-il dans la langue apprise ? Sert à l'attribut `lang`. */
export function choicePromptIsLearningLanguage(cue: ChoiceCue): boolean {
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

/**
 * D'où vient l'énoncé d'une production libre (`type`).
 *
 *   `text`  : le mot est donné à l'écrit, dans l'autre langue — thème ou
 *             version.
 *   `audio` : le mot est seulement prononcé, jamais écrit — une dictée. Le
 *             pendant en production du `audio` de `ChoiceCue`, qui ne teste
 *             que la reconnaissance ; n'a de sens que pour écrire dans la
 *             langue apprise (`direction: 'to-learning'`) — dicter un mot
 *             déjà affiché en russe pour en redemander la traduction ne
 *             testerait que la lecture, pas l'écoute.
 */
export type TypeCue = 'text' | 'audio'

export interface TypeExercise {
  kind: 'type'
  id: string
  vocab: Vocab
  direction: Direction
  cue: TypeCue
}

/** Rappel de cours affiché avant la pratique d'un point de grammaire. */
export interface RuleExercise {
  kind: 'rule'
  id: string
  title: string
  notes: string
  /** Nature de la leçon : l'écran s'accorde à la couleur de sa piste. */
  topic: 'grammar' | 'conjugation' | 'vocab'
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
 * Ce qui désigne la phrase correcte quand on ne l'a pas encore trouvée.
 *
 *   `translation` : la traduction française de la phrase, quand l'auteur l'a
 *                   écrite — le sens visé est acquis, il ne reste qu'à repérer
 *                   la forme qui le porte ;
 *   `audio`       : la phrase correcte elle-même, prononcée plutôt qu'écrite.
 *                   Les options ne différant que par la terminaison en jeu, il
 *                   faut alors la reconnaître à l'oreille parmi des leurres
 *                   qui s'écrivent presque pareil — pendant du `audio` de
 *                   `ChoiceCue`, à l'échelle de la phrase plutôt que du mot.
 */
export type GrammarChoiceCue = 'translation' | 'audio'

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
  cue: GrammarChoiceCue
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
 *   `audio`       : l'infinitif prononcé, jamais écrit — pendant du `audio`
 *                   de `ChoiceCue`, réservé à la reconnaissance (`choice`) :
 *                   deviner la forme depuis l'écrit n'est pas ce que teste ce
 *                   cue, entendre l'infinitif et reconnaître l'orthographe de
 *                   la forme conjuguée parmi les leurres, si. Toujours côté
 *                   langue apprise, jamais un remplaçant de `translation`.
 */
export type ConjugationCue = 'verb' | 'translation' | 'audio'

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

/**
 * Ce qu'un exercice fait travailler, pour la maîtrise lien par lien (voir
 * `ghosts.ts`). Un élément ne se dit pas d'une seule façon : un mot a son
 * sens, son son, sa phrase et sa forme écrite ; un point de grammaire ou une
 * forme conjuguée se reconnaissent avant de se produire. Chaque réponse est
 * retenue pour *cet* élément et *ce* lien, pas pour l'exercice.
 */
export type LinkId = 'sens' | 'oreille' | 'contexte' | 'production' | 'reconnaissance'

/**
 * Ce que porte un exercice formé à partir d'une place réservée.
 *
 *   `link`     : le lien noté ; absent pour une présentation, qui ne note rien ;
 *   `session`  : la séance qui l'a formé, pour ne pas reprendre en consolidation
 *                un élément qu'elle vient de réussir ;
 *   `day`      : le jour, l'acquis se comptant en jours distincts ;
 *   `practice` : remise à niveau, rien n'est noté côté liens.
 */
export interface GhostMeta {
  session: string
  day: string
  link?: LinkId
  practice?: boolean
}

/**
 * Place réservée dans une séance : rien n'y est formé d'avance. L'exercice se
 * forme à l'instant où la place arrive en tête de file, d'après ce que
 * l'apprenant sait alors (voir `materializeGhost`). Seule sa forme est fixée,
 * pour le rythme : une manche d'association, ou un exercice sur un élément.
 */
export interface GhostExercise {
  kind: 'ghost'
  id: string
  shape: 'match' | 'single'
}

type ExerciseBody =
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
  | GhostExercise

export type Exercise = ExerciseBody & { ghost?: GhostMeta }

/** Nombre de mots proposés dans une banque de cloze. */
const BANK_SIZE = 4
/** Nombre d'options (bonne réponse comprise) proposées dans un QCM. */
const CHOICE_SIZE = 3

/**
 * Les exercices qui présentent sans évaluer : ils ne comptent pas dans le
 * score.
 *
 * `intro` en fait partie malgré ses trois boutons : découvrir un mot et le
 * déclarer nouveau n'est pas une faute, c'est l'état normal d'un mot qu'on
 * n'a jamais vu. Compté comme une erreur, il faisait échouer la leçon de
 * l'apprenant honnête — huit mots annoncés nouveaux sur une vingtaine
 * d'exercices suffisaient à passer sous la barre des 70 %. Les boutons
 * servent à amorcer la révision espacée, pas à noter.
 */
export function isPresentation(exercise: Exercise): boolean {
  return exercise.kind === 'rule' || exercise.kind === 'intro'
}

/**
 * L'exercice ne se joue-t-il qu'à l'oreille ? Sert à la mise en sourdine
 * temporaire (voir `useListeningMuteStore`) : seuls ceux-là n'ont aucune
 * façon de répondre sans le son, les autres cues du même exercice restent
 * jouables les yeux fermés — pas besoin de les sauter.
 */
export function isListeningExercise(exercise: Exercise): boolean {
  switch (exercise.kind) {
    case 'match':
    case 'choice':
    case 'type':
    case 'conjugation-choice':
    case 'grammar-choice':
      return exercise.cue === 'audio'
    default:
      return false
  }
}

/** Les éléments dont dépend un exercice : ce sont eux qui reçoivent la note. */
export function itemIdsOf(exercise: Exercise): string[] {
  switch (exercise.kind) {
    case 'rule':
    case 'ghost':
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
 *
 * `pool`, ici, n'a pas besoin d'être borné aux mots déjà rencontrés comme il
 * l'est pour un QCM : un leurre de banque ne demande que d'être rejeté, pas
 * reconnu, et peut donc venir de tout le vocabulaire de la leçon. Un bassin
 * trop court renverrait moins de quatre cases dans une grille à deux
 * colonnes — une rangée à moitié vide, qui a l'air d'un bug.
 */
export function clozeFor(vocab: Vocab, pool: readonly Vocab[] | null, rng: Rng): ClozeExercise | null {
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
 * QCM : reconnaître la bonne réponse parmi des leurres piochés dans le reste
 * du bassin. `null` quand le bassin est trop petit pour offrir au moins un
 * leurre distinct de la réponse — un QCM à une seule option ne teste rien.
 */
export function choiceFor(vocab: Vocab, cue: ChoiceCue, pool: readonly Vocab[], rng: Rng): ChoiceExercise | null {
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
export function grammarChoiceFor(point: GrammarPoint, cue: GrammarChoiceCue, rng: Rng): GrammarChoiceExercise | null {
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
    id: `sentence:${cue}:${point.id}`,
    point,
    cue,
    options: shuffle([fillGap(point.sentence, point.answer), ...distractors], rng),
  }
}

/** Nombre de formes proposées (la bonne comprise) dans un QCM de conjugaison. */
const CONJUGATION_CHOICE_SIZE = 3

/**
 * QCM de conjugaison. Les leurres viennent d'abord des autres personnes du
 * même verbe : c'est là que se joue la confusion réelle (« have been working »
 * contre « has been working »). Les autres verbes du bassin complètent quand
 * le paradigme est trop court.
 */
export function conjugationChoiceFor(
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
  const given = learningForm(value)
  return given.length > 0 && [expected, ...alt].some((candidate) => learningForm(candidate) === given)
}

/**
 * Forme comparable d'un texte dans la langue apprise : `normalizeForm`, puis
 * le repli des graphies équivalentes quand la langue en déclare (voir
 * `spelling.ts`).
 */
export function learningForm(value: string): string {
  return foldSpelling(normalizeForm(value))
}

/**
 * Casse et ponctuation : ce qu'on ignore dans tous les cas.
 *
 * Les accents, eux, restent : dans la langue apprise ils sont de
 * l'orthographe, et souvent l'objet même du point (« que » contre « qué »,
 * « мой » contre « мои »). NFC ramène la lettre précomposée et sa forme
 * décomposée — selon le clavier — à une seule écriture.
 */
function normalizeCore(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:"“”()]/g, '')
    .replace(/[’‘]/g, "'")
}

/**
 * Retire les accents d'un texte en français, où l'on tolère qu'ils manquent.
 *
 * La brève et le tréma d'une lettre cyrillique ne sont pas des accents mais
 * des lettres à part entière (Й, Ё) : ils restent, au cas où un mot russe
 * passerait par là.
 */
function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/(\p{Script=Cyrillic}?)([\u0300-\u036f])/gu, (_, base: string, mark: string) =>
      base !== '' && (mark === '\u0306' || mark === '\u0308') ? base + mark : base,
    )
    .normalize('NFC')
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

/** Réponse tapée en français : comme `normalizeAnswer`, accents en moins. */
export function normalizeKnownAnswer(value: string): string {
  return stripAccents(normalizeAnswer(value))
}

export function isAnswerCorrect(vocab: Vocab, direction: Direction, value: string): boolean {
  const expected =
    direction === 'to-known' ? [vocab.translation, ...vocab.alt] : [vocab.term]
  // Le français tapé tolère les accents manquants ; la langue apprise, non,
  // mais elle replie ses graphies équivalentes quand elle en déclare.
  const comparable =
    direction === 'to-known' ? normalizeKnownAnswer : (text: string) => foldSpelling(normalizeAnswer(text))
  const given = comparable(value)
  return given.length > 0 && expected.some((candidate) => comparable(candidate) === given)
}
