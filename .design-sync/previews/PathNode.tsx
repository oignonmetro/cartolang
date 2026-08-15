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
  doneBg: 'bg-teal/25',
  doneBorder: 'border-teal/55',
  doneText: 'text-teal-deep',
  faintBg: 'bg-teal/8',
  faintBorder: 'border-teal/20',
  faintText: 'text-teal/55',
  dotFill: 'fill-teal/25',
  fill: 'fill-teal',
  stroke: 'stroke-teal',
}

/**
 * Les trois états d'une leçon, tailles réelles issues de `KIND_SIZES` +
 * `STATUS_DELTA` (leçon : courante 66, franchie 58, verrouillée 54). L'étape
 * courante garde son titre et son sous-titre, la franchie devient un pavé
 * plein, la verrouillée un simple contour — c'est cette échelle qui fait lire
 * le chemin comme se pavant derrière soi.
 */
export function LessonStates() {
  return (
    <div style={{ position: 'relative', height: 130, width: 340 }}>
      <PathNode
        spot={{
          node: { id: 'l3', kind: 'lesson', lesson: null, title: 'Le present perfect', subtitle: 'Prochaine étape', status: 'available', cycle: 2 },
          x: -105, y: 44, r: 33,
        }}
        tone={teal}
        depth={0}
        onOpen={() => {}}
      />
      <PathNode
        spot={{
          node: { id: 'l2', kind: 'lesson', lesson: null, title: 'Les modaux', subtitle: '', status: 'done', cycle: 1 },
          x: 0, y: 44, r: 29,
        }}
        tone={teal}
        depth={0}
        onOpen={() => {}}
      />
      <PathNode
        spot={{
          node: { id: 'l4', kind: 'lesson', lesson: null, title: 'Le passif', subtitle: '', status: 'locked', cycle: 3 },
          x: 105, y: 44, r: 27,
        }}
        tone={teal}
        depth={1}
        onOpen={() => {}}
      />
    </div>
  )
}

/**
 * Les étapes de pratique : plus petites que les leçons — c'est la nature, et
 * non l'état, qui donne son gabarit au cercle — et nommées en marge plutôt que
 * dessous, là où le serpentin laisse la place vide.
 *
 * Les deux nœuds sont décalés en hauteur comme ils le sont toujours dans le
 * parcours : les étiquettes partent du côté où le serpentin laisse de l'air,
 * donc deux nœuds de part et d'autre de l'axe écrivent l'un vers l'autre — ce
 * n'est lisible que parce que `placePath` leur impose une descente minimale.
 */
export function StepsWithAsideLabels() {
  return (
    <div style={{ position: 'relative', height: 150, width: 340 }}>
      <PathNode
        spot={{
          node: { id: 'r0', kind: 'review', lesson: null, title: 'Révision', subtitle: '', status: 'done', cycle: 0 },
          x: -62, y: 40, r: 21,
        }}
        tone={teal}
        depth={0}
        onOpen={() => {}}
      />
      <PathNode
        spot={{
          node: { id: 'w0', kind: 'workout', lesson: null, title: 'Entraînement', subtitle: '', status: 'locked', cycle: 0 },
          x: 40, y: 104, r: 19,
        }}
        tone={teal}
        depth={2}
        onOpen={() => {}}
      />
    </div>
  )
}

/**
 * La séance finale : plus large que tout le reste, ceinte d'un anneau, et en
 * amber quelle que soit la couleur de l'unité — l'amber n'est la teinte
 * d'aucune piste, elle se lit comme une arrivée sans jamais entrer en conflit
 * avec le teal, le violet ou le sky de l'unité qu'on termine.
 */
export function FinalDestination() {
  return (
    <div style={{ position: 'relative', height: 140, width: 340 }}>
      <PathNode
        spot={{
          node: { id: 'final', kind: 'final', lesson: null, title: 'Séance finale', subtitle: "Bilan complet de l'unité", status: 'available', cycle: 3 },
          x: -80, y: 52, r: 37,
        }}
        tone={teal}
        depth={0}
        onOpen={() => {}}
      />
      <PathNode
        spot={{
          node: { id: 'final-locked', kind: 'final', lesson: null, title: 'Séance finale', subtitle: '', status: 'locked', cycle: 3 },
          x: 60, y: 52, r: 31,
        }}
        tone={teal}
        depth={6}
        onOpen={() => {}}
      />
    </div>
  )
}
