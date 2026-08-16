import { ConjugationMatch } from 'cartolang'

const toBe = {
  verb: 'to be',
  translation: 'être',
  tense: 'présent',
  forms: [
    { id: 'be-1', person: 'I', answer: 'am', alt: [] },
    { id: 'be-2', person: 'you', answer: 'are', alt: [] },
    { id: 'be-3', person: 'he / she / it', answer: 'is', alt: [] },
    { id: 'be-4', person: 'we', answer: 'are', alt: [] },
  ],
}

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
        exercise={{ kind: 'conjugation-match', id: 'conj-match:to-be-present', verbs: [toBe] }}
        onDone={() => {}}
      />
    </div>
  )
}

const toWork = {
  verb: 'to work',
  translation: 'travailler',
  tense: 'present perfect continu',
  forms: [
    { id: 'work-1', person: 'I / you / we / they', answer: 'have been working', alt: [] },
    { id: 'work-2', person: 'he / she / it', answer: 'has been working', alt: [] },
  ],
}

const toWait = {
  verb: 'to wait',
  translation: 'attendre',
  tense: 'present perfect continu',
  forms: [
    { id: 'wait-1', person: 'I / you / we / they', answer: 'have been waiting', alt: [] },
    { id: 'wait-2', person: 'he / she / it', answer: 'has been waiting', alt: [] },
  ],
}

/*
 * Le rappel du second passage, pas la présentation : deux verbes du même
 * temps mélangés dans une seule manche plutôt que de rejouer isolément la
 * petite manche à deux paires que la présentation venait déjà de montrer.
 * Les deux verbes partagent les mêmes personnes (« he / she / it » existe
 * dans les deux paradigmes) : sans le nom du verbe sur chaque jeton, deux
 * cases identiques à l'écran pointeraient vers deux réponses différentes,
 * indiscernables au regard.
 */
export function MelangeDeuxVerbes() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ConjugationMatch
        exercise={{ kind: 'conjugation-match', id: 'conj-match:work+wait', verbs: [toWork, toWait] }}
        onDone={() => {}}
      />
    </div>
  )
}
