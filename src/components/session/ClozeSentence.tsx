import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { ClozeExercise } from '@/engine/exercises'
import { normalizeAnswer } from '@/engine/exercises'
import { Button } from '@/components/Button'

/**
 * Phrase à trou.
 *
 * Deux modes selon le niveau : on pioche le mot dans une banque tant que la
 * leçon est jeune, on le saisit au clavier une fois qu'elle est solide.
 */
export function ClozeSentence({
  exercise,
  onAnswer,
}: {
  exercise: ClozeExercise
  onAnswer: (correct: boolean) => void
}) {
  const { vocab, sentence, bank } = exercise
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue('')
    setChecked(null)
    if (!bank) input.current?.focus()
  }, [exercise.id, bank])

  const filled = value.trim().length > 0

  function check(candidate: string) {
    const correct = normalizeAnswer(candidate) === normalizeAnswer(sentence.match)
    setValue(candidate)
    setChecked(correct)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Complétez la phrase</p>

      <div className="card-3d flex flex-col gap-3 px-5 py-6">
        <p className="text-2xl leading-relaxed font-bold">
          {sentence.before}
          <Blank value={value} state={checked} />
          {sentence.after}
        </p>
        {vocab.example && <p className="text-sm text-ink-soft">{vocab.example.translation}</p>}
      </div>

      {bank ? (
        <div className="grid grid-cols-2 gap-3">
          {bank.map((word) => (
            <button
              key={word}
              type="button"
              disabled={checked !== null}
              onClick={() => check(word)}
              className={`min-h-14 rounded-2xl border-2 px-3 py-3 font-bold transition-colors ${
                value === word && checked !== null
                  ? checked
                    ? 'border-success bg-success/15 text-success'
                    : 'border-error bg-error/15 text-error'
                  : 'border-line bg-paper'
              } disabled:opacity-60`}
            >
              {word}
            </button>
          ))}
        </div>
      ) : (
        <input
          ref={input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filled && checked === null) check(value)
          }}
          disabled={checked !== null}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Le mot manquant…"
          aria-label="Mot manquant"
          className="w-full rounded-2xl border-2 border-line bg-paper px-4 py-4 text-lg font-bold outline-none focus:border-teal disabled:opacity-70"
        />
      )}

      <Feedback state={checked} expected={sentence.match} translation={vocab.translation} />

      <div className="mt-auto">
        {checked === null ? (
          <Button block disabled={!filled} onClick={() => check(value)}>
            Vérifier
          </Button>
        ) : (
          <Button block tone={checked ? 'success' : 'error'} onClick={() => onAnswer(checked)}>
            Continuer
          </Button>
        )}
      </div>
    </div>
  )
}

function Blank({ value, state }: { value: string; state: null | boolean }) {
  const tone =
    state === null
      ? 'border-ink-faint text-ink'
      : state
        ? 'border-success text-success'
        : 'border-error text-error line-through'

  return (
    <span
      className={`mx-1 inline-block min-w-24 border-b-4 px-2 text-center align-baseline ${tone}`}
    >
      {value || ' '}
    </span>
  )
}

function Feedback({
  state,
  expected,
  translation,
}: {
  state: null | boolean
  expected: string
  translation: string
}) {
  if (state === null) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-sm font-bold ${state ? 'text-success' : 'text-error'}`}
    >
      {state ? `Exact — ${expected} : ${translation}` : `La réponse attendue était « ${expected} ».`}
    </motion.p>
  )
}
