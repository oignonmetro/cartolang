import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { buildLessonSession, lessonProgress } from '@/engine/exercises'
import { seedFrom } from '@/engine/rng'
import { findLesson } from '@/content/course'
import { lessonDifficulty, type SessionOutcome } from '@/engine/progress'
import { buildUnitPath, nextNodeAfter, sectionRank } from '@/engine/unitPath'
import { useProgress } from '@/store/progressStore'
import { canSpeak } from '@/lib/speech'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'

interface Finished {
  outcome: SessionOutcome
  passed: boolean
  xp: number
  peakTier: number
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

  // La difficulté suit ce qui est réellement su : rejouer une leçon déjà
  // solide donne d'emblée de la production, la découvrir donne la
  // présentation. Figée à l'ouverture pour que les réponses de la session en
  // cours ne la fassent pas varier en cours de route.
  const [level] = useState(() =>
    entry ? lessonDifficulty(entry.lesson, useProgress.getState().cards[course.id] ?? {}) : 0,
  )

  // La graine change à chaque tentative pour que « Recommencer » rebatte les cartes.
  const [attempt, setAttempt] = useState(0)
  const [finished, setFinished] = useState<Finished | null>(null)

  const exercises = useMemo(() => {
    if (!entry) return []
    const cards = useProgress.getState().cards[course.id] ?? {}
    return buildLessonSession(
      entry.lesson,
      level,
      // L'avancement entre dans la graine : rouvrir une leçon un autre jour ne
      // doit pas redonner la même session, exercice pour exercice.
      seedFrom(entry.lesson.id, level, attempt, lessonProgress(entry.lesson, cards)),
      cards,
      canSpeak,
      sectionRank(entry.unit, entry.lesson.id),
    )
  }, [entry, attempt, level, course.id])

  if (!entry) return <Navigate to="/" replace />

  const unit = entry.unit
  const backHome = () => navigate('/', { replace: true })

  if (finished) {
    // L'enchaînement suit l'ordre du parcours, pas celui des seules leçons :
    // la suite peut être une révision, et la sauter viderait le parcours de
    // son sens.
    const { lessons, steps } = useProgress.getState()
    const next = nextNodeAfter(
      buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {}),
      lessonId,
    )

    return (
      <SessionResult
        outcome={finished.outcome}
        passed={finished.passed}
        xp={finished.xp}
        peakTier={finished.peakTier}
        onContinue={backHome}
        onNext={
          next && next.status !== 'locked'
            ? () =>
                navigate(next.lesson ? `/lecon/${next.lesson.id}` : `/etape/${unit.id}/${next.id}`, {
                  replace: true,
                })
            : undefined
        }
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
      onQuit={backHome}
      onFinish={(outcome, peakTier) => {
        const result = finishLesson(course.id, lessonId, outcome)
        setFinished({ outcome, peakTier, ...result })
      }}
    />
  )
}
