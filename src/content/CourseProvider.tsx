import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Course } from './schema'
import { indexItems, type ItemLocation } from './course'
import { availableCourses, resolveCourse, resolveManifest } from './loader'
import { syncContentFromRemote } from './remoteSync'
import { Mascot } from '@/components/Mascot'

/** Cours actif, chargé une fois au démarrage et partagé par tous les écrans. */

interface CourseContextValue {
  course: Course
  itemsById: Map<string, ItemLocation>
}

const CourseContext = createContext<CourseContextValue | null>(null)

const SELECTED_COURSE_KEY = 'cartolang.course'

export function CourseProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<CourseContextValue | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const manifest = await resolveManifest()
        // Un cours archivé ne doit plus être proposé, même s'il était
        // sélectionné par le passé : on retombe alors sur le cours courant.
        const offered = availableCourses(manifest)
        const wanted = localStorage.getItem(SELECTED_COURSE_KEY)
        const entry = offered.find((item) => item.id === wanted) ?? offered[0]
        if (!entry) throw new Error('Aucun cours disponible.')
        const course = await resolveCourse(entry.id)
        if (cancelled) return
        localStorage.setItem(SELECTED_COURSE_KEY, course.id)
        setValue({ course, itemsById: indexItems(course) })
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message)
      }
    }

    void load()
    // Volontairement non attendue : la synchronisation ne doit jamais
    // retarder l'affichage de la session en cours. Elle prépare, en tâche de
    // fond, le contenu qui sera utilisé au *prochain* démarrage — voir
    // `remoteSync.ts` pour le détail du mécanisme et ses garanties.
    void syncContentFromRemote()
    return () => {
      cancelled = true
    }
  }, [])

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
