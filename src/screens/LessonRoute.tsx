import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { buildLessonSession } from '@/engine/exercises'
import { seedFrom } from '@/engine/rng'
import { findLesson } from '@/content/course'
import { levelOf, type SessionOutcome } from '@/engine/progress'
import { useProgress } from '@/store/progressStore'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'

interface Finished {
  outcome: SessionOutcome
  passed: boolean
  xp: number
  level: number
}

export function LessonRoute() {
  const { lessonId = '' } = useParams()
  const navigate = useNavigate()
  const { course } = useCourse()
  const finishLesson = useProgress((state) => state.finishLesson)
  const level = useProgress((state) => levelOf(state.lessons, lessonId))

  // La graine change à chaque tentative pour que « Recommencer » rebatte les cartes.
  const [attempt, setAttempt] = useState(0)
  const [finished, setFinished] = useState<Finished | null>(null)

  const entry = useMemo(() => findLesson(course, lessonId), [course, lessonId])
  const exercises = useMemo(
    () => (entry ? buildLessonSession(entry.lesson, level, seedFrom(entry.lesson.id, level, attempt)) : []),
    [entry, attempt, level],
  )

  if (!entry) return <Navigate to="/" replace />

  if (finished) {
    return (
      <SessionResult
        outcome={finished.outcome}
        passed={finished.passed}
        xp={finished.xp}
        level={finished.level}
        onContinue={() => navigate('/', { replace: true })}
        onRetry={() => {
          setFinished(null)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }

  return (
    <SessionScreen
      // La file d'exercices est un état interne de la session : passer d'une
      // leçon à l'autre sans changer de route doit repartir de zéro, sinon
      // l'ancienne file resterait affichée.
      key={`${lessonId}#${attempt}`}
      title={entry.lesson.title}
      exercises={exercises}
      onQuit={() => navigate('/', { replace: true })}
      onFinish={(outcome) => {
        const result = finishLesson(lessonId, outcome)
        setFinished({ outcome, ...result })
      }}
    />
  )
}
