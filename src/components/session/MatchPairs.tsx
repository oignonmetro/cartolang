import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Vocab } from '@/content/schema'
import type { MatchExercise } from '@/engine/exercises'
import { createRng, seedFrom, shuffle } from '@/engine/rng'

/**
 * Association de paires : deux colonnes, on relie chaque mot à sa traduction.
 *
 * L'exercice ne se termine que lorsque toutes les paires sont trouvées ; on
 * compte les erreurs pour noter les mots concernés.
 */

type Side = 'term' | 'translation'

interface Token {
  key: string
  vocabId: string
  label: string
  side: Side
}

export function MatchPairs({
  exercise,
  onDone,
}: {
  exercise: MatchExercise
  onDone: (result: { missedVocabIds: string[] }) => void
}) {
  const columns = useMemo(() => buildColumns(exercise), [exercise])
  const [selected, setSelected] = useState<Token | null>(null)
  const [solved, setSolved] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<string | null>(null)
  const [missed, setMissed] = useState<Set<string>>(new Set())

  function pick(token: Token) {
    if (solved.has(token.vocabId)) return

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

    if (selected.vocabId === token.vocabId) {
      const next = new Set(solved).add(token.vocabId)
      setSolved(next)
      setSelected(null)
      if (next.size === exercise.pairs.length) {
        onDone({ missedVocabIds: [...missed] })
      }
      return
    }

    setMissed((current) => new Set(current).add(selected.vocabId).add(token.vocabId))
    setWrong(token.key)
    window.setTimeout(() => setWrong(null), 350)
    setSelected(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Reliez les paires</p>

      <div className="grid flex-1 grid-cols-2 content-start gap-3">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-3">
            {column.map((token) => (
              <TokenButton
                key={token.key}
                token={token}
                solved={solved.has(token.vocabId)}
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

/**
 * Colonne gauche : les mots à apprendre. Colonne droite : les traductions,
 * mélangées indépendamment pour que les paires ne soient jamais alignées.
 */
function buildColumns(exercise: MatchExercise): [Token[], Token[]] {
  const rng = createRng(seedFrom(exercise.id))
  const terms = exercise.pairs.map((vocab) => token(vocab, 'term'))
  const translations = exercise.pairs.map((vocab) => token(vocab, 'translation'))
  return [shuffle(terms, rng), shuffle(translations, rng)]
}

function token(vocab: Vocab, side: Side): Token {
  return {
    key: `${side}:${vocab.id}`,
    vocabId: vocab.id,
    label: side === 'term' ? vocab.term : vocab.translation,
    side,
  }
}
