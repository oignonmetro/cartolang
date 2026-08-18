/**
 * Compilateur de contenu.
 *
 *   content/courses/<id>/course.yaml   → métadonnées, et agencement du cours
 *   content/courses/<id>/units/*.yaml  → une unité par fichier
 *
 * produit
 *
 *   public/content/<id>.json           → cours compilé, embarqué dans l'app
 *   public/content/manifest.json       → index des cours (sert aux mises à jour)
 *
 * Le champ `kind` (vocab / grammar / conjugation) n'est écrit qu'une fois, sur
 * la piste ; le compilateur le propage aux unités puis aux leçons avant de
 * valider. Les fichiers d'unités restent donc courts.
 *
 * Usage :
 *   npm run content:build     compile
 *   npm run content:check     valide sans écrire (utilisé par la CI)
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import {
  courseSchema,
  unitSchema,
  GAP,
  type ConjugationLesson,
  type Course,
  type GrammarLesson,
  type LessonKind,
  type Manifest,
  type Unit,
  type VocabLesson,
} from '../../src/content/schema.ts'
import { findVocabGap } from '../../src/content/text.ts'
import { parseNotes } from '../../src/content/notes.ts'
import { itemsOfCourse, itemsOfLesson, lessonsOf } from '../../src/content/course.ts'
import {
  alphabetGatingRemarks,
  conjugationVerbRemarks,
  duplicateAcrossCourses,
  grammarPointRemarks,
} from './difficulty.ts'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const contentDir = join(root, 'content', 'courses')
const outDir = join(root, 'public', 'content')
const checkOnly = process.argv.includes('--check')

/**
 * Le fichier course.yaml décrit l'ossature et référence les unités par
 * identifiant ; les unités elles-mêmes vivent dans units/.
 */
const courseFileSchema = z.discriminatedUnion('layout', [
  courseSchema.options[0].omit({ sections: true }).extend({
    sections: z
      .array(z.object({ id: z.string(), title: z.string(), units: z.array(z.string()).min(1) }))
      .min(1),
  }),
  courseSchema.options[1].omit({ tracks: true }).extend({
    tracks: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          subtitle: z.string().optional(),
          kind: z.enum(['vocab', 'grammar', 'conjugation']),
          color: z.enum(['teal', 'violet', 'coral', 'amber', 'sky']).default('teal'),
          icon: z.string().default('book'),
          // Vide, une piste publie le squelette d'un niveau avant tout contenu.
          units: z.array(z.string()),
        }),
      )
      .min(1),
  }),
])

class ContentError extends Error {}

/**
 * Signalements qui n'invalident pas le contenu mais méritent un regard.
 * Une traduction identique au terme, par exemple : défendable pour un
 * grand débutant (« bus » est le même mot), douteux au-delà.
 */
const warnings: string[] = []

function warn(where: string, message: string) {
  warnings.push(`${where} : ${message}`)
}

function reportWarnings() {
  if (warnings.length === 0) return
  console.log(`\n${warnings.length} remarque(s) :`)
  for (const line of warnings) console.log(`  · ${line}`)
}

function fail(file: string, message: string): never {
  throw new ContentError(`${file}\n    ${message}`)
}

function readYaml(file: string): unknown {
  try {
    return parseYaml(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(file, `YAML illisible : ${(error as Error).message}`)
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
    .join('\n    ')
}

/** Propage la nature du contenu depuis la piste jusqu'aux leçons. */
function withKind(raw: unknown, kind: LessonKind): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const unit = raw as Record<string, unknown>
  const lessons = Array.isArray(unit.lessons) ? unit.lessons : []
  return {
    ...unit,
    kind: unit.kind ?? kind,
    lessons: lessons.map((lesson) =>
      typeof lesson === 'object' && lesson !== null
        ? { ...(lesson as Record<string, unknown>), kind: (lesson as Record<string, unknown>).kind ?? unit.kind ?? kind }
        : lesson,
    ),
  }
}

function loadUnits(dir: string, kindOf: (unitId: string) => LessonKind): Map<string, Unit> {
  const unitsDir = join(dir, 'units')
  if (!existsSync(unitsDir)) fail(unitsDir, 'dossier units/ manquant')

  const units = new Map<string, Unit>()
  for (const name of readdirSync(unitsDir).sort()) {
    if (!name.endsWith('.yaml') && !name.endsWith('.yml')) continue
    const file = join(unitsDir, name)
    const expected = basename(name).replace(/\.ya?ml$/, '')

    const parsed = unitSchema.safeParse(withKind(readYaml(file), kindOf(expected)))
    if (!parsed.success) fail(file, formatIssues(parsed.error))
    const unit = parsed.data

    if (unit.id !== expected) fail(file, `l'identifiant "${unit.id}" ne correspond pas au fichier "${expected}"`)
    if (units.has(unit.id)) fail(file, `unité "${unit.id}" définie deux fois`)
    units.set(unit.id, unit)
  }
  return units
}

function buildCourse(courseId: string): Course {
  const dir = join(contentDir, courseId)
  const courseFile = join(dir, 'course.yaml')
  if (!existsSync(courseFile)) fail(courseFile, 'fichier course.yaml manquant')

  const meta = courseFileSchema.safeParse(readYaml(courseFile))
  if (!meta.success) fail(courseFile, formatIssues(meta.error))
  if (meta.data.id !== courseId) {
    fail(courseFile, `l'identifiant "${meta.data.id}" ne correspond pas au dossier "${courseId}"`)
  }

  // La nature du contenu d'une unité vient de la piste qui la référence ;
  // un parcours n'a pas de piste et ne contient que du vocabulaire.
  const kindByUnit = new Map<string, LessonKind>()
  if (meta.data.layout === 'library') {
    for (const track of meta.data.tracks) {
      for (const unitId of track.units) kindByUnit.set(unitId, track.kind)
    }
  }
  const units = loadUnits(dir, (unitId) => kindByUnit.get(unitId) ?? 'vocab')

  const used = new Set<string>()
  const take = (unitId: string, from: string): Unit => {
    const unit = units.get(unitId)
    if (!unit) fail(courseFile, `l'unité "${unitId}" est référencée par ${from} mais units/${unitId}.yaml n'existe pas`)
    if (used.has(unitId)) fail(courseFile, `l'unité "${unitId}" est référencée deux fois`)
    used.add(unitId)
    return unit
  }

  const assembled =
    meta.data.layout === 'library'
      ? {
          ...meta.data,
          tracks: meta.data.tracks.map((track) => ({
            ...track,
            units: track.units.map((unitId) => take(unitId, `la piste "${track.id}"`)),
          })),
        }
      : {
          ...meta.data,
          sections: meta.data.sections.map((section) => ({
            ...section,
            units: section.units.map((unitId) => take(unitId, `la section "${section.id}"`)),
          })),
        }

  for (const unitId of units.keys()) {
    if (!used.has(unitId)) fail(join(dir, 'units', `${unitId}.yaml`), 'unité jamais référencée dans course.yaml')
  }

  const parsed = courseSchema.safeParse(assembled)
  if (!parsed.success) fail(courseFile, formatIssues(parsed.error))

  checkCoherence(parsed.data, dir)
  return parsed.data
}

/** Règles qui dépassent la validation fichier par fichier. */
function checkCoherence(course: Course, dir: string) {
  const itemOwner = new Map<string, string>()
  const lessonIds = new Set<string>()
  const problems: string[] = []

  for (const { lesson, unit } of lessonsOf(course)) {
    if (lessonIds.has(lesson.id)) problems.push(`leçon "${lesson.id}" définie deux fois`)
    lessonIds.add(lesson.id)

    if (unit.kind !== lesson.kind) {
      problems.push(`leçon "${lesson.id}" de nature ${lesson.kind} dans une unité ${unit.kind}`)
    }

    checkNotesMarkup(lesson.id, 'notes' in lesson ? lesson.notes : undefined)
    if (lesson.kind === 'vocab') checkVocabLesson(lesson, problems, course.learning)
    if (lesson.kind === 'grammar') checkGrammarLesson(lesson, problems)
    if (lesson.kind === 'conjugation') checkConjugationLesson(lesson, problems, course.level ?? '')
  }

  for (const { lesson } of lessonsOf(course)) {
    for (const item of itemsOfLesson(lesson)) {
      const owner = itemOwner.get(item.id)
      if (owner) problems.push(`identifiant "${item.id}" déjà utilisé dans la leçon "${owner}"`)
      itemOwner.set(item.id, lesson.id)
    }
  }

  // Un cours qui enseigne un alphabet doit rester déchiffrable de bout en bout.
  const vocabLessons = lessonsOf(course)
    .map(({ lesson }) => lesson)
    .filter((lesson): lesson is VocabLesson => lesson.kind === 'vocab')
  for (const remark of alphabetGatingRemarks(vocabLessons)) warn(`cours "${course.id}"`, remark)

  if (problems.length) fail(dir, problems.join('\n    '))
}

function checkVocabLesson(lesson: VocabLesson, problems: string[], learning: string) {
  if (lesson.vocab.length < 4) {
    problems.push(
      `leçon "${lesson.id}" : ${lesson.vocab.length} mot(s), il en faut au moins 4 pour l'exercice d'association`,
    )
  }

  const seen = new Set<string>()
  for (const vocab of lesson.vocab) {
    const key = vocab.term.toLowerCase()
    if (seen.has(key)) problems.push(`leçon "${lesson.id}" : le terme "${vocab.term}" apparaît deux fois`)
    seen.add(key)

    // Une carte « motif → motif » n'enseigne rien, et l'association afficherait
    // le même mot dans les deux colonnes. Défendable pour un grand débutant,
    // douteux au-delà : on signale sans bloquer.
    if (vocab.term.trim().toLowerCase() === vocab.translation.trim().toLowerCase()) {
      warn(
        `mot "${vocab.id}"`,
        `traduction identique au terme ("${vocab.term}") ; une traduction qui ` +
          'informe, avec la forme identique dans `alt`, ferait une meilleure carte',
      )
    }

    // L'infinitif anglais s'écrit avec « to » : la convention rend les cartes
    // comparables et guide la forme attendue à la saisie. Elle ne vaut que pour
    // l'anglais — l'infinitif russe (« есть ») ne porte aucune particule.
    if (learning === 'en' && vocab.pos === 'verbe' && !/^to\s/i.test(vocab.term)) {
      warn(`mot "${vocab.id}"`, `verbe noté sans « to » ("${vocab.term}")`)
    }

    if (vocab.example && !findVocabGap(vocab.example.text, vocab.term, vocab.gap)) {
      problems.push(
        `mot "${vocab.id}" : la phrase d'exemple ne contient ni "${vocab.term}" ni sa forme nue ; ` +
          "ajoutez un champ `gap` avec la forme exacte à masquer",
      )
    }
  }

  // Deux mots d'une même leçon qui acceptent la même réponse : la saisie ne
  // peut plus les distinguer, et le couple perd son intérêt.
  const accepted = new Map<string, string>()
  for (const vocab of lesson.vocab) {
    for (const answer of [vocab.translation, ...vocab.alt]) {
      const key = answer.trim().toLowerCase()
      const owner = accepted.get(key)
      if (owner && owner !== vocab.term) {
        warn(`leçon "${lesson.id}"`, `« ${answer} » est accepté pour « ${owner} » et « ${vocab.term} »`)
      }
      accepted.set(key, vocab.term)
    }
  }
}

/**
 * Une forme citée entre accents graves doit tenir sur une seule ligne.
 *
 * Le repli du YAML est recollé pour la prose et les pièges, mais pas à la
 * frontière entre une règle et son exemple indenté : les deux moitiés y
 * deviennent des champs distincts, chacune avec un accent grave orphelin, que
 * l'apprenant voit alors s'afficher tel quel.
 */
function checkNotesMarkup(lessonId: string, notes: string | undefined) {
  if (!notes) return
  for (const block of parseNotes(notes)) {
    if (block.kind !== 'rules') continue
    for (const rule of block.rules) {
      for (const [field, text] of [['règle', rule.body], ['exemple', rule.example]] as const) {
        if (text && (text.match(/`/g)?.length ?? 0) % 2 === 1) {
          warn(
            `leçon "${lessonId}"`,
            `accent grave orphelin dans ${field} « ${text.slice(0, 48)}… » : une forme citée ` +
              "ne doit pas être coupée par un repli de ligne, elle s'afficherait avec ses accents graves",
          )
        }
      }
    }
  }
}

function checkGrammarLesson(lesson: GrammarLesson, problems: string[]) {
  if (lesson.points.length < 3) {
    problems.push(`leçon "${lesson.id}" : ${lesson.points.length} point(s), il en faut au moins 3`)
  }

  for (const point of lesson.points) {
    if (!point.sentence.includes(GAP)) {
      problems.push(`point "${point.id}" : la phrase doit contenir le marqueur ${GAP}`)
    }
    if (point.options.length > 0 && !point.options.includes(point.answer)) {
      problems.push(`point "${point.id}" : la réponse "${point.answer}" ne figure pas dans les options proposées`)
    }
    if (point.options.length === 1) {
      problems.push(`point "${point.id}" : une seule option proposée, il en faut au moins 2 ou aucune`)
    }

    // Un distracteur doit être faux pour la raison qu'enseigne le point ;
    // sinon l'exercice se résout sans la règle (voir difficulty.ts).
    for (const remark of grammarPointRemarks(point)) warn(`leçon "${lesson.id}"`, remark)
  }
}

function checkConjugationLesson(lesson: ConjugationLesson, problems: string[], courseLevel: string) {
  const total = lesson.verbs.reduce((count, verb) => count + verb.forms.length, 0)
  if (total < 4) {
    problems.push(`leçon "${lesson.id}" : ${total} forme(s), il en faut au moins 4 pour l'exercice d'association`)
  }

  for (const verb of lesson.verbs) {
    const persons = new Set<string>()
    for (const form of verb.forms) {
      if (persons.has(form.person)) {
        problems.push(`verbe "${verb.verb}" (${verb.tense}) : la personne "${form.person}" apparaît deux fois`)
      }
      persons.add(form.person)
    }

    // Deux formes qu'un seul mot sépare font une paire d'association triviale.
    for (const remark of conjugationVerbRemarks(verb, courseLevel)) warn(`leçon "${lesson.id}"`, remark)
  }
}

/**
 * Ce qu'un cours ne peut pas voir seul : les phrases qu'un niveau reprend au
 * niveau voisin. Un cours archivé sert de référence historique et n'entre pas
 * dans la comparaison.
 */
function checkAcrossCourses(courses: readonly Course[]) {
  const sentences: { courseId: string; where: string; sentence: string }[] = []

  for (const course of courses) {
    if (course.status === 'archived') continue
    for (const { lesson } of lessonsOf(course)) {
      if (lesson.kind === 'grammar') {
        for (const point of lesson.points) {
          sentences.push({ courseId: course.id, where: point.id, sentence: point.sentence })
        }
      }
      // Les exemples des cartes de cours se recopient aussi d'un niveau à l'autre.
      for (const line of (lesson.notes ?? '').split('\n')) {
        const trimmed = line.trim().replace(/^[—!]\s*/, '')
        if (/^[A-Z][^.!?]*[.!?]$/.test(trimmed) && !/[àâçéèêëîïôûùü«»]/i.test(trimmed)) {
          sentences.push({ courseId: course.id, where: `${lesson.id} (carte)`, sentence: trimmed })
        }
      }
    }
  }

  for (const remark of duplicateAcrossCourses(sentences)) warn('entre cours', remark)
}

function main() {
  if (!existsSync(contentDir)) {
    console.error(`Aucun contenu trouvé dans ${contentDir}`)
    process.exit(1)
  }

  const courseIds = readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const courses: Course[] = []
  const errors: string[] = []

  for (const id of courseIds) {
    try {
      courses.push(buildCourse(id))
    } catch (error) {
      if (error instanceof ContentError) errors.push(error.message)
      else throw error
    }
  }

  if (errors.length) {
    console.error(`\n✗ Contenu invalide (${errors.length} cours en erreur) :\n`)
    for (const message of errors) console.error(`  ${message}\n`)
    process.exit(1)
  }

  checkAcrossCourses(courses)

  if (courses.every((course) => course.status === 'archived')) {
    console.error('\n✗ Tous les cours sont archivés : l\'application n\'aurait rien à proposer.')
    process.exit(1)
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      learning: course.learning,
      known: course.known,
      flag: course.flag,
      level: course.level,
      tagline: course.tagline,
      layout: course.layout,
      status: course.status,
      default: course.default,
      version: course.version,
      file: `${course.id}.json`,
      itemCount: itemsOfCourse(course).length,
      lessonCount: lessonsOf(course).length,
    })),
  }

  for (const entry of manifest.courses) {
    const badge = entry.status === 'archived' ? ' (archivé)' : ''
    console.log(
      `  ✓ ${entry.id}  v${entry.version}  ${entry.layout}  ${entry.lessonCount} leçons, ${entry.itemCount} éléments${badge}`,
    )
  }

  if (checkOnly) {
    reportWarnings()
    console.log('\nContenu valide.')
    return
  }

  mkdirSync(outDir, { recursive: true })
  for (const course of courses) {
    writeFileSync(join(outDir, `${course.id}.json`), JSON.stringify(course), 'utf8')
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  reportWarnings()
  console.log(`\nÉcrit dans public/content/`)
}

main()
