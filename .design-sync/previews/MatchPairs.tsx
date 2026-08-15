import { MatchPairs } from 'cartolang'

/**
 * Association de quatre paires mot/traduction, avant le passage au QCM.
 * État de repos : aucun jeton sélectionné.
 */
export function Default() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <MatchPairs
        exercise={{
          kind: 'match',
          id: 'match:b2-set',
          pairs: [
            { id: 'v1', term: 'diligent', translation: 'appliqué', alt: [] },
            { id: 'v2', term: 'to overwhelm', translation: 'submerger', alt: [] },
            { id: 'v3', term: 'reluctant', translation: 'réticent', alt: [] },
            { id: 'v4', term: 'to negotiate', translation: 'négocier', alt: [] },
          ],
        }}
        onDone={() => {}}
      />
    </div>
  )
}
