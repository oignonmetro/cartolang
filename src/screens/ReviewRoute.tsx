import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { buildReviewSession } from '@/engine/exercises'
import type { SessionOutcome } from '@/engine/progress'
import { dueCards, type CardState } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import type { PracticeItem } from '@/content/schema'

/** Nombre maximal d'éléments par session de révision : on garde des sessions courtes. */
const REVIEW_LIMIT = 15

export function ReviewRoute() {
  const navigate = useNavigate()
  const { itemsById } = useCourse()
  const cards = useProgress((state) => state.cards)
  const finishReview = useProgress((state) => state.finishReview)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number } | null>(null)

  // La file est figée à l'ouverture : les notes données pendant la session ne
  // doivent pas retirer des éléments de la session en cours. Toutes pistes
  // confondues — mélanger vocabulaire, grammaire et conjugaison ancre mieux
  // que réviser chaque nature d'un bloc.
  const [entries] = useState<{ card: CardState; item: PracticeItem }[]>(() =>
    // Restreint au cours affiché *avant* de plafonner : sinon les cartes d'un
    // autre niveau consommeraient les quinze places sans être jouables.
    dueCards(
      Object.values(cards).filter((card) => itemsById.has(card.itemId)),
      Date.now(),
      REVIEW_LIMIT,
    ).map((card) => ({ card, item: itemsById.get(card.itemId)!.item })),
  )

  const exercises = useMemo(() => buildReviewSession(entries), [entries])

  if (finished) {
    return (
      <SessionResult
        outcome={finished.outcome}
        passed
        xp={finished.xp}
        onContinue={() => navigate('/', { replace: true })}
        onRetry={() => navigate('/', { replace: true })}
      />
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <Mascot mood="happy" size={130} />
        <h1 className="text-2xl font-black">Rien à réviser</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          Tout est à jour. Travaillez de nouvelles leçons, les révisions reviendront d'elles-mêmes.
        </p>
        <Button onClick={() => navigate('/', { replace: true })}>Retour</Button>
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
