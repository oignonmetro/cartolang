import { ChestIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <ChestIcon />
}

/**
 * Nœud « coffre » du parcours : blanc sur pastille amber arrondie (30px).
 * Le fond réel est reconstitué — sans lui l'icône blanche serait invisible.
 */
export function Reward() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber">
      <ChestIcon size={30} className="text-white" />
    </div>
  )
}
