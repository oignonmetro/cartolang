import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { ConjugationExercise } from '@/engine/exercises'
import { matchesAnswer } from '@/engine/exercises'
import { Button } from '@/components/Button'

/**
 * Production d'une forme conjuguée : verbe, temps et personne sont donnés,
 * la forme est à écrire. C'est l'exercice le plus exigeant de la piste, et
 * le seul qui vérifie vraiment que le paradigme est su.
 */
export function ConjugationAnswer({
  exercise,
  onAnswer,
}: {
  exercise: ConjugationExercise
  onAnswer: (correct: boolean) => void
}) {
  const { verb, form } = exercise
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
    setChecked(matchesAnswer(form.answer, form.alt, value))
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Conjuguez</p>

      {/* Seule cette enveloppe est flexible : la carte se centre dedans, mais
          l'input et le bouton restent collés juste après (comme dans
          Flashcard.tsx) — une marge auto sur la carte les aurait écartés
          d'elle sur les écrans hauts. */}
      <div className="flex flex-1 items-center">
        <div className="card-3d flex w-full flex-col items-center gap-3 px-5 py-8 text-center">
          <span className="text-3xl font-black break-words">{verb.verb}</span>
          {verb.translation && <span className="text-sm text-ink-soft">{verb.translation}</span>}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-sky/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky">
              {verb.tense}
            </span>
            <span className="rounded-full bg-line px-3 py-1 text-xs font-extrabold text-ink-soft">
              {form.person}
            </span>
          </div>
        </div>
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
        lang="en"
        placeholder="La forme conjuguée…"
        aria-label="Forme conjuguée"
        className={`w-full rounded-2xl border-2 bg-paper px-4 py-4 text-lg font-bold outline-none disabled:opacity-70 ${
          checked === null ? 'border-line focus:border-sky' : checked ? 'border-success' : 'border-error'
        }`}
      />

      {checked !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border-2 px-4 py-3 text-sm ${
            checked ? 'border-success/40 bg-success/10' : 'border-error/40 bg-error/10'
          }`}
        >
          <p className={`font-extrabold ${checked ? 'text-success' : 'text-error'}`}>
            {checked ? 'Bonne réponse.' : `La forme attendue était « ${form.answer} ».`}
          </p>
          {verb.note && <p className="mt-1 text-ink-soft">{verb.note}</p>}
        </motion.div>
      )}

      <div>
        {checked === null ? (
          <Button block tone="sky" disabled={!filled} onClick={check}>
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
