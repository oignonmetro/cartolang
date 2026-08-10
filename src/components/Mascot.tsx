import { useId } from 'react'
import { motion } from 'framer-motion'

/**
 * Kartu, la mascotte : une petite tortue, dessinée en SVG pour rester nette
 * à toutes les tailles et légère dans l'APK. Les expressions changent en
 * échangeant les yeux et la bouche ; la carapace, elle, ne bouge pas.
 */

export type MascotMood = 'idle' | 'happy' | 'disappointed' | 'reassuring' | 'cheer' | 'think'

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

// Carapace resserrée (par rapport à la première version) pour laisser de la
// place aux pattes de part et d'autre, sans qu'elles soient recouvertes.
const SHELL_PATH = 'M20 92 A40 36 0 0 1 100 92 L100 114 A40 20 0 0 1 20 114 Z'

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
  hexPath(60, 98, 12),
  hexPath(35, 103, 9.5),
  hexPath(85, 103, 9.5),
  hexPath(48, 114, 8.5),
  hexPath(72, 114, 8.5),
]

/** Une patte : simple palette arrondie, dans le repère local pivoté et
 * translaté par le composant appelant. */
function Leg({ rx, ry }: { rx: number; ry: number }) {
  return <ellipse cx="0" cy="0" rx={rx} ry={ry} fill={SKIN_DARK} />
}

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

  if (mood === 'disappointed') {
    // Sourcils inquiets (pointe intérieure relevée) plutôt qu'en colère,
    // et un regard qui fuit légèrement vers le bas.
    return (
      <>
        <circle cx="47" cy="55" r="5.5" fill="#23253c" />
        <circle cx="45.5" cy="56.5" r="1.6" fill="#fff" />
        <circle cx="73" cy="55" r="5.5" fill="#23253c" />
        <circle cx="71.5" cy="56.5" r="1.6" fill="#fff" />
        <path d="M39 47 Q46 43 53 45" stroke="#23253c" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M81 47 Q74 43 67 45" stroke="#23253c" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </>
    )
  }

  if (mood === 'reassuring') {
    // Un clin d'œil chaleureux : un œil fermé et souriant, l'autre ouvert.
    return (
      <>
        <path d="M40 52 q7 -7 14 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="73" cy="53" r="6.5" fill="#23253c" />
        <circle cx="75.5" cy="50.5" r="2.2" fill="#fff" />
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
  if (mood === 'happy' || mood === 'reassuring') {
    return <path d="M52 66 q8 9 16 0" stroke="#23253c" strokeWidth="4" strokeLinecap="round" fill="none" />
  }
  if (mood === 'disappointed') {
    // Une moue légère et résignée, pas des larmes.
    return <path d="M54 67 q6 -3 12 0" stroke="#23253c" strokeWidth="3.5" strokeLinecap="round" fill="none" />
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
      : mood === 'disappointed'
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
      <ellipse cx="60" cy="122" rx="5.5" ry="6" fill={SKIN} />

      {/* Carapace : dôme, sommet caché derrière la tête, motif en écailles */}
      <path d={SHELL_PATH} fill={SHELL} />
      <g clipPath={`url(#${clipId})`}>
        {SHELL_SCUTES.map((scute) => (
          <path key={scute} d={scute} fill={SHELL_DEEP} fillOpacity="0.28" stroke={SHELL_DEEP} strokeWidth="2" strokeOpacity="0.6" strokeLinejoin="round" />
        ))}
      </g>
      <path d={SHELL_PATH} fill="none" stroke={SHELL_DEEP} strokeWidth="3" opacity="0.4" />

      {/* Pattes, dessinées après la carapace pour bien s'y accrocher et rester visibles */}
      <g transform="translate(15 90) rotate(-32)">
        <Leg rx={10} ry={16} />
      </g>
      <g transform="translate(105 90) rotate(32)">
        <Leg rx={10} ry={16} />
      </g>
      <g transform="translate(25 120) rotate(20)">
        <Leg rx={12} ry={9} />
      </g>
      <g transform="translate(95 120) rotate(-20)">
        <Leg rx={12} ry={9} />
      </g>

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
