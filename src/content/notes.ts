/**
 * Mise en forme des rappels de cours.
 *
 * Les `notes:` d'une leçon sont du texte brut, écrit à la main dans le YAML et
 * replié à ~80 colonnes pour rester lisible dans le fichier. Ce repli est une
 * commodité d'édition, pas une intention typographique : la première version
 * de l'écran coupait naïvement sur chaque retour à la ligne, si bien qu'une
 * phrase repliée s'affichait en deux paragraphes séparés par un blanc. D'où le
 * texte haché que voyait l'apprenant.
 *
 * Ce module reconstitue l'intention de l'auteur :
 *
 *   - les lignes de prose qui se suivent forment un seul paragraphe ;
 *   - une ligne vide sépare deux paragraphes ;
 *   - une ligne ouverte par « — » est une règle, mise en valeur ;
 *   - une ligne indentée sous une règle en est l'exemple ;
 *   - une ligne ouverte par « ! » est un piège, signalé comme tel.
 *
 * Le format reste du texte : pas de moteur Markdown à embarquer, et un auteur
 * qui ne connaît aucune de ces conventions obtient malgré tout des paragraphes
 * corrects.
 */

/**
 * Fragment de texte enrichi.
 *
 * `form` est le plus utile des quatre : il marque une forme anglaise citée au
 * milieu d'une explication française. L'œil la repère sans lire, ce qui est
 * exactement ce qu'on demande à un rappel de cours.
 */
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'underline'; children: Inline[] }
  /** Forme anglaise citée : littérale, rien ne s'y imbrique. */
  | { kind: 'form'; text: string }

const INLINE = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`/g

/**
 * `**gras**`, `*italique*`, `__souligné__`, `` `forme anglaise` ``.
 *
 * Les trois premiers s'imbriquent — « **pas de `to`** » met bien la forme en
 * valeur à l'intérieur du gras. Le quatrième est littéral, comme du code.
 * Un texte sans aucun marqueur ressort en un seul fragment, ce qui rend la
 * fonction sûre à appliquer partout.
 */
export function parseInline(text: string): Inline[] {
  const spans: Inline[] = []
  let last = 0

  for (const match of text.matchAll(INLINE)) {
    const at = match.index
    if (at > last) spans.push({ kind: 'text', text: text.slice(last, at) })

    const [, strong, underline, em, form] = match
    if (strong !== undefined) spans.push({ kind: 'strong', children: parseInline(strong) })
    else if (underline !== undefined) spans.push({ kind: 'underline', children: parseInline(underline) })
    else if (em !== undefined) spans.push({ kind: 'em', children: parseInline(em) })
    else if (form !== undefined) spans.push({ kind: 'form', text: form })

    last = at + match[0].length
  }

  if (last < text.length) spans.push({ kind: 'text', text: text.slice(last) })
  return spans
}

/** Une règle, avec son étiquette éventuelle et son exemple éventuel. */
export interface NoteRule {
  /** Ce qui précède le « : » — le cas couvert par la règle. */
  label: string | null
  /** Le corps de la règle. */
  body: string
  /** Exemple donné sur la ligne indentée qui suit. */
  example: string | null
}

export type NoteBlock =
  | { kind: 'paragraph'; text: string }
  /** Suite de règles consécutives : elles s'affichent comme une seule liste. */
  | { kind: 'rules'; rules: NoteRule[] }
  | { kind: 'warning'; text: string }

const RULE = /^—\s*/
const WARNING = /^!\s*/

/**
 * Sépare « étiquette : corps » quand la ligne s'y prête.
 *
 * On ne coupe que sur le premier « : » entouré d'espaces, et seulement si
 * l'étiquette reste courte : « If + présent simple, … will + base verbale. »
 * ne doit pas être charcuté, alors que « Une syllabe : -er + than » gagne à
 * l'être.
 */
function splitLabel(text: string): { label: string | null; body: string } {
  const at = text.indexOf(' : ')
  if (at === -1 || at > 48) return { label: null, body: text }
  return { label: text.slice(0, at), body: text.slice(at + 3) }
}

export function parseNotes(notes: string): NoteBlock[] {
  const blocks: NoteBlock[] = []
  // Bloc de texte en cours de constitution — prose ou piège. Les lignes s'y
  // accumulent jusqu'à ce qu'une ligne vide ou un marqueur vienne le clore,
  // ce qui recolle les phrases repliées quel que soit leur type.
  let pending: { kind: 'paragraph' | 'warning'; lines: string[] } | null = null

  function flush() {
    if (!pending) return
    blocks.push({ kind: pending.kind, text: pending.lines.join(' ') })
    pending = null
  }

  /** La liste de règles ouverte, s'il y en a une juste au-dessus. */
  function openRules(): NoteRule[] | null {
    const last = blocks[blocks.length - 1]
    return last?.kind === 'rules' ? last.rules : null
  }

  for (const raw of notes.split('\n')) {
    const line = raw.trim()

    if (line === '') {
      flush()
      continue
    }

    if (RULE.test(line)) {
      flush()
      const { label, body } = splitLabel(line.replace(RULE, ''))
      const rule: NoteRule = { label, body, example: null }
      const current = openRules()
      if (current) current.push(rule)
      else blocks.push({ kind: 'rules', rules: [rule] })
      continue
    }

    if (WARNING.test(line)) {
      flush()
      pending = { kind: 'warning', lines: [line.replace(WARNING, '')] }
      continue
    }

    // Ligne indentée juste après une règle : c'est son exemple. On regarde
    // l'indentation de la ligne brute, la seule trace qu'il en reste.
    const rules = openRules()
    if (/^\s+/.test(raw) && !pending && rules) {
      const last = rules[rules.length - 1]
      last.example = last.example ? `${last.example} ${line}` : line
      continue
    }

    if (pending) pending.lines.push(line)
    else pending = { kind: 'paragraph', lines: [line] }
  }

  flush()
  return blocks
}

/**
 * Découpe le commentaire final entre parenthèses, pour l'afficher en retrait.
 * « I will call you as soon as I arrive. (jamais « as soon as I will arrive ») »
 */
export function splitAside(text: string): { main: string; aside: string | null } {
  const match = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(text)
  if (!match) return { main: text, aside: null }
  return { main: match[1], aside: match[2] }
}
