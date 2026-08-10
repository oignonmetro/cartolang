import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Course } from './schema'
import { indexVocab, loadCourse, loadManifest, type VocabLocation } from './loader'
import { Mascot } from '@/components/Mascot'

/** Cours actif, chargé une fois au démarrage et partagé par tous les écrans. */

interface CourseContextValue {
  course: Course
  vocabById: Map<string, VocabLocation>
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
        const manifest = await loadManifest()
        const wanted = localStorage.getItem(SELECTED_COURSE_KEY)
        const entry = manifest.courses.find((item) => item.id === wanted) ?? manifest.courses[0]
        if (!entry) throw new Error('Aucun cours disponible.')
        const course = await loadCourse(entry.id)
        if (cancelled) return
        localStorage.setItem(SELECTED_COURSE_KEY, course.id)
        setValue({ course, vocabById: indexVocab(course) })
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <Mascot mood="sad" size={110} />
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

/** Cartes de révision échues, associées à leur mot. */
export function useVocabLookup() {
  const { vocabById } = useCourse()
  return useMemo(() => (id: string) => vocabById.get(id)?.vocab ?? null, [vocabById])
}
