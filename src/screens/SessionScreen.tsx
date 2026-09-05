import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Exercise } from '@/engine/exercises'
import { isListeningExercise, isPresentation, itemIdsOf } from '@/engine/exercises'
import { ratingFromAnswer, type Rating } from '@/engine/srs'
import { useCourse } from '@/content/CourseProvider'
import { useProgress } from '@/store/progressStore'
import { isListeningMuted, useListeningMuteStore } from '@/store/listeningMuteStore'
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
import {
  SessionHapticsProvider,
  useHaptics,
  type SessionCombo,
  type SessionHaptics,
} from '@/components/session/useSessionHaptics'
import { ComboBadge } from '@/components/session/ComboBadge'
import { BookIcon, ChestIcon, CloseIcon, FlagIcon, RefreshIcon, StarIcon } from '@/components/icons'
import type { SessionOutcome } from '@/engine/progress'
import type { UnitNodeKind } from '@/engine/unitPath'

/**
 * Déroulé d'une session.
 *
 * Un exercice raté repart en fin de file : la session ne se termine pas tant
 * qu'il n'a pas été réussi. Seule la première tentative compte dans le score,
 * pour que le taux de réussite reflète ce qui était su au départ.
 */

interface SessionScreenProps {
  title: string
  /**
   * Nature de la séance — leçon, révision, approfondissement, entraînement,
   * bilan final (voir `UnitNodeKind`). Se lit sur un petit repère dans
   * l'en-tête (voir `SessionKindBadge`) : depuis l'archivage du parcours
   * visuel, une leçon enchaîne directement sur sa révision puis sa
   * consolidation sans jamais repasser par un écran de parcours qui le
   * disait — sans ce repère, rien à l'écran ne distingue plus les deux.
   */
  kind: UnitNodeKind
  exercises: Exercise[]
  onQuit: () => void
  /** `peakTier` : le plus haut palier de série atteint, voir `useSessionHaptics`. */
  onFinish: (outcome: SessionOutcome, peakTier: number) => void
}

/**
 * Icône, libellé et teinte de chaque nature de séance — mêmes intitulés que
 * `STEP_LABELS` dans `unitPath.ts`, « Leçon » en plus pour le seul nœud que
 * ce fichier-là ne nomme pas lui-même (`lesson.title` y tient déjà lieu de
 * titre). La teinte reprend des couleurs déjà en usage ailleurs plutôt que
 * d'en inventer : `teal` porte déjà le vocabulaire (voir `RuleNote`),
 * `amber` la récompense de fin d'unité (voir `ChestNode`, `PathScreen`) — la
 * séance finale en hérite tout naturellement.
 *
 * Les classes de teinte sont écrites en toutes lettres plutôt qu'assemblées
 * par gabarit (`bg-${tone}/15`) : Tailwind ne génère que les classes qu'il
 * peut lire littéralement dans le source, un nom composé à l'exécution ne
 * produirait rien.
 */
const SESSION_KIND: Record<UnitNodeKind, { label: string; Icon: typeof BookIcon; tone: string }> = {
  lesson: { label: 'Leçon', Icon: BookIcon, tone: 'bg-teal/15 text-teal' },
  review: { label: 'Révision', Icon: RefreshIcon, tone: 'bg-sky/15 text-sky' },
  drill: { label: 'Approfondissement', Icon: StarIcon, tone: 'bg-violet/15 text-violet' },
  workout: { label: 'Entraînement', Icon: FlagIcon, tone: 'bg-coral/15 text-coral' },
  final: { label: 'Séance finale', Icon: ChestIcon, tone: 'bg-amber/15 text-amber' },
}

function SessionKindBadge({ kind }: { kind: UnitNodeKind }) {
  const { label, Icon, tone } = SESSION_KIND[kind]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-full p-2 ${tone}`}
    >
      <Icon size={18} />
    </span>
  )
}

interface Attempt {
  seen: Set<string>
  correct: number
  total: number
}

/**
 * Ne fait qu'ouvrir la session au retour haptique : le suiveur de série doit
 * être créé au-dessus du déroulé pour que les exercices y accèdent par le
 * contexte (voir `useSessionHaptics`), et `SessionRunner` ne peut pas à la
 * fois fournir un contexte et le lire.
 */
export function SessionScreen(props: SessionScreenProps) {
  const { haptics, combo, peakTier } = useHaptics()
  return (
    <SessionHapticsProvider value={haptics}>
      <SessionRunner {...props} haptics={haptics} combo={combo} peakTier={peakTier} />
    </SessionHapticsProvider>
  )
}

function SessionRunner({
  title,
  kind,
  exercises,
  onQuit,
  onFinish,
  haptics,
  combo,
  peakTier,
}: SessionScreenProps & { haptics: SessionHaptics; combo: SessionCombo; peakTier: () => number }) {
  const { course } = useCourse()
  const gradeItem = useProgress((state) => state.gradeItem)
  const mutedUntil = useListeningMuteStore((state) => state.mutedUntil)
  const muteListening = useListeningMuteStore((state) => state.muteListening)
  const [queue, setQueue] = useState<Exercise[]>(exercises)
  const [position, setPosition] = useState(0)
  const [attempt, setAttempt] = useState<Attempt>({ seen: new Set(), correct: 0, total: 0 })
  const [confirmQuit, setConfirmQuit] = useState(false)

  const current = queue[position]
  // Un exercice à l'oreille pendant la sourdine : ni pénalité ni note, il n'a
  // simplement pas eu lieu cette fois — voir `useListeningMuteStore`.
  const mustSkipListening = current !== undefined && isListeningExercise(current) && isListeningMuted(mutedUntil)
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

  /**
   * « Je ne peux pas écouter maintenant » : coupe l'écoute pour vingt minutes
   * (voir `useListeningMuteStore`) et passe l'exercice en cours sans le
   * compter, ni en bien ni en mal — il n'a simplement pas eu lieu cette fois.
   * Pas de `record` ici, à la différence de `answer` : le compter comme juste
   * gonflerait le score sans avoir été répondu, le compter comme faux
   * pénaliserait une gêne passagère qui n'a rien à voir avec le mot.
   */
  const cantListen = useCallback(() => {
    muteListening()
    advance(false)
  }, [advance, muteListening])

  // Les exercices suivants pendant la fenêtre de sourdine se sautent tout
  // seuls, sans attendre un nouvel appui sur « Je ne peux pas écouter » à
  // chacun — sans quoi la coupure ne durerait qu'un seul exercice. Rien ne se
  // rend visible entre-temps (voir plus bas, `!mustSkipListening`) : le temps
  // d'un rendu suffirait à un `SpeakButton auto` à parler avant d'être
  // démonté, ce que la coupure existe justement pour éviter.
  useEffect(() => {
    if (mustSkipListening) advance(false)
  }, [mustSkipListening, advance])

  const answer = useCallback(
    (exercise: Exercise, correct: boolean, rating?: Rating) => {
      const firstTry = !attempt.seen.has(exercise.id)
      for (const itemId of itemIdsOf(exercise)) {
        gradeItem(course.id, itemId, rating ?? ratingFromAnswer(correct, firstTry))
      }
      // Pas de son ici : il a déjà sonné dans l'exercice, à la validation
      // de la réponse (voir `useSessionSounds`). `answer` n'est appelé qu'à
      // l'appui sur « Continuer », une ou deux secondes plus tard.
      if (!isPresentation(exercise)) record(exercise, correct)
      // Une auto-évaluation (`rating` fourni : découverte d'un mot,
      // flashcard) ne se refait pas. Reposer la question quelques écrans
      // plus loin demanderait de réévaluer un mot qu'on vient de déclarer
      // nouveau — pas un rattrapage, juste du temps perdu. Ce qui est mal su
      // revient par la révision espacée, une séance plus tard, quand
      // l'oublier est redevenu possible.
      advance(!correct && rating === undefined)
    },
    [advance, attempt.seen, course.id, gradeItem, record],
  )

  const answerMatch = useCallback(
    (exercise: Exercise, missedItemIds: string[]) => {
      const missed = new Set(missedItemIds)
      const firstTry = !attempt.seen.has(exercise.id)
      for (const itemId of itemIdsOf(exercise)) {
        gradeItem(course.id, itemId, missed.has(itemId) ? 'again' : ratingFromAnswer(true, firstTry))
      }
      // Pas de son ici : chaque paire a déjà sonné en se résolvant (voir
      // `PairBoard`), et la dernière est la fin de la manche. En rejouer un
      // par-dessus doublerait la note d'arrivée.
      //
      // La vibration, elle, se déclenche bien ici, et une seule fois pour
      // toute la manche : la dernière paire trouvée *est* la fin de
      // l'exercice, il n'y a pas de « Continuer » qui retarderait la
      // sensation. Vibrer à chaque paire aurait fait exactement le bruit
      // que la parcimonie cherche à éviter.
      haptics.answered(exercise, missed.size === 0)
      record(exercise, missed.size === 0)
      // Les paires sont toutes trouvées à la fin : inutile de rejouer la manche.
      advance(false)
    },
    [advance, attempt.seen, course.id, gradeItem, haptics, record],
  )

  // La file est vide : la session est terminée. Le drapeau évite que le rendu
  // suivant ne déclenche une seconde clôture.
  const finished = useRef(false)
  useEffect(() => {
    if (current || finished.current) return
    finished.current = true
    const outcome = { correct: attempt.correct, total: attempt.total }
    haptics.finished(outcome)
    onFinish(outcome, peakTier())
  }, [attempt.correct, attempt.total, current, haptics, onFinish, peakTier])

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
      <header className="relative flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setConfirmQuit(true)}
          aria-label="Quitter la session"
          className="rounded-full p-2 text-ink-faint transition-colors hover:text-ink"
        >
          <CloseIcon size={22} />
        </button>
        <SessionKindBadge kind={kind} />
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
        {/* Seul repère de ce qui vient de se passer : sans lui, les
            exercices d'écoute sautés silencieusement (voir
            `mustSkipListening`) donneraient l'impression d'un bug plutôt que
            d'un choix. */}
        {mutedUntil !== null && isListeningMuted(mutedUntil) && (
          <span className="rounded-full bg-line px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap text-ink-faint">
            Écoute coupée {Math.max(1, Math.ceil((mutedUntil - Date.now()) / 60_000))} min
          </span>
        )}
        <ComboBadge combo={combo} />
      </header>

      {/* `min-h-0` : sans lui, un enfant flex-1 en colonne se voit imposer une
          hauteur minimale égale à son contenu, ce qui neutralise
          `overflow-y-auto` juste en dessous — le classique piège flexbox.
          Filet de sécurité, pas le comportement voulu : un rappel de
          grammaire trop long pour l'écran doit rester lisible en entier
          plutôt que couper son bouton, même si l'intention reste que rien
          n'ait normalement besoin de défiler ici. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
        {/* Le temps d'un rendu, le temps d'un exercice à l'oreille sauté
            pendant la sourdine — voir `mustSkipListening` et l'effet qui
            avance juste au-dessus. Rien ne s'y monte, pas même le composant
            de l'exercice : un `SpeakButton auto` parlerait sinon avant que
            l'effet n'ait eu le temps de passer à la suite. */}
        {!mustSkipListening && (
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
                <MatchPairs
                  exercise={current}
                  onDone={({ missedIds }) => answerMatch(current, missedIds)}
                  onCantListen={cantListen}
                />
              )}
              {current.kind === 'choice' && (
                <ChoiceQuestion
                  exercise={current}
                  onAnswer={(correct) => answer(current, correct)}
                  onCantListen={cantListen}
                />
              )}
              {current.kind === 'rule' && <RuleNote exercise={current} onNext={() => advance(false)} />}
              {current.kind === 'grammar-gap' && (
                <GrammarGap exercise={current} onAnswer={(correct) => answer(current, correct)} />
              )}
              {current.kind === 'grammar-choice' && (
                <GrammarSentenceChoice
                  exercise={current}
                  onAnswer={(correct) => answer(current, correct)}
                  onCantListen={cantListen}
                />
              )}
              {current.kind === 'conjugation' && (
                <ConjugationAnswer exercise={current} onAnswer={(correct) => answer(current, correct)} />
              )}
              {current.kind === 'conjugation-choice' && (
                <ConjugationChoice
                  exercise={current}
                  onAnswer={(correct) => answer(current, correct)}
                  onCantListen={cantListen}
                />
              )}
              {current.kind === 'conjugation-match' && (
                <ConjugationMatch exercise={current} onDone={({ missedIds }) => answerMatch(current, missedIds)} />
              )}
              {current.kind === 'cloze' && (
                <ClozeSentence exercise={current} onAnswer={(correct) => answer(current, correct)} />
              )}
              {current.kind === 'type' && (
                <TypeAnswer
                  exercise={current}
                  onAnswer={(correct) => answer(current, correct)}
                  onCantListen={cantListen}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
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
      className="fixed inset-0 z-20 flex items-end justify-center bg-scrim/40 p-4"
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
