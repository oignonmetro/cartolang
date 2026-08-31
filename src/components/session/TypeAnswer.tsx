import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { TypeExercise } from '@/engine/exercises'
import { isAnswerCorrect } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { learningLanguage, learningLanguageName, speechFor } from '@/lib/speech'
import { CorrectionGap } from './CorrectionGap'
import { SpeakButton } from './SpeakButton'
import { useSessionHaptics } from './useSessionHaptics'
import { useSessionSounds } from './useSessionSounds'

/**
 * Traduction au clavier, sans contexte : l'exercice le plus exigeant.
 *
 * En dictée (`cue === 'audio'`), l'énoncé écrit disparaît : seul le mot
 * prononcé reste, et c'est lui qui doit guider l'orthographe — voir `TypeCue`.
 */
export function TypeAnswer({
  exercise,
  onAnswer,
}: {
  exercise: TypeExercise
  onAnswer: (correct: boolean) => void
}) {
  const { vocab, direction, cue } = exercise
  const dictation = cue === 'audio'
  const prompt = direction === 'to-known' ? vocab.term : vocab.translation
  const expected = direction === 'to-known' ? vocab.translation : vocab.term
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
    input.current?.focus()
  }, [exercise.id])

  const filled = value.trim().length > 0

  function check() {
    const correct = isAnswerCorrect(vocab, direction, value)
    setChecked(correct)
    sounds.success(correct)
    haptics.answered(exercise, correct)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Épinglée en haut de la zone qui défile : sur mobile, le clavier qui
          s'ouvre au focus du champ réduit la fenêtre visible, et le
          navigateur fait remonter le champ dans cet espace réduit — sans
          `sticky`, la consigne se retrouvait poussée au-dessus, hors champ. */}
      <p className="sticky top-0 z-10 bg-cream py-1 text-sm font-bold uppercase tracking-wide text-ink-faint">
        {dictation
          ? 'Écrivez le mot que vous entendez'
          : direction === 'to-known'
            ? 'Traduisez en français'
            : `Traduisez en ${learningLanguageName()}`}
      </p>

      <div className="card-3d mt-auto flex flex-col items-center gap-2 px-5 py-8 text-center">
        {dictation ? (
          // L'énoncé est le son lui-même : voir la même remarque dans
          // `ChoiceQuestion`. Il part tout seul à l'affichage et se rejoue à
          // volonté, sans jamais s'écrire.
          <div className="flex items-center gap-3 py-1">
            <SpeakButton text={speechFor(vocab)} auto size={32} className="shrink-0" />
            <span className="text-sm text-ink-soft">Touchez pour réécouter</span>
          </div>
        ) : (
          <span lang={direction === 'to-known' ? learningLanguage() : 'fr'} className="text-4xl font-black break-words">
            {prompt}
          </span>
        )}
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
        // L'attribut suit la langue réellement tapée, pas un « en » hérité du
        // cours d'anglais d'origine : c'est lui qui fait proposer au clavier
        // du téléphone la disposition cyrillique en thème, pourvu qu'elle
        // soit installée (voir `learningLanguage`).
        lang={direction === 'to-known' ? 'fr' : learningLanguage()}
        placeholder="Votre réponse…"
        aria-label="Votre réponse"
        className={`w-full rounded-2xl border-2 bg-paper px-4 py-4 text-lg font-bold outline-none disabled:opacity-70 ${
          checked === null ? 'border-line focus:border-teal' : checked ? 'border-success' : 'border-error'
        }`}
      />

      {checked !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={checked ? 'text-success' : 'text-error'}
        >
          {checked ? (
            <p className="text-sm font-bold">Bonne réponse.</p>
          ) : (
            <CorrectionGap typed={value} expected={expected} onResolved={() => setGapResolved(true)} />
          )}
        </motion.div>
      )}

      <div className="mt-auto">
        {checked === null ? (
          <Button block disabled={!filled} onClick={check}>
            Vérifier
          </Button>
        ) : (
          <Button
            block
            tone={checked ? 'success' : 'error'}
            disabled={!checked && !gapResolved}
            onClick={() => onAnswer(checked)}
          >
            Continuer
          </Button>
        )}
      </div>
    </div>
  )
}
