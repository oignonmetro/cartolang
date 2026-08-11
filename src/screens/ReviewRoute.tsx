import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { buildReviewSession } from '@/engine/exercises'
import { itemIdsOfTrack, type SessionOutcome } from '@/engine/progress'
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
  const [params] = useSearchParams()
  const { course, itemsById } = useCourse()
  const cards = useProgress((state) => state.cards)
  const finishReview = useProgress((state) => state.finishReview)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number } | null>(null)

  // Une révision peut être restreinte à une piste, depuis la bibliothèque.
  const trackId = params.get('piste')
  const track = trackId && course.layout === 'library'
    ? course.tracks.find((candidate) => candidate.id === trackId) ?? null
    : null

  // La file est figée à l'ouverture : les notes données pendant la session ne
  // doivent pas retirer des éléments de la session en cours.
  const [entries] = useState<{ card: CardState; item: PracticeItem }[]>(() => {
    const scope = trackId ? new Set(itemIdsOfTrack(course, trackId)) : null
    const pool = Object.values(cards).filter((card) => !scope || scope.has(card.itemId))
    return dueCards(pool, Date.now(), REVIEW_LIMIT)
      .map((card) => ({ card, item: itemsById.get(card.itemId)?.item }))
      .filter((entry): entry is { card: CardState; item: PracticeItem } => entry.item !== undefined)
  })

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
          {track
            ? `Tout est à jour dans « ${track.title} ». Les révisions reviendront d'elles-mêmes.`
            : "Toutes vos cartes sont à jour. Travaillez de nouvelles leçons, les révisions reviendront d'elles-mêmes."}
        </p>
        <Button onClick={() => navigate('/', { replace: true })}>Retour</Button>
      </div>
    )
  }

  return (
    <SessionScreen
      title={track ? `Révision — ${track.title}` : 'Révision'}
      exercises={exercises}
      onQuit={() => navigate('/', { replace: true })}
      onFinish={(outcome) => setFinished({ outcome, ...finishReview(outcome) })}
    />
  )
}
