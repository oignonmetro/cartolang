import { RefreshIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <RefreshIcon />
}

/**
 * Nœud « révision » du parcours : blanc sur cercle plein (30px).
 * Le fond réel est reconstitué — sans lui l'icône blanche serait invisible.
 */
export function ReviewNode() {
  return (
    <div className="flex h-18 w-18 items-center justify-center rounded-full bg-sky">
      <RefreshIcon size={30} className="text-white" />
    </div>
  )
}

/** Bandeau « mise à jour disponible » du profil (20px, teal). */
export function UpdateCard() {
  return <RefreshIcon size={20} className="text-teal" />
}
