import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { learningLanguage } from '@/lib/speech'
import { divergenceAt } from './ExpectedAnswer'

/** Essais tolérés sur le trou avant de révéler la réponse. */
const MAX_ATTEMPTS = 2

/**
 * Trou de correction : la partie fautive d'une réponse d'un seul mot devient
 * un champ à remplir plutôt qu'un texte à lire — corriger activement grave
 * mieux qu'observer la différence. Reprend le même découpage préfixe/reste
 * qu'`ExpectedAnswer` (`divergenceAt`), qu'il remplace après une mauvaise
 * réponse : à la place de « la réponse attendue était… », l'apprenant écrit
 * lui-même ce qu'il a manqué.
 *
 * Toujours un trou, même quand rien ne coïncide (`typed` sans rapport avec
 * `expected`) : le trou couvre alors le mot entier, ce qui revient à le
 * retaper — cohérent plutôt que de retomber sur un autre affichage.
 *
 * Deux essais ratés sur le trou révèlent la réponse et débloquent la suite :
 * jamais de piège sur une terminaison que l'apprenant ne connaît simplement
 * pas encore.
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
  const [attempts, setAttempts] = useState(0)
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
    // Le dernier essai révèle plutôt que de reboucler indéfiniment sur une
    // terminaison que l'apprenant ne connaît tout simplement pas encore.
    if (attempts + 1 >= MAX_ATTEMPTS) {
      setValue(hole)
      setResolved(true)
      onResolved()
      return
    }
    setAttempts((count) => count + 1)
    setShake(true)
    const timeout = window.setTimeout(() => {
      setValue('')
      setShake(false)
      input.current?.focus()
    }, 350)
    return () => window.clearTimeout(timeout)
    // Ne dépend que de la frappe : `hole`/`attempts`/`resolved` sont lus à
    // jour dans le corps de l'effet, les y ajouter ne changerait que le
    // moment où l'effet se relance, jamais ce qu'il compare.
  }, [value])

  const width = Math.max(hole.length, 1)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-bold">Complétez la réponse :</p>
      <motion.span
        animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : {}}
        transition={{ duration: 0.35 }}
        className="text-2xl font-black"
      >
        {prefix}
        <input
          ref={input}
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, hole.length))}
          disabled={resolved}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          lang={learningLanguage()}
          aria-label="Partie manquante"
          style={{ width: `${width}ch` }}
          className={`mx-0.5 border-b-4 bg-transparent text-center outline-none disabled:opacity-100 ${
            resolved
              ? attempts >= MAX_ATTEMPTS
                ? 'border-error text-error'
                : 'border-success text-success'
              : 'border-ink-faint'
          }`}
        />
      </motion.span>
    </div>
  )
}
