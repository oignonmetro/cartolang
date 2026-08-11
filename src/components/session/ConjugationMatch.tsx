import { useMemo } from 'react'
import type { ConjugationMatchExercise } from '@/engine/exercises'
import { PairBoard, type Pair } from './PairBoard'

/**
 * Association personnes ↔ formes d'un même verbe.
 *
 * Sert de présentation du tableau de conjugaison au premier passage : on
 * reconstitue le paradigme avant d'avoir à le produire de mémoire.
 */
export function ConjugationMatch({
  exercise,
  onDone,
}: {
  exercise: ConjugationMatchExercise
  onDone: (result: { missedIds: string[] }) => void
}) {
  const pairs = useMemo<Pair[]>(
    () => exercise.forms.map((form) => ({ id: form.id, left: form.person, right: form.answer })),
    [exercise],
  )

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border-2 border-sky bg-sky/10 px-4 py-3">
        <p className="text-lg font-extrabold text-ink">{exercise.verb.verb}</p>
        <p className="text-xs font-bold uppercase tracking-wide text-sky">{exercise.verb.tense}</p>
      </div>
      <PairBoard seed={exercise.id} pairs={pairs} prompt="Reliez chaque personne à sa forme" onDone={onDone} />
    </div>
  )
}
