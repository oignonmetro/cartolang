import { Button, SpeakButton } from 'cartolang'

/**
 * Bouton d'écoute isolé, taille par défaut. Le composant rend `null` quand
 * la synthèse vocale n'est pas disponible (`canSpeak`) — une capture vide
 * ici reflète honnêtement cet état de repli, pas un défaut de preview.
 */
export function Default() {
  return <SpeakButton text="to argue" />
}

/**
 * Usage inline tel qu'il apparaît après correction dans `ChoiceQuestion` et
 * `ClozeSentence` : à côté d'un bouton pleine largeur.
 */
export function InlineWithButton() {
  return (
    <div className="flex items-center gap-3">
      <SpeakButton text="to argue" className="shrink-0" />
      <Button block>Continuer</Button>
    </div>
  )
}
