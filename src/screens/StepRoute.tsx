import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { findUnit, itemsOfCourse, itemsOfUnit } from '@/content/course'
import type { GhostExercise } from '@/engine/exercises'
import { ghostsFor, hasLearnWork, hasPresented, materializeGhost, type GhostMode, type GhostScope } from '@/engine/ghosts'
import type { SessionOutcome } from '@/engine/progress'
import { buildUnitPath, finalItems, nextNodeAfter, stepKey, type UnitStepKind } from '@/engine/unitPath'
import { useProgress } from '@/store/progressStore'
import { distractorsFor, ghostOptionsFor, ghostStateOf } from './ghostSession'
import { SessionScreen } from './SessionScreen'
import { SessionResult } from './SessionResult'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'

/** Éléments en cours dans une étape : plus large qu'en leçon, l'étape ne présente rien. */
const STEP_ACTIVE_COUNT = 8

/**
 * Places d'une étape : courtes, comme la révision, on préfère revenir
 * souvent. La séance finale s'allonge avec le nombre d'éléments fragiles
 * qu'elle reprend : deux places pour chacun.
 */
function stepLength(kind: UnitStepKind, items: number): number {
  if (kind === 'final') return Math.min(25, Math.max(8, 2 * items))
  return kind === 'workout' ? 12 : 10
}

/**
 * Étape de parcours qui n'est pas une leçon : révision de l'unité,
 * approfondissement, ou entraînement sur les points fragiles.
 */
export function StepRoute() {
  const { unitId = '', stepId = '' } = useParams()
  return <StepSession key={`${unitId}/${stepId}`} unitId={unitId} stepId={stepId} />
}

function StepSession({ unitId, stepId }: { unitId: string; stepId: string }) {
  const navigate = useNavigate()
  const { course } = useCourse()
  const finishStep = useProgress((state) => state.finishStep)
  const skipTo = useProgress((state) => state.skipTo)
  const [finished, setFinished] = useState<{ outcome: SessionOutcome; xp: number; peakTier: number } | null>(null)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])
  const node = useMemo(() => {
    if (!unit) return null
    const { lessons, steps } = useProgress.getState()
    return (
      buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {}).find(
        (candidate) => candidate.id === stepId,
      ) ?? null
    )
  }, [unit, stepId, course.id])

  // Seul l'entraînement sort de l'unité : c'est là qu'on va chercher ce qui a
  // été appris ailleurs et qui redemande du travail. Une étape ne présente
  // rien : elle ne fait travailler que ce que les leçons ont déjà présenté.
  // La séance finale ne reprend que les éléments de l'unité qui ont rechuté
  // plusieurs fois (voir `finalItems`), relevés à l'ouverture : les réponses
  // données pendant la séance ne doivent pas en remanier la liste.
  const [scope] = useState<GhostScope | null>(() => {
    if (!unit || !node || node.kind === 'lesson') return null
    if (node.kind === 'workout') return { items: itemsOfCourse(course), distractors: itemsOfCourse(course) }
    const items =
      node.kind === 'final'
        ? finalItems(useProgress.getState().cards[course.id] ?? {}, itemsOfUnit(unit))
        : itemsOfUnit(unit)
    return { items, distractors: distractorsFor(course, unit) }
  })

  // Figé à l'ouverture : le mode et le nombre de places. Ce que chaque place
  // contiendra, lui, se décide au moment de l'ouvrir.
  const [session] = useState(() => {
    if (!scope || !node || node.kind === 'lesson' || !unit) return null
    const seed = Date.now()
    const served = new Map<string, number>()
    const state = ghostStateOf(course.id)
    // L'entraînement fait passer les éléments fragiles en premier.
    const favorFragile = node.kind === 'workout'
    const options = { allowIntro: false, activeCount: STEP_ACTIVE_COUNT, favorFragile }
    // La séance finale reprend chacun de ses éléments, acquis ou non : c'est
    // d'avoir rechuté qui les y a fait entrer.
    const learn =
      node.kind !== 'final' && hasLearnWork(scope, state, ghostOptionsFor(seed, served, { mode: 'learn', ...options }))
    const mode: GhostMode = node.kind === 'final' ? 'review' : learn ? 'learn' : 'practice'
    return {
      seed,
      served,
      mode,
      // L'approfondissement pèse davantage sur la production.
      favorProduction: node.kind === 'drill',
      favorFragile,
      empty: !hasPresented(scope, state),
      exercises: ghostsFor(stepLength(node.kind, scope.items.length)),
    }
  })

  const materialize = useCallback(
    (ghost: GhostExercise) =>
      session && scope
        ? materializeGhost(
            ghost,
            scope,
            ghostStateOf(course.id),
            ghostOptionsFor(session.seed, session.served, {
              mode: session.mode,
              allowIntro: false,
              activeCount: STEP_ACTIVE_COUNT,
              favorProduction: session.favorProduction,
              favorFragile: session.favorFragile,
            }),
          )
        : null,
    [session, scope, course.id],
  )

  if (!unit || !node || node.kind === 'lesson' || !session) return <Navigate to="/" replace />

  const backHome = () => navigate('/', { replace: true })

  if (finished) {
    const { lessons, steps } = useProgress.getState()
    const next = nextNodeAfter(
      buildUnitPath(unit, lessons[course.id] ?? {}, steps[course.id] ?? {}),
      stepId,
    )
    return (
      <SessionResult
        outcome={finished.outcome}
        passed
        xp={finished.xp}
        peakTier={finished.peakTier}
        onContinue={backHome}
        onNext={
          next && next.status !== 'locked'
            ? () => navigate(next.lesson ? `/lecon/${next.lesson.id}` : `/etape/${unit.id}/${next.id}`, { replace: true })
            : undefined
        }
        onRetry={backHome}
      />
    )
  }

  if (session.empty) {
    // Une étape peut se retrouver sans rien à réviser (les leçons qui la
    // précèdent n'ont jamais été jouées) : rester bloqué là serait une
    // impasse, d'où l'échappatoire ci-dessous.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-8 text-center [&>*]:shrink-0">
        <Mascot mood="think" size={130} />
        <h1 className="text-2xl font-black">Rien à travailler</h1>
        <p className="max-w-xs text-sm text-ink-soft">
          {node.kind === 'final'
            ? "Aucun élément de cette unité n'a rechuté plusieurs fois : il n'y a rien à reprendre dans ce bilan. Vous pouvez le valider."
            : "Cette étape reprend ce que vous avez déjà rencontré. Faites d'abord les leçons qui la précèdent, ou passez cette étape si elles ont été sautées."}
        </p>
        <div className="flex gap-3">
          <Button tone="neutral" onClick={backHome}>
            Retour à l'accueil
          </Button>
          <Button
            onClick={() => {
              skipTo(course.id, [], [stepKey(unit.id, stepId)])
              backHome()
            }}
          >
            {node.kind === 'final' ? 'Valider ce bilan' : 'Passer cette étape'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SessionScreen
      title={`${node.title} (${unit.title})`}
      kind={node.kind}
      exercises={session.exercises}
      materialize={materialize}
      onQuit={backHome}
      onFinish={(outcome, peakTier) =>
        setFinished({ outcome, peakTier, ...finishStep(course.id, stepKey(unit.id, stepId), outcome) })
      }
    />
  )
}
