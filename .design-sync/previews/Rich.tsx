import { Rich } from 'cartolang'

/** Gras : met en valeur le point de règle au sein d'une phrase de rappel. */
export function Bold() {
  return (
    <p className="max-w-md text-sm leading-relaxed text-ink">
      <Rich text="Après **must**, jamais de `to` : *must go*, pas *must to go*." />
    </p>
  )
}

/**
 * Forme anglaise citée (délimitée par des accents graves, littérale) : reçoit
 * un fond très léger plutôt qu'une couleur, pour rester lisible sur un
 * paragraphe déjà teinté.
 */
export function FormCitation() {
  return (
    <p className="max-w-md text-sm leading-relaxed text-ink">
      <Rich text="On dit `I have been waiting`, pas `I am waiting since` : la forme en `-ing` du present perfect porte déjà la durée." />
    </p>
  )
}

/** Souligné et imbrication : le gras peut contenir une forme citée. */
export function UnderlineAndNesting() {
  return (
    <p className="max-w-md text-sm leading-relaxed text-ink">
      <Rich text="__Attention__ à l'ordre des mots : **jamais `to` juste après un modal**." />
    </p>
  )
}
