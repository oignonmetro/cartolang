import { ClozeSentence } from 'cartolang'

const argue = {
  id: 'b2-to-argue',
  term: 'to argue',
  translation: 'soutenir',
  alt: ["défendre l'idée", 'plaider'],
  pos: 'verbe',
  gap: 'argues',
  example: {
    text: 'The report argues that remote work improves retention.',
    translation: 'Le rapport soutient que le télétravail améliore la fidélisation.',
  },
}

/**
 * Phrase à trou en banque de mots : niveau jeune, la forme attendue se
 * choisit parmi des leurres plutôt que de se taper au clavier. Le blanc est
 * encore vide — aucune tuile choisie.
 */
export function Bank() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ClozeSentence
        exercise={{
          kind: 'cloze',
          id: 'cloze:to-argue',
          vocab: argue,
          sentence: { before: 'The report ', match: 'argues', after: ' that remote work improves retention.' },
          bank: ['argues', 'argued', 'arguing', 'arguable'],
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Même phrase, leçon plus mûre : la banque a disparu, la réponse se saisit
 * au clavier. Le champ est vide, prêt à recevoir la frappe.
 */
export function TypedInput() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ClozeSentence
        exercise={{
          kind: 'cloze',
          id: 'cloze:to-argue-2',
          vocab: argue,
          sentence: { before: 'The report ', match: 'argues', after: ' that remote work improves retention.' },
          bank: null,
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}
