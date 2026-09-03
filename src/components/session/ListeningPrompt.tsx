import { SpeakButton } from './SpeakButton'

/**
 * Énoncé purement sonore : un bouton d'écoute et l'invite à le rejouer, plus
 * l'échappatoire vers la mise en sourdine (voir `useListeningMuteStore`).
 * Reprend les mêmes trois lignes qui revenaient identiques dans
 * `ChoiceQuestion`, `TypeAnswer` et `ConjugationChoice`, chaque fois que
 * l'énoncé se prononce plutôt qu'il ne s'écrit.
 */
export function ListeningPrompt({
  text,
  size,
  onCantListen,
}: {
  text: string
  size: number
  onCantListen: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <div className="flex items-center gap-3">
        <SpeakButton text={text} auto size={size} className="shrink-0" />
        <span className="text-sm text-ink-soft">Touchez pour réécouter</span>
      </div>
      <button
        type="button"
        onClick={onCantListen}
        className="text-xs font-bold text-ink-faint underline underline-offset-2"
      >
        Je ne peux pas écouter maintenant
      </button>
    </div>
  )
}
