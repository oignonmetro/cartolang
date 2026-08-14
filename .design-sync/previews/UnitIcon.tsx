import { UnitIcon } from 'cartolang'

/** Taille par défaut (24px), icône « compass » (unité B1 « Voyages »). */
export function Default() {
  return <UnitIcon name="compass" />
}

/** En-tête d'écran de parcours d'unité (32px), icône « people ». */
export function UnitHeader() {
  return <UnitIcon name="people" size={32} />
}

/** Liste des parcours dans la bibliothèque (18px), icône « wave ». */
export function TrackList() {
  return <UnitIcon name="wave" size={18} />
}
