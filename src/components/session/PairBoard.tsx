import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createRng, seedFrom, shuffle } from '@/engine/rng'
import { useSessionSounds } from './useSessionSounds'

/**
 * Plateau d'association générique : deux colonnes de jetons à relier.
 *
 * Le vocabulaire l'utilise pour relier mots et traductions, la conjugaison
 * pour relier personnes et formes. Seuls les libellés changent — la mécanique
 * (sélection, validation, comptage des erreurs) est la même.
 */

export interface Pair {
  /** Identifiant de l'élément noté par la révision espacée. */
  id: string
  left: string
  right: string
}

type Side = 'left' | 'right'

interface Token {
  key: string
  pairId: string
  label: string
  side: Side
}

/**
 * Espace pris par tout ce qui n'est pas la grille : l'en-tête de session, la
 * consigne au-dessus, les espacements qui les séparent — et, quand
 * `ConjugationMatch` mélange plusieurs verbes, sa carte de rappel (verbes et
 * temps) au-dessus de la consigne, le plus grand des chromes possibles.
 * Mesuré sur l'écran réel plutôt que deviné — un budget trop court ferait
 * déborder la grille. Trop long ne coûte rien pour les cas plus légers : la
 * plupart des tailles de grille sont déjà plafonnées par `maxCard` avant
 * d'atteindre cette limite, donc le surplus de budget ne les rétrécit pas.
 */
const CHROME_BUDGET = 250
/** `gap-3` entre deux jetons d'une même colonne, en pixels. */
const ROW_GAP = 12

/**
 * Remplissage et taille de texte d'un jeton, selon la densité de la grille.
 *
 * Le plancher de `cardHeight` ne sert à rien si le remplissage à lui seul
 * dépasse déjà cette taille : un `py-4` et un `text-lg` pensés pour quatre
 * paires imposent une soixantaine de pixels même quand la grille en réclame
 * moins. Passé quatre paires, remplissage et texte se resserrent avec la
 * grille plutôt que de la forcer à déborder derrière eux.
 */
interface Density {
  minCard: number
  maxCard: number
  className: string
}

const COMFORTABLE: Density = { minCard: 56, maxCard: 80, className: 'px-3 py-4 text-lg' }
const COMPACT: Density = { minCard: 40, maxCard: 64, className: 'px-2 py-2 text-sm' }

function densityFor(rows: number): Density {
  return rows > 4 ? COMPACT : COMFORTABLE
}

/**
 * Hauteur des jetons, plafonnée par la densité et adaptée au nombre de
 * paires.
 *
 * Une taille fixe convenait à quatre paires mais débordait à six : la moitié
 * verticale de l'écran change d'un appareil à l'autre (barre d'adresse
 * repliée ou non, encoche…), ce qu'aucune constante ne peut anticiper. `dvh`
 * suit la hauteur réellement visible, et la division par le nombre de lignes
 * garantit que la grille tient toujours, quel que soit le nombre de paires —
 * plutôt que de compter sur le défilement de secours (`SessionScreen`) pour
 * un cas qui devrait simplement s'ajuster.
 */
function cardHeight(rows: number, density: Density): string {
  const available = `(100dvh - ${CHROME_BUDGET}px - ${ROW_GAP * (rows - 1)}px) / ${rows}`
  return `clamp(${density.minCard}px, calc(${available}), ${density.maxCard}px)`
}

export function PairBoard({
  seed,
  pairs,
  prompt,
  onDone,
}: {
  /** Graine du mélange : la même manche se présente toujours pareil. */
  seed: string
  pairs: readonly Pair[]
  prompt: string
  onDone: (result: { missedIds: string[] }) => void
}) {
  const sounds = useSessionSounds()
  const columns = useMemo(() => buildColumns(seed, pairs), [seed, pairs])
  const expected = useMemo(() => new Map(pairs.map((pair) => [pair.id, pair.right])), [pairs])
  const density = densityFor(pairs.length)
  const height = cardHeight(pairs.length, density)

  const [selected, setSelected] = useState<Token | null>(null)
  // Deux ensembles distincts : les jetons consommés (pour l'affichage) et les
  // paires résolues (pour la fin de manche). Ils divergent quand deux paires
  // partagent le même libellé — « sought » est à la fois prétérit et participe.
  const [solvedKeys, setSolvedKeys] = useState<Set<string>>(new Set())
  const [solvedPairs, setSolvedPairs] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<string | null>(null)
  const [missed, setMissed] = useState<Set<string>>(new Set())

  function pick(token: Token) {
    if (solvedKeys.has(token.key)) return

    if (!selected) {
      setSelected(token)
      return
    }

    if (selected.key === token.key) {
      setSelected(null)
      return
    }

    // Deux jetons du même côté : on déplace simplement la sélection.
    if (selected.side === token.side) {
      setSelected(token)
      return
    }

    const [left, right] = selected.side === 'left' ? [selected, token] : [token, selected]

    // On compare les libellés, pas les identifiants : quand deux formes sont
    // homographes, choisir l'un ou l'autre jeton est également correct.
    if (expected.get(left.pairId) === right.label) {
      setSolvedKeys((current) => new Set(current).add(left.key).add(right.key))
      const nextPairs = new Set(solvedPairs).add(left.pairId)
      setSolvedPairs(nextPairs)
      setSelected(null)
      // Chaque paire monte d'un degré de l'accord : la manche s'entend se
      // remplir, et la dernière paire arrive en haut. C'est ce que le score
      // final ne dit pas — qu'on progresse, pendant qu'on progresse.
      sounds.note(nextPairs.size - 1)
      if (nextPairs.size === pairs.length) onDone({ missedIds: [...missed] })
      return
    }

    setMissed((current) => new Set(current).add(left.pairId).add(right.pairId))
    setWrong(token.key)
    window.setTimeout(() => setWrong(null), 350)
    setSelected(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">{prompt}</p>

      {/* La grille se centre dans l'espace disponible plutôt que de s'aligner
          en haut : avec quatre paires, elle ne remplissait qu'un quart de
          l'écran et laissait le reste vide, comme une carte oubliée là. */}
      <div className="flex flex-1 flex-col justify-center">
        <div className="grid grid-cols-2 gap-3">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="flex flex-col gap-3">
              {column.map((token) => (
                <TokenButton
                  key={token.key}
                  token={token}
                  height={height}
                  density={density.className}
                  solved={solvedKeys.has(token.key)}
                  selected={selected?.key === token.key}
                  shaking={wrong === token.key}
                  onPick={pick}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TokenButton({
  token,
  height,
  density,
  solved,
  selected,
  shaking,
  onPick,
}: {
  token: Token
  /** Hauteur calculée par `cardHeight`, en `min-height` CSS. */
  height: string
  /** Classes de remplissage et de texte de `densityFor`. */
  density: string
  solved: boolean
  selected: boolean
  shaking: boolean
  onPick: (token: Token) => void
}) {
  const tone = solved
    ? 'border-success bg-success/15 text-success opacity-60'
    : selected
      ? 'border-teal bg-teal/15 text-teal'
      : 'border-line bg-paper text-ink'

  return (
    <motion.button
      type="button"
      onClick={() => onPick(token)}
      disabled={solved}
      animate={shaking ? { x: [0, -7, 7, -4, 0] } : { x: 0 }}
      transition={{ duration: 0.3 }}
      style={{ minHeight: height }}
      className={`rounded-2xl border-2 text-center font-bold break-words transition-colors ${density} ${tone}`}
    >
      {token.label}
    </motion.button>
  )
}

/** Les deux colonnes sont mélangées indépendamment : jamais de paire alignée. */
function buildColumns(seed: string, pairs: readonly Pair[]): [Token[], Token[]] {
  const rng = createRng(seedFrom(seed))
  const left = pairs.map((pair) => ({ key: `left:${pair.id}`, pairId: pair.id, label: pair.left, side: 'left' as const }))
  const right = pairs.map((pair) => ({
    key: `right:${pair.id}`,
    pairId: pair.id,
    label: pair.right,
    side: 'right' as const,
  }))
  return [shuffle(left, rng), shuffle(right, rng)]
}
