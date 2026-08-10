/** Utilitaires de texte partagés par le compilateur de contenu et l'application. */

/** Découpage d'une phrase autour d'un terme, pour l'exercice à trou. */
export interface TermSplit {
  before: string
  match: string
  after: string
}

const TERM_BOUNDARY = "[^\\p{L}\\p{N}'-]"

function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|${TERM_BOUNDARY})(${escaped})(${TERM_BOUNDARY}|$)`, 'iu')
}

/**
 * Localise un terme dans une phrase, en n'acceptant que les mots entiers :
 * « cat » ne doit pas être trouvé dans « catalogue ».
 */
export function findTerm(sentence: string, term: string): TermSplit | null {
  const match = termPattern(term).exec(sentence)
  if (!match) return null
  const start = match.index + match[1].length
  const end = start + match[2].length
  return {
    before: sentence.slice(0, start),
    match: sentence.slice(start, end),
    after: sentence.slice(end),
  }
}

export function containsTerm(sentence: string, term: string): boolean {
  return findTerm(sentence, term) !== null
}
