import { motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { BoltIcon } from '@/components/icons'
import { accuracyOf, type SessionOutcome } from '@/engine/progress'

/** Écran de fin de session : score et XP gagnés. */
export function SessionResult({
  outcome,
  passed,
  xp,
  onContinue,
  onNext,
  onRetry,
}: {
  outcome: SessionOutcome
  passed: boolean
  xp: number
  onContinue: () => void
  /** Enchaîne sur l'étape suivante, quand il y en a une dans le parcours. */
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

      <h1 className="text-3xl font-black">{passed ? 'Bien joué !' : 'Presque…'}</h1>
      <p className="max-w-xs text-sm text-ink-soft">
        {passed
          ? 'Ces mots reviendront au bon moment dans vos révisions.'
          : `Il faut 70 % de bonnes réponses pour valider. Vous êtes à ${accuracy} %.`}
      </p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Stat label="Réussite" value={`${accuracy} %`} tone="text-teal" />
        <Stat label="XP gagnés" value={`+${xp}`} tone="text-amber" icon />
      </div>

      <div className="mt-2 flex w-full max-w-sm flex-col gap-3">
        {/* Enchaîner est l'envie naturelle après une session réussie : c'est
            donc l'action principale, et non un retour à la liste où il
            faudrait retrouver sa place à la main. « Étape » et non « leçon » :
            la suite du parcours peut être une révision. */}
        {passed && onNext ? (
          <>
            <Button block onClick={onNext}>
              Étape suivante
            </Button>
            <Button block tone="neutral" onClick={onContinue}>
              Voir le parcours
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
