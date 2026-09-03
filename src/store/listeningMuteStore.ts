import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Mise en sourdine temporaire des exercices d'écoute.
 *
 * Certains moments — transport en commun, salle d'attente — interdisent
 * d'écouter sans casque : plutôt que de forcer une devinette à l'aveugle sur
 * un exercice qui ne se joue qu'à l'oreille (voir `isListeningExercise`), on
 * laisse l'apprenant les couper pour un temps court plutôt que de quitter la
 * session. Vingt minutes, à peu près la durée d'une séance : au-delà,
 * l'appareil est probablement resté silencieux par choix plutôt que par gêne
 * passagère, et il vaut mieux que la piste s'en aperçoive à la séance
 * suivante plutôt que de rester coupée indéfiniment sans rien qui le rappelle.
 *
 * Persisté (et pas un simple état en mémoire) pour survivre à un changement
 * d'écran ou un rechargement pendant la fenêtre des vingt minutes — couper
 * l'écoute puis perdre ce choix au moindre aller-retour serait plus agaçant
 * que de ne pas l'avoir proposé. Volontairement à part de `progressStore` :
 * ce n'est pas un réglage ni un progrès, juste une minuterie locale à
 * l'appareil, qui n'a rien à faire dans un export/import de sauvegarde.
 */
const MUTE_MINUTES = 20

interface ListeningMuteState {
  mutedUntil: number | null
  muteListening: () => void
}

export const useListeningMuteStore = create<ListeningMuteState>()(
  persist(
    (set) => ({
      mutedUntil: null,
      muteListening: () => set({ mutedUntil: Date.now() + MUTE_MINUTES * 60_000 }),
    }),
    { name: 'cartolang.listening-mute.v1' },
  ),
)

/** L'écoute est-elle actuellement coupée ? */
export function isListeningMuted(mutedUntil: number | null): boolean {
  return mutedUntil !== null && Date.now() < mutedUntil
}
