/**
 * Anneau de progression, à deux arcs.
 *
 * Sans parcours imposé, l'anneau est le seul repère : il doit répondre d'un
 * coup d'œil à « où en suis-je ? ». Un arc plein donne la part solidement
 * acquise, un arc pâle la part simplement rencontrée. Sans ce second arc, une
 * unité entièrement travaillée le jour même afficherait 0 % — la maîtrise
 * durable demande plusieurs jours de révision — et le retour serait nul.
 */
export function ProgressRing({
  ratio,
  seenRatio = 0,
  size = 44,
  stroke = 5,
  color,
  label,
}: {
  /** Part solidement acquise, entre 0 et 1. */
  ratio: number
  /** Part rencontrée au moins une fois, entre 0 et 1. */
  seenRatio?: number
  size?: number
  stroke?: number
  /** Couleur CSS du tracé (variable de thème de la piste). */
  color: string
  /** Texte affiché au centre ; le pourcentage acquis par défaut. */
  label?: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const known = clamp(ratio)
  const seen = Math.max(known, clamp(seenRatio))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <Arc size={size} radius={radius} stroke={stroke} color={color} circumference={circumference} value={seen} opacity={0.3} />
        <Arc size={size} radius={radius} stroke={stroke} color={color} circumference={circumference} value={known} opacity={1} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-black" style={{ color }}>
        {label ?? `${Math.round(known * 100)}%`}
      </span>
    </div>
  )
}

function Arc({
  size,
  radius,
  stroke,
  color,
  circumference,
  value,
  opacity,
}: {
  size: number
  radius: number
  stroke: number
  color: string
  circumference: number
  value: number
  opacity: number
}) {
  if (value <= 0) return null
  return (
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference * (1 - value)}
      style={{ transition: 'stroke-dashoffset 400ms ease' }}
    />
  )
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
