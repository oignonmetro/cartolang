import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ChoiceCue, ChoiceExercise } from '@/engine/exercises'
import { choiceAnswer, choicePrompt, choicePromptIsEnglish, normalizeAnswer } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { SpeakButton } from './SpeakButton'

/**
 * QCM : reconnaître la bonne réponse parmi des leurres, juste après avoir
 * relié le mot dans une manche d'association — une étape de reconnaissance
 * de plus avant la phrase à trou qui suit.
 *
 * Cinq énoncés possibles pour un même mot (voir `ChoiceCue`), ce qui évite
 * de reposer indéfiniment la même question. Chacun demande un rappel
 * différent, d'où la consigne qui change avec lui.
 */
const PROMPTS: Record<ChoiceCue, string> = {
  term: 'Choisissez le sens',
  translation: 'Choisissez la traduction',
  hint: 'De quel mot parle-t-on ?',
  sentence: 'Quel mot convient ici ?',
  audio: 'Quel mot entendez-vous ?',
}

export function ChoiceQuestion({
  exercise,
  onAnswer,
}: {
  exercise: ChoiceExercise
  onAnswer: (correct: boolean) => void
}) {
  const { vocab, cue, options } = exercise
  const answer = choiceAnswer(vocab, cue)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [exercise.id])

  const checked = picked !== null
  const correct = checked && normalizeAnswer(picked) === normalizeAnswer(answer)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">{PROMPTS[cue]}</p>

      <div className="flex items-end gap-3">
        <Mascot mood={checked ? (correct ? 'happy' : 'disappointed') : 'idle'} size={64} />
        <div className="card-3d relative flex-1 px-4 py-3 before:absolute before:top-5 before:-left-2 before:h-4 before:w-4 before:rotate-45 before:border-b-2 before:border-l-2 before:border-line before:bg-paper">
          {cue === 'audio' ? (
            // L'énoncé est le son lui-même : le mot ne doit pas s'écrire, sinon
            // il ne reste plus rien à reconnaître. Il se rejoue à volonté, et
            // part tout seul à l'affichage — sans quoi l'écran est muet et la
            // question sans énoncé.
            <div className="flex items-center gap-3 py-1">
              <SpeakButton text={vocab.term} auto size={26} className="shrink-0" />
              <span className="text-sm text-ink-soft">Touchez pour réécouter</span>
            </div>
          ) : (
            <span
              lang={choicePromptIsEnglish(cue) ? 'en' : 'fr'}
              className={`break-words ${cue === 'sentence' || cue === 'hint' ? 'text-base leading-snug font-bold' : 'text-xl font-black'}`}
            >
              {choicePrompt(vocab, cue)}
            </span>
          )}
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
                répondre désignerait la bonne case. Sauf quand le son EST la
                question — il a alors déjà servi d'énoncé, et le bouton reste
                là-haut. */}
            {cue !== 'audio' && <SpeakButton text={vocab.term} className="shrink-0" />}
            <Button block tone={correct ? 'success' : 'error'} onClick={() => onAnswer(correct)}>
              Continuer
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
