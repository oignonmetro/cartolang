import { Button } from 'cartolang'

/** Ton par défaut, celui des actions principales (« Continuer », « Vérifier »). */
export function Teal() {
  return <Button>Continuer</Button>
}

/** Auto-évaluation en trois boutons : nouveau, incertain, je savais. */
export function Rating() {
  return (
    <div className="flex gap-2">
      <Button tone="error">À revoir</Button>
      <Button tone="amber">Hésitant</Button>
      <Button tone="success">Je savais</Button>
    </div>
  )
}

/** Pleine largeur, comme en pied d'exercice. */
export function Block() {
  return (
    <div className="w-64">
      <Button block>Vérifier</Button>
    </div>
  )
}

/** Ton neutre, désactivé — état de repos avant qu'une réponse ne soit saisie. */
export function DisabledNeutral() {
  return (
    <Button tone="neutral" disabled>
      Vérifier
    </Button>
  )
}
