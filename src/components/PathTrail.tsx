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
 * Fil du chemin : jusqu'à trois pastilles posées sur le segment qui joint
 * deux centres, entre les bords des deux cercles. Elles suivent donc la vraie
 * direction du parcours, aussi penchée soit-elle, grossissent en approchant
 * du nœud suivant — un soupçon de perspective — et se colorent une fois
 * l'étape franchie : le chemin se remplit derrière soi plutôt que de rester
 * gris. Leur nombre suit la place disponible entre les deux cercles : un
 * intervalle serré en reçoit une seule plutôt que trois écrasées les unes sur
 * les autres, pour que le fil reste continu d'un bout à l'autre du parcours.
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
