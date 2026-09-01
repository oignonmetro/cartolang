import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { Exercise } from '@/engine/exercises'
import type { SessionOutcome } from '@/engine/progress'
import { afterAnswer, effortOf, endBuzz, NO_COMBO, type Combo } from '@/engine/combo'
import { vibrate } from '@/lib/haptics'
import { useProgress } from '@/store/progressStore'

/**
 * Le retour haptique d'une session, déjà filtré par le réglage.
 *
 * Contrairement aux sons, la série a une mémoire : elle court d'un exercice
 * à l'autre, alors que le moment où elle doit se sentir est *dans*
 * l'exercice, à la validation de la réponse — pas à l'appui sur
 * « Continuer », une ou deux secondes plus tard, où la sensation ne se
 * rattacherait plus à rien (voir `useSessionSounds`, même argument). D'où le
 * contexte : `SessionScreen` tient le compteur pour toute la session, chaque
 * exercice le déclenche au bon instant.
 *
 * Les manches d'association font exception et se signalent depuis
 * `SessionScreen` : leur dernière paire trouvée *est* la fin de la manche,
 * il n'y a pas de « Continuer » à attendre.
 */

export interface SessionHaptics {
  /** Un exercice validé : fait avancer la série, ou la rompt. */
  answered: (exercise: Exercise, correct: boolean) => void
  /** Fin de session : un seul retour, gradué par le résultat. */
  finished: (outcome: SessionOutcome) => void
}

/** Hors session, il n'y a pas de série à suivre : tout est sans effet. */
const SILENT: SessionHaptics = { answered: () => {}, finished: () => {} }

const SessionHapticsContext = createContext<SessionHaptics>(SILENT)

export const SessionHapticsProvider = SessionHapticsContext.Provider

/**
 * Le pendant visible de la série, pour le badge affiché par `ComboBadge`.
 *
 * `tier` est le palier courant, 0 hors série. `bump` n'avance qu'à la montée
 * d'un palier — jamais à la rupture, qui n'a pas plus droit à l'écran qu'à
 * la vibration (même règle que `afterAnswer`, voir `combo.ts`) — et sert de
 * clé pour rejouer l'animation à chaque nouvelle montée.
 */
export interface SessionCombo {
  tier: number
  bump: number
}

const NO_VISIBLE_COMBO: SessionCombo = { tier: 0, bump: 0 }

/**
 * Crée le suiveur de série d'une session. Appelé par `SessionScreen`, seul,
 * qui partage `haptics` aux exercices par le contexte et affiche `combo`
 * lui-même — voir `ComboBadge`.
 *
 * L'élan complet vit dans une `ref` et non dans un état : le faire
 * re-rendre la session à chaque bonne réponse coûterait un rendu complet
 * pour une donnée que rien n'affiche en continu. Seul le palier franchi,
 * rare par construction, passe par un état — c'est justement l'instant où
 * un rendu de plus ne coûte rien.
 *
 * `peakTier` suit le plus haut palier jamais atteint, indépendamment des
 * ruptures qui ramènent `combo` à zéro entre-temps : c'est ce qui permet à
 * `SessionResult` de rappeler la meilleure série une fois la session finie,
 * quand bien même elle se serait cassée sur le tout dernier exercice.
 */
export function useHaptics(): { haptics: SessionHaptics; combo: SessionCombo; peakTier: () => number } {
  const enabled = useProgress((state) => state.haptics)
  const combo = useRef<Combo>(NO_COMBO)
  const bump = useRef(0)
  const peak = useRef(0)
  const [visible, setVisible] = useState<SessionCombo>(NO_VISIBLE_COMBO)

  const haptics = useMemo<SessionHaptics>(
    () => ({
      answered: (exercise, correct) => {
        // Le compteur avance même réglage éteint : la série reste juste si
        // l'apprenant rallume les vibrations en cours de session.
        const result = afterAnswer(combo.current, effortOf(exercise), correct)
        const leveledUp = result.combo.tier > combo.current.tier
        combo.current = result.combo
        peak.current = Math.max(peak.current, result.combo.tier)
        if (enabled && result.buzz) vibrate(result.buzz)
        if (leveledUp) {
          bump.current += 1
          setVisible({ tier: result.combo.tier, bump: bump.current })
        }
      },
      finished: (outcome) => {
        combo.current = NO_COMBO
        setVisible(NO_VISIBLE_COMBO)
        const buzz = endBuzz(outcome)
        if (enabled && buzz) vibrate(buzz)
      },
    }),
    [enabled],
  )

  // Identité stable : sans elle, `SessionScreen` la verrait changer à chaque
  // rendu et son effet de clôture se redéclencherait pour rien à chaque fois
  // (sans risque — le drapeau `finished` l'empêche d'agir deux fois — mais
  // sans raison non plus).
  const peakTier = useCallback(() => peak.current, [])

  return { haptics, combo: visible, peakTier }
}

/** Le suiveur de la session en cours, pour un exercice. */
export function useSessionHaptics(): SessionHaptics {
  return useContext(SessionHapticsContext)
}
