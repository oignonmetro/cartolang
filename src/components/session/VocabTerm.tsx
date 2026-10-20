import type { Vocab } from '@/content/schema'

/**
 * Le terme d'une carte, tel qu'il s'affiche : son dessin quand il en a un
 * (`figure`), son texte sinon.
 *
 * Un signe de correction d'épreuve ne s'écrit pas, il se trace : la carte
 * porte alors un SVG, et `term` n'en est plus que la description, lue par les
 * lecteurs d'écran. Le dessin vient du contenu du cours, versionné et validé
 * comme lui (voir `checkFigure` dans tools/content/build.ts).
 */
export function VocabTerm({ vocab, className = 'w-48' }: { vocab: Vocab; className?: string }) {
  if (!vocab.figure) return <>{vocab.term}</>
  return <Figure svg={vocab.figure} label={vocab.term} className={className} />
}

export function Figure({ svg, label, className = 'w-48' }: { svg: string; label: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-block max-w-full align-middle font-normal [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
