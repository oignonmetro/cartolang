import { useMemo } from 'react'
import type { MatchExercise } from '@/engine/exercises'
import { PairBoard, type Pair } from './PairBoard'

/** Association de paires : relier chaque mot à sa traduction. */
export function MatchPairs({
  exercise,
  onDone,
}: {
  exercise: MatchExercise
  onDone: (result: { missedIds: string[] }) => void
}) {
  const pairs = useMemo<Pair[]>(
    () => exercise.pairs.map((vocab) => ({ id: vocab.id, left: vocab.term, right: vocab.translation })),
    [exercise],
  )

  return <PairBoard seed={exercise.id} pairs={pairs} prompt="Reliez les paires" onDone={onDone} />
}
