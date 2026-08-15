/**
 * Teintes du parcours d'unité.
 *
 * Une unité porte une seule couleur ; ce module en décline toutes les nuances
 * dont `PathNode` et `PathTrail` ont besoin — face pleine, pavé du franchi,
 * teinte à peine posée du verrouillé, fil du chemin — pour que les deux
 * composants restent de purs consommateurs de la teinte, jamais de classes
 * Tailwind écrites en dur.
 *
 * Les trois états forment une échelle lisible de loin : le franchi est un pavé
 * plein mais éteint, l'étape courante une face vive, et ce qui reste à faire un
 * simple contour. On voit ainsi le chemin se paver derrière soi.
 */
export interface Tone {
  face: string
  edge: string
  soft: string
  border: string
  text: string
  css: string
  /** Pavé du franchi : rempli, mais assez sourd pour ne pas voler la vedette. */
  doneBg: string
  doneBorder: string
  doneText: string
  /** Teinte à peine posée : le verrouillé reste coloré, pas juste gris éteint. */
  faintBg: string
  faintBorder: string
  faintText: string
  /** Pastille du chemin pas encore franchi, et sa version franchie. */
  dotFill: string
  fill: string
  /** Trait plein du chemin déjà parcouru. */
  stroke: string
}

/*
 * Les classes sont écrites en toutes lettres plutôt que composées à la volée :
 * Tailwind lit le source pour savoir quoi générer, une interpolation ne lui
 * dirait rien et les classes manqueraient à l'exécution.
 */
export const TONES: Record<string, Tone> = {
  teal: {
    face: 'bg-teal', edge: 'var(--color-teal-deep)', soft: 'bg-teal/15', border: 'border-teal/40',
    text: 'text-teal', css: 'var(--color-teal)',
    doneBg: 'bg-teal/25', doneBorder: 'border-teal/55', doneText: 'text-teal-deep',
    faintBg: 'bg-teal/8', faintBorder: 'border-teal/20', faintText: 'text-teal/55',
    dotFill: 'fill-teal/25', fill: 'fill-teal', stroke: 'stroke-teal',
  },
  violet: {
    face: 'bg-violet', edge: 'var(--color-violet-deep)', soft: 'bg-violet/15', border: 'border-violet/40',
    text: 'text-violet', css: 'var(--color-violet)',
    doneBg: 'bg-violet/25', doneBorder: 'border-violet/55', doneText: 'text-violet-deep',
    faintBg: 'bg-violet/8', faintBorder: 'border-violet/20', faintText: 'text-violet/55',
    dotFill: 'fill-violet/25', fill: 'fill-violet', stroke: 'stroke-violet',
  },
  sky: {
    face: 'bg-sky', edge: 'var(--color-sky-deep)', soft: 'bg-sky/15', border: 'border-sky/40',
    text: 'text-sky', css: 'var(--color-sky)',
    doneBg: 'bg-sky/25', doneBorder: 'border-sky/55', doneText: 'text-sky-deep',
    faintBg: 'bg-sky/8', faintBorder: 'border-sky/20', faintText: 'text-sky/55',
    dotFill: 'fill-sky/25', fill: 'fill-sky', stroke: 'stroke-sky',
  },
  coral: {
    face: 'bg-coral', edge: 'var(--color-coral-deep)', soft: 'bg-coral/15', border: 'border-coral/40',
    text: 'text-coral', css: 'var(--color-coral)',
    doneBg: 'bg-coral/25', doneBorder: 'border-coral/55', doneText: 'text-coral-deep',
    faintBg: 'bg-coral/8', faintBorder: 'border-coral/20', faintText: 'text-coral/55',
    dotFill: 'fill-coral/25', fill: 'fill-coral', stroke: 'stroke-coral',
  },
  amber: {
    face: 'bg-amber', edge: 'var(--color-amber-deep)', soft: 'bg-amber/15', border: 'border-amber/40',
    text: 'text-amber', css: 'var(--color-amber)',
    doneBg: 'bg-amber/25', doneBorder: 'border-amber/55', doneText: 'text-amber-deep',
    faintBg: 'bg-amber/8', faintBorder: 'border-amber/20', faintText: 'text-amber/55',
    dotFill: 'fill-amber/25', fill: 'fill-amber', stroke: 'stroke-amber',
  },
}

/**
 * Teinte de la séance finale, la même quelle que soit la couleur de l'unité.
 *
 * L'amber n'est la couleur d'aucune piste et c'est déjà celle de l'XP : elle se
 * lit comme une récompense sans jamais entrer en conflit avec le teal, le
 * violet ou le sky de l'unité qu'on est en train de terminer.
 */
export const FINAL_TONE: Tone = TONES.amber!
