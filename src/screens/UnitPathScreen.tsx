import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { findUnit } from '@/content/course'
import { unitMastery } from '@/engine/progress'
import { buildUnitPath, type UnitPathNode } from '@/engine/unitPath'
import { placePath } from '@/engine/unitPathLayout'
import { useProgress } from '@/store/progressStore'
import { ProgressRing } from '@/components/ProgressRing'
import { PathNode } from '@/components/PathNode'
import { PathTrail } from '@/components/PathTrail'
import { TONES } from '@/components/pathTone'
import { ChevronLeftIcon } from '@/components/icons'

/**
 * Parcours d'une unité.
 *
 * Les unités sont libres, l'intérieur ne l'est pas : découvrir, consolider,
 * approfondir, puis aller travailler ses points faibles — dans cet ordre. Le
 * chemin rend cette progression visible, au lieu de la laisser au bon vouloir
 * d'un bouton posé à côté de la liste des leçons.
 */
export function UnitPathScreen() {
  const { unitId = '' } = useParams()
  const navigate = useNavigate()
  const { course } = useCourse()
  const lessons = useProgress((state) => state.lessons)
  const steps = useProgress((state) => state.steps)
  const cards = useProgress((state) => state.cards)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])
  const path = useMemo(
    () => (unit ? buildUnitPath(unit, lessons, steps) : []),
    [unit, lessons, steps],
  )
  const placed = useMemo(() => placePath(path), [path])
  const mastery = useMemo(() => (unit ? unitMastery(unit, cards) : null), [unit, cards])

  if (!unit || !mastery) return <Navigate to="/" replace />

  const tone = TONES[unit.color] ?? TONES.teal

  const open = (node: UnitPathNode) => {
    if (node.status === 'locked') return
    navigate(node.lesson ? `/lecon/${node.lesson.id}` : `/etape/${unit.id}/${node.id}`)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            aria-label="Retour"
            className="rounded-full p-2 text-ink-faint hover:text-ink"
          >
            <ChevronLeftIcon size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-base leading-tight font-black">{unit.title}</h1>
            {unit.subtitle && <p className="text-xs text-ink-soft">{unit.subtitle}</p>}
          </div>
          <ProgressRing
            ratio={mastery.ratio}
            seenRatio={mastery.total === 0 ? 0 : mastery.seen / mastery.total}
            size={44}
            color={tone.css}
          />
        </div>
      </header>

      <main
        className="flex flex-1 flex-col items-center px-4 pt-4 pb-6"
        // Un lavis très léger de la teinte de l'unité derrière le chemin :
        // sans lui, l'écran retombe sur le cream générique de partout ailleurs
        // et l'unité perd sa couleur dès qu'on quitte le fil des cercles.
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, color-mix(in srgb, ${tone.css} 7%, transparent), transparent 70%)`,
        }}
      >
        <div className="relative w-full" style={{ height: placed.height }}>
          <PathTrail nodes={placed.nodes} height={placed.height} tone={tone} />
          {placed.nodes.map((spot) => (
            <PathNode key={spot.node.id} spot={spot} tone={tone} onOpen={() => open(spot.node)} />
          ))}
        </div>
      </main>
    </div>
  )
}
