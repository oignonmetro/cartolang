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
          cue: 'verb',
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Le même exercice à partir du français seul : il faut retrouver « to see »
 * avant de l'accorder, et c'est ce rappel-là qui sert à parler — personne, en
 * conversation, ne part de l'infinitif anglais déjà trouvé. L'anglais
 * disparaît donc de l'énoncé, sans quoi la moitié de la réponse serait donnée ;
 * il revient à la correction, seul endroit où le couple s'apprend. Ce verbe n'a
 * pas de note d'usage (`note` est optionnelle), ce que la carte absorbe.
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
          cue: 'translation',
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}
