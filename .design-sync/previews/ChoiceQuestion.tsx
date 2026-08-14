import { ChoiceQuestion } from 'cartolang'

const postpone = {
  id: 'b2-to-postpone',
  term: 'to postpone',
  translation: 'reporter',
  alt: ['remettre à plus tard'],
  pos: 'verbe',
  hint: 'Décaler dans le temps, sans annuler.',
  example: {
    text: 'They postponed the meeting until next week.',
    translation: 'Ils ont reporté la réunion à la semaine prochaine.',
  },
}

/**
 * QCM anglais → français, juste après une manche d'association : le mot est
 * affiché, aucune option n'est encore choisie. C'est l'état qu'un rendu
 * statique peut représenter honnêtement — le retour coloré n'apparaît
 * qu'après un clic interne au composant (`useState`), impossible à figer
 * depuis les props.
 */
export function ToKnown() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ChoiceQuestion
        exercise={{
          kind: 'choice',
          id: 'choice:to-postpone',
          vocab: postpone,
          direction: 'to-known',
          options: ['reporter', 'annuler', 'accélérer'],
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Même QCM en sens inverse : la traduction française est affichée, il faut
 * reconnaître le terme anglais parmi les leurres.
 */
export function ToLearning() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ChoiceQuestion
        exercise={{
          kind: 'choice',
          id: 'choice:to-postpone-2',
          vocab: postpone,
          direction: 'to-learning',
          options: ['to postpone', 'to cancel', 'to rush', 'to schedule'],
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}
