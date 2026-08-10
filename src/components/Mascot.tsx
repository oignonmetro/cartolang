import { motion } from 'framer-motion'

/**
 * Kartu, la mascotte : un petit explorateur rond, dessiné en SVG pour rester
 * net à toutes les tailles et léger dans l'APK. Les expressions changent en
 * échangeant les yeux et la bouche ; le corps, lui, ne bouge pas.
 */

export type MascotMood = 'idle' | 'happy' | 'sad' | 'cheer' | 'think'

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
}

const BODY = '#14b8a6'
const BODY_DARK = '#0b8b7d'
const BELLY = '#ffe9c9'
const HAT = '#ff6b57'
const HAT_DARK = '#d4432f'

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
  const animation =
    mood === 'cheer'
      ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] }
      : mood === 'sad'
        ? { y: [0, 3, 0], rotate: 0 }
        : { y: [0, -4, 0], rotate: 0 }

  return (
    <motion.svg
      viewBox="0 0 120 130"
      width={size}
      height={(size * 130) / 120}
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
      {/* Ombre portée */}
      <ellipse cx="60" cy="122" rx="30" ry="6" fill="#23253c" opacity="0.12" />

      {/* Pieds */}
      <ellipse cx="46" cy="113" rx="11" ry="7" fill={BODY_DARK} />
      <ellipse cx="74" cy="113" rx="11" ry="7" fill={BODY_DARK} />

      {/* Corps */}
      <path d="M26 66 a34 34 0 0 1 68 0 v20 a34 30 0 0 1 -68 0z" fill={BODY} />
      <ellipse cx="60" cy="88" rx="20" ry="17" fill={BELLY} />

      {/* Bras */}
      <ellipse cx="22" cy="80" rx="8" ry="12" fill={BODY_DARK} transform="rotate(-15 22 80)" />
      <ellipse cx="98" cy="80" rx="8" ry="12" fill={BODY_DARK} transform="rotate(15 98 80)" />

      {/* Tête */}
      <circle cx="60" cy="55" r="34" fill={BODY} />
      <circle cx="60" cy="55" r="34" fill="none" stroke={BODY_DARK} strokeWidth="2" opacity="0.35" />

      {/* Casquette d'explorateur */}
      <path d="M28 40 a32 32 0 0 1 64 0 z" fill={HAT} />
      <path d="M24 40 h72 a4 4 0 0 1 0 8 h-72 a4 4 0 0 1 0 -8z" fill={HAT_DARK} />
      <circle cx="60" cy="18" r="5" fill={HAT_DARK} />

      <Eyes mood={mood} />
      <Mouth mood={mood} />

      {/* Joues */}
      <ellipse cx="36" cy="66" rx="6" ry="4" fill={HAT} opacity="0.35" />
      <ellipse cx="84" cy="66" rx="6" ry="4" fill={HAT} opacity="0.35" />
    </motion.svg>
  )
}
