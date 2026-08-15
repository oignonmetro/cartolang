import { PathNode } from 'cartolang'

/**
 * `pathTone.ts` (`TONES`) est un fichier `.ts` pur, hors du barrel synthétisé
 * (qui ne réunit que les `.tsx`) : on ne peut pas l'importer de `'cartolang'`,
 * donc on recopie ici la teinte teal telle quelle — mêmes classes Tailwind
 * que la source, aucune divergence de rendu.
 */
const teal = {
  face: 'bg-teal',
  edge: 'var(--color-teal-deep)',
  soft: 'bg-teal/15',
  border: 'border-teal/40',
  text: 'text-teal',
  css: 'var(--color-teal)',
  faintBg: 'bg-teal/8',
  faintBorder: 'border-teal/20',
  faintText: 'text-teal/55',
  dotFill: 'fill-teal/25',
  fill: 'fill-teal',
}

/**
 * Les trois états d'un nœud, tailles réelles issues de `SIZES` dans
 * `unitPathLayout.ts` (available 66 / done 48 / locked 42). L'étape courante
 * garde son titre et son sous-titre ; l'étape franchie ne garde que son
 * titre (leçon) ; le nœud verrouillé ici est une révision — sans texte,
 * identifiée par sa seule icône, comme dans le parcours réel.
 */
export function States() {
  return (
    <div style={{ position: 'relative', height: 120, width: 320 }}>
      <PathNode
        spot={{
          node: { id: 'lesson-3', kind: 'lesson', lesson: null, title: 'Le present perfect', subtitle: 'Prochaine étape', status: 'available' },
          x: -60,
          y: 40,
          r: 33,
        }}
        tone={teal}
        onOpen={() => {}}
      />
      <PathNode
        spot={{
          node: { id: 'lesson-2', kind: 'lesson', lesson: null, title: 'Les modaux', subtitle: '', status: 'done' },
          x: 40,
          y: 40,
          r: 24,
        }}
        tone={teal}
        onOpen={() => {}}
      />
      <PathNode
        spot={{
          node: { id: 'review-1', kind: 'review', lesson: null, title: 'Révision', subtitle: '', status: 'locked' },
          x: 140,
          y: 40,
          r: 21,
        }}
        tone={teal}
        onOpen={() => {}}
      />
    </div>
  )
}
