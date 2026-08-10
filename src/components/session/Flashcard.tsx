import { useState } from 'react'
import { motion } from 'framer-motion'
import type { FlashcardExercise } from '@/engine/exercises'
import type { Rating } from '@/engine/srs'
import { Button } from '@/components/Button'

/**
 * Flashcard avec auto-évaluation.
 *
 * L'apprenant retourne la carte puis juge lui-même sa réponse : c'est ce
 * jugement qui alimente la révision espacée, d'où les trois notes.
 */
export function Flashcard({
  exercise,
  onRate,
}: {
  exercise: FlashcardExercise
  onRate: (rating: Rating) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const { vocab, direction } = exercise
  const front = direction === 'to-known' ? vocab.term : vocab.translation
  const back = direction === 'to-known' ? vocab.translation : vocab.term

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">
        {direction === 'to-known' ? 'Que veut dire ce mot ?' : 'Comment dit-on ?'}
      </p>

      {/* La carte reste dimensionnée par son contenu et flotte au centre. */}
      <div className="flex flex-1 items-center">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={revealed}
          className="card-3d flex w-full min-h-56 flex-col items-center justify-center gap-4 px-6 py-8 text-center disabled:cursor-default"
        >
          <span className="text-4xl font-black break-words">{front}</span>
          {vocab.pos && (
            <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">{vocab.pos}</span>
          )}

          {revealed ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex w-full flex-col items-center gap-3 border-t-2 border-dashed border-line pt-4"
            >
              <span className="text-3xl font-extrabold text-teal">{back}</span>
              {vocab.hint && <span className="text-sm text-ink-soft">{vocab.hint}</span>}
              {vocab.example && (
                <p className="text-sm text-ink-soft">
                  <span className="font-bold">{vocab.example.text}</span>
                  <br />
                  {vocab.example.translation}
                </p>
              )}
            </motion.div>
          ) : (
            <span className="text-sm font-bold text-ink-faint">Touchez pour révéler</span>
          )}
        </button>
      </div>

      {revealed ? (
        <div className="grid grid-cols-3 gap-2">
          <Button tone="error" onClick={() => onRate('again')} className="text-xs">
            À revoir
          </Button>
          <Button tone="amber" onClick={() => onRate('hard')} className="text-xs">
            Hésitant
          </Button>
          <Button tone="success" onClick={() => onRate('good')} className="text-xs">
            Je savais
          </Button>
        </div>
      ) : (
        <Button block onClick={() => setRevealed(true)}>
          Révéler
        </Button>
      )}
    </div>
  )
}
