import { motion } from 'framer-motion'
import type { IntroExercise } from '@/engine/exercises'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'

/** Présentation d'un mot nouveau, avant tout test. */
export function VocabIntro({ exercise, onNext }: { exercise: IntroExercise; onNext: () => void }) {
  const { vocab } = exercise

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Nouveau mot</p>

      <motion.div
        key={vocab.id}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="card-3d my-auto flex flex-col items-center gap-3 px-6 py-8 text-center"
      >
        <Mascot mood="happy" size={84} />
        <span className="text-4xl font-black break-words">{vocab.term}</span>
        {vocab.pos && <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">{vocab.pos}</span>}
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

      <Button block onClick={onNext}>
        Compris
      </Button>
    </div>
  )
}
