import { LockIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <LockIcon />
}

/** Nœud verrouillé du parcours d'unité (20px, encre atténuée). */
export function LockedNode() {
  return <LockIcon size={20} className="text-ink-faint" />
}

/** Nœud d'unité verrouillé sur la carte du parcours (26px, encre atténuée). */
export function LockedUnit() {
  return <LockIcon size={26} className="text-ink-faint" />
}
