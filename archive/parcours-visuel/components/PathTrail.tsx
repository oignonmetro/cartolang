import { SWING, type PlacedNode } from '@/engine/unitPathLayout'
import type { Tone } from './pathTone'

/** Nombre maximal de pastilles entre deux nœuds. */
const TRAIL_DOTS = 3
/** Retrait des pastilles par rapport au bord des cercles. */
const TRAIL_PAD = 6
/** Longueur qu'occupe une pastille avec son air : sert à en choisir le nombre. */
const DOT_PITCH = 13
/** Largeur du calque des pastilles : de quoi couvrir les deux extrêmes. */
const TRAIL_WIDTH = 2 * SWING + 80

/**
 * Fil du chemin, entre les bords de deux cercles successifs.
 *
 * Derrière soi, un trait plein : le chemin est tracé, il ne se discute plus.
 * Devant, des pastilles espacées qui grossissent en approchant du nœud suivant
 * — un soupçon de perspective, et une invitation à avancer plutôt qu'une
 * chaîne déjà posée. Les deux se rejoignent exactement sur l'étape courante,
 * si bien qu'on voit d'un coup d'œil jusqu'où l'on est allé. Leur nombre suit
 * la place disponible entre les deux cercles : un intervalle serré en reçoit
 * une seule plutôt que trois écrasées les unes sur les autres.
 */
export function PathTrail({ nodes, height, tone }: { nodes: readonly PlacedNode[]; height: number; tone: Tone }) {
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

        const point = (along: number) => ({
          x: from.x + (dx / span) * along,
          y: from.y + (dy / span) * along,
        })

        if (from.node.status === 'done') {
          const a = point(start)
          const b = point(end)
          return (
            <line
              key={to.node.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={5}
              strokeLinecap="round"
              className={tone.stroke}
            />
          )
        }

        const count = Math.min(TRAIL_DOTS, Math.max(1, Math.floor((end - start) / DOT_PITCH)))

        return (
          <g key={to.node.id}>
            {Array.from({ length: count }, (_, dot) => {
              const at = point(start + ((end - start) * (dot + 1)) / (count + 1))
              return <circle key={dot} cx={at.x} cy={at.y} r={2 + dot * 0.75} className={tone.dotFill} />
            })}
          </g>
        )
      })}
    </svg>
  )
}
