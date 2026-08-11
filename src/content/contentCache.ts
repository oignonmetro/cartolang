import { courseSchema, manifestSchema, type Course, type Manifest } from './schema'

/**
 * Cache local du contenu, alimenté par `remoteSync.ts`.
 *
 * Sert de pont entre ce qui est embarqué dans le build (toujours disponible,
 * garanti valide) et ce qui a pu être téléchargé depuis GitHub Pages après
 * coup. Une entrée en cache prend systématiquement le pas sur le contenu
 * embarqué : c'est elle la plus fraîche par construction.
 *
 * Ce module ne fait aucun réseau — seulement de la lecture/écriture locale,
 * tolérante à un stockage absent, corrompu ou plein.
 */

const STORAGE_KEY = 'cartolang.content-cache.v1'

interface Cache {
  manifest: Manifest | null
  courses: Record<string, Course>
}

const EMPTY: Cache = { manifest: null, courses: {} }

function read(): Cache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY

    const parsed = JSON.parse(raw) as { manifest?: unknown; courses?: Record<string, unknown> }
    const manifest = manifestSchema.safeParse(parsed.manifest)

    const courses: Record<string, Course> = {}
    for (const [id, value] of Object.entries(parsed.courses ?? {})) {
      const course = courseSchema.safeParse(value)
      if (course.success) courses[id] = course.data
    }

    return { manifest: manifest.success ? manifest.data : null, courses }
  } catch {
    // Stockage absent, JSON corrompu… le contenu embarqué reste le filet
    // de sécurité, inutile de faire échouer quoi que ce soit ici.
    return EMPTY
  }
}

function write(cache: Cache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Quota dépassé ou stockage indisponible (navigation privée…) : on
    // continue sans cache plutôt que de faire échouer la synchronisation.
  }
}

export function cachedManifest(): Manifest | null {
  return read().manifest
}

export function cachedCourse(courseId: string): Course | null {
  return read().courses[courseId] ?? null
}

export function writeCachedCourse(course: Course): void {
  const current = read()
  write({ ...current, courses: { ...current.courses, [course.id]: course } })
}

export function writeCachedManifest(manifest: Manifest): void {
  const current = read()
  write({ ...current, manifest })
}
