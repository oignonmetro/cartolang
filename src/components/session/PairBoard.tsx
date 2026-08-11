import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createRng, seedFrom, shuffle } from '@/engine/rng'

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
  const columns = useMemo(() => buildColumns(seed, pairs), [seed, pairs])
  const expected = useMemo(() => new Map(pairs.map((pair) => [pair.id, pair.right])), [pairs])

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

      <div className="grid grid-cols-2 content-start gap-3">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-3">
            {column.map((token) => (
              <TokenButton
                key={token.key}
                token={token}
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
  )
}

function TokenButton({
  token,
  solved,
  selected,
  shaking,
  onPick,
}: {
  token: Token
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
      className={`min-h-16 rounded-2xl border-2 px-3 py-3 text-center font-bold break-words transition-colors ${tone}`}
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
