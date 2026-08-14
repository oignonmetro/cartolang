import { CheckIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <CheckIcon />
}

/** Coche du cours sélectionné dans le sélecteur de cours (20px, teal). */
export function Selected() {
  return <CheckIcon size={20} className="text-teal" />
}

/**
 * Nœud du parcours marqué comme terminé : blanc sur cercle plein (30px).
 * Le cercle teinté est reconstitué ici — sans lui l'icône blanche serait
 * invisible sur le fond de capture.
 */
export function Completed() {
  return (
    <div className="flex h-18 w-18 items-center justify-center rounded-full bg-teal">
      <CheckIcon size={30} className="text-white" />
    </div>
  )
}
