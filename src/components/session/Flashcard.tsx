import { useState } from 'react'
import { motion } from 'framer-motion'
import type { FlashcardExercise } from '@/engine/exercises'
import type { Rating } from '@/engine/srs'
import { Button } from '@/components/Button'
import { speechFor } from '@/lib/speech'
import { SpeakButton } from './SpeakButton'

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

      {/* La carte et le bouton qui suit doivent rester collés : c'est le duo
          qui se centre dans l'espace disponible, pas la carte seule — sinon
          elle flotte au milieu de l'écran, loin du bouton. */}
      <div className="flex flex-1 flex-col justify-center gap-6">
        {/* Une div, pas un bouton : le haut-parleur qu'elle contient en serait
            un aussi, et un bouton dans un bouton est invalide — le navigateur
            déclencherait les deux, si bien qu'écouter le mot retournerait la
            carte. Le clavier garde son chemin par le bouton « Révéler ». */}
        <div
          onClick={revealed ? undefined : () => setRevealed(true)}
          className={`card-3d flex min-h-56 flex-col items-center justify-center gap-4 px-6 py-8 text-center ${
            revealed ? '' : 'cursor-pointer'
          }`}
        >
          {/* Le haut-parleur ne suit pas la face affichée mais le mot anglais :
              proposer d'écouter la traduction française n'apprendrait rien, et
              l'entendre avant d'avoir répondu donnerait la réponse quand c'est
              le français qui est en façade. */}
          <span className="text-4xl font-black break-words">{front}</span>
          {direction === 'to-known' && <SpeakButton text={speechFor(vocab)} auto />}
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
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-extrabold text-teal">{back}</span>
                {direction === 'to-learning' && <SpeakButton text={speechFor(vocab)} auto />}
              </div>
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
    </div>
  )
}
