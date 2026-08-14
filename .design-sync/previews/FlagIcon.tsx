import { FlagIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <FlagIcon />
}

/**
 * Nœud « séance finale » du parcours : blanc sur cercle plein (30px).
 * Le fond réel est reconstitué — sans lui l'icône blanche serait invisible.
 */
export function FinalNode() {
  return (
    <div className="flex h-18 w-18 items-center justify-center rounded-full bg-violet">
      <FlagIcon size={30} className="text-white" />
    </div>
  )
}
