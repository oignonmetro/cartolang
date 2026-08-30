import { describe, expect, it } from 'vitest'
import type { UnitNodeKind, UnitNodeStatus, UnitPathNode } from './unitPath'
import { KIND_SIZES, placePath } from './unitPathLayout'

function node(
  kind: UnitNodeKind,
  status: UnitNodeStatus,
  cycle: number,
  id = `${kind}-${cycle}-${status}`,
): UnitPathNode {
  return {
    id,
    kind,
    lesson: null,
    title: kind,
    subtitle: 'sous-titre',
    status,
    cycle,
    checkpoint: false,
    checkpointLabel: null,
  }
}

/** Un bloc complet : une leçon, sa révision, sa consolidation. */
function block(cycle: number, status: UnitNodeStatus): UnitPathNode[] {
  return [node('lesson', status, cycle), node('review', status, cycle), node('workout', status, cycle)]
}

describe('gabarit des cercles', () => {
  it('donne à chaque nature sa taille, indépendamment de l’état', () => {
    // C'est le rythme du parcours — un grand, deux petits — qui doit se lire de
    // loin : une leçon franchie ne doit pas se confondre avec une révision
    // franchie sous prétexte qu'elles partagent le même état.
    const lesson = placePath([node('lesson', 'done', 0)]).nodes[0]!
    const review = placePath([node('review', 'done', 0)]).nodes[0]!
    expect(lesson.r).toBeGreaterThan(review.r)
    expect(lesson.r * 2).toBe(KIND_SIZES.lesson)
  })

  it('fait de la séance finale le plus large cercle du parcours', () => {
    expect(KIND_SIZES.final).toBeGreaterThan(KIND_SIZES.lesson)
    expect(KIND_SIZES.lesson).toBeGreaterThan(KIND_SIZES.review)
  })

  it('gonfle l’étape courante et rétracte ce qui n’est pas atteint', () => {
    const [current, done, locked] = [
      placePath([node('lesson', 'available', 0)]).nodes[0]!,
      placePath([node('lesson', 'done', 0)]).nodes[0]!,
      placePath([node('lesson', 'locked', 0)]).nodes[0]!,
    ]
    expect(current.r).toBeGreaterThan(done.r)
    expect(done.r).toBeGreaterThan(locked.r)
  })
})

describe('séparation des blocs', () => {
  it('pose un filet à chaque changement de bloc, et un seul', () => {
    const path = [...block(0, 'done'), ...block(1, 'locked'), node('final', 'locked', 2)]
    expect(placePath(path).breaks).toHaveLength(2)
  })

  it('les pose quel que soit l’avancement', () => {
    // La structure du parcours ne doit pas changer de lisibilité au fil de la
    // progression, quel que soit le statut de l'étape courante du bloc.
    const path = [
      ...block(0, 'done'),
      node('lesson', 'available', 1),
      node('review', 'locked', 1),
      node('workout', 'locked', 1),
      node('final', 'locked', 2),
    ]
    expect(placePath(path).breaks).toHaveLength(2)
  })

  it('pose le filet à mi-chemin entre le cercle du dessus et celui du dessous', () => {
    const path = [...block(0, 'done'), node('lesson', 'available', 1)]
    const { nodes, breaks } = placePath(path)
    const previous = nodes[2]!
    const next = nodes[3]!
    expect(breaks[0]!.y).toBeGreaterThan(previous.y + previous.r)
    expect(breaks[0]!.y).toBeLessThan(next.y - next.r)
  })

  it('n’en pose aucun dans un bloc unique', () => {
    expect(placePath(block(0, 'locked')).breaks).toHaveLength(0)
  })
})
