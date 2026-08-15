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
  faintBg: 'bg-violet/8',
  faintBorder: 'border-violet/20',
  faintText: 'text-violet/55',
  dotFill: 'fill-violet/25',
  fill: 'fill-violet',
}

const nodes = [
  { node: { id: 'n1', kind: 'lesson' as const, lesson: null, title: 'Le conditionnel', subtitle: '', status: 'done' as const }, x: -60, y: 40, r: 24 },
  { node: { id: 'n2', kind: 'review' as const, lesson: null, title: 'Révision', subtitle: '', status: 'done' as const }, x: 40, y: 150, r: 21 },
  { node: { id: 'n3', kind: 'lesson' as const, lesson: null, title: 'Le passif', subtitle: 'Prochaine étape', status: 'available' as const }, x: -20, y: 270, r: 33 },
]

/**
 * Serpentin sur trois nœuds (amplitude ±60/40/-20 px, proche de SWING=80
 * dans `unitPathLayout.ts`), deux segments franchis (pastilles pleines,
 * `tone.fill`) menant à l'étape courante — le fil montre ainsi les deux
 * états de pastille dans un même écran. Les cercles des nœuds sont
 * superposés au fil, comme dans `UnitPathScreen` où `PathTrail` est un
 * calque sous les `PathNode`.
 */
export function Serpentine() {
  return (
    <div style={{ position: 'relative', height: 320, width: 320 }}>
      <PathTrail nodes={nodes} height={320} tone={violet} />
      {nodes.map((spot) => (
        <PathNode key={spot.node.id} spot={spot} tone={violet} onOpen={() => {}} />
      ))}
    </div>
  )
}
