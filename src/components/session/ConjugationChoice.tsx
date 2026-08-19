import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ConjugationChoiceExercise } from '@/engine/exercises'
import { normalizeForm } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { highlightDiffWords } from './highlightDiffWords'
import { OptionList } from './OptionList'
import { SpeakButton } from './SpeakButton'

/**
 * Reconnaître une forme conjuguée parmi celles du paradigme.
 *
 * C'est l'échelon qui manquait sous la production : la piste réclamait
 * d'emblée d'écrire « has been working » de mémoire, alors qu'à ce stade la
 * seule chose apprenable est la différence entre les formes. Les leurres sont
 * d'abord les autres personnes du même verbe — c'est là, et pas ailleurs, que
 * la confusion se joue.
 */
export function ConjugationChoice({
  exercise,
  onAnswer,
}: {
  exercise: ConjugationChoiceExercise
  onAnswer: (correct: boolean) => void
}) {
  const { verb, form, cue, options } = exercise
  const fromFrench = cue === 'translation' && Boolean(verb.translation)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [exercise.id])

  const checked = picked !== null
  const correct = checked && normalizeForm(picked) === normalizeForm(form.answer)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Choisissez la forme</p>

      <div className="card-3d flex flex-col items-center gap-3 px-5 py-6 text-center">
        <span lang={fromFrench ? 'fr' : 'en'} className="text-2xl font-black break-words">
          {fromFrench ? verb.translation : verb.verb}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-sky/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sky">
            {verb.tense}
          </span>
          <span className="rounded-full bg-line px-3 py-1 text-xs font-extrabold text-ink-soft">
            {form.person}
          </span>
        </div>
      </div>

      <OptionList
        options={options}
        picked={picked}
        isCorrect={(option) => normalizeForm(option) === normalizeForm(form.answer)}
        onPick={setPicked}
        lang="en"
        renderOption={highlightDiffWords(options)}
      />

      {checked && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border-2 px-4 py-3 text-sm ${
            correct ? 'border-success/40 bg-success/10' : 'border-error/40 bg-error/10'
          }`}
        >
          <p className={`font-extrabold ${correct ? 'text-success' : 'text-error'}`}>
            {correct ? 'Bonne réponse.' : `La forme attendue était « ${form.answer} ».`}
          </p>
          {fromFrench && (
            <p className="mt-1 text-ink-soft">
              {verb.translation} — <span lang="en">{verb.verb}</span>
            </p>
          )}
          {verb.note && <p className="mt-1 text-ink-soft">{verb.note}</p>}
        </motion.div>
      )}

      <div className="mt-auto pt-2">
        {checked && (
          <div className="flex items-center gap-3">
            {/* La forme attendue, pas celle qui a été choisie. */}
            <SpeakButton text={form.answer} auto className="shrink-0" />
            <Button block tone={correct ? 'success' : 'error'} onClick={() => onAnswer(correct)}>
              Continuer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
