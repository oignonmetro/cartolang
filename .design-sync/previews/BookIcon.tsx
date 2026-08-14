import { BookIcon } from 'cartolang'

/** Taille par défaut (24px), telle qu'employée inline dans le texte. */
export function Default() {
  return <BookIcon />
}

/**
 * Icône de nœud « leçon » du parcours : blanche sur cercle plein (30px).
 * Le cercle teinté est reconstitué ici — sans lui l'icône blanche serait
 * invisible sur le fond de capture, alors qu'en application elle repose
 * toujours sur ce disque coloré.
 */
export function LessonNode() {
  return (
    <div className="flex h-18 w-18 items-center justify-center rounded-full bg-teal">
      <BookIcon size={30} className="text-white" />
    </div>
  )
}
