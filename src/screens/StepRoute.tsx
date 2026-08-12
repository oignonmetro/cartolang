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
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number } | null>(null)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])
  const node = useMemo(() => {
    if (!unit) return null
    const { lessons, steps } = useProgress.getState()
    return buildUnitPath(unit, lessons, steps).find((candidate) => candidate.id === stepId) ?? null
  }, [unit, stepId])

  // Figé à l'ouverture : les réponses données pendant la session ne doivent
  // pas remanier la file en cours.
  const [entries] = useState<ConsolidationEntry[]>(() => {
    if (!unit || !node || node.kind === 'lesson') return []
    return consolidationEntries(useProgress.getState().cards, itemsById, {
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
      ? buildPracticeSession(entries)
      : buildReviewSession(entries)
  }, [entries, node])

  if (!unit || !node || node.kind === 'lesson') return <Navigate to="/" replace />

  const backToPath = () => navigate(`/unite/${unit.id}`, { replace: true })

  if (finished) {
    const next = nextNodeAfter(buildUnitPath(unit, useProgress.getState().lessons, useProgress.getState().steps), stepId)
    return (
      <SessionResult
        outcome={finished.outcome}
        passed
        xp={finished.xp}
        onContinue={backToPath}
        onNext={
          next && next.status !== 'locked'
            ? () => navigate(next.lesson ? `/lecon/${next.lesson.id}` : `/etape/${unit.id}/${next.id}`, { replace: true })
            : undefined
        }
        onRetry={backToPath}
      />
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <Mascot mood="think" size={130} />
        <h1 className="text-2xl font-black">Rien à travailler</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          Cette étape reprend ce que vous avez déjà rencontré. Faites d'abord les leçons qui la précèdent.
        </p>
        <Button onClick={backToPath}>Retour au parcours</Button>
      </div>
    )
  }

  return (
    <SessionScreen
      title={`${node.title} — ${unit.title}`}
      exercises={exercises}
      onQuit={backToPath}
      onFinish={(outcome) => setFinished({ outcome, ...finishStep(stepKey(unit.id, stepId), outcome) })}
    />
  )
}
