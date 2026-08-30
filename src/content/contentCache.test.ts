import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Course, Manifest } from './schema'
import { cachedCourse, cachedManifest, writeCachedCourse, writeCachedManifest } from './contentCache'

/**
 * Le bac à sable de test tourne en environnement Node, sans `localStorage`
 * natif : on le simule par un `Map`, comme le ferait un vrai navigateur ou
 * la WebView Capacitor pour ce module (lecture/écriture synchrone, texte).
 */
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

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage())
})

const MANIFEST: Manifest = {
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
      version: 2,
      file: 'fr-en-b2.json',
      itemCount: 10,
      lessonCount: 2,
    },
  ],
}

const COURSE: Course = {
  id: 'fr-en-b2',
  name: 'Anglais B2',
  learning: 'en',
  known: 'fr',
  flag: '🇬🇧',
  status: 'available',
  default: false,
  version: 2,
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
              vocab: [{ id: 'w1', term: 'hello', translation: 'bonjour', alt: [] }],
            },
          ],
        },
      ],
    },
  ],
}

describe('cache de contenu', () => {
  it('est vide sans rien en stockage', () => {
    expect(cachedManifest()).toBeNull()
    expect(cachedCourse('fr-en-b2')).toBeNull()
  })

  it('retrouve un manifeste écrit', () => {
    writeCachedManifest(MANIFEST)
    expect(cachedManifest()).toEqual(MANIFEST)
  })

  it('retrouve un cours écrit, par identifiant', () => {
    writeCachedCourse(COURSE)
    expect(cachedCourse('fr-en-b2')).toEqual(COURSE)
    expect(cachedCourse('autre-cours')).toBeNull()
  })

  it('conserve manifeste et cours indépendamment', () => {
    writeCachedCourse(COURSE)
    writeCachedManifest(MANIFEST)
    expect(cachedCourse('fr-en-b2')).toEqual(COURSE)
    expect(cachedManifest()).toEqual(MANIFEST)
  })

  it('écrase un cours par un nouvel envoi du même identifiant', () => {
    writeCachedCourse(COURSE)
    const updated: Course = { ...COURSE, version: 3 }
    writeCachedCourse(updated)
    expect(cachedCourse('fr-en-b2')?.version).toBe(3)
  })

  it('ignore un contenu corrompu plutôt que de faire échouer la lecture', () => {
    localStorage.setItem('cartolang.content-cache.v1', '{ ceci n’est pas du JSON')
    expect(cachedManifest()).toBeNull()
    expect(cachedCourse('fr-en-b2')).toBeNull()
  })

  it('ignore une entrée de cours invalide sans perdre les autres', () => {
    localStorage.setItem(
      'cartolang.content-cache.v1',
      JSON.stringify({ manifest: MANIFEST, courses: { 'fr-en-b2': COURSE, cassé: { id: 'cassé' } } }),
    )
    expect(cachedCourse('fr-en-b2')).toEqual(COURSE)
    expect(cachedCourse('cassé')).toBeNull()
    expect(cachedManifest()).toEqual(MANIFEST)
  })
})
