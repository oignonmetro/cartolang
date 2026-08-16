import type { ReactNode } from 'react'

/**
 * Souligne les mots qui distinguent les options d'un QCM entre elles.
 *
 * Utile quand les options partagent une ossature commune et ne varient que
 * sur quelques mots — les formes conjuguées d'un même auxiliaire, les
 * infinitifs anglais qui partagent leur « to ». Une position est soulignée
 * dès qu'elle diffère quelque part dans le lot, chez toutes les options à la
 * fois, pour que l'œil compare la même colonne d'une case à l'autre plutôt
 * que de relire chaque option en entier.
 *
 * Souligner n'a de sens que si une partie du texte reste commune : sans
 * colonne partagée pour ancrer la comparaison, tout serait souligné, et un
 * mot entièrement souligné ne distingue plus rien. C'est le cas courant du
 * vocabulaire, où les options sont le plus souvent des mots distincts sans
 * rapport entre eux (« reporter », « annuler », « accélérer ») — le repère
 * s'efface alors de lui-même plutôt que de souligner chaque case en entier.
 * Un décompte de mots inégal entre options retombe sur le même silence : pas
 * de colonnes à comparer, pas de repère à poser.
 */
export function highlightDiffWords(options: readonly string[]): (option: string) => ReactNode {
  const tokenized = options.map((option) => option.split(' '))
  const width = tokenized[0]?.length ?? 0
  const sameLength = tokenized.every((tokens) => tokens.length === width)
  const differs = sameLength
    ? tokenized[0].map((token, index) => tokenized.some((tokens) => tokens[index] !== token))
    : []
  const worthHighlighting = differs.some(Boolean) && differs.some((differing) => !differing)

  return (option) => {
    if (!worthHighlighting) return option
    return option.split(' ').map((token, index) => (
      <span key={index}>
        {index > 0 && ' '}
        {differs[index] ? (
          <span className="underline decoration-2 underline-offset-4">{token}</span>
        ) : (
          token
        )}
      </span>
    ))
  }
}
