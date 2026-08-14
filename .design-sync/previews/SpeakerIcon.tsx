import { SpeakerIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <SpeakerIcon />
}

/** Bouton d'écoute d'un mot, dans une carte de vocabulaire (22px, teal). */
export function WordCard() {
  return <SpeakerIcon size={22} className="text-teal" />
}
