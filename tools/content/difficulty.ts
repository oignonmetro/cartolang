/**
 * Contrôles de difficulté.
 *
 * Le reste du compilateur valide la structure — identifiants uniques, trou
 * présent, réponse figurant parmi les options. Ce module vérifie autre chose :
 * qu'un exercice teste bien ce qu'il prétend tester.
 *
 * Une seule règle les commande tous : **un distracteur doit être faux pour la
 * raison qu'enseigne le point**. Un distracteur qu'on écarte autrement — parce
 * qu'il sonne impossible, parce qu'il casse l'accord, parce qu'un seul mot le
 * sépare de la bonne réponse — laisse résoudre l'exercice sans la règle visée.
 * L'exercice cesse alors de valoir son niveau, sans que rien ne le signale.
 *
 * Ces contrôles sont **des remarques, jamais des erreurs** : ce sont des
 * heuristiques, elles se trompent, et c'est à l'auteur de trancher. Elles
 * repèrent les tournures qui ont réellement posé problème dans ce corpus,
 * pas l'anglais en général.
 */
import { GAP, type ConjugationVerb, type GrammarPoint, type Vocab } from '../../src/content/schema.ts'

/** Mots dont la première lettre ment sur le son initial. */
const SILENT_H = new Set([
  'hour', 'hours', 'honest', 'honestly', 'honesty', 'honour', 'honours', 'honourable',
  'honorary', 'honor', 'heir', 'heiress',
])

/** Voyelle à l'écrit, consonne à l'oreille — le [j] de « university », le [w] de « once ». */
const CONSONANT_ONSET = new Set([
  'university', 'universities', 'universal', 'unique', 'unit', 'units', 'united', 'uniform',
  'union', 'unions', 'european', 'europe', 'user', 'users', 'useful', 'usual', 'utility',
  'once', 'one', 'ubiquitous', 'euro', 'eulogy',
])

type Sound = 'vowel' | 'consonant' | 'unknown'

/**
 * Le son initial d'un mot, pour arbitrer « a » contre « an ».
 *
 * Les sigles se prononcent lettre à lettre (« an MP ») : impossible de trancher
 * sur l'orthographe seule, on renvoie `unknown` plutôt que de risquer un faux
 * signalement.
 */
export function initialSound(word: string): Sound {
  const bare = word.replace(/^[^A-Za-z]+/, '').split(/[-–—]/)[0].replace(/[^A-Za-z].*$/, '')
  if (!bare) return 'unknown'
  if (bare.length > 1 && bare === bare.toUpperCase()) return 'unknown'

  const w = bare.toLowerCase()
  if (SILENT_H.has(w)) return 'vowel'
  if (CONSONANT_ONSET.has(w)) return 'consonant'
  return 'aeiou'.includes(w[0]) ? 'vowel' : 'consonant'
}

/** Le premier mot qui suit le trou, celui dont dépend le choix a/an. */
function wordAfterGap(sentence: string): string {
  const after = sentence.split(GAP)[1] ?? ''
  return after.trim().split(/\s+/)[0] ?? ''
}

const NUMBER_MARKED: Record<string, 'sing' | 'plur'> = {
  is: 'sing', was: 'sing', has: 'sing',
  are: 'plur', were: 'plur', have: 'plur',
}

/** Noms en -s qui restent singuliers, et que l'accord ne doit pas piéger. */
const SINGULAR_IN_S = new Set([
  'news', 'politics', 'mathematics', 'maths', 'physics', 'economics', 'statistics',
  'analysis', 'series', 'species', 'means', 'crossroads',
])

const SINGULAR_DETERMINERS = new Set(['a', 'an', 'this', 'each', 'every', 'one'])
const PLURAL_DETERMINERS = new Set(['these', 'those', 'many', 'both', 'several', 'few'])

/** Le nombre d'un groupe nominal, tel qu'un accord sujet-verbe le verrait. */
export function phraseNumber(phrase: string): 'sing' | 'plur' | 'unknown' {
  const tokens = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 'unknown'

  const first = tokens[0].replace(/[^a-z']/g, '')
  if (SINGULAR_DETERMINERS.has(first)) return 'sing'
  if (PLURAL_DETERMINERS.has(first)) return 'plur'

  const head = tokens[tokens.length - 1].replace(/[^a-z']/g, '')
  if (!head) return 'unknown'
  if (SINGULAR_IN_S.has(head)) return 'sing'
  if (head.endsWith('ss')) return 'sing'
  return head.endsWith('s') ? 'plur' : 'sing'
}

function hasDeterminer(phrase: string): boolean {
  const first = phrase.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z']/g, '') ?? ''
  return (
    SINGULAR_DETERMINERS.has(first) ||
    PLURAL_DETERMINERS.has(first) ||
    ['the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'most'].includes(first)
  )
}

/**
 * Mots-outils : auxiliaires, modaux, conjonctions, prépositions, pronoms.
 *
 * Les contrôles d'accord ne valent que pour des groupes nominaux. Sans ce
 * filtre, un trou qui accueille un auxiliaire (« ___ we known earlier ») ou
 * une locution (« ___ the storm ») déclenche des signalements absurdes.
 */
const FUNCTION_WORDS = new Set([
  'be', 'been', 'being', 'am', 'is', 'are', 'was', 'were', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may',
  'might', 'must', 'ought', 'let',
  'if', 'as', 'than', 'that', 'whether', 'unless', 'because', 'since', 'while',
  'whereas', 'though', 'although', 'when', 'where', 'which', 'who', 'whom', 'whose',
  'for', 'from', 'of', 'to', 'in', 'on', 'at', 'by', 'with', 'into', 'onto', 'over',
  'under', 'through', 'across', 'along', 'among', 'between', 'within', 'about',
  'despite', 'during', 'until', 'till', 'ago', 'above', 'below',
  'not', "n't", 'so', 'such', 'only', 'but', 'and', 'or', 'nor', 'otherwise',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'the', 'a', 'an', 'this', 'these', 'those', 'some', 'any', 'most', 'much',
  'many', 'few', 'little', 'more', 'less', 'fewer', 'no', 'every', 'each',
])

/** Modaux : « would have » n'est pas un verbe accordé, c'est un auxiliaire composé. */
const MODALS = new Set(['will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must'])

/**
 * L'option peut-elle s'analyser comme un groupe nominal ?
 *
 * On exige que sa tête soit autre chose qu'un mot-outil : « The waters » oui,
 * « Have », « But for » ou « as » non.
 */
export function looksLikeNounPhrase(option: string): boolean {
  const tokens = option.trim().toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z'-]/g, '')).filter(Boolean)
  if (tokens.length === 0) return false
  return !FUNCTION_WORDS.has(tokens[tokens.length - 1])
}

/**
 * Le verbe accordé dont dépend le sujet placé dans le trou.
 *
 * On s'arrête au premier modal rencontré : dans « ___ we would have cancelled »,
 * le `have` appartient à `would have` et n'accorde rien. On renonce aussi
 * au-delà de quelques mots, le sujet et son verbe étant alors trop éloignés
 * pour qu'on puisse encore en juger sans analyser la phrase.
 */
function mainVerbAfterGap(sentence: string): string | null {
  const after = (sentence.split(GAP)[1] ?? '').toLowerCase().split(/\s+/)
  for (const raw of after.slice(0, 6)) {
    const token = raw.replace(/[^a-z']/g, '')
    if (!token) continue
    if (MODALS.has(token)) return null
    if (NUMBER_MARKED[token]) return token
  }
  return null
}

/**
 * Les remarques que soulève un point de grammaire.
 *
 * Chaque règle s'efface quand le point porte précisément sur ce qu'elle
 * contrôle : signaler « an » dans une leçon sur a/an n'aurait aucun sens.
 */
export function grammarPointRemarks(point: GrammarPoint): string[] {
  const remarks: string[] = []
  if (!point.sentence.includes(GAP)) return remarks

  const distractors = point.options.filter((option) => option !== point.answer)
  const answer = point.answer.trim().toLowerCase()

  // 1. Un « an » devant un son de consonne s'écarte à l'oreille, sans rien
  //    savoir de la règle testée — sauf si la règle testée est justement a/an.
  if (answer !== 'a' && answer !== 'an') {
    const next = wordAfterGap(point.sentence)
    const sound = initialSound(next)
    for (const option of distractors) {
      const o = option.trim().toLowerCase()
      if (o !== 'a' && o !== 'an') continue
      if (sound === 'unknown') continue
      if ((o === 'an' && sound === 'consonant') || (o === 'a' && sound === 'vowel')) {
        remarks.push(
          `point "${point.id}" : le distracteur « ${option} » est impossible devant « ${next} » ` +
            "par la seule règle a/an ; il s'élimine sans la règle du point",
        )
      }
    }
  }

  // 2. Le trou occupe la place du sujet : un distracteur qui brouille l'accord
  //    avec le verbe se repère à l'accord, pas à la règle. On passe si le trou
  //    est lui-même le verbe, l'accord étant alors ce qu'on enseigne.
  if (point.sentence.trimStart().startsWith(GAP) && !NUMBER_MARKED[answer]) {
    const verb = mainVerbAfterGap(point.sentence)
    if (verb) {
      for (const option of distractors) {
        if (!looksLikeNounPhrase(option)) continue
        const number = phraseNumber(option)
        if (number !== 'unknown' && number !== NUMBER_MARKED[verb]) {
          remarks.push(
            `point "${point.id}" : le distracteur « ${option} » casse l'accord avec « ${verb} » ; ` +
              "il s'élimine sur l'accord, pas sur la règle du point",
          )
        }
      }
    }
  }

  // 3. Même défaut côté attribut : « she is now researchers » se corrige au
  //    nombre. On passe si la réponse est elle-même un pluriel nu.
  const before = point.sentence.split(GAP)[0] ?? ''
  if (/\b(is|was)\s+(?:\w+\s+)?$/i.test(before) && !(phraseNumber(answer) === 'plur' && !hasDeterminer(answer))) {
    for (const option of distractors) {
      if (!looksLikeNounPhrase(option)) continue
      if (phraseNumber(option) === 'plur' && !hasDeterminer(option)) {
        remarks.push(
          `point "${point.id}" : le distracteur « ${option} » est un pluriel nu après un verbe ` +
            "singulier ; il s'élimine au nombre, pas sur la règle du point",
        )
      }
    }
  }

  return remarks
}

/**
 * L'unique mot qui sépare deux formes, quand c'en est un — sinon `null`.
 *
 * « will win » et « will not win » ne diffèrent que par « not » ; « would have
 * passed » et « would pass » diffèrent autrement, et opposent alors deux vraies
 * constructions.
 */
export function insertedToken(a: string, b: string): string | null {
  const ta = a.trim().split(/\s+/)
  const tb = b.trim().split(/\s+/)
  if (Math.abs(ta.length - tb.length) !== 1) return null

  const [short, long] = ta.length < tb.length ? [ta, tb] : [tb, ta]
  let i = 0
  while (i < short.length && short[i] === long[i]) i++
  for (let j = i; j < short.length; j++) {
    if (short[j] !== long[j + 1]) return null
  }
  return long[i]
}

/** Mots dont l'insertion seule ne fait pas un exercice de niveau B2. */
const TRIVIAL_INSERTIONS = new Set([
  'not', "n't", 'never', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
])

/**
 * Les remarques que soulève un tableau de conjugaison.
 *
 * L'exercice d'association présente les formes d'un même verbe côte à côte :
 * si deux d'entre elles ne diffèrent que par un mot inséré, la paire se résout
 * en repérant ce mot, sans rien savoir de la construction. Toléré en B1, où la
 * négation et la question sont encore l'objet même de l'apprentissage ; suspect
 * au-delà.
 */
export function conjugationVerbRemarks(verb: ConjugationVerb, courseLevel: string): string[] {
  if (!/^(B2|C1|C2)/i.test(courseLevel)) return []

  const remarks: string[] = []
  for (let i = 0; i < verb.forms.length; i++) {
    for (let j = i + 1; j < verb.forms.length; j++) {
      const token = insertedToken(verb.forms[i].answer, verb.forms[j].answer)
      if (token && TRIVIAL_INSERTIONS.has(token.toLowerCase())) {
        remarks.push(
          `verbe "${verb.verb}" (${verb.tense}) : « ${verb.forms[i].answer} » et ` +
            `« ${verb.forms[j].answer} » ne diffèrent que par « ${token} » ; ` +
            "la paire se résout en repérant ce mot",
        )
      }
    }
  }
  return remarks
}

/**
 * Les phrases anglaises reprises telles quelles d'un cours à l'autre.
 *
 * Un niveau qui rejoue l'exemple du niveau précédent n'approfondit rien, même
 * quand la règle affichée diffère. On ne compare que les phrases assez longues
 * pour être signifiantes.
 */
export function duplicateAcrossCourses(
  entries: readonly { courseId: string; where: string; sentence: string }[],
): string[] {
  const bySentence = new Map<string, { courseId: string; where: string }[]>()
  for (const entry of entries) {
    const key = entry.sentence.trim().replace(/\s+/g, ' ').toLowerCase()
    if (key.length < 20) continue
    const list = bySentence.get(key) ?? []
    list.push({ courseId: entry.courseId, where: entry.where })
    bySentence.set(key, list)
  }

  const remarks: string[] = []
  for (const [sentence, list] of bySentence) {
    const courses = new Set(list.map((item) => item.courseId))
    if (courses.size < 2) continue
    remarks.push(
      `« ${sentence} » apparaît dans ${[...courses].join(' et ')} ` +
        `(${list.map((item) => item.where).join(', ')})`,
    )
  }
  return remarks
}

/**
 * Un cours qui enseigne un alphabet promet que tout ce qu'il montre est
 * déchiffrable : aucun mot ne doit employer une lettre que l'apprenant n'a pas
 * encore rencontrée. C'est ce qui distingue une progression d'un empilement.
 *
 * Le contrôle ne s'active que si le cours comporte des cartes `pos: lettre` ;
 * ailleurs il ne coûte rien. L'ordre des leçons fait foi — d'où un cours en
 * `layout: path`, où cet ordre est imposé.
 */
export function alphabetGatingRemarks(
  lessons: readonly { id: string; vocab: readonly Vocab[] }[],
): string[] {
  const teachesLetters = lessons.some((l) => l.vocab.some((v) => v.pos === 'lettre'))
  if (!teachesLetters) return []

  const remarks: string[] = []
  const known = new Set<string>()

  for (const lesson of lessons) {
    for (const item of lesson.vocab) {
      if (item.pos === 'lettre') continue
      // Le terme et sa phrase d'exemple sont tous deux donnés à lire.
      for (const [what, text] of [['le mot', item.term], ["l'exemple", item.example?.text]] as const) {
        if (!text) continue
        const missing = [...new Set([...text.toLowerCase()])].filter(
          (c) => /\p{Script=Cyrillic}/u.test(c) && !known.has(c),
        )
        if (missing.length > 0) {
          remarks.push(
            `leçon "${lesson.id}" : ${what} « ${item.term} » emploie ${missing
              .map((c) => `« ${c} »`)
              .join(', ')}, pas encore enseigné`,
          )
        }
      }
    }
    // Les lettres de la leçon ne comptent qu'à partir de la leçon suivante.
    for (const item of lesson.vocab) {
      if (item.pos !== 'lettre') continue
      for (const c of item.term.toLowerCase()) known.add(c)
    }
  }
  return remarks
}
