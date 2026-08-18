import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Course, Manifest } from './schema'
import { indexItems, type ItemLocation } from './course'
import { availableCourses, resolveCourse, resolveManifest } from './loader'
import { syncContentFromRemote } from './remoteSync'
import { Mascot } from '@/components/Mascot'

/** Cours actif, chargé au démarrage et partagé par tous les écrans. */

interface CourseState {
  course: Course
  itemsById: Map<string, ItemLocation>
  /** Tous les cours du manifeste, pour le sélecteur de niveau. */
  manifest: Manifest
}

interface CourseContextValue extends CourseState {
  /**
   * Change le cours actif. Rejette si le cours demandé ne charge pas, sans
   * toucher au cours en cours d'utilisation — un échec de bascule ne doit
   * pas faire disparaître ce qui fonctionnait déjà.
   */
  switchCourse: (courseId: string) => Promise<void>
}

const CourseContext = createContext<CourseContextValue | null>(null)

import { setSpokenLanguage } from '@/lib/speech'

const SELECTED_COURSE_KEY = 'cartolang.course'

export function CourseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CourseState | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Écarte une réponse tardive qui écraserait un choix plus récent (ex. deux
  // bascules de cours coup sur coup).
  const requestId = useRef(0)

  const applyCourse = useCallback(async (courseId?: string) => {
    const id = ++requestId.current
    const manifest = await resolveManifest()
    // Un cours archivé ne doit plus être proposé, même s'il était sélectionné
    // par le passé : on retombe alors sur le cours marqué par défaut (voir
    // `default` dans le schéma), et à défaut sur le premier du manifeste.
    const offered = availableCourses(manifest)
    const wanted = courseId ?? localStorage.getItem(SELECTED_COURSE_KEY)
    const entry =
      offered.find((item) => item.id === wanted) ?? offered.find((item) => item.default) ?? offered[0]
    if (!entry) throw new Error('Aucun cours disponible.')
    const course = await resolveCourse(entry.id)
    if (id !== requestId.current) return
    localStorage.setItem(SELECTED_COURSE_KEY, course.id)
    // La voix suit la langue enseignée : un cours de russe ne doit pas être lu
    // par une voix anglaise.
    setSpokenLanguage(course.learning)
    setState({ course, itemsById: indexItems(course), manifest })
  }, [])

  useEffect(() => {
    applyCourse().catch((cause) => setError((cause as Error).message))
    // Volontairement non attendue : la synchronisation ne doit jamais
    // retarder l'affichage de la session en cours. Elle prépare, en tâche de
    // fond, le contenu qui sera utilisé au *prochain* démarrage — voir
    // `remoteSync.ts` pour le détail du mécanisme et ses garanties.
    void syncContentFromRemote()
  }, [applyCourse])

  // Séparé de `applyCourse` pour ne jamais faire basculer l'app entière sur
  // l'écran d'erreur à cause d'un changement de niveau raté : l'appelant
  // (le sélecteur) reçoit le rejet et affiche son propre message, pendant
  // que le cours déjà chargé reste actif.
  const switchCourse = useCallback((courseId: string) => applyCourse(courseId), [applyCourse])

  const value = useMemo<CourseContextValue | null>(
    () => (state ? { ...state, switchCourse } : null),
    [state, switchCourse],
  )

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <Mascot mood="reassuring" size={110} />
        <h1 className="text-xl font-extrabold">Le cours n'a pas pu être chargé</h1>
        <p className="max-w-sm text-sm text-ink-soft">{error}</p>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Mascot mood="think" size={110} />
        <p className="font-bold text-ink-soft">Chargement…</p>
      </div>
    )
  }

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
}

export function useCourse(): CourseContextValue {
  const value = useContext(CourseContext)
  if (!value) throw new Error('useCourse doit être utilisé sous <CourseProvider>.')
  return value
}
