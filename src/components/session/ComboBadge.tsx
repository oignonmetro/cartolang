import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BoltIcon } from '@/components/icons'
import type { SessionCombo } from './useSessionHaptics'

/**
 * Ce que dit le badge à chaque palier. Trois messages, à l'image des trois
 * intensités de vibration qu'ils accompagnent — au-delà, le vocabulaire n'a
 * rien de plus fort à offrir (même plafond que `IMPACTS`, combo.ts).
 *
 * Le chiffre affiché à côté (voir plus bas, `combo.momentum`) est l'élan
 * réellement accumulé, pas un décompte de bonnes réponses consécutives :
 * l'élan pondère l'effort de chaque exercice (voir `effortOf`, combo.ts), si
 * bien qu'il peut monter de plusieurs points sur une seule réponse, ou
 * rester muet sur une présentation qui ne compte pour rien. Écrit `x5`,
 * comme un multiplicateur de jeu — plus court à lire d'un coup d'œil qu'« 5
 * pts », pour un badge qui ne reste affiché qu'un instant.
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
 * Un premier essai le centrait dans l'en-tête de `SessionScreen`, par-dessus
 * le bouton fermer et la barre de progression : ça se lisait comme un pop-up
 * cachant un vrai élément de l'écran plutôt que comme une célébration. Un
 * second essai l'a ancré en bas, comme le bandeau de mise à jour
 * (`AppUpdateBanner`) — mais là, en bas de l'écran de session, c'est le
 * bouton « Continuer » qui traîne, jamais absent bien longtemps. Posé juste
 * sous l'en-tête à la place (`position: fixed`, pas relatif à l'en-tête) :
 * il ne recouvre jamais que la consigne de l'exercice (« Choisissez la
 * traduction »…), du texte déjà lu une fois et jamais cliquable — le seul
 * endroit de l'écran où passer dessus un instant ne coûte vraiment rien.
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
    <AnimatePresence>
      {visible && tier > 0 && (
        <motion.div
          key={combo.bump}
          initial={{ opacity: 0, y: -16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          // `top-[4.75rem]` : juste sous l'en-tête (voir la remarque plus
          // haut) — mesuré sur l'écran réel, pas deviné, une valeur trop
          // courte chevaucherait l'en-tête au lieu de le suivre.
          className="pointer-events-none fixed inset-x-4 top-[4.75rem] z-20 mx-auto flex max-w-md items-center justify-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-extrabold whitespace-nowrap text-white shadow-lg"
          style={{ boxShadow: '0 4px 0 0 var(--color-coral-deep)' }}
        >
          {Array.from({ length: tier }, (_, index) => (
            <BoltIcon key={index} size={14} />
          ))}
          {MESSAGES[tier - 1]}
          <span className="opacity-80">x{combo.momentum}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
