import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { learningLanguage } from '@/lib/speech'
import { divergenceAt } from './ExpectedAnswer'

/**
 * Réponse attendue, avec en dessous une invite à recopier la partie fautive
 * — recopier grave mieux que lire, mais ce n'est plus un test : la réponse
 * reste affichée pendant qu'on la retape.
 *
 * Une première version cachait la partie manquante et la faisait deviner :
 * sur un mot que l'apprenant ne connaît simplement pas du tout (`typed` sans
 * aucun rapport avec `expected`), le trou couvrait le mot entier et devenait
 * un pur devinage à l'aveugle, sans la moindre information pour s'en sortir
 * — exactement ce qu'un exercice de correction ne doit jamais être : on ne
 * peut pas corriger ce qu'on n'a jamais su. La réponse s'affiche donc
 * maintenant toujours, et recopier n'est plus qu'un renfort optionnel —
 * « Je ne sais pas » saute la copie sans pénalité pour qui n'en voit pas
 * l'intérêt.
 *
 * Reprend le même découpage préfixe/reste qu'`ExpectedAnswer`
 * (`divergenceAt`), qu'il remplace après une mauvaise réponse.
 */
export function CorrectionGap({
  typed,
  expected,
  onResolved,
}: {
  typed: string
  expected: string
  onResolved: () => void
}) {
  const at = divergenceAt(typed, expected)
  const prefix = expected.slice(0, at)
  const hole = expected.slice(at)
  const [value, setValue] = useState('')
  const [resolved, setResolved] = useState(false)
  const [shake, setShake] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  useEffect(() => {
    if (resolved || value.length < hole.length) return
    if (value.trim().toLowerCase() === hole.toLowerCase()) {
      setResolved(true)
      onResolved()
      return
    }
    // Une coquille en recopiant, pas une mauvaise réponse : la cible reste
    // affichée juste au-dessus, on rejoue simplement l'essai.
    setShake(true)
    const timeout = window.setTimeout(() => {
      setValue('')
      setShake(false)
      input.current?.focus()
    }, 350)
    return () => window.clearTimeout(timeout)
    // Ne dépend que de la frappe : `hole`/`resolved` sont lus à jour dans le
    // corps de l'effet, les y ajouter ne changerait que le moment où l'effet
    // se relance, jamais ce qu'il compare.
  }, [value])

  function skip() {
    setValue(hole)
    setResolved(true)
    onResolved()
  }

  const width = Math.max(hole.length, 1)

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-bold">La réponse attendue :</p>
        <span className="text-2xl font-black">
          {prefix}
          <span className="underline decoration-2 underline-offset-4">{hole}</span>
        </span>
      </div>

      {resolved ? (
        <p className="text-sm font-bold text-success">Recopiée, bien joué.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-bold">Réécrivez-la :</span>
          <motion.input
            ref={input}
            value={value}
            onChange={(event) => setValue(event.target.value.slice(0, hole.length))}
            animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.35 }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            lang={learningLanguage()}
            aria-label="Recopier la partie manquante"
            style={{ width: `${width}ch` }}
            className="border-b-4 border-ink-faint bg-transparent text-center text-lg font-black outline-none focus:border-teal"
          />
          <button
            type="button"
            onClick={skip}
            className="text-xs font-bold text-ink-faint underline underline-offset-2"
          >
            Je ne sais pas
          </button>
        </div>
      )}
    </div>
  )
}
