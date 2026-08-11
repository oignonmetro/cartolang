import { courseSchema, manifestSchema, type Course, type Manifest, type ManifestEntry } from './schema'
import { cachedCourse, cachedManifest } from './contentCache'

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

/**
 * Cours proposés à l'apprenant.
 *
 * Un cours archivé reste compilé et validé par la CI, mais n'est plus offert :
 * c'est ainsi que le cours débutant a été mis de côté sans être perdu.
 */
export function availableCourses(manifest: Manifest): ManifestEntry[] {
  return manifest.courses.filter((entry) => entry.status === 'available')
}

/**
 * Manifeste à utiliser : le cache local (alimenté par `remoteSync.ts` dans
 * l'APK) s'il existe, sinon celui embarqué dans le build. Le cache est
 * toujours le plus frais par construction — voir `contentCache.ts`.
 */
export async function resolveManifest(): Promise<Manifest> {
  return cachedManifest() ?? loadManifest()
}

/** Même logique que `resolveManifest`, pour un cours donné. */
export async function resolveCourse(courseId: string): Promise<Course> {
  return cachedCourse(courseId) ?? loadCourse(courseId)
}
