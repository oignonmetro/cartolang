import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Course, Manifest } from './schema'
import { cachedCourse, cachedManifest, writeCachedCourse, writeCachedManifest } from './contentCache'

/**
 * `Capacitor.isNativePlatform()` est le seul interrupteur du module : on le
 * simule pour couvrir le comportement web (aucun réseau) et natif (APK).
 * `vi.mock` est hoisté au-dessus des imports par Vitest, donc l'import de
 * `remoteSync` ci-dessous reçoit déjà la version simulée.
 */
const isNativePlatform = vi.fn(() => true)
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }))

const { syncContentFromRemote } = await import('./remoteSync')

function fakeLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  } satisfies Storage
}

function manifestWith(version: number): Manifest {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    courses: [
      {
        id: 'fr-en-b2',
        name: 'Anglais B2',
        learning: 'en',
        known: 'fr',
        flag: '🇬🇧',
        layout: 'library',
        status: 'available',
        default: false,
        version,
        file: 'fr-en-b2.json',
        itemCount: 1,
        lessonCount: 1,
      },
    ],
  }
}

function courseWith(version: number): Course {
  return {
    id: 'fr-en-b2',
    name: 'Anglais B2',
    learning: 'en',
    known: 'fr',
    flag: '🇬🇧',
    status: 'available',
    default: false,
    version,
    layout: 'library',
    tracks: [
      {
        id: 'vocabulaire',
        title: 'Vocabulaire',
        kind: 'vocab',
        color: 'teal',
        icon: 'book',
        units: [
          {
            id: 'v1',
            title: 'Unité 1',
            icon: 'book',
            color: 'teal',
            kind: 'vocab',
            lessons: [
              {
                kind: 'vocab',
                id: 'l1',
                title: 'Leçon 1',
                checkpoint: false,
                vocab: [{ id: 'w1', term: 'hello', translation: 'bonjour', alt: [] }],
              },
            ],
          },
        ],
      },
    ],
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage())
  isNativePlatform.mockReturnValue(true)
})

describe('synchronisation du contenu distant', () => {
  it('ne fait aucun appel réseau hors de l’app native', async () => {
    isNativePlatform.mockReturnValue(false)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await syncContentFromRemote()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('télécharge et met en cache un cours plus récent', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return jsonResponse(manifestWith(2))
      if (url.endsWith('fr-en-b2.json')) return jsonResponse(courseWith(2))
      throw new Error(`inattendu : ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    await syncContentFromRemote()

    expect(cachedManifest()?.courses[0]?.version).toBe(2)
    expect(cachedCourse('fr-en-b2')?.version).toBe(2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('ne télécharge rien quand le cache est déjà à jour', async () => {
    writeCachedCourse(courseWith(2))
    writeCachedManifest(manifestWith(2))

    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return jsonResponse(manifestWith(2))
      throw new Error(`ne devrait pas être appelé : ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    await syncContentFromRemote()

    expect(fetchSpy).toHaveBeenCalledTimes(1) // seulement le manifeste
  })

  it('reste silencieux et ne touche pas au cache si l’origine est injoignable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    await expect(syncContentFromRemote()).resolves.toBeUndefined()

    expect(cachedManifest()).toBeNull()
  })

  it('n’écrit pas le manifeste si un cours échoue en cours de synchronisation', async () => {
    const manifestTwoCourses: Manifest = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      courses: [
        ...manifestWith(2).courses,
        {
          id: 'autre-cours',
          name: 'Autre cours',
          learning: 'de',
          known: 'fr',
          flag: '🇩🇪',
          layout: 'library',
          status: 'available',
          default: false,
          version: 2,
          file: 'autre-cours.json',
          itemCount: 1,
          lessonCount: 1,
        },
      ],
    }

    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return jsonResponse(manifestTwoCourses)
      if (url.endsWith('fr-en-b2.json')) return jsonResponse(courseWith(2))
      if (url.endsWith('autre-cours.json')) throw new Error('coupure réseau en cours de route')
      throw new Error(`inattendu : ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    await syncContentFromRemote()

    // Le premier cours a bien été mis en cache : rien à retélécharger pour
    // lui la prochaine fois. Mais le manifeste n'avance pas, pour que le
    // second cours soit retenté au prochain démarrage.
    expect(cachedCourse('fr-en-b2')?.version).toBe(2)
    expect(cachedManifest()).toBeNull()
  })
})
