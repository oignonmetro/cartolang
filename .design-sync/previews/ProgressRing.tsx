import { ProgressRing } from 'cartolang'

/**
 * Les trois états réels d'un anneau sur la durée de vie d'une unité : rien
 * encore rencontré, une part rencontrée mais peu acquise durablement, et
 * presque tout acquis. L'arc pâle (`seenRatio`) montre ce qui manquerait si
 * on ne comptait que l'acquis solide.
 */
export function Lifecycle() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <ProgressRing ratio={0} seenRatio={0} size={72} stroke={7} color="var(--color-teal)" />
      <ProgressRing ratio={0.2} seenRatio={0.5} size={72} stroke={7} color="var(--color-teal)" />
      <ProgressRing ratio={0.85} seenRatio={1} size={72} stroke={7} color="var(--color-teal)" />
    </div>
  )
}

/** Autre teinte d'unité (violet), pour vérifier que la couleur suit bien la prop. */
export function VioletTone() {
  return <ProgressRing ratio={0.6} seenRatio={0.8} size={72} stroke={7} color="var(--color-violet)" />
}

/**
 * Taille réelle (44), telle qu'utilisée inline dans les cartes d'unité —
 * plus petite mais toujours lisible.
 */
export function InlineSize() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProgressRing ratio={0.2} seenRatio={0.5} color="var(--color-teal)" />
      <ProgressRing ratio={0.85} seenRatio={1} color="var(--color-sky)" />
    </div>
  )
}
