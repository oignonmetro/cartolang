import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Exercise } from '@/engine/exercises'
import { isPresentation, itemIdsOf } from '@/engine/exercises'
import { ratingFromAnswer, type Rating } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { stopSpeaking } from '@/lib/speech'
import { Flashcard } from '@/components/session/Flashcard'
import { ChoiceQuestion } from '@/components/session/ChoiceQuestion'
import { MatchPairs } from '@/components/session/MatchPairs'
import { ClozeSentence } from '@/components/session/ClozeSentence'
import { TypeAnswer } from '@/components/session/TypeAnswer'
import { VocabIntro } from '@/components/session/VocabIntro'
import { RuleNote } from '@/components/session/RuleNote'
import { GrammarGap } from '@/components/session/GrammarGap'
import { ConjugationAnswer } from '@/components/session/ConjugationAnswer'
import { ConjugationMatch } from '@/components/session/ConjugationMatch'
import { CloseIcon } from '@/components/icons'
import type { SessionOutcome } from '@/engine/progress'

/**
 * Déroulé d'une session.
 *
 * Un exercice raté repart en fin de file : la session ne se termine pas tant
 * qu'il n'a pas été réussi. Seule la première tentative compte dans le score,
 * pour que le taux de réussite reflète ce qui était su au départ.
 */

interface SessionScreenProps {
  title: string
  exercises: Exercise[]
  onQuit: () => void
  onFinish: (outcome: SessionOutcome) => void
}

interface Attempt {
  seen: Set<string>
  correct: number
  total: number
}

export function SessionScreen({ title, exercises, onQuit, onFinish }: SessionScreenProps) {
  const gradeItem = useProgress((state) => state.gradeItem)
  const [queue, setQueue] = useState<Exercise[]>(exercises)
  const [position, setPosition] = useState(0)
  const [attempt, setAttempt] = useState<Attempt>({ seen: new Set(), correct: 0, total: 0 })
  const [confirmQuit, setConfirmQuit] = useState(false)

  const current = queue[position]
  const graded = useMemo(() => exercises.filter((exercise) => !isPresentation(exercise)).length, [exercises])
  const progress = graded === 0 ? 1 : Math.min(1, attempt.seen.size / graded)

  /** Avance dans la file, en réinsérant l'exercice raté un peu plus loin. */
  const advance = useCallback(
    (requeue: boolean) => {
      setQueue((current_) => {
        if (!requeue) return current_
        const exercise = current_[position]
        const next = current_.slice()
        // Trois exercices plus loin : assez pour ne pas répondre de mémoire.
        next.splice(Math.min(next.length, position + 4), 0, exercise)
        return next
      })
      setPosition((index) => index + 1)
    },
    [position],
  )

  const record = useCallback(
    (exercise: Exercise, correct: boolean) => {
      setAttempt((state) => {
        if (state.seen.has(exercise.id)) return state
        return {
          seen: new Set(state.seen).add(exercise.id),
          correct: state.correct + (correct ? 1 : 0),
          total: state.total + 1,
        }
      })
    },
    [],
  )

  const answer = useCallback(
    (exercise: Exercise, correct: boolean, rating?: Rating) => {
      const firstTry = !attempt.seen.has(exercise.id)
      for (const itemId of itemIdsOf(exercise)) {
        gradeItem(itemId, rating ?? ratingFromAnswer(correct, firstTry))
      }
      record(exercise, correct)
      advance(!correct)
    },
    [advance, attempt.seen, gradeItem, record],
  )

  const answerMatch = useCallback(
    (exercise: Exercise, missedItemIds: string[]) => {
      const missed = new Set(missedItemIds)
      const firstTry = !attempt.seen.has(exercise.id)
      for (const itemId of itemIdsOf(exercise)) {
        gradeItem(itemId, missed.has(itemId) ? 'again' : ratingFromAnswer(true, firstTry))
      }
      record(exercise, missed.size === 0)
      // Les paires sont toutes trouvées à la fin : inutile de rejouer la manche.
      advance(false)
    },
    [advance, attempt.seen, gradeItem, record],
  )

  // La file est vide : la session est terminée. Le drapeau évite que le
  // rendu suivant ne déclenche une seconde clôture.
  const finished = useRef(false)
  useEffect(() => {
    if (current || finished.current) return
    finished.current = true
    onFinish({ correct: attempt.correct, total: attempt.total })
  }, [attempt.correct, attempt.total, current, onFinish])

  // Quitter une session en cours de prononciation laisserait la voix courir
  // sur l'écran suivant, qui n'a plus rien à voir avec le mot.
  useEffect(() => () => void stopSpeaking(), [])

  if (!current) return null

  return (
    // `h-full overflow-hidden`, pas `min-h-full` : une leçon ne doit jamais
    // pouvoir défiler, le contenu est conçu pour tenir dans l'écran.
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setConfirmQuit(true)}
          aria-label="Quitter la session"
          className="rounded-full p-2 text-ink-faint transition-colors hover:text-ink"
        >
          <CloseIcon size={22} />
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full bg-teal"
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          />
        </div>
        <span className="w-12 text-right text-sm font-extrabold text-ink-faint">
          {attempt.seen.size}/{graded}
        </span>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}:${position}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="flex flex-1 flex-col"
          >
            {current.kind === 'intro' && (
              <VocabIntro exercise={current} onRate={(rating) => answer(current, rating !== 'again', rating)} />
            )}
            {current.kind === 'flashcard' && (
              <Flashcard
                exercise={current}
                onRate={(rating) => answer(current, rating !== 'again', rating)}
              />
            )}
            {current.kind === 'match' && (
              <MatchPairs exercise={current} onDone={({ missedIds }) => answerMatch(current, missedIds)} />
            )}
            {current.kind === 'choice' && (
              <ChoiceQuestion exercise={current} onAnswer={(correct) => answer(current, correct)} />
            )}
            {current.kind === 'rule' && <RuleNote exercise={current} onNext={() => advance(false)} />}
            {current.kind === 'grammar-gap' && (
              <GrammarGap exercise={current} onAnswer={(correct) => answer(current, correct)} />
            )}
            {current.kind === 'conjugation' && (
              <ConjugationAnswer exercise={current} onAnswer={(correct) => answer(current, correct)} />
            )}
            {current.kind === 'conjugation-match' && (
              <ConjugationMatch exercise={current} onDone={({ missedIds }) => answerMatch(current, missedIds)} />
            )}
            {current.kind === 'cloze' && (
              <ClozeSentence exercise={current} onAnswer={(correct) => answer(current, correct)} />
            )}
            {current.kind === 'type' && (
              <TypeAnswer exercise={current} onAnswer={(correct) => answer(current, correct)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {confirmQuit && (
          <QuitDialog title={title} onCancel={() => setConfirmQuit(false)} onConfirm={onQuit} />
        )}
      </AnimatePresence>
    </div>
  )
}

function QuitDialog({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-blob bg-paper p-6"
      >
        <h2 className="text-lg font-extrabold">Quitter « {title} » ?</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Les mots déjà répondus restent enregistrés, mais la session ne comptera pas d'étoile.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border-2 border-line py-3 font-extrabold text-ink-soft"
          >
            Continuer
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-error py-3 font-extrabold text-white"
          >
            Quitter
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
