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
  /** Teinte à peine posée : le verrouillé reste coloré, pas juste gris éteint. */
  faintBg: string
  faintBorder: string
  faintText: string
  /** Pastille du chemin pas encore franchi. */
  dot: string
}

const TONES: Record<string, Tone> = {
  teal: {
    face: 'bg-teal', edge: 'var(--color-teal-deep)', soft: 'bg-teal/15', border: 'border-teal/40',
    text: 'text-teal', css: 'var(--color-teal)',
    faintBg: 'bg-teal/8', faintBorder: 'border-teal/20', faintText: 'text-teal/55', dot: 'bg-teal/25',
  },
  violet: {
    face: 'bg-violet', edge: 'var(--color-violet-deep)', soft: 'bg-violet/15', border: 'border-violet/40',
    text: 'text-violet', css: 'var(--color-violet)',
    faintBg: 'bg-violet/8', faintBorder: 'border-violet/20', faintText: 'text-violet/55', dot: 'bg-violet/25',
  },
  sky: {
    face: 'bg-sky', edge: 'var(--color-sky-deep)', soft: 'bg-sky/15', border: 'border-sky/40',
    text: 'text-sky', css: 'var(--color-sky)',
    faintBg: 'bg-sky/8', faintBorder: 'border-sky/20', faintText: 'text-sky/55', dot: 'bg-sky/25',
  },
  coral: {
    face: 'bg-coral', edge: 'var(--color-coral-deep)', soft: 'bg-coral/15', border: 'border-coral/40',
    text: 'text-coral', css: 'var(--color-coral)',
    faintBg: 'bg-coral/8', faintBorder: 'border-coral/20', faintText: 'text-coral/55', dot: 'bg-coral/25',
  },
  amber: {
    face: 'bg-amber', edge: 'var(--color-amber-deep)', soft: 'bg-amber/15', border: 'border-amber/40',
    text: 'text-amber', css: 'var(--color-amber)',
    faintBg: 'bg-amber/8', faintBorder: 'border-amber/20', faintText: 'text-amber/55', dot: 'bg-amber/25',
  },
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
const OFFSETS = [0, 38, 52, 38, 0, -38, -52, -38]

/**
 * Diamètre des cercles selon l'état. L'étape courante domine, le verrouillé
 * s'efface : la hiérarchie se lit à la taille avant même la couleur, et le
 * parcours à venir prend moins de place à l'écran.
 */
const SIZES = { available: 68, done: 52, locked: 46 }

/** Nombre de pastilles marquant le chemin entre deux nœuds. */
const TRAIL_DOTS = 3

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

      <main
        className="flex flex-1 flex-col items-center px-4 pt-4 pb-12"
        // Un lavis très léger de la teinte de l'unité derrière le chemin :
        // sans lui, l'écran retombe sur le cream générique de partout ailleurs
        // et l'unité perd sa couleur dès qu'on quitte le fil des cercles.
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, color-mix(in srgb, ${tone.css} 7%, transparent), transparent 70%)`,
        }}
      >
        {path.map((node, index) => (
          <PathNode
            key={node.id}
            node={node}
            tone={tone}
            offset={OFFSETS[index % OFFSETS.length]!}
            // Le fil se penche vers le nœud suivant : le chemin se suit du
            // regard au lieu de se deviner d'un cercle à l'autre.
            nextOffset={index === path.length - 1 ? null : OFFSETS[(index + 1) % OFFSETS.length]!}
            onOpen={() => open(node)}
          />
        ))}

        <p className="mt-5 max-w-xs text-center text-xs text-ink-faint">
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
  nextOffset,
  onOpen,
}: {
  node: UnitPathNode
  tone: Tone
  offset: number
  /** Décalage du nœud suivant, ou `null` pour le dernier. */
  nextOffset: number | null
  onOpen: () => void
}) {
  const Icon = NODE_ICONS[node.kind]
  const locked = node.status === 'locked'
  const done = node.status === 'done'
  const current = node.status === 'available'
  const size = locked ? SIZES.locked : done ? SIZES.done : SIZES.available

  // Un seul cercle plein à la fois, l'étape courante : les étapes franchies
  // passent en teinte claire, les suivantes restent teintées mais à peine —
  // gris pur les aurait fait sortir de la couleur de l'unité, comme si le
  // chemin changeait de nature au lieu de simplement attendre.
  const circle = locked
    ? `border-2 ${tone.faintBorder} ${tone.faintBg} ${tone.faintText}`
    : done
      ? `border-2 ${tone.border} ${tone.soft} ${tone.text}`
      : `${tone.face} text-white`

  // Chaque cercle porte l'ombre en tranche qui fait le langage visuel du
  // reste de l'app (boutons, cartes) : sans elle, tout ce qui n'est pas
  // l'étape courante retombait à plat, hors style. Elle s'assombrit avec
  // l'importance de l'étape plutôt que de disparaître.
  const shadow = current
    ? `0 5px 0 0 ${tone.edge}`
    : done
      ? `0 3px 0 0 color-mix(in srgb, ${tone.edge} 55%, var(--color-line))`
      : `0 2px 0 0 color-mix(in srgb, ${tone.edge} 18%, var(--color-line))`

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex flex-col items-center" style={{ transform: `translateX(${offset}px)` }}>
        <div className="relative flex items-center justify-center">
          {/* Halo pulsé sur l'étape courante : attire l'œil sans rien coûter
              en hauteur, contrairement à une pastille « Commencer ». */}
          {current && (
            <motion.span
              aria-hidden
              className={`absolute inset-0 rounded-full ${tone.face}`}
              animate={{ scale: [1, 1.35], opacity: [0.35, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          )}

          <motion.button
            type="button"
            onClick={onOpen}
            disabled={locked}
            whileTap={locked ? undefined : { y: 4 }}
            aria-label={`${node.title} — ${locked ? 'verrouillé' : done ? 'terminé' : 'à faire'}`}
            className={`relative flex items-center justify-center rounded-full transition-colors ${circle}`}
            style={{ width: size, height: size, boxShadow: shadow }}
          >
            {locked ? <LockIcon size={20} /> : done ? <CheckIcon size={24} /> : <Icon size={30} />}
          </motion.button>
        </div>

        <p
          className={`mt-1 max-w-[13rem] text-center text-xs leading-tight font-extrabold ${
            locked ? 'text-ink-faint' : current ? tone.text : 'text-ink-soft'
          }`}
        >
          {node.title}
        </p>
        {/* Le sous-titre n'a d'utilité que là où l'on va cliquer : partout
            ailleurs il double la hauteur d'un nœud pour rien. */}
        {current && (
          <p className="mt-0.5 max-w-[15rem] text-center text-[0.68rem] leading-tight text-ink-faint">
            {node.subtitle}
          </p>
        )}
      </div>

      {nextOffset !== null && <Trail from={offset} to={nextOffset} filled={done} tone={tone} />}
    </div>
  )
}

/**
 * Chemin entre deux nœuds : trois pastilles alignées vers le nœud suivant.
 * Un trait plein posé sous le libellé flottait sans relier personne ; des
 * pastilles se lisent comme des pas, et penchées vers la suite elles rendent
 * le serpentin évident. Elles grossissent légèrement en approchant du nœud
 * suivant — un soupçon de perspective — et se colorent une fois l'étape
 * franchie : le chemin se remplit derrière soi plutôt que de rester gris.
 */
function Trail({ from, to, filled, tone }: { from: number; to: number; filled: boolean; tone: Tone }) {
  return (
    <span aria-hidden className="flex flex-col items-center gap-1 py-1">
      {Array.from({ length: TRAIL_DOTS }, (_, index) => {
        const dotSize = 4 + index * 1.5
        return (
          <span
            key={index}
            className={`rounded-full ${filled ? tone.face : tone.dot}`}
            style={{
              width: dotSize,
              height: dotSize,
              transform: `translateX(${from + ((to - from) * (index + 1)) / (TRAIL_DOTS + 1)}px)`,
            }}
          />
        )
      })}
    </span>
  )
}
