import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { findUnit } from '@/content/course'
import { unitMastery } from '@/engine/progress'
import { buildUnitPath, type UnitPathNode } from '@/engine/unitPath'
import { placePath } from '@/engine/unitPathLayout'
import { EMPTY_CARDS, EMPTY_LESSON_PROGRESS, EMPTY_STEPS, useProgress } from '@/store/progressStore'
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
  const lessons = useProgress((state) => state.lessons[course.id] ?? EMPTY_LESSON_PROGRESS)
  const steps = useProgress((state) => state.steps[course.id] ?? EMPTY_STEPS)
  const cards = useProgress((state) => state.cards[course.id] ?? EMPTY_CARDS)

  const unit = useMemo(() => findUnit(course, unitId), [course, unitId])
  const path = useMemo(
    () => (unit ? buildUnitPath(unit, lessons, steps) : []),
    [unit, lessons, steps],
  )
  const placed = useMemo(() => placePath(path), [path])
  const mastery = useMemo(() => (unit ? unitMastery(unit, cards) : null), [unit, cards])

  // Rang de l'étape courante : tout ce qui la suit s'efface avec la distance.
  // Sans repère, un parcours vierge est un mur de cercles identiques.
  const currentIndex = path.findIndex((node) => node.status === 'available')
  const doneCount = path.filter((node) => node.status === 'done').length

  if (!unit || !mastery) return <Navigate to="/" replace />

  const tone = TONES[unit.color] ?? TONES.teal

  const open = (node: UnitPathNode) => {
    if (node.status === 'locked') return
    navigate(node.lesson ? `/lecon/${node.lesson.id}` : `/etape/${unit.id}/${node.id}`)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            aria-label="Retour"
            className="-ml-2 rounded-full p-2 text-ink-faint hover:text-ink"
          >
            <ChevronLeftIcon size={24} />
          </button>
          <div className="flex-1">
            <p className={`text-[11px] font-black tracking-wide uppercase ${tone.text}`}>Unité</p>
            <h1 className="text-lg leading-tight font-black">{unit.title}</h1>
            {unit.subtitle && <p className="text-xs text-ink-soft">{unit.subtitle}</p>}
          </div>
          <ProgressRing
            ratio={mastery.ratio}
            seenRatio={mastery.total === 0 ? 0 : mastery.seen / mastery.total}
            size={48}
            color={tone.css}
          />
        </div>
        {/* La carte d'unité, sur l'écran précédent, annonce un nombre
            d'étapes ; le compte disparaissait dès qu'on entrait, remplacé par
            l'anneau de maîtrise, qui mesure autre chose (ce qui est su, pas ce
            qui est fait). Les deux sont utiles, mais celui que ce chemin
            dessine littéralement de haut en bas, c'est celui-ci — en pastille
            plutôt qu'en simple texte, pour rester lisible sous le titre agrandi. */}
        <div
          className={`mt-3 inline-flex w-fit items-center rounded-full border-2 px-3 py-1 text-xs font-bold ${
            doneCount > 0 ? `${tone.border} ${tone.soft} ${tone.text}` : 'border-line bg-line/30 text-ink-faint'
          }`}
        >
          <span>
            {doneCount} / {path.length} étapes
          </span>
        </div>
      </header>

      <main
        className="flex flex-1 flex-col items-center px-4 pt-6 pb-10"
        // Un lavis très léger de la teinte de l'unité derrière le chemin :
        // sans lui, l'écran retombe sur le cream générique de partout ailleurs
        // et l'unité perd sa couleur dès qu'on quitte le fil des cercles.
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, color-mix(in srgb, ${tone.css} 7%, transparent), transparent 70%)`,
        }}
      >
        <div className="relative w-full" style={{ height: placed.height }}>
          <PathTrail nodes={placed.nodes} height={placed.height} tone={tone} />

          {placed.nodes.map((spot, index) => (
            <PathNode
              key={spot.node.id}
              spot={spot}
              tone={tone}
              depth={currentIndex === -1 ? 0 : Math.max(0, index - currentIndex)}
              onOpen={() => open(spot.node)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
