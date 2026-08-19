import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { GrammarChoiceExercise } from '@/engine/exercises'
import { fillGap, normalizeForm, splitGap } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { OptionList } from './OptionList'
import { SpeakButton } from './SpeakButton'

/**
 * Les options ne diffèrent que par la forme qui comble le trou — le reste de
 * la phrase, avant et après, est identique d'une case à l'autre. Sans repère,
 * il faut relire chaque phrase en entier pour trouver ce qui change ; la
 * forme substituée est donc soulignée, ce qui ramène l'attention sur ce que
 * l'exercice teste réellement.
 *
 * Le découpage est exact, pas une devinette : chaque option est
 * `fillGap(point.sentence, uneForme)`, donc `before` et `after` — calculés une
 * fois sur la phrase d'origine — sont le préfixe et le suffixe littéraux de
 * toute option.
 */
function highlightGap(option: string, before: string, after: string) {
  const middle = option.slice(before.length, option.length - after.length)
  if (!middle) return option
  return (
    <>
      {before}
      <span className="underline decoration-2 underline-offset-4">{middle}</span>
      {after}
    </>
  )
}

/**
 * Choisir la phrase entière correcte, plutôt que la forme isolée.
 *
 * La phrase à trou se traite souvent par élimination mécanique : on regarde
 * quatre formes côte à côte et on prend celle qui « sonne » juste dans un
 * espace vide. Ici les quatre phrases sont écrites en entier, et il faut les
 * lire — c'est à la lecture que le décalage de temps s'entend, ce qui est
 * exactement ce que la leçon enseigne.
 *
 * Le français donne le sens visé : sans lui, plusieurs de ces phrases seraient
 * défendables, et l'exercice ne porterait plus sur la règle mais sur la
 * devinette.
 */
export function GrammarSentenceChoice({
  exercise,
  onAnswer,
}: {
  exercise: GrammarChoiceExercise
  onAnswer: (correct: boolean) => void
}) {
  const { point, options } = exercise
  const answer = fillGap(point.sentence, point.answer)
  const { before, after } = splitGap(point.sentence)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [exercise.id])

  const checked = picked !== null
  const correct = checked && normalizeForm(picked) === normalizeForm(answer)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">
        Quelle phrase est correcte ?
      </p>

      {point.translation && (
        <div className="card-3d px-5 py-4">
          <p className="text-lg leading-snug font-bold">{point.translation}</p>
        </div>
      )}

      <OptionList
        options={options}
        picked={picked}
        isCorrect={(option) => normalizeForm(option) === normalizeForm(answer)}
        onPick={setPicked}
        lang="en"
        size="long"
        renderOption={(option) => highlightGap(option, before, after)}
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
            {correct ? 'Exact.' : `La forme attendue était « ${point.answer} ».`}
          </p>
          {point.explanation && <p className="mt-1 text-ink-soft">{point.explanation}</p>}
        </motion.div>
      )}

      <div className="mt-auto pt-2">
        {checked && (
          <div className="flex items-center gap-3">
            {/* La phrase correcte, pas celle qui a été choisie : c'est le
                modèle à retenir, y compris quand on s'est trompé. */}
            <SpeakButton text={answer} auto className="shrink-0" />
            <Button block tone={correct ? 'success' : 'error'} onClick={() => onAnswer(correct)}>
              Continuer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
