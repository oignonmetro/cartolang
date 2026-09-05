import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { findUnit, itemsOfUnit } from '@/content/course'
import { buildPracticeSession, buildReviewSession } from '@/engine/exercises'
import type { SessionOutcome } from '@/engine/progress'
import {
  buildUnitPath,
  consolidationEntries,
  nextNodeAfter,
  stepKey,
  type ConsolidationEntry,
} from '@/engine/unitPath'
import { useProgress } from '@/store/progressStore'
import { canSpeak } from '@/lib/speech'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'

/** Sessions courtes, comme la révision : on préfère revenir souvent. */
const STEP_LIMIT = 15

/**
 * Étape de parcours qui n'est pas une leçon : révision de l'unité,
 * approfondissement, ou entraînement sur les points fragiles.
 */
export function StepRoute() {
  const { unitId = '', stepId = '' } = useParams()
  return <StepSession key={`${unitId}/${stepId}`} unitId={unitId} stepId={stepId} />
}

function StepSession({ unitId, stepId }: { unitId: string; stepId: string }) {
  const navigate = useNavigate()
  const { course, itemsById } = useCourse()
  const finishStep = useProgress((state) => state.finishStep)
  const skipTo = useProgress((state) => state.skipTo)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number; peakTier: number } | null>(null)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])
  const node = useMemo(() => {
    if (!unit) return null
    const { lessons, steps } = useProgress.getState()
    return (
      buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {}).find(
        (candidate) => candidate.id === stepId,
      ) ?? null
    )
  }, [unit, stepId, course.id])

  // Figé à l'ouverture : les réponses données pendant la session ne doivent
  // pas remanier la file en cours.
  const [entries] = useState<ConsolidationEntry[]>(() => {
    if (!unit || !node || node.kind === 'lesson') return []
    return consolidationEntries(useProgress.getState().cards[course.id] ?? {}, itemsById, {
      // Seul l'entraînement sort de l'unité : c'est là qu'on va chercher ce
      // qui a été appris ailleurs et qui redemande du travail.
      scope: node.kind === 'workout' ? 'course' : 'unit',
      unitItemIds: itemsOfUnit(unit).map((item) => item.id),
      now: Date.now(),
      // La séance finale est un bilan complet : pas de plafond court comme
      // pour les étapes intermédiaires.
      limit: node.kind === 'final' ? itemsOfUnit(unit).length : STEP_LIMIT,
    })
  })

  const exercises = useMemo(() => {
    if (!node) return []
    // L'approfondissement et la séance finale forcent la production ; les
    // deux autres suivent l'état réel de chaque carte.
    return node.kind === 'drill' || node.kind === 'final'
      ? buildPracticeSession(entries, undefined, canSpeak)
      : buildReviewSession(entries, undefined, canSpeak)
  }, [entries, node])

  if (!unit || !node || node.kind === 'lesson') return <Navigate to="/" replace />

  const backHome = () => navigate('/', { replace: true })

  if (finished) {
    const { lessons, steps } = useProgress.getState()
    const next = nextNodeAfter(
      buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {}),
      stepId,
    )
    return (
      <SessionResult
        outcome={finished.outcome}
        passed
        xp={finished.xp}
        peakTier={finished.peakTier}
        onContinue={backHome}
        onNext={
          next && next.status !== 'locked'
            ? () => navigate(next.lesson ? `/lecon/${next.lesson.id}` : `/etape/${unit.id}/${next.id}`, { replace: true })
            : undefined
        }
        onRetry={backHome}
      />
    )
  }

  if (exercises.length === 0) {
    // Une étape peut se retrouver sans rien à réviser (les leçons qui la
    // précèdent n'ont jamais été jouées) : rester bloqué là serait une
    // impasse, d'où l'échappatoire ci-dessous.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-8 text-center [&>*]:shrink-0">
        <Mascot mood="think" size={130} />
        <h1 className="text-2xl font-black">Rien à travailler</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          Cette étape reprend ce que vous avez déjà rencontré. Faites d'abord les leçons qui la précèdent, ou
          passez cette étape si elles ont été sautées.
        </p>
        <div className="flex gap-3">
          <Button tone="neutral" onClick={backHome}>
            Retour à l'accueil
          </Button>
          <Button
            onClick={() => {
              skipTo(course.id, [], [stepKey(unit.id, stepId)])
              backHome()
            }}
          >
            Passer cette étape
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SessionScreen
      title={`${node.title} (${unit.title})`}
      kind={node.kind}
      exercises={exercises}
      onQuit={backHome}
      onFinish={(outcome, peakTier) =>
        setFinished({ outcome, peakTier, ...finishStep(course.id, stepKey(unit.id, stepId), outcome) })
      }
    />
  )
}
