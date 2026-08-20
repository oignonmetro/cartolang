import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Exercise } from '@/engine/exercises'
import { isPresentation, itemIdsOf } from '@/engine/exercises'
import { ratingFromAnswer, type Rating } from '@/engine/srs'
import { useCourse } from '@/content/CourseProvider'
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
import { GrammarSentenceChoice } from '@/components/session/GrammarSentenceChoice'
import { ConjugationAnswer } from '@/components/session/ConjugationAnswer'
import { ConjugationChoice } from '@/components/session/ConjugationChoice'
import { ConjugationMatch } from '@/components/session/ConjugationMatch'
import { CloseIcon, HeartIcon } from '@/components/icons'
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
  /**
   * Épreuve plutôt qu'entraînement (voir `CheckpointTestRoute`). Trois choses
   * changent, toutes pour la même raison — on mesure ce qui est su, on
   * n'enseigne pas :
   *
   *   - rien n'est noté dans la révision espacée. Une carte créée ici
   *     priverait ensuite la leçon de sa présentation (`buildVocabSession`
   *     ne présente que les mots sans carte), et un test raté coûterait
   *     précisément la découverte qu'il renvoie faire ;
   *   - un exercice raté ne repart pas en fin de file : le refaire jusqu'à
   *     le réussir n'est plus une correction mais une triche ;
   *   - l'en-tête compte les fautes restantes plutôt que les questions vues,
   *     et la session s'arrête dès qu'il n'en reste plus.
   *
   * `allowed` est le nombre de fautes tolérées, annoncé avant le test (voir
   * `mistakesAllowed`).
   */
  exam?: { allowed: number }
}

interface Attempt {
  seen: Set<string>
  correct: number
  total: number
}

export function SessionScreen({ title, exercises, onQuit, onFinish, exam }: SessionScreenProps) {
  const { course } = useCourse()
  const gradeItem = useProgress((state) => state.gradeItem)
  const [queue, setQueue] = useState<Exercise[]>(exercises)
  const [position, setPosition] = useState(0)
  const [attempt, setAttempt] = useState<Attempt>({ seen: new Set(), correct: 0, total: 0 })
  const [confirmQuit, setConfirmQuit] = useState(false)

  const current = queue[position]
  const graded = useMemo(() => exercises.filter((exercise) => !isPresentation(exercise)).length, [exercises])
  const progress = graded === 0 ? 1 : Math.min(1, attempt.seen.size / graded)

  // Cœurs d'un test : un de plus que les fautes tolérées, pour que les perdre
  // tous soit exactement la faute de trop. Le compte annoncé avant le test est
  // donc celui qu'on voit ici (voir `mistakesAllowed`).
  const mistakes = attempt.total - attempt.correct
  const hearts = exam ? exam.allowed + 1 : 0
  const outOfHearts = exam !== undefined && mistakes >= hearts

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
      if (!exam) {
        for (const itemId of itemIdsOf(exercise)) {
          gradeItem(course.id, itemId, rating ?? ratingFromAnswer(correct, firstTry))
        }
      }
      // Pas de son ici : il a déjà sonné dans l'exercice, à la validation
      // de la réponse (voir `useSessionSounds`). `answer` n'est appelé qu'à
      // l'appui sur « Continuer », une ou deux secondes plus tard.
      record(exercise, correct)
      advance(!correct && !exam)
    },
    [advance, attempt.seen, course.id, exam, gradeItem, record],
  )

  const answerMatch = useCallback(
    (exercise: Exercise, missedItemIds: string[]) => {
      const missed = new Set(missedItemIds)
      const firstTry = !attempt.seen.has(exercise.id)
      if (!exam) {
        for (const itemId of itemIdsOf(exercise)) {
          gradeItem(course.id, itemId, missed.has(itemId) ? 'again' : ratingFromAnswer(true, firstTry))
        }
      }
      // Pas de son ici : chaque paire a déjà sonné en se résolvant (voir
      // `PairBoard`), et la dernière est la fin de la manche. En rejouer un
      // par-dessus doublerait la note d'arrivée.
      record(exercise, missed.size === 0)
      // Les paires sont toutes trouvées à la fin : inutile de rejouer la manche.
      advance(false)
    },
    [advance, attempt.seen, course.id, exam, gradeItem, record],
  )

  // La file est vide : la session est terminée. Un test s'arrête en plus dès
  // le dernier cœur perdu — finir une épreuve déjà manquée n'apprend rien et
  // ne fait qu'ajouter l'humiliation à l'échec. Le drapeau évite que le rendu
  // suivant ne déclenche une seconde clôture.
  const finished = useRef(false)
  useEffect(() => {
    if ((current && !outOfHearts) || finished.current) return
    finished.current = true
    onFinish({ correct: attempt.correct, total: attempt.total })
  }, [attempt.correct, attempt.total, current, onFinish, outOfHearts])

  // Quitter une session en cours de prononciation laisserait la voix courir
  // sur l'écran suivant, qui n'a plus rien à voir avec le mot.
  useEffect(() => () => void stopSpeaking(), [])

  if (!current) return null

  return (
    // `h-dvh`, pas `h-full` : `#root` ne porte qu'un `min-height` (voir
    // `CourseProvider`), donc un pourcentage ne résout contre rien et la
    // div reprenait la hauteur de son seul contenu — sans jamais vraiment
    // remplir l'écran, ni donc avoir quoi que ce soit à couper avec
    // `overflow-hidden`. `dvh` se mesure contre le viewport directement,
    // pas contre le parent. Une leçon ne doit jamais pouvoir défiler, le
    // contenu est conçu pour tenir dans l'écran — d'où `overflow-hidden`
    // plutôt que `min-h-dvh`, qui laisserait grandir au lieu de couper.
    <div className="flex h-dvh flex-col overflow-hidden">
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
        {/* Un test montre ce qu'il reste à perdre, une leçon ce qui a été
            parcouru : dans une épreuve, savoir combien de fautes on peut
            encore commettre est la seule information qui change la façon de
            répondre. */}
        {exam ? (
          <span
            className="flex shrink-0 items-center gap-0.5 text-error"
            aria-label={`${hearts - mistakes} faute${hearts - mistakes > 1 ? 's' : ''} encore permise${hearts - mistakes > 1 ? 's' : ''}`}
          >
            {Array.from({ length: hearts }, (_, index) => (
              <HeartIcon key={index} size={17} filled={index < hearts - mistakes} />
            ))}
          </span>
        ) : (
          <span className="w-12 text-right text-sm font-extrabold text-ink-faint">
            {attempt.seen.size}/{graded}
          </span>
        )}
      </header>

      {/* `min-h-0` : sans lui, un enfant flex-1 en colonne se voit imposer une
          hauteur minimale égale à son contenu, ce qui neutralise
          `overflow-y-auto` juste en dessous — le classique piège flexbox.
          Filet de sécurité, pas le comportement voulu : un rappel de
          grammaire trop long pour l'écran doit rester lisible en entier
          plutôt que couper son bouton, même si l'intention reste que rien
          n'ait normalement besoin de défiler ici. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
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
            {current.kind === 'grammar-choice' && (
              <GrammarSentenceChoice
                exercise={current}
                onAnswer={(correct) => answer(current, correct)}
              />
            )}
            {current.kind === 'conjugation' && (
              <ConjugationAnswer exercise={current} onAnswer={(correct) => answer(current, correct)} />
            )}
            {current.kind === 'conjugation-choice' && (
              <ConjugationChoice exercise={current} onAnswer={(correct) => answer(current, correct)} />
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
        <h2 className="text-lg font-extrabold">Quitter « {title} » ?</h2>
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
