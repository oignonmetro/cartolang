import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BoltIcon } from '@/components/icons'
import type { SessionCombo } from './useSessionHaptics'

/**
 * Ce que dit le badge à chaque palier — jamais un nombre brut : l'élan
 * pondère l'effort de chaque exercice (voir `effortOf`, combo.ts), un
 * compteur en clair laisserait croire à un décompte de bonnes réponses
 * consécutives, ce qu'il n'est pas. Trois messages, à l'image des trois
 * intensités de vibration qu'ils accompagnent — au-delà, le vocabulaire n'a
 * rien de plus fort à offrir (même plafond que `IMPACTS`, combo.ts).
 *
 * Exportés : `SessionResult` reprend les mêmes mots pour son rappel de
 * meilleure série, plutôt que d'en inventer d'autres pour la même chose.
 */
export const COMBO_TIER_LABELS = ['En pleine lancée', 'Ça chauffe', 'Imparable'] as const
const MESSAGES = COMBO_TIER_LABELS

const VISIBLE_MS = 1400

/**
 * Le pendant visible d'un palier de série franchi : même instant, même
 * rareté que la vibration (voir `useSessionHaptics`), juste dans le canal
 * qu'on peut regarder plutôt que sentir. Ne réagit qu'aux montées — casser
 * une série n'a pas plus droit à l'écran qu'à la main, pour la même raison
 * (voir `combo.ts`).
 *
 * Rendu par `SessionScreen` à l'intérieur de son en-tête (`relative`), et
 * borné à cette seule boîte (`inset-0`, pas de débordement en dessous) :
 * il peut bien cacher un instant le bouton fermer ou la barre de
 * progression, mais jamais la consigne de l'exercice juste en dessous, qui
 * commence exactement là où l'en-tête finit.
 */
export function ComboBadge({ combo }: { combo: SessionCombo }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (combo.bump === 0) return
    setVisible(true)
    const timeout = setTimeout(() => setVisible(false), VISIBLE_MS)
    return () => clearTimeout(timeout)
  }, [combo.bump])

  const tier = Math.min(combo.tier, MESSAGES.length)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <AnimatePresence>
        {visible && tier > 0 && (
          <motion.div
            key={combo.bump}
            initial={{ opacity: 0, y: -10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-extrabold whitespace-nowrap text-white"
            style={{ boxShadow: '0 4px 0 0 var(--color-coral-deep)' }}
          >
            {Array.from({ length: tier }, (_, index) => (
              <BoltIcon key={index} size={14} />
            ))}
            {MESSAGES[tier - 1]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
