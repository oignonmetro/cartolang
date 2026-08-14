import { CloseIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <CloseIcon />
}

/** Bouton « Quitter la session » d'en-tête d'exercice (22px, encre atténuée). */
export function SessionClose() {
  return <CloseIcon size={22} className="text-ink-faint" />
}
