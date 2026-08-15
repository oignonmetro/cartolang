import { PathTrail, PathNode } from 'cartolang'

/**
 * `pathTone.ts` (`TONES`) n'entre pas dans le barrel synthétisé (fichier
 * `.ts` pur) : la teinte violet est recopiée ici à l'identique.
 */
const violet = {
  face: 'bg-violet',
  edge: 'var(--color-violet-deep)',
  soft: 'bg-violet/15',
  border: 'border-violet/40',
  text: 'text-violet',
  css: 'var(--color-violet)',
  doneBg: 'bg-violet/25',
  doneBorder: 'border-violet/55',
  doneText: 'text-violet-deep',
  faintBg: 'bg-violet/8',
  faintBorder: 'border-violet/20',
  faintText: 'text-violet/55',
  dotFill: 'fill-violet/25',
  fill: 'fill-violet',
  stroke: 'stroke-violet',
}

const nodes = [
  { node: { id: 'n1', kind: 'lesson' as const, lesson: null, title: 'Le conditionnel', subtitle: '', status: 'done' as const, cycle: 0 }, x: -60, y: 40, r: 29 },
  { node: { id: 'n2', kind: 'review' as const, lesson: null, title: 'Révision', subtitle: '', status: 'done' as const, cycle: 0 }, x: 46, y: 148, r: 21 },
  { node: { id: 'n3', kind: 'lesson' as const, lesson: null, title: 'Le passif', subtitle: 'Prochaine étape', status: 'available' as const, cycle: 1 }, x: -20, y: 262, r: 33 },
  { node: { id: 'n4', kind: 'workout' as const, lesson: null, title: 'Entraînement', subtitle: '', status: 'locked' as const, cycle: 1 }, x: 58, y: 366, r: 19 },
]

/**
 * Serpentin sur quatre nœuds, qui montre les deux régimes du fil dans un même
 * écran : trait plein derrière l'apprenant (segments partant d'une étape
 * franchie), pastilles espacées devant lui. Les deux se rejoignent exactement
 * sur l'étape courante, si bien qu'on voit d'un coup d'œil jusqu'où l'on est
 * allé. Les cercles sont superposés au fil, comme dans `UnitPathScreen` où
 * `PathTrail` est un calque sous les `PathNode`.
 */
export function Serpentine() {
  return (
    <div style={{ position: 'relative', height: 410, width: 320 }}>
      <PathTrail nodes={nodes} height={410} tone={violet} />
      {nodes.map((spot, index) => (
        <PathNode
          key={spot.node.id}
          spot={spot}
          tone={violet}
          depth={Math.max(0, index - 2)}
          onOpen={() => {}}
        />
      ))}
    </div>
  )
}
