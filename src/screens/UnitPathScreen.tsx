import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCourse } from '@/content/CourseProvider'
import { findUnit } from '@/content/course'
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
  /** Pastille du chemin pas encore franchi, et sa version franchie. */
  dotFill: string
  fill: string
}

const TONES: Record<string, Tone> = {
  teal: {
    face: 'bg-teal', edge: 'var(--color-teal-deep)', soft: 'bg-teal/15', border: 'border-teal/40',
    text: 'text-teal', css: 'var(--color-teal)',
    faintBg: 'bg-teal/8', faintBorder: 'border-teal/20', faintText: 'text-teal/55',
    dotFill: 'fill-teal/25', fill: 'fill-teal',
  },
  violet: {
    face: 'bg-violet', edge: 'var(--color-violet-deep)', soft: 'bg-violet/15', border: 'border-violet/40',
    text: 'text-violet', css: 'var(--color-violet)',
    faintBg: 'bg-violet/8', faintBorder: 'border-violet/20', faintText: 'text-violet/55',
    dotFill: 'fill-violet/25', fill: 'fill-violet',
  },
  sky: {
    face: 'bg-sky', edge: 'var(--color-sky-deep)', soft: 'bg-sky/15', border: 'border-sky/40',
    text: 'text-sky', css: 'var(--color-sky)',
    faintBg: 'bg-sky/8', faintBorder: 'border-sky/20', faintText: 'text-sky/55',
    dotFill: 'fill-sky/25', fill: 'fill-sky',
  },
  coral: {
    face: 'bg-coral', edge: 'var(--color-coral-deep)', soft: 'bg-coral/15', border: 'border-coral/40',
    text: 'text-coral', css: 'var(--color-coral)',
    faintBg: 'bg-coral/8', faintBorder: 'border-coral/20', faintText: 'text-coral/55',
    dotFill: 'fill-coral/25', fill: 'fill-coral',
  },
  amber: {
    face: 'bg-amber', edge: 'var(--color-amber-deep)', soft: 'bg-amber/15', border: 'border-amber/40',
    text: 'text-amber', css: 'var(--color-amber)',
    faintBg: 'bg-amber/8', faintBorder: 'border-amber/20', faintText: 'text-amber/55',
    dotFill: 'fill-amber/25', fill: 'fill-amber',
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
 * Géométrie du parcours.
 *
 * Le chemin est posé en coordonnées absolues plutôt qu'empilé dans un flux
 * vertical. C'est ce qui permet de faire dépendre l'écart vertical de l'écart
 * horizontal : deux nœuds rejetés de part et d'autre de l'axe ne peuvent pas
 * se toucher, alors leur réserver la hauteur d'un cercle entier entre eux est
 * du vide pur. Empilés dans un flux, ils ne pouvaient jamais se chevaucher en
 * hauteur même quand rien ne les en empêchait — c'est là que le parcours
 * perdait le plus de place.
 */

/** Amplitude du serpentin, en pixels de part et d'autre de l'axe. */
const SWING = 80
/** Nombre de nœuds que parcourt une ondulation complète. */
const WAVE = 8

/**
 * Le chemin suit une sinusoïde plutôt qu'un aller-retour d'un bord à l'autre :
 * les nœuds voisins restent proches, la courbe se lit d'un trait, et le regard
 * la suit sans à-coup. L'amplitude est bornée par les libellés, qui doivent
 * tenir à l'écran une fois centrés sous leur cercle.
 */
function offsetOf(index: number): number {
  return Math.round(SWING * Math.sin((2 * Math.PI * index) / WAVE))
}

/**
 * Diamètre des cercles selon l'état. L'étape courante domine, le verrouillé
 * s'efface : la hiérarchie se lit à la taille avant même la couleur, et le
 * parcours à venir prend moins de place à l'écran.
 */
const SIZES = { available: 66, done: 48, locked: 42 }

/** Descente minimale entre deux nœuds : le chemin doit se lire de haut en bas. */
const MIN_STEP = 40
/**
 * Intervalle laissé entre deux bords de cercles.
 *
 * Ce n'est pas qu'une question d'air : c'est là que logent les pastilles du
 * fil. Trop serré, elles n'ont plus la place d'être dessinées et la chaîne se
 * rompt — les cercles flottent alors sans rien qui les relie, ce qui défait
 * l'idée même de parcours.
 */
const CLEARANCE = 26
/** Écart entre le bas d'un libellé et le cercle qui suit. */
const TEXT_GAP = 12
/** Hauteur réservée à un titre sous son cercle (deux lignes au plus). */
const TITLE_SPACE = 30
/** Hauteur réservée en plus au sous-titre de l'étape courante (une ligne). */
const SUBTITLE_SPACE = 22
/** Demi-largeur d'un libellé, pour savoir s'il passe au-dessus du nœud suivant. */
const LABEL_HALF = 104
/** Air laissé sous le dernier nœud. */
const BOTTOM_SPACE = 4

interface PlacedNode {
  node: UnitPathNode
  x: number
  y: number
  r: number
}

function radiusOf(node: UnitPathNode): number {
  const size = node.status === 'locked' ? SIZES.locked : node.status === 'done' ? SIZES.done : SIZES.available
  return size / 2
}

/** Hauteur que le texte d'un nœud occupe sous son cercle. */
function textSpaceUnder(node: UnitPathNode): number {
  const title = node.kind === 'lesson' || node.kind === 'final' ? TITLE_SPACE : 0
  // Le sous-titre n'apparaît que sur l'étape courante.
  const subtitle = node.status === 'available' ? SUBTITLE_SPACE : 0
  return title + subtitle
}

/**
 * Descente entre deux nœuds : la plus contraignante des trois exigences.
 *
 * Les cercles ne doivent pas se toucher — mais écartés horizontalement, ils
 * n'ont besoin d'aucune descente pour cela, et c'est tout le gain. Le libellé
 * du nœud du dessus ne réclame de la hauteur que si le nœud suivant passe
 * effectivement sous lui ; rejeté au-delà de sa demi-largeur, il n'en coûte
 * aucune. Reste une descente minimale, pour que le chemin garde son sens.
 */
function stepBetween(a: PlacedNode, b: { node: UnitPathNode; x: number; r: number }): number {
  const dx = Math.abs(b.x - a.x)
  const text = textSpaceUnder(a.node)

  const apart = a.r + b.r + CLEARANCE
  const byCircles = Math.sqrt(Math.max(0, apart ** 2 - dx ** 2))
  const byText = text > 0 && dx < LABEL_HALF + b.r ? a.r + text + TEXT_GAP + b.r : 0

  return Math.max(MIN_STEP, byCircles, byText)
}

/** Place tout le parcours et renvoie la hauteur qu'il occupe. */
function placePath(path: readonly UnitPathNode[]): { nodes: PlacedNode[]; height: number } {
  const nodes: PlacedNode[] = []
  path.forEach((node, index) => {
    const r = radiusOf(node)
    const x = offsetOf(index)
    const previous = nodes[nodes.length - 1]
    const y = previous ? previous.y + stepBetween(previous, { node, x, r }) : r
    nodes.push({ node, x, y, r })
  })
  const last = nodes[nodes.length - 1]
  const height = last ? last.y + last.r + textSpaceUnder(last.node) + BOTTOM_SPACE : 0
  return { nodes, height }
}

/** Nombre maximal de pastilles entre deux nœuds. */
const TRAIL_DOTS = 3
/** Retrait des pastilles par rapport au bord des cercles. */
const TRAIL_PAD = 6
/** Longueur qu'occupe une pastille avec son air : sert à en choisir le nombre. */
const DOT_PITCH = 13
/** Largeur du calque des pastilles : de quoi couvrir les deux extrêmes. */
const TRAIL_WIDTH = 2 * SWING + 80

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
          <Trail nodes={placed.nodes} height={placed.height} tone={tone} />
          {placed.nodes.map((spot) => (
            <PathNode key={spot.node.id} spot={spot} tone={tone} onOpen={() => open(spot.node)} />
          ))}
        </div>
      </main>
    </div>
  )
}

function PathNode({ spot, tone, onOpen }: { spot: PlacedNode; tone: Tone; onOpen: () => void }) {
  const { node, x, y, r } = spot
  const Icon = NODE_ICONS[node.kind]
  const locked = node.status === 'locked'
  const done = node.status === 'done'
  const current = node.status === 'available'
  // Le diamètre vient du placement : c'est lui qui a calculé les écarts, deux
  // sources pour la même mesure finiraient par diverger.
  const size = r * 2

  // Révision, entraînement, approfondissement reviennent plusieurs fois par
  // unité : leur nom en toutes lettres finissait par tapisser le chemin de
  // texte répété. Leur icône propre (déjà là pour chaque nature de nœud) les
  // distingue tout aussi bien. Une leçon garde son titre — c'est un nom
  // propre, pas une catégorie —, la séance finale aussi : elle n'apparaît
  // qu'une fois par unité, la répétition ne la concerne pas.
  const iconOnly = node.kind === 'review' || node.kind === 'drill' || node.kind === 'workout'

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
    // Le cercle est centré sur son point ; les libellés pendent en dessous
    // sans peser sur la position, la place qu'il leur faut ayant déjà été
    // comptée dans la descente jusqu'au nœud suivant.
    <div
      className="absolute"
      style={{ left: `calc(50% + ${x}px)`, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <div className="relative flex flex-col items-center">
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
            {/* Un nœud verrouillé affiche d'ordinaire un cadenas, quelle que
                soit sa nature : sans texte à côté, ce serait le seul indice
                qui reste, et un cadenas ne dit pas s'il s'agit d'une révision
                ou d'un entraînement. Ces nœuds gardent donc leur icône propre
                même verrouillés — atténuée par la teinte du cercle comme
                le reste. Une leçon ou la séance finale, elles, restent
                identifiées par leur nom : le cadenas peut y rester générique. */}
            {locked && !iconOnly ? (
              <LockIcon size={20} />
            ) : done ? (
              <CheckIcon size={24} />
            ) : (
              <Icon size={locked ? 20 : 30} />
            )}
          </motion.button>
        </div>

        {/* Les libellés sortent du flux : leur hauteur est déjà réservée par
            la descente calculée, et les laisser peser ici décalerait le
            cercle de son point. */}
        {(!iconOnly || current) && (
          <div className="absolute top-full left-1/2 flex w-max -translate-x-1/2 flex-col items-center pt-1">
            {!iconOnly && (
              <p
                className={`max-w-[13rem] text-center text-xs leading-tight font-extrabold ${
                  locked ? 'text-ink-faint' : current ? tone.text : 'text-ink-soft'
                }`}
              >
                {node.title}
              </p>
            )}
            {/* Le sous-titre n'a d'utilité que là où l'on va cliquer : partout
                ailleurs il double la hauteur d'un nœud pour rien. */}
            {current && (
              <p
                className={`max-w-[15rem] text-center text-[0.68rem] leading-tight text-ink-faint ${
                  iconOnly ? '' : 'mt-0.5'
                }`}
              >
                {node.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Fil du chemin : trois pastilles posées sur le segment qui joint deux
 * centres, entre les bords des deux cercles. Elles suivent donc la vraie
 * direction du parcours, aussi penchée soit-elle, grossissent en approchant
 * du nœud suivant — un soupçon de perspective — et se colorent une fois
 * l'étape franchie : le chemin se remplit derrière soi plutôt que de rester
 * gris.
 */
function Trail({ nodes, height, tone }: { nodes: readonly PlacedNode[]; height: number; tone: Tone }) {
  return (
    <svg
      aria-hidden
      width={TRAIL_WIDTH}
      height={height}
      viewBox={`${-TRAIL_WIDTH / 2} 0 ${TRAIL_WIDTH} ${height}`}
      className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
    >
      {nodes.slice(1).map((to, index) => {
        const from = nodes[index]!
        const dx = to.x - from.x
        const dy = to.y - from.y
        const span = Math.hypot(dx, dy)
        const start = from.r + TRAIL_PAD
        const end = span - to.r - TRAIL_PAD
        if (end <= start) return null

        // Le nombre de pastilles suit la place disponible. Un intervalle serré
        // en reçoit une seule plutôt que trois écrasées les unes sur les
        // autres, et le fil reste continu d'un bout à l'autre du parcours.
        const count = Math.min(TRAIL_DOTS, Math.max(1, Math.floor((end - start) / DOT_PITCH)))

        return (
          <g key={to.node.id}>
            {Array.from({ length: count }, (_, dot) => {
              const along = start + ((end - start) * (dot + 1)) / (count + 1)
              return (
                <circle
                  key={dot}
                  cx={from.x + (dx / span) * along}
                  cy={from.y + (dy / span) * along}
                  r={2 + dot * 0.75}
                  className={from.node.status === 'done' ? tone.fill : tone.dotFill}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
