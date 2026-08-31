import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { ClozeExercise } from '@/engine/exercises'
import { normalizeForm } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { CorrectionGap } from './CorrectionGap'
import { ExpectedAnswer } from './ExpectedAnswer'
import { SpeakButton } from './SpeakButton'
import { useSessionHaptics } from './useSessionHaptics'
import { useSessionSounds } from './useSessionSounds'

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
  const [gapResolved, setGapResolved] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const sounds = useSessionSounds()
  const haptics = useSessionHaptics()

  useEffect(() => {
    setValue('')
    setChecked(null)
    setGapResolved(false)
    if (!bank) input.current?.focus()
  }, [exercise.id, bank])

  const filled = value.trim().length > 0

  function check(candidate: string) {
    const correct = normalizeForm(candidate) === normalizeForm(sentence.match)
    setValue(candidate)
    setChecked(correct)
    sounds.success(correct)
    haptics.answered(exercise, correct)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Épinglée : voir la même remarque dans `TypeAnswer`. Vaut surtout
          quand la réponse se tape (`bank` absent) — sans effet visible
          sinon, la banque de mots ne réclamant jamais le clavier. */}
      <p className="sticky top-0 z-10 bg-cream py-1 text-sm font-bold uppercase tracking-wide text-ink-faint">
        Complétez la phrase
      </p>

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

      <Feedback
        state={checked}
        expected={sentence.match}
        translation={vocab.translation}
        typed={value}
        bank={bank}
        onGapResolved={() => setGapResolved(true)}
      />

      <div className="mt-auto">
        {checked === null ? (
          <Button block disabled={!filled} onClick={() => check(value)}>
            Vérifier
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            {/* Le mot attendu, pas la phrase : c'est lui qu'on apprend, et
                l'écouter avant d'avoir répondu donnerait la réponse. */}
            <SpeakButton text={sentence.match} auto className="shrink-0" />
            <Button
              block
              tone={checked ? 'success' : 'error'}
              disabled={!checked && !bank && !gapResolved}
              onClick={() => onAnswer(checked)}
            >
              Continuer
            </Button>
          </div>
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
  typed,
  bank,
  onGapResolved,
}: {
  state: null | boolean
  expected: string
  translation: string
  typed: string
  bank: string[] | null
  onGapResolved: () => void
}) {
  if (state === null) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={state ? 'text-success' : 'text-error'}
    >
      {state ? (
        <p className="text-sm font-bold">
          Exact : {expected} ({translation})
        </p>
      ) : bank ? (
        // Piochée dans une banque, pas écrite : rien à corriger au clavier,
        // la réponse s'affiche comme avant.
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold">La réponse attendue :</p>
          <ExpectedAnswer typed={typed} expected={expected} />
        </div>
      ) : (
        <CorrectionGap typed={typed} expected={expected} onResolved={onGapResolved} />
      )}
    </motion.div>
  )
}
