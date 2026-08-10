import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { buildReviewSession } from '@/engine/exercises'
import type { SessionOutcome } from '@/engine/progress'
import { dueCards } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'

/** Nombre maximal de mots par session de révision : on garde des sessions courtes. */
const REVIEW_LIMIT = 15

export function ReviewRoute() {
  const navigate = useNavigate()
  const { vocabById } = useCourse()
  const cards = useProgress((state) => state.cards)
  const finishReview = useProgress((state) => state.finishReview)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number } | null>(null)

  // La file est figée à l'ouverture : les notes données pendant la session ne
  // doivent pas retirer des mots de la session en cours.
  const [entries] = useState(() =>
    dueCards(Object.values(cards), Date.now(), REVIEW_LIMIT)
      .map((card) => ({ card, vocab: vocabById.get(card.vocabId)?.vocab }))
      .filter((entry): entry is { card: (typeof entry)['card']; vocab: NonNullable<(typeof entry)['vocab']> } =>
        entry.vocab !== undefined,
      ),
  )

  const exercises = useMemo(() => buildReviewSession(entries), [entries])

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
        <Mascot mood="happy" size={130} />
        <h1 className="text-2xl font-black">Rien à réviser</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          Toutes vos cartes sont à jour. Avancez sur le chemin, les révisions reviendront d'elles-mêmes.
        </p>
        <Button onClick={() => navigate('/', { replace: true })}>Retour au chemin</Button>
      </div>
    )
  }

  return (
    <SessionScreen
      title="Révision"
      exercises={exercises}
      onQuit={() => navigate('/', { replace: true })}
      onFinish={(outcome) => setFinished({ outcome, ...finishReview(outcome) })}
    />
  )
}
