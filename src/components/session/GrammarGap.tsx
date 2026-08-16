import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { GrammarGapExercise } from '@/engine/exercises'
import { matchesAnswer, splitGap } from '@/engine/exercises'
import { Button } from '@/components/Button'

/**
 * Phrase de grammaire à compléter.
 *
 * Aux premiers passages, les formes plausibles sont proposées : l'apprenant
 * choisit, et c'est la comparaison entre les formes qui enseigne la règle.
 * Ensuite la réponse se saisit, sans filet.
 *
 * La traduction française suit le même retrait : tant qu'elle est là, le sens
 * visé est acquis et il ne reste qu'à trouver la forme ; une fois retirée,
 * c'est la grammaire seule qui doit trancher. Elle réapparaît toujours à la
 * correction, où elle n'aide plus mais explique.
 */
export function GrammarGap({
  exercise,
  onAnswer,
}: {
  exercise: GrammarGapExercise
  onAnswer: (correct: boolean) => void
}) {
  const { point, bank, cue } = exercise
  const gap = useMemo(() => splitGap(point.sentence), [point.sentence])
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
    setValue(candidate)
    setChecked(matchesAnswer(point.answer, point.alt, candidate))
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Complétez la phrase</p>

      <div className="card-3d flex flex-col gap-3 px-5 py-6">
        <p className="text-xl leading-relaxed font-bold">
          {gap.before}
          <Blank value={value} state={checked} />
          {gap.after}
        </p>
        {point.translation && (cue === 'translation' || checked !== null) && (
          <p className="text-sm text-ink-soft">{point.translation}</p>
        )}
      </div>

      {bank ? (
        <div className="grid grid-cols-2 gap-3">
          {bank.map((option) => (
            <button
              key={option}
              type="button"
              disabled={checked !== null}
              onClick={() => check(option)}
              className={`min-h-14 rounded-2xl border-2 px-3 py-3 font-bold break-words transition-colors ${
                value === option && checked !== null
                  ? checked
                    ? 'border-success bg-success/15 text-success'
                    : 'border-error bg-error/15 text-error'
                  : 'border-line bg-paper'
              } disabled:opacity-60`}
            >
              {option}
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
          lang="en"
          placeholder="La forme manquante…"
          aria-label="Forme manquante"
          className={`w-full rounded-2xl border-2 bg-paper px-4 py-4 text-lg font-bold outline-none disabled:opacity-70 ${
            checked === null ? 'border-line focus:border-violet' : checked ? 'border-success' : 'border-error'
          }`}
        />
      )}

      {checked !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border-2 px-4 py-3 text-sm ${
            checked ? 'border-success/40 bg-success/10' : 'border-error/40 bg-error/10'
          }`}
        >
          <p className={`font-extrabold ${checked ? 'text-success' : 'text-error'}`}>
            {checked ? 'Exact.' : `La réponse attendue était « ${point.answer} ».`}
          </p>
          {point.explanation && <p className="mt-1 text-ink-soft">{point.explanation}</p>}
        </motion.div>
      )}

      <div className="mt-auto">
        {checked === null ? (
          <Button block tone="violet" disabled={!filled} onClick={() => check(value)}>
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
    <span className={`mx-1 inline-block min-w-28 border-b-4 px-2 text-center align-baseline ${tone}`}>
      {value || ' '}
    </span>
  )
}
