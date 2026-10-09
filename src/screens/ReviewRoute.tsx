import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { itemsOfCourse } from '@/content/course'
import type { GhostExercise } from '@/engine/exercises'
import { ACTIVE_COUNT, ghostsFor, materializeGhost, type GhostScope } from '@/engine/ghosts'
import type { SessionOutcome } from '@/engine/progress'
import { dueCards } from '@/engine/srs'
import { EMPTY_CARDS, useProgress } from '@/store/progressStore'
import { ghostOptionsFor, ghostStateOf } from './ghostSession'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'

/** Nombre maximal d'éléments par session de révision : on garde des sessions courtes. */
const REVIEW_LIMIT = 15

export function ReviewRoute() {
  const navigate = useNavigate()
  const { course, itemsById } = useCourse()
  const cards = useProgress((state) => state.cards[course.id] ?? EMPTY_CARDS)
  const finishReview = useProgress((state) => state.finishReview)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number; peakTier: number } | null>(null)

  // La file est figée à l'ouverture : les notes données pendant la session ne
  // doivent pas retirer des éléments de la session en cours. Toutes pistes
  // confondues — mélanger vocabulaire, grammaire et conjugaison ancre mieux
  // que réviser chaque nature d'un bloc. `cards` est déjà restreint au cours
  // affiché.
  //
  // Les échéances décident de *quels* éléments revoir ; ce que chaque place
  // leur demande se décide à son ouverture, par le lien qui leur reste le plus
  // à réussir (voir `engine/ghosts.ts`).
  const [session] = useState(() => {
    const due = dueCards(Object.values(cards), Date.now(), REVIEW_LIMIT).flatMap((card) => {
      const location = itemsById.get(card.itemId)
      return location ? [location.item] : []
    })
    const scope: GhostScope = { items: due, distractors: itemsOfCourse(course) }
    return { seed: Date.now(), served: new Map<string, number>(), scope, exercises: ghostsFor(due.length) }
  })

  const materialize = useCallback(
    (ghost: GhostExercise) =>
      materializeGhost(
        ghost,
        session.scope,
        ghostStateOf(course.id),
        ghostOptionsFor(session.seed, session.served, { mode: 'review', allowIntro: false, activeCount: ACTIVE_COUNT }),
      ),
    [session, course.id],
  )
  const exercises = session.exercises

  if (finished) {
    return (
      <SessionResult
        outcome={finished.outcome}
        passed
        xp={finished.xp}
        peakTier={finished.peakTier}
        onContinue={() => navigate('/', { replace: true })}
        onRetry={() => navigate('/', { replace: true })}
      />
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-8 text-center [&>*]:shrink-0">
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
      kind="review"
      exercises={exercises}
      materialize={materialize}
      onQuit={() => navigate('/', { replace: true })}
      onFinish={(outcome, peakTier) => setFinished({ outcome, peakTier, ...finishReview(outcome) })}
    />
  )
}
