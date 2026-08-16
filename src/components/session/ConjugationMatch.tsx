import { useMemo } from 'react'
import type { ConjugationMatchExercise } from '@/engine/exercises'
import { PairBoard, type Pair } from './PairBoard'

/**
 * Association personnes ↔ formes.
 *
 * Sert de présentation du tableau de conjugaison au premier passage — un seul
 * verbe, on reconstitue son paradigme avant d'avoir à le produire de mémoire.
 * Au passage suivant, plusieurs verbes se mélangent dans la même manche : le
 * jeton de gauche porte alors aussi le verbe (« to work — he/she/it »), sans
 * quoi deux verbes au même temps partagent souvent les mêmes personnes et
 * rien ne distinguerait leurs jetons à l'écran.
 */
export function ConjugationMatch({
  exercise,
  onDone,
}: {
  exercise: ConjugationMatchExercise
  onDone: (result: { missedIds: string[] }) => void
}) {
  const { verbs } = exercise
  const mixed = verbs.length > 1

  const pairs = useMemo<Pair[]>(
    () =>
      verbs.flatMap((verb) =>
        verb.forms.map((form) => ({
          id: form.id,
          left: mixed ? `${verb.verb} — ${form.person}` : form.person,
          right: form.answer,
        })),
      ),
    [verbs, mixed],
  )

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border-2 border-sky bg-sky/10 px-4 py-3">
        <p className="text-lg font-extrabold text-ink">{verbs.map((verb) => verb.verb).join(' · ')}</p>
        <p className="text-xs font-bold uppercase tracking-wide text-sky">{verbs[0]!.tense}</p>
      </div>
      <PairBoard
        seed={exercise.id}
        pairs={pairs}
        prompt={mixed ? 'Reliez chaque verbe et personne à sa forme' : 'Reliez chaque personne à sa forme'}
        onDone={onDone}
      />
    </div>
  )
}
