import { useMemo } from 'react'
import { playSuccess, playSuccessNote } from '@/lib/sound'
import { useProgress } from '@/store/progressStore'

/**
 * Les sons de réussite d'une session, déjà filtrés par le réglage.
 *
 * Le son se déclenche au moment où la réponse est validée, dans l'exercice
 * lui-même — pas dans `SessionScreen`, qui ne l'apprend qu'à l'appui sur
 * « Continuer ». La différence s'entend : une seconde ou deux séparent le
 * retour vert de l'appui suivant, et un son qui arrive après coup ne se
 * rattache plus à rien.
 *
 * Le réglage se lit ici plutôt que dans `lib/sound.ts` : le module de son
 * reste sans dépendance à React ni au store, comme `lib/speech.ts` dont
 * `SpeakButton` lit de la même façon le réglage de prononciation.
 */
export function useSessionSounds(): {
  /** Réussite d'un exercice entier : à appeler à la validation de la réponse. */
  success: (correct: boolean) => void
  /** Réussite partielle, la `index`-ième d'un même exercice (`index` part de zéro). */
  note: (index: number) => void
} {
  const sounds = useProgress((state) => state.sounds)

  return useMemo(
    () => ({
      success: (correct) => {
        if (correct && sounds) playSuccess()
      },
      note: (index) => {
        if (sounds) playSuccessNote(index)
      },
    }),
    [sounds],
  )
}
