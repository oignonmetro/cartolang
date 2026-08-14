import { BoltIcon } from 'cartolang'

/** Taille par défaut (24px), utilisée dans les libellés de bouton et listes. */
export function Default() {
  return <BoltIcon />
}

/** Taille réduite, telle qu'employée dans les badges de série (streak). */
export function Small() {
  return <BoltIcon size={16} className="text-amber" />
}

/** Grande taille, telle qu'employée dans les nœuds « Approfondissement » du parcours. */
export function Large() {
  return <BoltIcon size={30} className="text-teal" />
}
