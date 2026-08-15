import { ConjugationAnswer } from 'cartolang'

/**
 * Production d'une forme irrégulière au prétérit : le verbe et la personne
 * sont donnés, la forme est à écrire de mémoire, sans filet. Champ vide,
 * aucune vérification encore faite — le retour coloré n'apparaît qu'après un
 * clic interne au composant, impossible à figer depuis les props.
 */
export function Default() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ConjugationAnswer
        exercise={{
          kind: 'conjugation',
          id: 'conj:to-go-preterite',
          verb: {
            verb: 'to go',
            translation: 'aller',
            tense: 'prétérit',
            note: 'Verbe irrégulier : forme à mémoriser, pas de -ed.',
            forms: [
              { id: 'go-1', person: 'I', answer: 'went', alt: [] },
              { id: 'go-2', person: 'she', answer: 'went', alt: [] },
            ],
          },
          form: { id: 'go-1', person: 'I', answer: 'went', alt: [] },
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Même exercice à un autre temps, pour montrer la piste sky sur un cas où le
 * verbe n'a pas de note d'usage (`note` est optionnelle).
 */
export function PresentPerfect() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ConjugationAnswer
        exercise={{
          kind: 'conjugation',
          id: 'conj:to-see-perfect',
          verb: {
            verb: 'to see',
            translation: 'voir',
            tense: 'present perfect',
            forms: [
              { id: 'see-1', person: 'they', answer: 'have seen', alt: [] },
              { id: 'see-2', person: 'he', answer: 'has seen', alt: [] },
            ],
          },
          form: { id: 'see-1', person: 'they', answer: 'have seen', alt: [] },
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}
