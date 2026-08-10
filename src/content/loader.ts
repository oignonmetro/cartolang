import { courseSchema, manifestSchema, type Course, type Manifest, type Vocab } from './schema'

/**
 * Chargement des cours.
 *
 * Les cours compilés sont servis depuis `public/content/`, donc embarqués dans
 * le build : ils sont disponibles hors-ligne dès la première ouverture, et
 * précachés par le service worker. La validation à l'exécution protège le jour
 * où un cours sera téléchargé depuis le réseau.
 */

/** `import.meta.env.BASE_URL` vaut "/" en local et dans l'APK, "/cartolang/" sur GitHub Pages. */
function contentUrl(path: string): string {
  return `${import.meta.env.BASE_URL}content/${path}`.replace(/([^:]\/)\/+/g, '$1')
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(contentUrl(path), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`${path} : ${response.status} ${response.statusText}`)
  return response.json()
}

export async function loadManifest(): Promise<Manifest> {
  const parsed = manifestSchema.safeParse(await fetchJson('manifest.json'))
  if (!parsed.success) throw new Error(`Manifeste de contenu invalide : ${parsed.error.message}`)
  return parsed.data
}

export async function loadCourse(courseId: string): Promise<Course> {
  const parsed = courseSchema.safeParse(await fetchJson(`${courseId}.json`))
  if (!parsed.success) throw new Error(`Cours "${courseId}" invalide : ${parsed.error.message}`)
  return parsed.data
}

export interface VocabLocation {
  vocab: Vocab
  lessonId: string
}

/** Index mot → leçon, pour retrouver un mot depuis une carte de révision. */
export function indexVocab(course: Course): Map<string, VocabLocation> {
  const byId = new Map<string, VocabLocation>()
  for (const section of course.sections) {
    for (const unit of section.units) {
      for (const lesson of unit.lessons) {
        for (const vocab of lesson.vocab) {
          byId.set(vocab.id, { vocab, lessonId: lesson.id })
        }
      }
    }
  }
  return byId
}
