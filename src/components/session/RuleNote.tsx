import { motion } from 'framer-motion'
import type { RuleExercise } from '@/engine/exercises'
import { Button } from '@/components/Button'

/**
 * Rappel de cours affiché avant la pratique, à la découverte d'une leçon.
 *
 * Le texte est du texte brut : les retours à la ligne séparent les
 * paragraphes, et une ligne commençant par « — » devient un exemple mis en
 * valeur. Pas de moteur Markdown à embarquer pour si peu.
 */
export function RuleNote({ exercise, onNext }: { exercise: RuleExercise; onNext: () => void }) {
  const blocks = exercise.notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-faint">Rappel</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="card-3d my-auto flex flex-col gap-3 px-6 py-7"
      >
        <h2 className="text-2xl font-black">{exercise.title}</h2>
        {blocks.map((block, index) =>
          block.startsWith('—') ? (
            <p
              key={index}
              className="rounded-xl border-l-4 border-violet bg-violet/10 px-4 py-2 text-sm font-bold text-ink"
            >
              {block.replace(/^—\s*/, '')}
            </p>
          ) : (
            <p key={index} className="text-sm leading-relaxed text-ink-soft">
              {block}
            </p>
          ),
        )}
      </motion.div>

      <Button block tone="violet" onClick={onNext}>
        C'est parti
      </Button>
    </div>
  )
}
