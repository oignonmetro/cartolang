import { PairBoard } from 'cartolang'

/**
 * Plateau d'association générique, hors contexte vocabulaire/conjugaison :
 * relier chaque temps à sa forme au présent simple, pour montrer que la
 * mécanique (deux colonnes mélangées indépendamment) ne connaît que des
 * libellés, jamais leur nature.
 */
export function Default() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <PairBoard
        seed="preview:tense-timeline"
        prompt="Reliez chaque temps à sa forme"
        pairs={[
          { id: 't1', left: 'présent', right: 'do' },
          { id: 't2', left: 'passé', right: 'did' },
          { id: 't3', left: 'futur', right: 'will do' },
        ]}
        onDone={() => {}}
      />
    </div>
  )
}
