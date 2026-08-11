import { motion } from 'framer-motion'
import type { IntroExercise } from '@/engine/exercises'
import type { Rating } from '@/engine/srs'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'

/**
 * Présentation d'un mot nouveau, avec auto-évaluation immédiate.
 *
 * Tout est déjà affiché (terme, traduction, exemple) : redemander la même
 * information une seconde fois dans une flashcard séparée juste après ne
 * teste rien, ça ne fait que répéter ce qu'on vient de lire. L'auto-évaluation
 * porte donc ici sur la première impression — mot connu, incertain, ou
 * franchement nouveau — et amorce directement la révision espacée.
 */
export function VocabIntro({ exercise, onRate }: { exercise: IntroExercise; onRate: (rating: Rating) => void }) {
  const { vocab } = exercise

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Nouveau mot</p>

      {/* Comme dans Flashcard.tsx : seule cette enveloppe est flexible, la
          carte se centre dedans mais les boutons restent collés juste après —
          pas de marge auto sur la carte, qui écarterait carte et boutons sur
          les écrans hauts. */}
      <div className="flex flex-1 items-center">
        <motion.div
          key={vocab.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="card-3d flex w-full flex-col items-center gap-3 px-6 py-8 text-center"
        >
          <Mascot mood="happy" size={84} />
          <span className="text-4xl font-black break-words">{vocab.term}</span>
          {vocab.pos && (
            <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">{vocab.pos}</span>
          )}
          <span className="text-2xl font-extrabold text-teal">{vocab.translation}</span>
          {vocab.hint && <p className="text-sm text-ink-soft">{vocab.hint}</p>}
          {vocab.example && (
            <p className="mt-2 border-t-2 border-dashed border-line pt-3 text-sm text-ink-soft">
              <span className="font-bold text-ink">{vocab.example.text}</span>
              <br />
              {vocab.example.translation}
            </p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button tone="error" onClick={() => onRate('again')} className="text-xs">
          Nouveau
        </Button>
        <Button tone="amber" onClick={() => onRate('hard')} className="text-xs">
          Incertain
        </Button>
        <Button tone="success" onClick={() => onRate('good')} className="text-xs">
          Je savais
        </Button>
      </div>
    </div>
  )
}
