import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { TypeExercise } from '@/engine/exercises'
import { isAnswerCorrect } from '@/engine/exercises'
import { Button } from '@/components/Button'

/** Traduction au clavier, sans contexte : l'exercice le plus exigeant. */
export function TypeAnswer({
  exercise,
  onAnswer,
}: {
  exercise: TypeExercise
  onAnswer: (correct: boolean) => void
}) {
  const { vocab, direction } = exercise
  const prompt = direction === 'to-known' ? vocab.term : vocab.translation
  const expected = direction === 'to-known' ? vocab.translation : vocab.term
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue('')
    setChecked(null)
    input.current?.focus()
  }, [exercise.id])

  const filled = value.trim().length > 0

  function check() {
    setChecked(isAnswerCorrect(vocab, direction, value))
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">
        {direction === 'to-known' ? 'Traduisez en français' : 'Traduisez en anglais'}
      </p>

      <div className="card-3d mt-auto flex flex-col items-center gap-2 px-5 py-8 text-center">
        <span className="text-4xl font-black break-words">{prompt}</span>
        {vocab.pos && <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">{vocab.pos}</span>}
      </div>

      <input
        ref={input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          if (checked === null && filled) check()
          else if (checked !== null) onAnswer(checked)
        }}
        disabled={checked !== null}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        lang={direction === 'to-known' ? 'fr' : 'en'}
        placeholder="Votre réponse…"
        aria-label="Votre réponse"
        className={`w-full rounded-2xl border-2 bg-paper px-4 py-4 text-lg font-bold outline-none disabled:opacity-70 ${
          checked === null ? 'border-line focus:border-teal' : checked ? 'border-success' : 'border-error'
        }`}
      />

      {checked !== null && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-sm font-bold ${checked ? 'text-success' : 'text-error'}`}
        >
          {checked ? 'Bonne réponse.' : `La réponse attendue était « ${expected} ».`}
        </motion.p>
      )}

      <div className="mt-auto">
        {checked === null ? (
          <Button block disabled={!filled} onClick={check}>
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
