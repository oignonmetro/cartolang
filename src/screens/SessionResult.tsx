import { motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { BoltIcon, StarIcon } from '@/components/icons'
import { accuracyOf, MAX_LEVEL, type SessionOutcome } from '@/engine/progress'

/** Écran de fin de session : score, étoile gagnée, XP. */
export function SessionResult({
  outcome,
  passed,
  xp,
  level,
  onContinue,
  onNext,
  onRetry,
}: {
  outcome: SessionOutcome
  passed: boolean
  xp: number
  /** Étoiles de la leçon, ou `null` pour une session de révision. */
  level: number | null
  onContinue: () => void
  /** Enchaîne sur la leçon suivante, quand il y en a une dans la piste. */
  onNext?: () => void
  onRetry: () => void
}) {
  const accuracy = Math.round(accuracyOf(outcome) * 100)

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <Mascot mood={passed ? 'cheer' : 'disappointed'} size={150} />
      </motion.div>

      <h1 className="text-3xl font-black">
        {passed ? (level === MAX_LEVEL ? 'Leçon maîtrisée !' : 'Bien joué !') : 'Presque…'}
      </h1>
      <p className="max-w-xs text-sm text-ink-soft">
        {passed
          ? 'Ces mots reviendront au bon moment dans vos révisions.'
          : `Il faut 70 % de bonnes réponses pour valider. Vous êtes à ${accuracy} %.`}
      </p>

      {level !== null && (
        <div className="flex gap-2">
          {Array.from({ length: MAX_LEVEL }, (_, index) => (
            <motion.span
              key={index}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 + index * 0.12, type: 'spring', stiffness: 300, damping: 14 }}
              className={index < level ? 'text-amber' : 'text-line'}
            >
              <StarIcon filled={index < level} size={40} />
            </motion.span>
          ))}
        </div>
      )}

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Stat label="Réussite" value={`${accuracy} %`} tone="text-teal" />
        <Stat label="XP gagnés" value={`+${xp}`} tone="text-amber" icon />
      </div>

      <div className="mt-2 flex w-full max-w-sm flex-col gap-3">
        {/* Enchaîner est l'envie naturelle après une leçon réussie : c'est
            donc l'action principale, et non un retour à la bibliothèque où il
            faudrait retrouver sa place à la main. */}
        {passed && onNext ? (
          <>
            <Button block onClick={onNext}>
              Leçon suivante
            </Button>
            <Button block tone="neutral" onClick={onContinue}>
              Terminer
            </Button>
          </>
        ) : (
          <Button block onClick={onContinue}>
            Continuer
          </Button>
        )}
        {!passed && (
          <Button block tone="neutral" onClick={onRetry}>
            Recommencer
          </Button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone: string; icon?: boolean }) {
  return (
    <div className="card-3d flex flex-col items-center gap-1 px-4 py-4">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</span>
      <span className={`flex items-center gap-1 text-2xl font-black ${tone}`}>
        {icon && <BoltIcon size={20} />}
        {value}
      </span>
    </div>
  )
}
