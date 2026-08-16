import { GrammarGap } from 'cartolang'

/**
 * Trou de grammaire en banque de formes : niveau jeune, on choisit parmi des
 * formes plausibles plutôt que de saisir au clavier — la comparaison entre
 * les formes enseigne la règle.
 */
export function Bank() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <GrammarGap
        exercise={{
          kind: 'grammar-gap',
          id: 'gap:has-lived',
          point: {
            id: 'present-perfect-duration',
            sentence: 'She ___ in London for five years.',
            answer: 'has lived',
            alt: [],
            options: ['has lived', 'lives', 'lived', 'is living'],
            translation: 'Elle vit à Londres depuis cinq ans.',
            explanation: "Present perfect (has lived) : l'action a commencé dans le passé et continue.",
          },
          cue: 'translation',
          bank: ['has lived', 'lives', 'lived', 'is living'],
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Même règle, leçon plus mûre : la banque a disparu, la réponse se saisit au
 * clavier — et la traduction française avec elle. C'est l'aide qu'on retire en
 * dernier ; tant qu'elle est là, le sens visé est acquis et il ne reste qu'à
 * trouver la forme. Elle réapparaît toujours à la correction, où elle n'aide
 * plus mais explique.
 */
export function TypedInput() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <GrammarGap
        exercise={{
          kind: 'grammar-gap',
          id: 'gap:has-lived-2',
          point: {
            id: 'present-perfect-duration',
            sentence: 'She ___ in London for five years.',
            answer: 'has lived',
            alt: [],
            options: [],
            translation: 'Elle vit à Londres depuis cinq ans.',
            explanation: "Present perfect (has lived) : l'action a commencé dans le passé et continue.",
          },
          cue: 'sentence',
          bank: null,
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}
