import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { findUnit } from '@/content/course'
import { buildCheckpointTest } from '@/engine/exercises'
import { seedFrom } from '@/engine/rng'
import type { SessionOutcome } from '@/engine/progress'
import { buildUnitPath, checkpointTestVocab, mistakesAllowed, pathBefore } from '@/engine/unitPath'
import { useProgress } from '@/store/progressStore'
import { canSpeak } from '@/lib/speech'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { TONES } from '@/components/pathTone'
import { SessionScreen } from './SessionScreen'

/**
 * Test de passage d'un checkpoint.
 *
 * Un checkpoint permet d'ouvrir directement une section plus loin dans
 * l'unité (voir `UnitPathScreen`). Le laisser franchir d'un simple appui
 * revenait à demander « êtes-vous sûr ? » sans jamais vérifier : on sautait
 * l'alphabet en trois appuis, et le cours s'effondrait deux unités plus loin,
 * sur des mots qu'on ne savait pas déchiffrer.
 *
 * D'où cette porte en deux temps : on annonce l'épreuve, puis on la passe. Ce
 * n'est pas une friction ajoutée pour ralentir — c'est ce qui rend le saut
 * mérité, et ce qui protège l'apprenant d'un raccourci qu'il paierait plus
 * tard sans comprendre pourquoi.
 */
export function CheckpointTestRoute() {
  const { unitId = '', lessonId = '' } = useParams()
  return <CheckpointTest key={`${unitId}/${lessonId}`} unitId={unitId} lessonId={lessonId} />
}

function CheckpointTest({ unitId, lessonId }: { unitId: string; lessonId: string }) {
  const navigate = useNavigate()
  const { course } = useCourse()
  const skipTo = useProgress((state) => state.skipTo)

  const [started, setStarted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<SessionOutcome | null>(null)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])

  // Le parcours est figé à l'ouverture : réussir le test marque acquis tout ce
  // qui précède, donc déverrouille le nœud. Le relire à ce moment-là ferait
  // disparaître le test sous les pieds de l'apprenant, avant même qu'il ait vu
  // son résultat.
  const [path] = useState(() => {
    if (!unit) return []
    const { lessons, steps } = useProgress.getState()
    return buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {})
  })
  const node = path.find((candidate) => candidate.id === lessonId) ?? null

  const vocab = useMemo(() => (unit ? checkpointTestVocab(unit, lessonId) : []), [unit, lessonId])
  const exercises = useMemo(
    () => buildCheckpointTest(vocab, seedFrom('checkpoint', lessonId, attempt), canSpeak),
    [vocab, lessonId, attempt],
  )
  const allowed = mistakesAllowed(exercises.length)
  // Le compte annoncé est celui des cœurs de l'en-tête : la faute de trop est
  // la (allowed + 1)-ième, autant le dire avec le même nombre des deux côtés.
  const hearts = allowed + 1

  // Le nœud n'est pas verrouillé : il n'y a rien à sauter, donc rien à
  // prouver. On ouvre la leçon, ce que l'appui demandait au fond.
  if (!unit || !node || !node.checkpoint) return <Navigate to="/" replace />
  if (node.status !== 'locked') return <Navigate to={`/lecon/${lessonId}`} replace />
  // Sans matière testable, un test ouvrirait un saut que rien ne mérite.
  if (exercises.length === 0) return <Navigate to={`/unite/${unit.id}`} replace />

  const tone = TONES[unit.color] ?? TONES.teal
  const onlyLetters = vocab.every((word) => word.pos === 'lettre')
  const noun = onlyLetters ? 'lettres' : 'mots'

  const backToPath = () => navigate(`/unite/${unit.id}`, { replace: true })
  const openLesson = () => navigate(`/lecon/${lessonId}`, { replace: true })

  const finish = (outcome: SessionOutcome) => {
    // Le saut s'applique ici, pas sur l'écran de résultat : quitter par le
    // bouton système juste après avoir réussi ne doit pas coûter le test.
    if (outcome.total - outcome.correct <= allowed) {
      const { lessonIds, stepIds } = pathBefore(unit.id, path, lessonId)
      skipTo(course.id, lessonIds, stepIds)
    }
    setResult(outcome)
  }

  if (result) {
    const mistakes = result.total - result.correct
    const passed = mistakes <= allowed
    return (
      <Outcome
        passed={passed}
        mistakes={mistakes}
        hearts={hearts}
        noun={noun}
        onOpen={openLesson}
        onBack={backToPath}
        onRetry={() => {
          setResult(null)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }

  if (started) {
    return (
      <SessionScreen
        // La file d'exercices est un état interne de la session : réessayer
        // doit repartir de zéro, sinon l'ancienne file resterait affichée.
        key={attempt}
        title={node.title}
        exercises={exercises}
        exam={{ allowed }}
        onQuit={backToPath}
        onFinish={finish}
      />
    )
  }

  return (
    // `min-h-dvh` et non `min-h-full` : `#root` ne porte qu'un `min-height`,
    // donc un pourcentage ne résout contre rien et le centrage serait sans
    // effet (voir `CourseProvider`, qui centre ses écrans de la même façon).
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      {/* Mascotte et bulle, comme au QCM : c'est la forme que prend déjà dans
          l'app une parole adressée à l'apprenant. */}
      <div className="flex items-end gap-3">
        <Mascot mood="reassuring" size={92} className="shrink-0" />
        <div className="card-3d relative flex-1 px-4 py-3 before:absolute before:top-6 before:-left-2 before:h-4 before:w-4 before:rotate-45 before:border-b-2 before:border-l-2 before:border-line before:bg-paper">
          {/* Espace insécable devant le « ? » : sans lui il part seul à la
              ligne suivante dès que la phrase se replie. */}
          <p className="text-sm leading-snug font-bold">
            Vous connaissez déjà ces {noun}&#160;? Moins de{' '}
            <span className={tone.text}>{hearts} fautes</span>, et vous passez directement à la
            suite.
          </p>
        </div>
      </div>

      {/* Ce sur quoi porte le test, en toutes lettres : on doit pouvoir juger
          d'un coup d'œil si on se lance, plutôt que le découvrir en le
          ratant. */}
      <div className="card-3d flex flex-wrap justify-center gap-2 px-4 py-4">
        {vocab.map((word) => (
          <span
            key={word.id}
            lang={course.learning}
            className={`rounded-xl px-2.5 py-1 text-lg font-black ${tone.soft} ${tone.text}`}
          >
            {word.term}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Button block onClick={() => setStarted(true)}>
          Passer le test
        </Button>
        {/* Renoncer reste un choix ordinaire, pas un aveu : le parcours normal
            est la voie par défaut, la sauter est l'exception. */}
        <button
          type="button"
          onClick={backToPath}
          className="text-sm font-extrabold text-ink-faint transition-colors hover:text-ink-soft"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}

/** Résultat du test : la section s'ouvre, ou le parcours reste à faire. */
function Outcome({
  passed,
  mistakes,
  hearts,
  noun,
  onOpen,
  onBack,
  onRetry,
}: {
  passed: boolean
  mistakes: number
  hearts: number
  noun: string
  onOpen: () => void
  onBack: () => void
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <Mascot mood={passed ? 'cheer' : 'disappointed'} size={150} />
      </motion.div>

      <h1 className="text-3xl font-black">{passed ? 'Section ouverte !' : 'Pas cette fois'}</h1>

      {/* Ce que le test vient de changer au parcours, dit explicitement : sans
          ça, retrouver toutes les étapes précédentes cochées ressemble à un
          bug plutôt qu'à ce qu'on a demandé. */}
      <p className="max-w-xs text-sm text-ink-soft">
        {passed
          ? 'Les étapes précédentes sont marquées comme acquises. Elles restent ouvertes si vous voulez y revenir.'
          : `${mistakes} fautes, il en fallait moins de ${hearts}. Ces ${noun} méritent un passage par les leçons.`}
      </p>

      <div className="mt-2 flex w-full max-w-sm flex-col gap-3">
        {passed ? (
          <Button block onClick={onOpen}>
            Commencer la section
          </Button>
        ) : (
          <>
            <Button block onClick={onBack}>
              Retour au parcours
            </Button>
            <Button block tone="neutral" onClick={onRetry}>
              Réessayer
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
