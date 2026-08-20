import type { UnitNodeKind, UnitPathNode } from './unitPath'

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
 * la suit sans à-coup.
 */
function offsetOf(index: number): number {
  return Math.round(SWING * Math.sin((2 * Math.PI * index) / WAVE))
}

/**
 * Diamètre des cercles : la nature d'abord, l'état ensuite.
 *
 * La taille encodait l'état seul, si bien qu'une leçon franchie et une simple
 * révision franchie étaient deux cercles identiques — la structure du parcours
 * (une leçon, sa pratique, une leçon, sa pratique) ne se lisait qu'à l'icône.
 * Chaque nature a donc son gabarit.
 *
 * Mais l'écart doit rester une nuance, pas une hiérarchie criée : la première
 * version allait de 38 à 74 px, presque du simple au double, et le chemin
 * paraissait dépareillé — les étapes lointaines devenaient de petits pois à
 * côté des leçons. L'échelle est resserrée autour de 46-66 px. Le rythme se
 * lit encore, mais ce sont surtout l'icône et le remplissage qui distinguent
 * les natures ; la taille ne fait que les accompagner. Seule la séance finale
 * garde une avance nette : c'est une arrivée, elle a le droit de dominer.
 */
export const KIND_SIZES: Record<UnitNodeKind, number> = {
  lesson: 54,
  review: 48,
  drill: 48,
  workout: 48,
  final: 62,
}

/**
 * L'étape courante gonfle un peu, celle qu'on n'a pas atteinte se rétracte —
 * à peine. Le halo pulsé, la face pleine et l'ombre plus profonde signalent
 * déjà l'étape courante ; la taille n'a pas à refaire ce travail une
 * troisième fois.
 */
const STATUS_DELTA: Record<UnitPathNode['status'], number> = {
  available: 4,
  done: 0,
  locked: -2,
}

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
/** Air laissé sous le dernier nœud. */
const BOTTOM_SPACE = 4
/** Respiration réservée au filet qui sépare deux blocs. */
const BREAK_SPACE = 30

/**
 * Respiration sous les nœuds qui comptaient un titre, avant que les libellés
 * ne soient retirés du chemin (l'icône suffit à distinguer une étape).
 * L'espace, lui, reste réservé : c'est lui qui donne au parcours son rythme
 * aéré, indépendamment du texte qui s'y logeait.
 */
const TEXT_GAP = 12
const TITLE_SPACE = 30
const SUBTITLE_SPACE = 22
/** Portée horizontale, de part et d'autre d'un nœud, sur laquelle compter cette respiration. */
export const LABEL_HALF = 104

/**
 * Respiration sous un checkpoint, pour sa bulle de libellé (voir `PathNode`).
 * Deux lignes de texte tiennent large dedans, quel que soit le nombre de
 * lettres du groupe qu'il ouvre.
 */
const CHECKPOINT_SPACE = 44

export interface PlacedNode {
  node: UnitPathNode
  x: number
  y: number
  r: number
}

function radiusOf(node: UnitPathNode): number {
  return (KIND_SIZES[node.kind] + STATUS_DELTA[node.status]) / 2
}

/** Vrai pour les nœuds qui portaient un titre : une leçon, la séance finale, ou l'étape courante. */
export function showsTitle(node: UnitPathNode): boolean {
  return node.kind === 'lesson' || node.kind === 'final' || node.status === 'available'
}

function textSpaceUnder(node: UnitPathNode): number {
  if (node.checkpoint) return CHECKPOINT_SPACE
  const title = showsTitle(node) ? TITLE_SPACE : 0
  const subtitle = node.status === 'available' ? SUBTITLE_SPACE : 0
  return title + subtitle
}

/**
 * Descente entre deux nœuds : la plus contraignante des exigences.
 *
 * Les cercles ne doivent pas se toucher — mais écartés horizontalement, ils
 * n'ont besoin d'aucune descente pour cela, et c'est tout le gain. Reste une
 * descente minimale, pour que le chemin garde son sens.
 *
 * Un changement de bloc, lui, réclame toujours sa place : le filet qui les
 * sépare traverse toute la largeur, il ne peut donc contourner le cercle du
 * dessous.
 */
function stepBetween(a: PlacedNode, b: { node: UnitPathNode; x: number; r: number }): number {
  const dx = Math.abs(b.x - a.x)
  const text = textSpaceUnder(a.node)

  const apart = a.r + b.r + CLEARANCE
  const byCircles = Math.sqrt(Math.max(0, apart ** 2 - dx ** 2))
  const byText = text > 0 && dx < LABEL_HALF + b.r ? a.r + text + TEXT_GAP + b.r : 0
  const byBreak = a.node.cycle !== b.node.cycle ? a.r + text + BREAK_SPACE + b.r : 0

  return Math.max(MIN_STEP, byCircles, byText, byBreak)
}

/** Séparation entre deux blocs du parcours, à mi-chemin des deux cercles. */
export interface CycleBreak {
  /** Hauteur du filet dans le repère du chemin. */
  y: number
}

/**
 * Où poser les filets qui séparent les blocs.
 *
 * Entre le bas du texte du nœud précédent et le haut du cercle suivant : c'est
 * le seul intervalle libre, et le filet y respire sans jamais barrer un
 * libellé. `stepBetween` a réservé cet intervalle, il est donc toujours là.
 */
function cycleBreaks(nodes: readonly PlacedNode[]): CycleBreak[] {
  const breaks: CycleBreak[] = []
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1]!
    const current = nodes[index]!
    if (previous.node.cycle === current.node.cycle) continue

    const from = previous.y + previous.r + textSpaceUnder(previous.node)
    const to = current.y - current.r
    breaks.push({ y: (from + to) / 2 })
  }
  return breaks
}

/** Place tout le parcours et renvoie la hauteur qu'il occupe. */
export function placePath(path: readonly UnitPathNode[]): {
  nodes: PlacedNode[]
  height: number
  breaks: CycleBreak[]
} {
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
  return { nodes, height, breaks: cycleBreaks(nodes) }
}
