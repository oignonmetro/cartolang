import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { findUnit, itemsOfUnit } from '@/content/course'
import { buildPracticeSession } from '@/engine/exercises'
import type { SessionOutcome } from '@/engine/progress'
import { type CardState } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import type { PracticeItem } from '@/content/schema'

/** Sessions courtes, comme la révision : on préfère revenir souvent. */
const PRACTICE_LIMIT = 15

/**
 * Entraînement libre sur une unité : tout ce qui y a déjà été rencontré,
 * mélangé et en production, sans attendre les échéances de révision.
 */
export function PracticeRoute() {
  const { unitId = '' } = useParams()
  return <PracticeSession key={unitId} unitId={unitId} />
}

function PracticeSession({ unitId }: { unitId: string }) {
  const navigate = useNavigate()
  const { course } = useCourse()
  const finishReview = useProgress((state) => state.finishReview)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number } | null>(null)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])

  // Figé à l'ouverture, comme la révision : les réponses données pendant la
  // session ne doivent pas remanier la file en cours.
  const [entries] = useState<{ card: CardState; item: PracticeItem }[]>(() => {
    if (!unit) return []
    const cards = useProgress.getState().cards
    const seen = itemsOfUnit(unit)
      .map((item) => ({ card: cards[item.id], item }))
      .filter((entry): entry is { card: CardState; item: PracticeItem } => entry.card !== undefined)
    // Les plus fragiles d'abord : ce sont elles qui ont besoin du passage.
    return [...seen].sort((a, b) => a.card.interval - b.card.interval).slice(0, PRACTICE_LIMIT)
  })

  const exercises = useMemo(() => buildPracticeSession(entries), [entries])

  if (!unit) return <Navigate to="/" replace />

  if (finished) {
    return (
      <SessionResult
        outcome={finished.outcome}
        passed
        xp={finished.xp}
        level={null}
        onContinue={() => navigate('/', { replace: true })}
        onRetry={() => navigate('/', { replace: true })}
      />
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <Mascot mood="think" size={130} />
        <h1 className="text-2xl font-black">Rien à travailler</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          L'entraînement reprend ce que vous avez déjà rencontré dans « {unit.title} ». Faites-en une leçon
          d'abord.
        </p>
        <Button onClick={() => navigate('/', { replace: true })}>Retour</Button>
      </div>
    )
  }

  return (
    <SessionScreen
      title={`Entraînement — ${unit.title}`}
      exercises={exercises}
      onQuit={() => navigate('/', { replace: true })}
      onFinish={(outcome) => setFinished({ outcome, ...finishReview(outcome) })}
    />
  )
}
