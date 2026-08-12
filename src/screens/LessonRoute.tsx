import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { buildLessonSession } from '@/engine/exercises'
import { seedFrom } from '@/engine/rng'
import { findLesson, nextLessonAfter } from '@/content/course'
import { starsFromMastery, type SessionOutcome } from '@/engine/progress'
import { useProgress } from '@/store/progressStore'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'

interface Finished {
  outcome: SessionOutcome
  passed: boolean
  xp: number
  level: number
}

/**
 * Le `key` remonte toute la session quand on enchaîne sur la leçon suivante :
 * sans lui, l'écran de résultat de la leçon précédente resterait affiché,
 * l'instance du composant survivant au changement de paramètre d'URL.
 */
export function LessonRoute() {
  const { lessonId = '' } = useParams()
  return <LessonSession key={lessonId} lessonId={lessonId} />
}

function LessonSession({ lessonId }: { lessonId: string }) {
  const navigate = useNavigate()
  const { course } = useCourse()
  const finishLesson = useProgress((state) => state.finishLesson)

  const entry = useMemo(() => findLesson(course, lessonId), [course, lessonId])
  const next = useMemo(() => nextLessonAfter(course, lessonId), [course, lessonId])

  // La difficulté suit ce qui est réellement su, plus le nombre de passages :
  // rejouer une leçon déjà solide donne d'emblée de la production, la
  // découvrir donne la présentation. Figée à l'ouverture pour que les réponses
  // de la session en cours ne la fassent pas varier en cours de route.
  const [level] = useState(() =>
    entry ? starsFromMastery(entry.lesson, useProgress.getState().cards) : 0,
  )

  // La graine change à chaque tentative pour que « Recommencer » rebatte les cartes.
  const [attempt, setAttempt] = useState(0)
  const [finished, setFinished] = useState<Finished | null>(null)

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
        onNext={next ? () => navigate(`/lecon/${next.lesson.id}`, { replace: true }) : undefined}
        onRetry={() => {
          setFinished(null)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }

  return (
    <SessionScreen
      // La file d'exercices est un état interne de la session : recommencer
      // doit repartir de zéro, sinon l'ancienne file resterait affichée.
      key={attempt}
      title={entry.lesson.title}
      exercises={exercises}
      onQuit={() => navigate('/', { replace: true })}
      onFinish={(outcome) => {
        // Les cartes viennent d'être mises à jour par la session : les étoiles
        // se calculent donc sur l'état d'après, pas celui d'avant.
        const stars = starsFromMastery(entry.lesson, useProgress.getState().cards)
        const result = finishLesson(lessonId, outcome, stars)
        setFinished({ outcome, ...result })
      }}
    />
  )
}
