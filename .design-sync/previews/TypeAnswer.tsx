import { TypeAnswer } from 'cartolang'

const overwhelm = {
  id: 'b2-to-overwhelm',
  term: 'to overwhelm',
  translation: 'submerger',
  alt: ['accabler'],
  pos: 'verbe' as const,
  example: {
    text: 'The volume of requests overwhelmed the support team.',
    translation: "Le volume de demandes a submergé l'équipe support.",
  },
}

/**
 * Traduction au clavier, anglais → français : l'exercice le plus exigeant,
 * sans aucun contexte. Champ vide, rien encore vérifié.
 */
export function ToKnown() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <TypeAnswer
        exercise={{ kind: 'type', id: 'type:to-overwhelm', vocab: overwhelm, direction: 'to-known' }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Même mot, sens inverse : la traduction française est donnée, il faut
 * produire le terme anglais de mémoire.
 */
export function ToLearning() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <TypeAnswer
        exercise={{ kind: 'type', id: 'type:to-overwhelm-2', vocab: overwhelm, direction: 'to-learning' }}
        onAnswer={() => {}}
      />
    </div>
  )
}
