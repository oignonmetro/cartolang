import { ChevronLeftIcon } from 'cartolang'

/** Taille par défaut (24px). */
export function Default() {
  return <ChevronLeftIcon />
}

/** Flèche « Retour » d'en-tête d'écran (24px, encre atténuée). */
export function BackButton() {
  return <ChevronLeftIcon size={24} className="text-ink-faint" />
}

/** Chevron pivoté servant de bascule « replier » la liste des chapitres (14px). */
export function ChapterToggle() {
  return <ChevronLeftIcon size={14} className="-rotate-90 text-ink-faint" />
}
