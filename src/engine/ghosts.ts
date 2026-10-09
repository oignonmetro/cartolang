import type { ConjugationForm, ConjugationVerb, GrammarPoint, PracticeItem, Vocab } from '@/content/schema'
import { findVocabGap } from '@/content/text'
import {
  choiceFor,
  clozeFor,
  conjugationChoiceFor,
  grammarChoiceFor,
  type ChoiceCue,
  type ConjugationCue,
  type Exercise,
  type GhostExercise,
  type GhostMeta,
  type LinkId,
} from './exercises'
import type { Mastery } from './progress'
import { createRng, sample, seedFrom, shuffle, type Rng } from './rng'
import type { CardState } from './srs'

/**
 * Séances à places réservées (« exercices fantômes »), et maîtrise lien par
 * lien.
 *
 * Repris de Cartophilo (docs/exercices-fantomes.md dans ce dépôt-là, et
 * docs/exercices-fantomes-plan.md ici). Un élément — un mot, un point de
 * grammaire, une forme conjuguée — ne se teste pas en bloc : il se dit de
 * plusieurs façons, et chaque exercice fait établir **un lien**.
 *
 *   mot              : `sens` (mot ↔ traduction), `oreille` (mot entendu),
 *                      `contexte` (phrase à trou), `production` (l'écrire) ;
 *   grammaire, forme : `reconnaissance`, puis `production`.
 *
 * Chaque réponse est retenue pour *cet* élément et *ce* lien. Un élément est
 * **maîtrisé** quand chacun de ses liens a eu une bonne réponse du premier
 * coup, et **acquis** quand, maîtrisé, il a été réussi sur deux jours
 * différents.
 *
 * Les exercices n'existent pas d'avance : une séance réserve des places
 * (`ghostsFor`), et chacune se forme au moment de l'ouvrir
 * (`materializeGhost`), par un tirage pondéré par ce qui reste à réussir. Un
 * élément maîtrisé laisse aussitôt sa place à un nouveau, qui entre par sa
 * présentation.
 *
 * Cette maîtrise coexiste avec la révision espacée (`srs.ts`) : chaque
 * réponse note aussi la carte de l'élément, qui décide de ses échéances.
 */

/** Ce qu'on retient d'un lien : ses réponses justes du premier coup, et fausses. */
export interface LinkRecord {
  right: number
  wrong: number
}

/**
 * Ce qu'on retient d'un élément.
 *
 * `legacy` : jours d'acquis repris d'une carte de révision qui avait gradué
 * avant la maîtrise par lien. Un tel élément compte comme maîtrisé sur tous
 * ses liens (voir `legacyOf`). Figé au premier passage dans `gradeLinks`, pour
 * que la carte, qui continue de graduer d'elle-même, n'en décide plus ensuite.
 */
export interface ItemRecord {
  presented?: boolean
  legacy?: number
  links?: Partial<Record<LinkId, LinkRecord>>
  /** Dernière séance où l'élément a été réussi. */
  session?: string
  /** Dernier jour où il l'a été, et nombre de jours différents. */
  day?: string
  days?: number
}

export type LinkProgress = Record<string, ItemRecord>

/** Éléments en cours d'apprentissage dans une leçon : la taille d'un bloc de présentation. */
export const ACTIVE_COUNT = 4
/** Jours différents où un élément maîtrisé doit avoir été réussi pour être acquis. */
export const ACQUIRED_DAYS = 2
/** Intervalle (jours) d'une carte héritée à partir duquel l'élément compte comme acquis. */
const LEGACY_ACQUIRED_INTERVAL = 7

/** Ce que l'apprenant sait, au moment de former un exercice. */
export interface GhostState {
  progress: LinkProgress
  cards: Record<string, CardState>
}

// --- liens et maîtrise --------------------------------------------------------

function hasContext(vocab: Vocab): boolean {
  return Boolean(vocab.example && findVocabGap(vocab.example.text, vocab.term, vocab.gap))
}

/**
 * Les liens qu'un élément permet d'établir. `canSpeak` : l'appareil sait
 * prononcer ; sans voix, le lien d'oreille n'existe pas, et n'est donc pas
 * exigé.
 */
export function linksOf(item: PracticeItem, canSpeak: boolean): LinkId[] {
  if (item.kind === 'vocab') {
    const links: LinkId[] = ['sens']
    if (canSpeak) links.push('oreille')
    if (hasContext(item.vocab)) links.push('contexte')
    links.push('production')
    return links
  }
  // Un point sans formes proposées ne peut se reconnaître ni en QCM ni en
  // banque : il ne lui reste que la production.
  if (item.kind === 'grammar' && item.point.options.length < 2) return ['production']
  return ['reconnaissance', 'production']
}

/** Le lien qu'il faut avoir réussi avant d'aborder celui-ci : on reconnaît avant de produire. */
function prerequisiteOf(item: PracticeItem, link: LinkId, canSpeak: boolean): LinkId | null {
  if (item.kind === 'vocab') return link === 'sens' ? null : 'sens'
  if (link === 'production' && linksOf(item, canSpeak).includes('reconnaissance')) return 'reconnaissance'
  return null
}

/** Jours d'acquis hérités d'une carte de révision, ou `undefined` si l'élément n'en hérite pas. */
export function legacyOf(record: ItemRecord | undefined, card: CardState | undefined): number | undefined {
  if (record?.legacy !== undefined) return record.legacy
  if (record || !card || card.step !== null) return undefined
  return card.interval >= LEGACY_ACQUIRED_INTERVAL ? ACQUIRED_DAYS : 1
}

function rightsOn(record: ItemRecord | undefined, card: CardState | undefined, link: LinkId): number {
  const right = record?.links?.[link]?.right ?? 0
  return legacyOf(record, card) !== undefined ? Math.max(1, right) : right
}

function wrongsOn(record: ItemRecord | undefined, link: LinkId): number {
  return record?.links?.[link]?.wrong ?? 0
}

export function isLinkDone(record: ItemRecord | undefined, card: CardState | undefined, link: LinkId): boolean {
  return rightsOn(record, card, link) >= 1
}

/** Maîtrisé : chacun de ses liens réussi au moins une fois du premier coup. */
export function isValidated(
  item: PracticeItem,
  record: ItemRecord | undefined,
  card: CardState | undefined,
  canSpeak: boolean,
): boolean {
  return linksOf(item, canSpeak).every((link) => isLinkDone(record, card, link))
}

function daysOf(record: ItemRecord | undefined, card: CardState | undefined): number {
  return Math.max(record?.days ?? 0, legacyOf(record, card) ?? 0)
}

/** Acquis : maîtrisé, et réussi sur au moins deux jours différents. */
export function isAcquired(
  item: PracticeItem,
  record: ItemRecord | undefined,
  card: CardState | undefined,
  canSpeak: boolean,
): boolean {
  return isValidated(item, record, card, canSpeak) && daysOf(record, card) >= ACQUIRED_DAYS
}

/** Déjà présenté : vu à sa présentation, déjà interrogé, ou porteur d'une carte de révision. */
export function isPresented(record: ItemRecord | undefined, card: CardState | undefined): boolean {
  return Boolean(record?.presented || record?.links || card)
}

/**
 * Maîtrise d'un ensemble d'éléments, pour les anneaux de la bibliothèque :
 * `seen` compte les éléments maîtrisés, `known` les acquis.
 */
export function linkMastery(items: readonly PracticeItem[], state: GhostState, canSpeak: boolean): Mastery {
  let seen = 0
  let known = 0
  for (const item of items) {
    const record = state.progress[item.id]
    const card = state.cards[item.id]
    if (!isValidated(item, record, card, canSpeak)) continue
    seen += 1
    if (daysOf(record, card) >= ACQUIRED_DAYS) known += 1
  }
  const total = items.length
  return { total, seen, known, ratio: total === 0 ? 0 : known / total }
}

// --- séance ---------------------------------------------------------------------

/**
 * Comment une séance choisit ses cibles.
 *
 *   `learn`    : le lot en cours (éléments présentés pas encore maîtrisés), plus
 *                les maîtrisés à consolider qui n'ont pas été réussis dans cette
 *                séance. Une place qui ne trouve plus rien à faire est sautée :
 *                la séance s'arrête quand tout est maîtrisé ;
 *   `review`   : tous les éléments de la portée (les cartes échues) ;
 *   `practice` : remise à niveau, quand tout est acquis. Rien n'y est noté côté
 *                liens ; la révision espacée, elle, continue de noter.
 */
export type GhostMode = 'learn' | 'review' | 'practice'

export interface GhostOptions {
  mode: GhostMode
  /** Une leçon présente ses éléments nouveaux ; les étapes ne font travailler que le déjà présenté. */
  allowIntro: boolean
  /** Taille du lot en cours. */
  activeCount: number
  /** L'appareil sait prononcer : le lien d'oreille existe. */
  canSpeak: boolean
  /** L'écoute est possible maintenant (pas coupée) : on peut former un exercice à l'oreille. */
  canHear: boolean
  /** Graine de la séance ; sa forme textuelle sert d'identifiant de séance. */
  seed: number
  day: string
  /** Pèse davantage sur la production (approfondissement). */
  favorProduction?: boolean
  /**
   * Combien de fois chaque élément a déjà été servi dans la séance. Mis à jour
   * à chaque formation : un élément déjà beaucoup interrogé pèse moins, et la
   * séance se répartit au lieu de retomber sur le même.
   */
  served: Map<string, number>
}

export interface GhostScope {
  /** Les éléments travaillés, dans leur ordre d'arrivée. */
  items: readonly PracticeItem[]
  /** Où prendre les leurres : les éléments voisins, de toutes natures (chacune ne retient que la sienne). */
  distractors: readonly PracticeItem[]
}

/** Rythme d'une séance : une manche d'association pour deux exercices ciblés. */
const SHAPES = ['match', 'single', 'single'] as const

/** Les places d'une séance : rien n'est formé encore, voir `materializeGhost`. */
export function ghostsFor(count: number): GhostExercise[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'ghost' as const,
    id: `ghost:${index}`,
    shape: SHAPES[index % SHAPES.length]!,
  }))
}

/** Un élément consolidé revient pour être consolidé : un poids léger, mais jamais nul. */
const REVIEW_WEIGHT = 1
const BOARD_SIZE = 4
const MIN_BOARD = 3

function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const weights = items.map((item) => Math.max(0.1, weight(item)))
  let roll = rng() * weights.reduce((sum, w) => sum + w, 0)
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

/** Un élément vu sous toutes ses coutures dans une séance, avec ce qui le décrit. */
interface Target {
  item: PracticeItem
  record: ItemRecord | undefined
  card: CardState | undefined
  validated: boolean
}

function describe(item: PracticeItem, state: GhostState, canSpeak: boolean): Target {
  const record = state.progress[item.id]
  const card = state.cards[item.id]
  return { item, record, card, validated: isValidated(item, record, card, canSpeak) }
}

/** Les liens qu'on peut faire travailler maintenant : prérequis atteint, oreille seulement si l'on entend. */
function workableLinks(target: Target, options: GhostOptions): LinkId[] {
  return linksOf(target.item, options.canSpeak).filter((link) => {
    if (link === 'oreille' && !options.canHear) return false
    const before = prerequisiteOf(target.item, link, options.canSpeak)
    return before === null || isLinkDone(target.record, target.card, before)
  })
}

function need(target: Target, link: LinkId): number {
  return (rightsOn(target.record, target.card, link) === 0 ? 3 : 0) + Math.min(wrongsOn(target.record, link), 3)
}

function weightOf(target: Target, link: LinkId, options: GhostOptions): number {
  const base = target.validated ? REVIEW_WEIGHT : need(target, link)
  const favored = options.favorProduction && link === 'production' ? 2 : 1
  return (base * favored) / (1 + (options.served.get(target.item.id) ?? 0))
}

/**
 * Poids d'un élément dans le tirage. Un élément à consolider pèse une fois en
 * tout, pas une fois par lien : sinon un mot à quatre liens, déjà maîtrisé,
 * pèserait plus lourd qu'un mot qui reste entièrement à apprendre.
 */
function itemWeight(target: Target, options: GhostOptions): number {
  if (target.validated) return REVIEW_WEIGHT / (1 + (options.served.get(target.item.id) ?? 0))
  return workableLinks(target, options).reduce((sum, link) => sum + weightOf(target, link, options), 0)
}

/** Ce qui ouvre un élément nouveau : sa fiche pour un mot, le tableau entier pour un verbe ; rien pour la grammaire. */
function needsIntro(item: PracticeItem): boolean {
  return item.kind !== 'grammar'
}

type Plan =
  | { kind: 'intro'; item: PracticeItem }
  | { kind: 'targets'; targets: Target[]; practice: boolean }
  | { kind: 'none' }

/** Les éléments d'un même verbe : une forme conjuguée se présente avec tout son tableau. */
function verbOf(item: PracticeItem): ConjugationVerb | null {
  return item.kind === 'conjugation' ? item.verb : null
}

function plan(scope: GhostScope, state: GhostState, options: GhostOptions, rng: Rng): Plan {
  const session = String(options.seed)
  const described = scope.items.map((item) => describe(item, state, options.canSpeak))
  const presented = described.filter((target) => isPresented(target.record, target.card))

  if (options.mode === 'practice') {
    if (presented.length === 0) return { kind: 'none' }
    return { kind: 'targets', targets: sample(presented, Math.max(options.activeCount, 4), rng), practice: true }
  }
  if (options.mode === 'review') {
    return presented.length > 0 ? { kind: 'targets', targets: presented, practice: false } : { kind: 'none' }
  }

  // Le lot en cours, dans l'ordre d'arrivée : un élément nouveau y entre par sa
  // présentation tant qu'il reste de la place.
  const lot: Target[] = []
  for (const target of described) {
    if (lot.length >= options.activeCount) break
    if (target.validated) continue
    if (isPresented(target.record, target.card)) {
      lot.push(target)
      continue
    }
    if (!options.allowIntro) continue
    if (!needsIntro(target.item)) {
      lot.push(target)
      continue
    }
    return { kind: 'intro', item: target.item }
  }

  const review = described.filter(
    (target) =>
      target.validated &&
      isPresented(target.record, target.card) &&
      !isAcquired(target.item, target.record, target.card, options.canSpeak) &&
      target.record?.session !== session,
  )
  const targets = [...lot, ...review]
  return targets.length > 0 ? { kind: 'targets', targets, practice: false } : { kind: 'none' }
}

/** Y a-t-il de quoi apprendre ou consolider ? Sinon, la séance se joue en remise à niveau. */
export function hasLearnWork(scope: GhostScope, state: GhostState, options: Omit<GhostOptions, 'mode'>): boolean {
  return plan(scope, state, { ...options, mode: 'learn' }, createRng(options.seed)).kind !== 'none'
}

/** Y a-t-il seulement un élément déjà présenté à faire travailler ? */
export function hasPresented(scope: GhostScope, state: GhostState): boolean {
  return scope.items.some((item) => isPresented(state.progress[item.id], state.cards[item.id]))
}

/**
 * Nombre de places d'une leçon : ce qui reste à présenter et à réussir, avec
 * de quoi rattraper quelques erreurs. C'est un plafond, pas une durée : la
 * séance s'arrête dès que tout est maîtrisé.
 */
export function lessonGhostCount(items: readonly PracticeItem[], state: GhostState, canSpeak: boolean): number {
  let count = 4
  for (const item of items) {
    const target = describe(item, state, canSpeak)
    if (!isPresented(target.record, target.card)) count += 1
    count += linksOf(item, canSpeak).filter((link) => !isLinkDone(target.record, target.card, link)).length
  }
  return Math.min(60, Math.max(8, count))
}

// --- formation ------------------------------------------------------------------

function vocabPool(scope: GhostScope, state: GhostState): Vocab[] {
  const all = scope.distractors.flatMap((item) => (item.kind === 'vocab' ? [item.vocab] : []))
  // Un leurre de QCM doit se reconnaître pour être rejeté : on le prend d'abord
  // parmi les mots déjà vus, et on n'élargit qu'à défaut.
  const known = all.filter((vocab) => isPresented(state.progress[vocab.id], state.cards[vocab.id]))
  return known.length >= 3 ? known : all
}

function verbPool(scope: GhostScope): ConjugationVerb[] {
  const verbs = new Set<ConjugationVerb>()
  for (const item of scope.distractors) if (item.kind === 'conjugation') verbs.add(item.verb)
  return [...verbs]
}

function vocabExercise(
  vocab: Vocab,
  link: LinkId,
  target: Target,
  pool: readonly Vocab[],
  options: GhostOptions,
  rng: Rng,
): Exercise | null {
  if (link === 'sens') {
    const cue: ChoiceCue = rng() < 0.5 ? 'term' : 'translation'
    return choiceFor(vocab, cue, pool, rng) ?? choiceFor(vocab, cue === 'term' ? 'translation' : 'term', pool, rng)
  }
  if (link === 'oreille') return choiceFor(vocab, 'audio', pool, rng)
  if (link === 'contexte') return clozeFor(vocab, pool, rng)
  // Une fois le mot maîtrisé, la production se fait aussi sous la dictée.
  const cue = target.validated && options.canHear && rng() < 0.3 ? 'audio' : 'text'
  return { kind: 'type', id: `type:${cue}:${vocab.id}`, vocab, direction: 'to-learning', cue }
}

function grammarExercise(point: GrammarPoint, link: LinkId, target: Target, options: GhostOptions, rng: Rng): Exercise | null {
  if (link === 'reconnaissance') {
    if (rng() < 0.5) {
      const choice = grammarChoiceFor(point, options.canHear && rng() < 0.2 ? 'audio' : 'translation', rng)
      if (choice) return choice
    }
    return {
      kind: 'grammar-gap',
      id: `gap:bank:${point.id}`,
      point,
      cue: point.translation ? 'translation' : 'sentence',
      bank: shuffle(point.options, rng),
    }
  }
  // La traduction est l'aide qu'on retire en dernier : elle reste tant que le point n'est pas maîtrisé.
  return {
    kind: 'grammar-gap',
    id: `gap:typed:${point.id}`,
    point,
    cue: !target.validated && point.translation ? 'translation' : 'sentence',
    bank: null,
  }
}

function conjugationExercise(
  verb: ConjugationVerb,
  form: ConjugationForm,
  link: LinkId,
  target: Target,
  pool: readonly ConjugationVerb[],
  options: GhostOptions,
  rng: Rng,
): Exercise | null {
  if (link === 'reconnaissance') {
    const cues: ConjugationCue[] = ['verb']
    if (verb.translation) cues.push('translation')
    if (options.canHear) cues.push('audio')
    return conjugationChoiceFor(verb, form, sample(cues, 1, rng)[0]!, pool, rng)
  }
  // Partir du français, une fois la forme maîtrisée : c'est le rappel utile pour parler.
  const cue: ConjugationCue = target.validated && verb.translation && rng() < 0.5 ? 'translation' : 'verb'
  return { kind: 'conjugation', id: `conj:${cue}:${form.id}`, verb, form, cue }
}

function exerciseFor(target: Target, link: LinkId, scope: GhostScope, state: GhostState, options: GhostOptions, rng: Rng): Exercise | null {
  const { item } = target
  if (item.kind === 'vocab') return vocabExercise(item.vocab, link, target, vocabPool(scope, state), options, rng)
  if (item.kind === 'grammar') return grammarExercise(item.point, link, target, options, rng)
  return conjugationExercise(item.verb, item.form, link, target, verbPool(scope), options, rng)
}

/** Une manche d'association : sens ou oreille pour les mots, tableau d'un verbe pour la conjugaison. */
function formMatch(targets: readonly Target[], options: GhostOptions, rng: Rng): { exercise: Exercise; link: LinkId } | null {
  const candidates: { link: LinkId; group: Target[]; weight: number; build: (group: Target[]) => Exercise }[] = []

  for (const link of ['sens', 'oreille'] as const) {
    const pool = targets.filter((target) => target.item.kind === 'vocab' && workableLinks(target, options).includes(link))
    if (pool.length < MIN_BOARD) continue
    // Les éléments qui ont le plus à y gagner d'abord, au hasard à besoin égal.
    const group = shuffle(pool, rng)
      .sort((a, b) => weightOf(b, link, options) - weightOf(a, link, options))
      .slice(0, BOARD_SIZE)
    candidates.push({
      link,
      group,
      weight: pool.reduce((sum, target) => sum + weightOf(target, link, options), 0),
      build: (chosen) => ({
        kind: 'match',
        id: 'match',
        pairs: chosen.map((target) => (target.item.kind === 'vocab' ? target.item.vocab : null)!),
        cue: link === 'oreille' ? 'audio' : 'text',
      }),
    })
  }

  // Conjugaison : le tableau du verbe dont les formes ont le plus à reconnaître.
  const byVerb = new Map<ConjugationVerb, Target[]>()
  for (const target of targets) {
    const verb = verbOf(target.item)
    if (!verb || verb.forms.length < MIN_BOARD || !workableLinks(target, options).includes('reconnaissance')) continue
    byVerb.set(verb, [...(byVerb.get(verb) ?? []), target])
  }
  for (const [verb, group] of byVerb) {
    candidates.push({
      link: 'reconnaissance',
      group,
      weight: group.reduce((sum, target) => sum + weightOf(target, 'reconnaissance', options), 0),
      build: () => ({ kind: 'conjugation-match', id: 'cmatch', verbs: [verb] }),
    })
  }

  if (candidates.length === 0) return null
  const chosen = weightedPick(candidates, (candidate) => candidate.weight, rng)
  return { exercise: chosen.build(chosen.group), link: chosen.link }
}

function formSingle(
  targets: readonly Target[],
  scope: GhostScope,
  state: GhostState,
  options: GhostOptions,
  rng: Rng,
): { exercise: Exercise; link: LinkId } | null {
  const target = weightedPick(targets, (candidate) => itemWeight(candidate, options), rng)
  const links = workableLinks(target, options)
  const unfinished = links.filter((link) => !isLinkDone(target.record, target.card, link))
  const first = weightedPick(unfinished.length > 0 ? unfinished : links, (link) => weightOf(target, link, options), rng)
  // Un lien qui ne peut se former (pas de leurre, pas de phrase) cède la place aux autres.
  for (const link of [first, ...shuffle(links.filter((other) => other !== first), rng)]) {
    const exercise = exerciseFor(target, link, scope, state, options, rng)
    if (exercise) return { exercise, link }
  }
  return null
}

function introFor(item: PracticeItem): Exercise | null {
  if (item.kind === 'vocab') return { kind: 'intro', id: 'intro', vocab: item.vocab }
  if (item.kind === 'conjugation') return { kind: 'conjugation-match', id: 'cmatch', verbs: [item.verb] }
  return null
}

/** Ce qui varie d'une réponse à l'autre : la graine en dépend, deux places formées sur le même état ne tirent pas pareil. */
function fingerprint(progress: LinkProgress): number {
  let answers = 0
  for (const record of Object.values(progress)) {
    for (const link of Object.values(record.links ?? {})) answers += (link?.right ?? 0) + (link?.wrong ?? 0)
    if (record.presented) answers += 1
  }
  return answers
}

/**
 * Forme l'exercice d'une place réservée, d'après ce que l'apprenant sait à cet
 * instant ; `null` quand il n'y a plus rien à faire (la place est sautée).
 *
 * L'exercice formé prend l'identifiant de la place : la file, le compte des
 * premiers essais et le retour d'un exercice raté ne connaissent que lui.
 */
export function materializeGhost(
  ghost: GhostExercise,
  scope: GhostScope,
  state: GhostState,
  options: GhostOptions,
): Exercise | null {
  const rng = createRng(seedFrom(options.seed, ghost.id, fingerprint(state.progress)))
  const meta: GhostMeta = { session: String(options.seed), day: options.day }
  const decided = plan(scope, state, options, rng)
  if (decided.kind === 'none') return null

  let formed: { exercise: Exercise; link?: LinkId } | null
  if (decided.kind === 'intro') {
    const exercise = introFor(decided.item)
    if (!exercise) return null
    // Le tableau d'un verbe se relie : il présente, mais se note aussi en reconnaissance.
    formed = { exercise, link: exercise.kind === 'conjugation-match' ? 'reconnaissance' : undefined }
  } else {
    const { targets, practice } = decided
    if (practice) meta.practice = true
    formed = (ghost.shape === 'match' ? formMatch(targets, options, rng) : null) ?? formSingle(targets, scope, state, options, rng)
  }
  if (!formed) return null

  const exercise: Exercise = { ...formed.exercise, id: ghost.id, ghost: { ...meta, ...(formed.link ? { link: formed.link } : {}) } }
  for (const id of servedIds(exercise)) options.served.set(id, (options.served.get(id) ?? 0) + 1)
  return exercise
}

/** Les éléments qu'un exercice formé met en jeu. */
function servedIds(exercise: Exercise): string[] {
  switch (exercise.kind) {
    case 'intro':
    case 'choice':
    case 'cloze':
    case 'type':
    case 'flashcard':
      return [exercise.vocab.id]
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
      return []
  }
}

// --- notation -------------------------------------------------------------------

/** Une réponse à retenir pour un élément. Sans `link`, elle ne fait que marquer l'élément présenté. */
export interface LinkResult {
  id: string
  link?: LinkId
  correct?: boolean
  session?: string
  day?: string
}

/**
 * Les notes d'un exercice formé, élément par élément.
 *
 * Toute erreur compte, mais une bonne réponse seulement du premier coup : une
 * reprise réussie après erreur ne maîtrise rien (on la trouverait par
 * élimination). `missed` : pour une manche, les éléments où l'on s'est trompé
 * au moins une fois.
 */
export function linkResultsOf(exercise: Exercise, correct: boolean, firstTry: boolean, missed?: ReadonlySet<string>): LinkResult[] {
  const meta = exercise.ghost
  if (!meta) return []
  return servedIds(exercise).map((id) => {
    const right = missed ? !missed.has(id) : correct
    const graded = meta.link !== undefined && !meta.practice && (!right || firstTry)
    return graded ? { id, link: meta.link, correct: right, session: meta.session, day: meta.day } : { id }
  })
}

/** Applique des notes à une fiche, sans rien muter. `card` : la carte de révision, pour figer l'héritage. */
export function applyLinkResult(record: ItemRecord | undefined, result: LinkResult, card: CardState | undefined): ItemRecord {
  const legacy = legacyOf(record, card)
  const next: ItemRecord = { ...record, presented: true, ...(legacy !== undefined ? { legacy } : {}) }
  if (!result.link) return next

  const previous = record?.links?.[result.link] ?? { right: 0, wrong: 0 }
  next.links = {
    ...record?.links,
    [result.link]: result.correct
      ? { ...previous, right: previous.right + 1 }
      : { ...previous, wrong: previous.wrong + 1 },
  }
  if (result.correct) {
    if (result.session !== undefined) next.session = result.session
    if (result.day !== undefined && result.day !== record?.day) {
      next.day = result.day
      next.days = (record?.days ?? 0) + 1
    }
  }
  return next
}
