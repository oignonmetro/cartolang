import type { UnitPathNode } from './unitPath'

/**
 * Géométrie du parcours d'unité.
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
export const SWING = 80
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
export const SIZES = { available: 66, done: 48, locked: 42 }

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

export interface PlacedNode {
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
export function placePath(path: readonly UnitPathNode[]): { nodes: PlacedNode[]; height: number } {
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
