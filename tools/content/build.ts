/**
 * Compilateur de contenu.
 *
 *   content/courses/<id>/course.yaml   → métadonnées du cours et ordre des unités
 *   content/courses/<id>/units/*.yaml  → une unité par fichier
 *
 * produit
 *
 *   public/content/<id>.json           → cours compilé, embarqué dans l'app
 *   public/content/manifest.json       → index des cours (sert aux mises à jour)
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
import { courseSchema, unitSchema, type Course, type Manifest, type Unit } from '../../src/content/schema.ts'
import { containsTerm } from '../../src/content/text.ts'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const contentDir = join(root, 'content', 'courses')
const outDir = join(root, 'public', 'content')
const checkOnly = process.argv.includes('--check')

/** Le fichier course.yaml décrit les sections et référence les unités par identifiant. */
const courseFileSchema = courseSchema
  .omit({ sections: true })
  .extend({
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          units: z.array(z.string()).min(1),
        }),
      )
      .min(1),
  })

class ContentError extends Error {}

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

function loadUnit(file: string): Unit {
  const parsed = unitSchema.safeParse(readYaml(file))
  if (!parsed.success) fail(file, formatIssues(parsed.error))
  return parsed.data
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

  const unitsDir = join(dir, 'units')
  if (!existsSync(unitsDir)) fail(unitsDir, 'dossier units/ manquant')

  const units = new Map<string, Unit>()
  for (const name of readdirSync(unitsDir).sort()) {
    if (!name.endsWith('.yaml') && !name.endsWith('.yml')) continue
    const file = join(unitsDir, name)
    const unit = loadUnit(file)
    if (units.has(unit.id)) fail(file, `unité "${unit.id}" définie deux fois`)
    const expected = basename(name).replace(/\.ya?ml$/, '')
    if (unit.id !== expected) fail(file, `l'identifiant "${unit.id}" ne correspond pas au fichier "${expected}"`)
    units.set(unit.id, unit)
  }

  const used = new Set<string>()
  const sections = meta.data.sections.map((section) => ({
    id: section.id,
    title: section.title,
    units: section.units.map((unitId) => {
      const unit = units.get(unitId)
      if (!unit) fail(courseFile, `l'unité "${unitId}" est référencée mais aucun fichier units/${unitId}.yaml n'existe`)
      if (used.has(unitId)) fail(courseFile, `l'unité "${unitId}" est référencée deux fois`)
      used.add(unitId)
      return unit
    }),
  }))

  for (const unitId of units.keys()) {
    if (!used.has(unitId)) {
      fail(join(unitsDir, `${unitId}.yaml`), 'unité jamais référencée dans course.yaml')
    }
  }

  const course = courseSchema.parse({ ...meta.data, sections })
  checkCoherence(course, dir)
  return course
}

/** Règles qui dépassent la validation fichier par fichier. */
function checkCoherence(course: Course, dir: string) {
  const vocabIds = new Map<string, string>()
  const lessonIds = new Set<string>()
  const problems: string[] = []

  for (const section of course.sections) {
    for (const unit of section.units) {
      for (const lesson of unit.lessons) {
        if (lessonIds.has(lesson.id)) problems.push(`leçon "${lesson.id}" définie deux fois`)
        lessonIds.add(lesson.id)

        if (lesson.vocab.length < 4) {
          problems.push(
            `leçon "${lesson.id}" : ${lesson.vocab.length} mot(s), il en faut au moins 4 pour l'exercice d'association`,
          )
        }

        const seenTerms = new Set<string>()
        for (const vocab of lesson.vocab) {
          const owner = vocabIds.get(vocab.id)
          if (owner) problems.push(`mot "${vocab.id}" déjà défini dans la leçon "${owner}"`)
          vocabIds.set(vocab.id, lesson.id)

          const key = vocab.term.toLowerCase()
          if (seenTerms.has(key)) {
            problems.push(`leçon "${lesson.id}" : le terme "${vocab.term}" apparaît deux fois`)
          }
          seenTerms.add(key)

          if (vocab.example && !containsTerm(vocab.example.text, vocab.term)) {
            problems.push(
              `mot "${vocab.id}" : la phrase d'exemple ne contient pas "${vocab.term}", aucun exercice à trou ne sera généré`,
            )
          }
        }
      }
    }
  }

  if (problems.length) fail(dir, problems.join('\n    '))
}

function countVocab(course: Course): number {
  return course.sections.reduce(
    (total, section) =>
      total +
      section.units.reduce(
        (unitTotal, unit) => unitTotal + unit.lessons.reduce((n, lesson) => n + lesson.vocab.length, 0),
        0,
      ),
    0,
  )
}

function countLessons(course: Course): number {
  return course.sections.reduce(
    (total, section) => total + section.units.reduce((n, unit) => n + unit.lessons.length, 0),
    0,
  )
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

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      learning: course.learning,
      known: course.known,
      flag: course.flag,
      version: course.version,
      file: `${course.id}.json`,
      vocabCount: countVocab(course),
      lessonCount: countLessons(course),
    })),
  }

  for (const entry of manifest.courses) {
    console.log(`  ✓ ${entry.id}  v${entry.version}  ${entry.lessonCount} leçons, ${entry.vocabCount} mots`)
  }

  if (checkOnly) {
    console.log('\nContenu valide.')
    return
  }

  mkdirSync(outDir, { recursive: true })
  for (const course of courses) {
    writeFileSync(join(outDir, `${course.id}.json`), JSON.stringify(course), 'utf8')
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`\nÉcrit dans public/content/`)
}

main()
