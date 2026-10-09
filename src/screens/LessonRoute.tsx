import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import type { Exercise, GhostExercise } from '@/engine/exercises'
import {
  ACTIVE_COUNT,
  ghostsFor,
  hasLearnWork,
  isPresented,
  isValidated,
  lessonGhostCount,
  materializeGhost,
  type GhostMode,
} from '@/engine/ghosts'
import { findLesson, isReadingOnly, itemsOfLesson } from '@/content/course'
import type { SessionOutcome } from '@/engine/progress'
import { buildUnitPath, nextNodeAfter } from '@/engine/unitPath'
import { useProgress } from '@/store/progressStore'
import { canHearNow, distractorsFor, ghostOptionsFor, ghostStateOf } from './ghostSession'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'

/** Places d'une leçon rejouée quand tout y est déjà acquis : une remise à niveau courte. */
const PRACTICE_COUNT = 10

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
  const skipTo = useProgress((state) => state.skipTo)

  const entry = useMemo(() => findLesson(course, lessonId), [course, lessonId])

  // Chaque tentative est une nouvelle séance : nouvelle graine, donc nouvel
  // identifiant de séance, ce qui compte pour la consolidation.
  const [attempt, setAttempt] = useState(0)
  const [finished, setFinished] = useState<Finished | null>(null)

  const scope = useMemo(
    () => (entry ? { items: itemsOfLesson(entry.lesson), distractors: distractorsFor(course, entry.unit) } : null),
    [course, entry],
  )

  // Des places réservées, pas des exercices : chacune se forme au moment de
  // l'ouvrir, d'après ce que les réponses précédentes ont appris (voir
  // `engine/ghosts.ts`). Le rappel de cours, lui, ouvre la leçon tant qu'un de
  // ses éléments reste à découvrir.
  const session = useMemo(() => {
    const seed = Date.now() + attempt
    const served = new Map<string, number>()
    if (!entry || !scope) return null
    const state = ghostStateOf(course.id)
    const base = ghostOptionsFor(seed, served, { mode: 'learn', allowIntro: true, activeCount: ACTIVE_COUNT })
    const mode: GhostMode = hasLearnWork(scope, state, base) ? 'learn' : 'practice'
    const { lesson } = entry
    const readingOnly = isReadingOnly(lesson)
    const discovering = readingOnly || scope.items.some((item) => !isPresented(state.progress[item.id], state.cards[item.id]))
    const rule: Exercise[] =
      lesson.notes && discovering
        ? [{ kind: 'rule', id: `rule:${lesson.id}`, title: lesson.title, notes: lesson.notes, topic: lesson.kind }]
        : []
    const count = readingOnly ? 0 : mode === 'learn' ? lessonGhostCount(scope.items, state, base.canSpeak) : PRACTICE_COUNT
    return { seed, served, mode, exercises: [...rule, ...ghostsFor(count)] }
    // `attempt` relance une séance neuve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, entry, scope, course.id])

  const materialize = useCallback(
    (ghost: GhostExercise) =>
      session && scope
        ? materializeGhost(
            ghost,
            scope,
            ghostStateOf(course.id),
            ghostOptionsFor(session.seed, session.served, {
              mode: session.mode,
              allowIntro: true,
              activeCount: ACTIVE_COUNT,
            }),
          )
        : null,
    [session, scope, course.id],
  )

  if (!entry || !session || !scope) return <Navigate to="/" replace />

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
      kind="lesson"
      exercises={session.exercises}
      materialize={materialize}
      onQuit={backHome}
      onFinish={(outcome, peakTier) => {
        if (isReadingOnly(entry.lesson)) {
          // Un rappel seul se lit sans se noter : sa lecture le valide, et
          // un écran de score n'aurait rien à afficher. On enchaîne donc
          // directement sur la suite du parcours.
          skipTo(course.id, [lessonId], [])
          const { lessons, steps } = useProgress.getState()
          const next = nextNodeAfter(
            buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {}),
            lessonId,
          )
          navigate(
            next && next.status !== 'locked'
              ? next.lesson
                ? `/lecon/${next.lesson.id}`
                : `/etape/${unit.id}/${next.id}`
              : '/',
            { replace: true },
          )
          return
        }
        // La leçon est réussie quand chacun de ses éléments est maîtrisé, lien
        // par lien ; l'oreille n'est exigée que si l'écoute est possible.
        const state = ghostStateOf(course.id)
        const hearing = canHearNow()
        const mastered = scope.items.every((item) =>
          isValidated(item, state.progress[item.id], state.cards[item.id], hearing),
        )
        const result = finishLesson(course.id, lessonId, outcome, undefined, mastered)
        setFinished({ outcome, peakTier, ...result })
      }}
    />
  )
}
