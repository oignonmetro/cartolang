/**
 * Teintes du parcours d'unité.
 *
 * Une unité porte une seule couleur ; ce module en décline toutes les nuances
 * dont `PathNode` et `PathTrail` ont besoin — face pleine, bordure et fond
 * à peine posés pour le verrouillé, remplissage des pastilles — pour que les
 * deux composants restent de purs consommateurs de la teinte, jamais de
 * classes Tailwind écrites en dur.
 */
export interface Tone {
  face: string
  edge: string
  soft: string
  border: string
  text: string
  css: string
  /** Teinte à peine posée : le verrouillé reste coloré, pas juste gris éteint. */
  faintBg: string
  faintBorder: string
  faintText: string
  /** Pastille du chemin pas encore franchi, et sa version franchie. */
  dotFill: string
  fill: string
}

export const TONES: Record<string, Tone> = {
  teal: {
    face: 'bg-teal', edge: 'var(--color-teal-deep)', soft: 'bg-teal/15', border: 'border-teal/40',
    text: 'text-teal', css: 'var(--color-teal)',
    faintBg: 'bg-teal/8', faintBorder: 'border-teal/20', faintText: 'text-teal/55',
    dotFill: 'fill-teal/25', fill: 'fill-teal',
  },
  violet: {
    face: 'bg-violet', edge: 'var(--color-violet-deep)', soft: 'bg-violet/15', border: 'border-violet/40',
    text: 'text-violet', css: 'var(--color-violet)',
    faintBg: 'bg-violet/8', faintBorder: 'border-violet/20', faintText: 'text-violet/55',
    dotFill: 'fill-violet/25', fill: 'fill-violet',
  },
  sky: {
    face: 'bg-sky', edge: 'var(--color-sky-deep)', soft: 'bg-sky/15', border: 'border-sky/40',
    text: 'text-sky', css: 'var(--color-sky)',
    faintBg: 'bg-sky/8', faintBorder: 'border-sky/20', faintText: 'text-sky/55',
    dotFill: 'fill-sky/25', fill: 'fill-sky',
  },
  coral: {
    face: 'bg-coral', edge: 'var(--color-coral-deep)', soft: 'bg-coral/15', border: 'border-coral/40',
    text: 'text-coral', css: 'var(--color-coral)',
    faintBg: 'bg-coral/8', faintBorder: 'border-coral/20', faintText: 'text-coral/55',
    dotFill: 'fill-coral/25', fill: 'fill-coral',
  },
  amber: {
    face: 'bg-amber', edge: 'var(--color-amber-deep)', soft: 'bg-amber/15', border: 'border-amber/40',
    text: 'text-amber', css: 'var(--color-amber)',
    faintBg: 'bg-amber/8', faintBorder: 'border-amber/20', faintText: 'text-amber/55',
    dotFill: 'fill-amber/25', fill: 'fill-amber',
  },
}
