import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

/**
 * Bouton en relief. La couleur porte la face, la variable `--btn-shadow`
 * porte la tranche : c'est ce décalage qui donne le rendu « touche ».
 */

export type ButtonTone = 'teal' | 'violet' | 'coral' | 'amber' | 'sky' | 'success' | 'error' | 'neutral'

const TONES: Record<ButtonTone, { face: string; edge: string; text: string }> = {
  teal: { face: 'bg-teal', edge: 'var(--color-teal-deep)', text: 'text-white' },
  violet: { face: 'bg-violet', edge: 'var(--color-violet-deep)', text: 'text-white' },
  coral: { face: 'bg-coral', edge: 'var(--color-coral-deep)', text: 'text-white' },
  amber: { face: 'bg-amber', edge: 'var(--color-amber-deep)', text: 'text-ink' },
  sky: { face: 'bg-sky', edge: 'var(--color-sky-deep)', text: 'text-white' },
  success: { face: 'bg-success', edge: 'var(--color-success-deep)', text: 'text-white' },
  error: { face: 'bg-error', edge: 'var(--color-error-deep)', text: 'text-white' },
  neutral: { face: 'bg-paper', edge: 'var(--color-line)', text: 'text-ink-soft' },
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone
  block?: boolean
  children: ReactNode
}

export function Button({ tone = 'teal', block = false, className = '', children, ...rest }: ButtonProps) {
  const { face, edge, text } = TONES[tone]
  const style = { '--btn-shadow': edge } as CSSProperties
  const border = tone === 'neutral' ? 'border-2 border-line' : ''

  return (
    <button
      {...rest}
      style={style}
      className={`btn-3d ${face} ${text} ${border} ${block ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
