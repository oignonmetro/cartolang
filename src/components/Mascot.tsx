import { useId } from 'react'
import { motion } from 'framer-motion'

/**
 * Kartu, la mascotte : une petite tortue, dessinée en SVG pour rester nette
 * à toutes les tailles et légère dans l'APK. Les expressions changent en
 * échangeant les yeux et la bouche ; la carapace, elle, ne bouge pas.
 */

export type MascotMood = 'idle' | 'happy' | 'sad' | 'cheer' | 'think'

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
}

const SKIN = '#3ecfb8'
const SKIN_DARK = '#249d89'
const SHELL = '#0c8a7c'
const SHELL_DEEP = '#075f56'
const BLUSH = '#ff6b57'

const SHELL_PATH = 'M14 96 A46 40 0 0 1 106 96 L106 118 A46 22 0 0 1 14 118 Z'

/** Petit hexagone (sommet en haut), pour le motif en écailles de la carapace. */
function hexPath(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90)
    const x = (cx + r * Math.cos(angle)).toFixed(1)
    const y = (cy + r * Math.sin(angle)).toFixed(1)
    return `${x} ${y}`
  })
  return `M${points[0]} L${points[1]} L${points[2]} L${points[3]} L${points[4]} L${points[5]} Z`
}

const SHELL_SCUTES = [
  hexPath(60, 101, 13),
  hexPath(33, 107, 10.5),
  hexPath(87, 107, 10.5),
  hexPath(47, 119, 9.5),
  hexPath(73, 119, 9.5),
]

function Eyes({ mood }: { mood: MascotMood }) {
  if (mood === 'happy' || mood === 'cheer') {
    // Yeux plissés de joie.
    return (
      <>
        <path d="M40 52 q7 -8 14 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M66 52 q7 -8 14 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    )
  }

  if (mood === 'sad') {
    return (
      <>
        <circle cx="47" cy="55" r="5" fill="#23253c" />
        <circle cx="73" cy="55" r="5" fill="#23253c" />
        <path d="M39 45 l14 5" stroke="#23253c" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M81 45 l-14 5" stroke="#23253c" strokeWidth="3.5" strokeLinecap="round" />
      </>
    )
  }

  if (mood === 'think') {
    return (
      <>
        <circle cx="47" cy="53" r="6" fill="#23253c" />
        <circle cx="49" cy="51" r="2" fill="#fff" />
        <path d="M67 53 q6 -4 12 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    )
  }

  return (
    <>
      <circle cx="47" cy="53" r="6.5" fill="#23253c" />
      <circle cx="49.5" cy="50.5" r="2.2" fill="#fff" />
      <circle cx="73" cy="53" r="6.5" fill="#23253c" />
      <circle cx="75.5" cy="50.5" r="2.2" fill="#fff" />
    </>
  )
}

function Mouth({ mood }: { mood: MascotMood }) {
  if (mood === 'cheer') {
    return <path d="M50 66 q10 14 20 0 q-10 5 -20 0z" fill="#23253c" />
  }
  if (mood === 'happy') {
    return <path d="M52 66 q8 9 16 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
  }
  if (mood === 'sad') {
    return <path d="M52 70 q8 -8 16 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
  }
  if (mood === 'think') {
    return <path d="M54 68 h10" stroke="#23253c" strokeWidth="4" strokeLinecap="round" />
  }
  return <path d="M53 66 q7 7 14 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
}

export function Mascot({ mood = 'idle', size = 120, className }: MascotProps) {
  const clipId = useId()
  const animation =
    mood === 'cheer'
      ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] }
      : mood === 'sad'
        ? { y: [0, 3, 0], rotate: 0 }
        : { y: [0, -4, 0], rotate: 0 }

  return (
    <motion.svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      className={className}
      role="img"
      aria-label="Kartu, la mascotte"
      animate={animation}
      transition={{
        duration: mood === 'cheer' ? 0.6 : 2.4,
        repeat: Infinity,
        repeatDelay: mood === 'cheer' ? 0.1 : 0.4,
        ease: 'easeInOut',
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SHELL_PATH} />
        </clipPath>
      </defs>

      {/* Ombre portée */}
      <ellipse cx="60" cy="142" rx="30" ry="6" fill="#23253c" opacity="0.12" />

      {/* Queue, en dessous de la carapace, tout juste visible */}
      <ellipse cx="60" cy="127" rx="5.5" ry="6" fill={SKIN} />

      {/* Pattes arrière */}
      <ellipse cx="38" cy="124" rx="11" ry="8" fill={SKIN_DARK} transform="rotate(12 38 124)" />
      <ellipse cx="82" cy="124" rx="11" ry="8" fill={SKIN_DARK} transform="rotate(-12 82 124)" />

      {/* Pattes avant, en palette, dépassant sous les bords de la carapace */}
      <ellipse cx="12" cy="100" rx="10" ry="14" fill={SKIN_DARK} transform="rotate(-25 12 100)" />
      <ellipse cx="108" cy="100" rx="10" ry="14" fill={SKIN_DARK} transform="rotate(25 108 100)" />

      {/* Carapace : dôme large, sommet caché derrière la tête, motif en écailles */}
      <path d={SHELL_PATH} fill={SHELL} />
      <g clipPath={`url(#${clipId})`}>
        {SHELL_SCUTES.map((scute) => (
          <path key={scute} d={scute} fill={SHELL_DEEP} fillOpacity="0.28" stroke={SHELL_DEEP} strokeWidth="2" strokeOpacity="0.6" strokeLinejoin="round" />
        ))}
      </g>
      <path d={SHELL_PATH} fill="none" stroke={SHELL_DEEP} strokeWidth="3" opacity="0.4" />

      {/* Tête */}
      <circle cx="60" cy="55" r="34" fill={SKIN} />
      <circle cx="60" cy="55" r="34" fill="none" stroke={SKIN_DARK} strokeWidth="2" opacity="0.35" />

      <Eyes mood={mood} />
      <Mouth mood={mood} />

      {/* Joues */}
      <ellipse cx="36" cy="66" rx="6" ry="4" fill={BLUSH} opacity="0.35" />
      <ellipse cx="84" cy="66" rx="6" ry="4" fill={BLUSH} opacity="0.35" />
    </motion.svg>
  )
}
