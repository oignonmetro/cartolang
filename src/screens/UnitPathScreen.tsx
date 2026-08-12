import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCourse } from '@/content/CourseProvider'
import { findUnit, itemsOfUnit } from '@/content/course'
import { masteredLabel } from '@/content/course'
import { unitMastery } from '@/engine/progress'
import { buildUnitPath, type UnitNodeKind, type UnitPathNode } from '@/engine/unitPath'
import { useProgress } from '@/store/progressStore'
import { ProgressRing } from '@/components/ProgressRing'
import { BoltIcon, BookIcon, ChestIcon, CheckIcon, ChevronLeftIcon, FlagIcon, LockIcon, RefreshIcon } from '@/components/icons'

/**
 * Parcours d'une unité.
 *
 * Les unités sont libres, l'intérieur ne l'est pas : découvrir, consolider,
 * approfondir, puis aller travailler ses points faibles — dans cet ordre. Le
 * chemin rend cette progression visible, au lieu de la laisser au bon vouloir
 * d'un bouton posé à côté de la liste des leçons.
 */

interface Tone {
  face: string
  edge: string
  soft: string
  border: string
  text: string
  css: string
}

const TONES: Record<string, Tone> = {
  teal: { face: 'bg-teal', edge: 'var(--color-teal-deep)', soft: 'bg-teal/15', border: 'border-teal/40', text: 'text-teal', css: 'var(--color-teal)' },
  violet: { face: 'bg-violet', edge: 'var(--color-violet-deep)', soft: 'bg-violet/15', border: 'border-violet/40', text: 'text-violet', css: 'var(--color-violet)' },
  sky: { face: 'bg-sky', edge: 'var(--color-sky-deep)', soft: 'bg-sky/15', border: 'border-sky/40', text: 'text-sky', css: 'var(--color-sky)' },
  coral: { face: 'bg-coral', edge: 'var(--color-coral-deep)', soft: 'bg-coral/15', border: 'border-coral/40', text: 'text-coral', css: 'var(--color-coral)' },
  amber: { face: 'bg-amber', edge: 'var(--color-amber-deep)', soft: 'bg-amber/15', border: 'border-amber/40', text: 'text-amber', css: 'var(--color-amber)' },
}

const NODE_ICONS: Record<UnitNodeKind, (props: { size?: number }) => React.ReactElement> = {
  lesson: BookIcon,
  review: RefreshIcon,
  drill: BoltIcon,
  workout: ChestIcon,
  final: FlagIcon,
}

/**
 * Décalage horizontal des nœuds, en pixels. Un chemin strictement vertical se
 * lit comme une liste ; le léger serpentin donne le sentiment d'avancer.
 */
const OFFSETS = [0, 44, 60, 44, 0, -44, -60, -44]

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
        <p className={`mt-1 text-xs font-bold ${tone.text}`}>
          {masteredLabel(unit.kind, mastery.known, mastery.total)}
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center gap-3 px-4 pt-6 pb-16">
        {path.map((node, index) => (
          <PathNode
            key={node.id}
            node={node}
            tone={tone}
            offset={OFFSETS[index % OFFSETS.length]!}
            last={index === path.length - 1}
            onOpen={() => open(node)}
          />
        ))}

        <p className="mt-4 max-w-xs text-center text-xs text-ink-faint">
          {itemsOfUnit(unit).length} éléments dans cette unité. Les entraînements vont aussi chercher vos points
          fragiles dans les autres unités déjà travaillées.
        </p>
      </main>
    </div>
  )
}

function PathNode({
  node,
  tone,
  offset,
  last,
  onOpen,
}: {
  node: UnitPathNode
  tone: Tone
  offset: number
  last: boolean
  onOpen: () => void
}) {
  const Icon = NODE_ICONS[node.kind]
  const locked = node.status === 'locked'
  const done = node.status === 'done'

  // Un seul cercle plein à la fois, l'étape courante : les étapes franchies
  // passent en teinte claire, les suivantes en gris. La hiérarchie se lit
  // alors d'un coup d'œil, sans avoir à comparer des nuances.
  const circle = locked
    ? 'h-16 w-16 border-2 border-line bg-line/40 text-ink-faint'
    : done
      ? `h-16 w-16 border-2 ${tone.border} ${tone.soft} ${tone.text}`
      : `h-20 w-20 ${tone.face} text-white`

  return (
    <div className="flex w-full flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
      <motion.button
        type="button"
        onClick={onOpen}
        disabled={locked}
        whileTap={locked ? undefined : { y: 4 }}
        aria-label={`${node.title} — ${locked ? 'verrouillé' : done ? 'terminé' : 'à faire'}`}
        className={`flex items-center justify-center rounded-full transition-colors ${circle}`}
        style={node.status === 'available' ? { boxShadow: `0 5px 0 0 ${tone.edge}` } : undefined}
      >
        {locked ? <LockIcon size={24} /> : done ? <CheckIcon size={26} /> : <Icon size={30} />}
      </motion.button>

      <p
        className={`mt-2 text-center text-sm font-extrabold ${
          locked ? 'text-ink-faint' : node.status === 'available' ? tone.text : 'text-ink'
        }`}
      >
        {node.title}
      </p>
      <p className="max-w-[16rem] text-center text-[0.7rem] text-ink-faint">{node.subtitle}</p>

      {/* Fil de liaison vers le nœud suivant — rien après le dernier. */}
      {!last && <span aria-hidden className="mt-3 h-5 w-1 rounded-full bg-line" />}
    </div>
  )
}
