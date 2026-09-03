import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ConjugationChoiceExercise } from '@/engine/exercises'
import { normalizeForm } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { learningLanguage } from '@/lib/speech'
import { highlightDiffWords } from './highlightDiffWords'
import { ListeningPrompt } from './ListeningPrompt'
import { OptionList } from './OptionList'
import { SpeakButton } from './SpeakButton'
import { useSessionHaptics } from './useSessionHaptics'
import { useSessionSounds } from './useSessionSounds'

/**
 * Reconnaître une forme conjuguée parmi celles du paradigme.
 *
 * C'est l'échelon qui manquait sous la production : la piste réclamait
 * d'emblée d'écrire « has been working » de mémoire, alors qu'à ce stade la
 * seule chose apprenable est la différence entre les formes. Les leurres sont
 * d'abord les autres personnes du même verbe — c'est là, et pas ailleurs, que
 * la confusion se joue.
 *
 * En `cue: 'audio'` (voir `ConjugationCue`), l'infinitif ne s'écrit plus : il
 * se prononce, et c'est l'oreille qui doit reconnaître l'orthographe de la
 * forme conjuguée parmi les leurres.
 */
export function ConjugationChoice({
  exercise,
  onAnswer,
  onCantListen,
}: {
  exercise: ConjugationChoiceExercise
  onAnswer: (correct: boolean) => void
  onCantListen: () => void
}) {
  const { verb, form, cue, options } = exercise
  const fromFrench = cue === 'translation' && Boolean(verb.translation)
  const audio = cue === 'audio'
  const [picked, setPicked] = useState<string | null>(null)
  const sounds = useSessionSounds()
  const haptics = useSessionHaptics()

  useEffect(() => {
    setPicked(null)
  }, [exercise.id])

  const checked = picked !== null
  const correct = checked && normalizeForm(picked) === normalizeForm(form.answer)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Choisissez la forme</p>

      <div className="card-3d flex flex-col items-center gap-3 px-5 py-6 text-center">
        {audio ? (
          // L'énoncé est le son lui-même : voir la même remarque dans
          // `ChoiceQuestion`. Il part tout seul à l'affichage et se rejoue à
          // volonté, sans jamais s'écrire.
          <ListeningPrompt text={verb.verb} size={26} onCantListen={onCantListen} />
        ) : (
          <span lang={fromFrench ? 'fr' : learningLanguage()} className="text-2xl font-black break-words">
            {fromFrench ? verb.translation : verb.verb}
          </span>
        )}
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
        onPick={(option) => {
          const wasCorrect = normalizeForm(option) === normalizeForm(form.answer)
          setPicked(option)
          sounds.success(wasCorrect)
          haptics.answered(exercise, wasCorrect)
        }}
        lang={learningLanguage()}
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
            {correct ? 'Bonne réponse.' : `La forme attendue était « ${form.answer} ».`}
          </p>
          {fromFrench && (
            <p className="mt-1 text-ink-soft">
              {verb.translation} (<span lang={learningLanguage()}>{verb.verb}</span>)
            </p>
          )}
          {/* L'infinitif ne s'est jamais écrit à l'écran : la correction est
              le seul endroit où son orthographe s'apprend. */}
          {audio && (
            <p className="mt-1 text-ink-soft">
              <span lang={learningLanguage()}>{verb.verb}</span>
              {verb.translation && ` (${verb.translation})`}
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
