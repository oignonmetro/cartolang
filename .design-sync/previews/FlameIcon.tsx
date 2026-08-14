import { FlameIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <FlameIcon />
}

/** Badge de série (streak) d'en-tête de parcours (20px, corail). */
export function StreakBadge() {
  return <FlameIcon size={20} className="text-coral" />
}

/** Tuile de statistique du profil (18px, corail). */
export function ProfileTile() {
  return <FlameIcon size={18} className="text-coral" />
}
