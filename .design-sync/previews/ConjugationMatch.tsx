import { ConjugationMatch } from 'cartolang'

/**
 * Reconstitution d'un paradigme au présent : quatre personnes à relier à
 * leur forme, avant que la production sans aide (`ConjugationAnswer`) ne
 * soit demandée. Bandeau sky avec le verbe et son temps, puis le plateau
 * d'association hérité de `PairBoard`.
 */
export function Default() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ConjugationMatch
        exercise={{
          kind: 'conjugation-match',
          id: 'conj-match:to-be-present',
          verb: {
            verb: 'to be',
            translation: 'être',
            tense: 'présent',
            forms: [
              { id: 'be-1', person: 'I', answer: 'am', alt: [] },
              { id: 'be-2', person: 'you', answer: 'are', alt: [] },
            ],
          },
          forms: [
            { id: 'be-1', person: 'I', answer: 'am', alt: [] },
            { id: 'be-2', person: 'you', answer: 'are', alt: [] },
            { id: 'be-3', person: 'he / she / it', answer: 'is', alt: [] },
            { id: 'be-4', person: 'we', answer: 'are', alt: [] },
          ],
        }}
        onDone={() => {}}
      />
    </div>
  )
}
