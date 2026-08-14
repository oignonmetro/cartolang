import { Flashcard } from 'cartolang'

const argue = {
  id: 'b2-to-argue',
  term: 'to argue',
  translation: 'soutenir',
  alt: ["défendre l'idée", 'plaider'],
  pos: 'verbe',
  hint: 'Au sens de « défendre une thèse », pas seulement « se disputer ».',
  gap: 'argues',
  example: {
    text: 'The report argues that remote work improves retention.',
    translation: 'Le rapport soutient que le télétravail améliore la fidélisation.',
  },
}

/** Recto anglais : « Que veut dire ce mot ? » — reconnaissance vers le français. */
export function ToKnown() {
  return (
    <Flashcard
      exercise={{ kind: 'flashcard', id: 'flash:to-argue', vocab: argue, direction: 'to-known' }}
      onRate={() => {}}
    />
  )
}

/** Recto français : « Comment dit-on ? » — production vers l'anglais. */
export function ToLearning() {
  return (
    <Flashcard
      exercise={{ kind: 'flashcard', id: 'flash:to-argue', vocab: argue, direction: 'to-learning' }}
      onRate={() => {}}
    />
  )
}
