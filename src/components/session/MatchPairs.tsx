import { useMemo } from 'react'
import type { MatchExercise } from '@/engine/exercises'
import { speechFor } from '@/lib/speech'
import { PairBoard, type Pair } from './PairBoard'

/**
 * Association de paires : relier chaque mot à sa traduction — ou, en
 * `cue: 'audio'`, chaque mot prononcé à sa traduction, voir `PairBoard`.
 */
export function MatchPairs({
  exercise,
  onDone,
  onCantListen,
}: {
  exercise: MatchExercise
  onDone: (result: { missedIds: string[] }) => void
  onCantListen: () => void
}) {
  const audio = exercise.cue === 'audio'
  const pairs = useMemo<Pair[]>(
    () =>
      exercise.pairs.map((vocab) => ({
        id: vocab.id,
        left: vocab.term,
        right: vocab.translation,
        leftAudio: audio ? speechFor(vocab) : undefined,
      })),
    [exercise, audio],
  )

  return (
    <PairBoard
      seed={exercise.id}
      pairs={pairs}
      prompt={audio ? 'Écoutez et associez' : 'Reliez les paires'}
      onCantListen={audio ? onCantListen : undefined}
      onDone={onDone}
    />
  )
}
