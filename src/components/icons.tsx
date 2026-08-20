import type { UnitColor } from '@/content/schema'

/** Petites icônes maison : pas de librairie, pas de requête réseau. */

interface IconProps {
  size?: number
  className?: string
}

function svgProps({ size = 24, className }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function StarIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...svgProps(props)} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.8-5.3-2.8-5.3 2.8 1.1-5.8L3.5 9.7l5.9-.8z" />
    </svg>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3c.5 3-2 4-2 7a2 2 0 0 0 4 0c2 1.5 3 3.4 3 5.5A5.5 5.5 0 0 1 6.5 15C6.5 10.5 10.5 8 12 3z" />
    </svg>
  )
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4h-4" />
    </svg>
  )
}

export function ChestIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M3 9a9 9 0 0 1 18 0M3 13.5h18M12 12v3.5" />
    </svg>
  )
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 21V4" />
      <path d="M6 4h12l-3 4 3 4H6" />
    </svg>
  )
}

/**
 * Cœur : les fautes qu'il reste à commettre dans un test de passage (voir
 * `SessionScreen`). Vidé plutôt que retiré quand il est perdu — le compte
 * total doit rester lisible, sinon on ne sait plus sur combien on joue.
 */
export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...svgProps(props)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20.5 4.6 13a4.7 4.7 0 1 1 7.4-5.7A4.7 4.7 0 1 1 19.4 13z" />
    </svg>
  )
}

/** Double chevron : le badge d'un checkpoint du parcours (voir `PathNode`). */
export function SkipIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m4 6 7 6-7 6" />
      <path d="m13 6 7 6-7 6" />
    </svg>
  )
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19" />
    </svg>
  )
}

/** Haut-parleur, pour écouter la prononciation d'un mot. */
export function SpeakerIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M11 5 6.5 8.5H3.5v7h3L11 19z" />
      <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M17 7a7 7 0 0 1 0 10" />
    </svg>
  )
}

/** Icônes d'unité, référencées par leur nom dans les fichiers YAML. */
const UNIT_ICONS: Record<string, (props: IconProps) => React.ReactElement> = {
  book: BookIcon,
  wave: (props) => (
    <svg {...svgProps(props)}>
      <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5a1.5 1.5 0 0 1 3 0v5m0-.5V6a1.5 1.5 0 0 1 3 0v6" />
      <path d="M7 11V9a1.5 1.5 0 0 0-3 0v4a8 8 0 0 0 8 8h1a7 7 0 0 0 7-7v-2" />
    </svg>
  ),
  people: (props) => (
    <svg {...svgProps(props)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.3A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  ),
  cup: (props) => (
    <svg {...svgProps(props)}>
      <path d="M4 8h13v6a6 6 0 0 1-12 0z" />
      <path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M3 21h16" />
    </svg>
  ),
  clock: (props) => (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </svg>
  ),
  compass: (props) => (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z" />
    </svg>
  ),
}

export function UnitIcon({ name, ...props }: IconProps & { name: string }) {
  const Icon = UNIT_ICONS[name] ?? BookIcon
  return <Icon {...props} />
}

/** Classes Tailwind associées à chaque teinte d'unité. */
export const UNIT_TONES: Record<UnitColor, { bg: string; deep: string; text: string; ring: string }> = {
  teal: { bg: 'bg-teal', deep: 'var(--color-teal-deep)', text: 'text-teal', ring: 'ring-teal' },
  violet: { bg: 'bg-violet', deep: 'var(--color-violet-deep)', text: 'text-violet', ring: 'ring-violet' },
  coral: { bg: 'bg-coral', deep: 'var(--color-coral-deep)', text: 'text-coral', ring: 'ring-coral' },
  amber: { bg: 'bg-amber', deep: 'var(--color-amber-deep)', text: 'text-amber', ring: 'ring-amber' },
  sky: { bg: 'bg-sky', deep: 'var(--color-sky-deep)', text: 'text-sky', ring: 'ring-sky' },
}
