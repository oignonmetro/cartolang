import { StarIcon } from 'cartolang'

/** Taille par défaut (24px), non remplie. */
export function Default() {
  return <StarIcon />
}

/** Étoile de notation d'unité remplie, telle qu'affichée sur le parcours (24px, amber). */
export function Filled() {
  return <StarIcon filled size={24} className="text-amber" />
}

/** Étoile de notation non acquise, même contexte (24px, amber). */
export function Empty() {
  return <StarIcon size={24} className="text-amber" />
}
