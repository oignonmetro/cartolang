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

/**
 * Localise, dans une phrase d'exemple, la portion à masquer pour l'exercice
 * à trou.
 *
 * Les verbes sont listés à l'infinitif (« to step down ») mais apparaissent
 * conjugués dans les exemples (« will step down »). On essaie donc le terme
 * complet, puis sa forme nue sans « to ». Quand la conjugaison est irrégulière
 * (« fell through »), l'auteur donne la forme exacte via le champ `gap`.
 */
export function findVocabGap(sentence: string, term: string, gap?: string): TermSplit | null {
  const candidates = gap ? [gap] : [term, term.replace(/^to\s+/i, '')]
  for (const candidate of candidates) {
    const found = findTerm(sentence, candidate)
    if (found) return found
  }
  return null
}
