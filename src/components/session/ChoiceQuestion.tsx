import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ChoiceExercise } from '@/engine/exercises'
import { normalizeAnswer } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { SpeakButton } from './SpeakButton'

/**
 * QCM : reconnaître la bonne traduction parmi des leurres, juste après avoir
 * relié le mot dans une manche d'association — une étape de reconnaissance
 * de plus avant la phrase à trou qui suit.
 */
export function ChoiceQuestion({
  exercise,
  onAnswer,
}: {
  exercise: ChoiceExercise
  onAnswer: (correct: boolean) => void
}) {
  const { vocab, direction, options } = exercise
  const prompt = direction === 'to-known' ? vocab.term : vocab.translation
  const answer = direction === 'to-known' ? vocab.translation : vocab.term
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [exercise.id])

  const checked = picked !== null
  const correct = checked && normalizeAnswer(picked) === normalizeAnswer(answer)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">
        {direction === 'to-known' ? 'Choisissez le sens' : 'Choisissez la traduction'}
      </p>

      <div className="flex items-end gap-3">
        <Mascot mood={checked ? (correct ? 'happy' : 'disappointed') : 'idle'} size={64} />
        <div className="card-3d relative flex-1 px-4 py-3 before:absolute before:top-5 before:-left-2 before:h-4 before:w-4 before:rotate-45 before:border-b-2 before:border-l-2 before:border-line before:bg-paper">
          <span className="text-xl font-black break-words">{prompt}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option, index) => {
          const isPicked = picked === option
          const isAnswer = checked && normalizeAnswer(option) === normalizeAnswer(answer)
          const tone = !checked
            ? 'border-line bg-paper'
            : isAnswer
              ? 'border-success bg-success/15 text-success'
              : isPicked
                ? 'border-error bg-error/15 text-error'
                : 'border-line bg-paper text-ink-faint'

          return (
            <button
              key={option}
              type="button"
              disabled={checked}
              onClick={() => setPicked(option)}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold transition-colors disabled:opacity-100 ${tone}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs">
                {index + 1}
              </span>
              {option}
            </button>
          )
        })}
      </div>

      <div className="mt-auto">
        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            {/* Le son n'arrive qu'à la correction : l'entendre avant de
                répondre désignerait la bonne case. */}
            <SpeakButton text={vocab.term} className="shrink-0" />
            <Button block tone={correct ? 'success' : 'error'} onClick={() => onAnswer(correct)}>
              Continuer
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
