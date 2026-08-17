import { describe, expect, it } from 'vitest'
import { parseInline, parseNotes, ruleSpeech, splitAside, type NoteRule } from './notes'

describe('rappels de cours', () => {
  it('recolle une phrase repliée sur plusieurs lignes', () => {
    // Le cas qui motivait tout : le repli à 80 colonnes du fichier YAML
    // s'affichait en deux paragraphes séparés par un blanc.
    const blocks = parseNotes(
      "Les modaux ne se conjuguent pas : pas de -s à la troisième personne, pas\nde « to » après eux, et pas d'auxiliaire « do » à la négation.",
    )
    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        text: "Les modaux ne se conjuguent pas : pas de -s à la troisième personne, pas de « to » après eux, et pas d'auxiliaire « do » à la négation.",
      },
    ])
  })

  it('sépare deux paragraphes sur une ligne vide', () => {
    const blocks = parseNotes('Premier paragraphe.\n\nSecond paragraphe.')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Premier paragraphe.' },
      { kind: 'paragraph', text: 'Second paragraphe.' },
    ])
  })

  it('groupe les règles consécutives en une seule liste', () => {
    const blocks = parseNotes('— can → could.\n— will → would.\n— may → might.')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'rules' })
    expect(blocks[0].kind === 'rules' && blocks[0].rules).toHaveLength(3)
  })

  it('détache l’étiquette d’une règle « cas : contenu »', () => {
    const blocks = parseNotes('— Une syllabe : -er + than.')
    expect(blocks[0]).toEqual({
      kind: 'rules',
      rules: [{ label: 'Une syllabe', body: '-er + than.', example: null }],
    })
  })

  it('ne coupe pas une règle dont le « : » arrive trop tard', () => {
    // Sinon « If + présent simple, … will + base verbale » se ferait charcuter.
    const long = '— Quand la condition est plausible et que rien ne s’y oppose : on garde le présent.'
    const blocks = parseNotes(long)
    expect(blocks[0].kind === 'rules' && blocks[0].rules[0].label).toBeNull()
  })

  it('rattache une ligne indentée à la règle qu’elle illustre', () => {
    const blocks = parseNotes('— If + présent simple, … will + base verbale.\n  If it rains, we will stay at home.')
    expect(blocks[0]).toEqual({
      kind: 'rules',
      rules: [
        {
          label: null,
          body: 'If + présent simple, … will + base verbale.',
          example: 'If it rains, we will stay at home.',
        },
      ],
    })
  })

  it('reconnaît un piège signalé par « ! »', () => {
    const blocks = parseNotes('Règle générale.\n! « very better » est faux.')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Règle générale.' },
      { kind: 'warning', text: '« very better » est faux.' },
    ])
  })

  it('recolle un piège replié sur plusieurs lignes', () => {
    const blocks = parseNotes('! Jamais de -s derrière un modal :\n« she wills » est fautif.')
    expect(blocks).toEqual([
      { kind: 'warning', text: '! Jamais de -s derrière un modal : « she wills » est fautif.'.replace('! ', '') },
    ])
  })

  it('referme un piège sur une ligne vide, sans avaler la suite', () => {
    // Le piège absorbe ses propres lignes repliées, mais une ligne vide le
    // clôt : sans quoi la règle qui suit se retrouverait encadrée en ambre.
    const blocks = parseNotes('! Jamais de « will » après « if » :\nc’est la faute la plus fréquente.\n\nQuand le fait est toujours vrai, les deux propositions sont au présent.')
    expect(blocks.map((block) => block.kind)).toEqual(['warning', 'paragraph'])
    expect(blocks[1]).toEqual({
      kind: 'paragraph',
      text: 'Quand le fait est toujours vrai, les deux propositions sont au présent.',
    })
  })

  it('reprend la prose après une liste de règles', () => {
    const blocks = parseNotes('Avant.\n— Une règle.\nAprès, sur deux\nlignes repliées.')
    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'rules', 'paragraph'])
    expect(blocks[2]).toEqual({ kind: 'paragraph', text: 'Après, sur deux lignes repliées.' })
  })

  it('ne rend rien pour des notes vides', () => {
    expect(parseNotes('')).toEqual([])
    expect(parseNotes('\n  \n')).toEqual([])
  })
})

describe('mise en forme dans le texte', () => {
  it('laisse un texte sans marqueur en un seul fragment', () => {
    expect(parseInline('Rien à signaler.')).toEqual([{ kind: 'text', text: 'Rien à signaler.' }])
  })

  it('reconnaît les quatre marqueurs', () => {
    expect(parseInline('**g** *i* __s__ `f`')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'g' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'i' }] },
      { kind: 'text', text: ' ' },
      { kind: 'underline', children: [{ kind: 'text', text: 's' }] },
      { kind: 'text', text: ' ' },
      { kind: 'form', text: 'f' },
    ])
  })

  it('ne confond pas le gras avec l’italique', () => {
    expect(parseInline('**deux** puis *un*')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'deux' }] },
      { kind: 'text', text: ' puis ' },
      { kind: 'em', children: [{ kind: 'text', text: 'un' }] },
    ])
  })

  it('interprète une forme anglaise à l’intérieur du gras', () => {
    // Régression : « **pas de `to`** » affichait les accents graves en clair.
    expect(parseInline('**pas de `to`**')).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'pas de ' },
          { kind: 'form', text: 'to' },
        ],
      },
    ])
  })

  it('conserve le texte autour des marqueurs', () => {
    expect(parseInline('avant `will` après')).toEqual([
      { kind: 'text', text: 'avant ' },
      { kind: 'form', text: 'will' },
      { kind: 'text', text: ' après' },
    ])
  })

  it('laisse intact un marqueur non refermé', () => {
    expect(parseInline('un * isolé')).toEqual([{ kind: 'text', text: 'un * isolé' }])
  })
})

describe('commentaire entre parenthèses', () => {
  it('isole le commentaire final', () => {
    expect(splitAside('I will call you as soon as I arrive. (jamais « I will arrive »)')).toEqual({
      main: 'I will call you as soon as I arrive.',
      aside: 'jamais « I will arrive »',
    })
  })

  it('laisse intacte une phrase sans commentaire final', () => {
    expect(splitAside('She can swim.')).toEqual({ main: 'She can swim.', aside: null })
  })

  it('ne se laisse pas piéger par une parenthèse au milieu', () => {
    const text = 'Les horaires (trains, cinémas) prennent le présent simple.'
    expect(splitAside(text)).toEqual({ main: text, aside: null })
  })
})

describe('ruleSpeech', () => {
  const rule = (body: string, example: string | null = null): NoteRule => ({ label: null, body, example })

  it('ne retient que la phrase anglaise quand la traduction suit', () => {
    expect(ruleSpeech(rule('x', 'If it rains, we will stay at home. S\'il pleut, nous resterons à la maison.')))
      .toBe('If it rains, we will stay at home.')
  })

  it('écarte le commentaire français entre parenthèses', () => {
    expect(ruleSpeech(rule('x', 'That bag looks heavy; I\'ll help you. (je le décide en parlant)')))
      .toBe("That bag looks heavy; I'll help you.")
  })

  it('se rabat sur les formes citées quand la règle n\'a pas d\'exemple', () => {
    expect(ruleSpeech(rule('`depend on`, `rely on`, `insist on`'))).toBe('depend on, rely on, insist on')
  })

  it('préfère la phrase complète aux formes citées', () => {
    expect(ruleSpeech(rule('`will` : décision prise à l\'instant', 'I will help you with that.')))
      .toBe('I will help you with that.')
  })

  it('se tait sur un résidu de repli de ligne', () => {
    expect(ruleSpeech(rule('x', 'jour précis est nommé** : on Monday morning.'))).toBeNull()
  })

  it('se tait sur un fragment de liste sans majuscule', () => {
    expect(ruleSpeech(rule('x', 'for ten years, since 2015, during the meeting'))).toBeNull()
  })

  it('se tait quand il n\'y a ni exemple ni forme citée', () => {
    expect(ruleSpeech(rule('Une règle sans aucune forme anglaise.'))).toBeNull()
  })

  it('retire les accents graves de la phrase lue', () => {
    expect(ruleSpeech(rule('x', '`Life is short.` And we waste it.'))).toBe('Life is short. And we waste it.')
  })
})

describe('ruleSpeech — défauts vus au rendu', () => {
  const rule = (body: string, example: string | null = null): NoteRule => ({ label: null, body, example })

  it('n\'ajoute pas de virgule après un point', () => {
    expect(ruleSpeech(rule('Article zéro : `Life is short.` `Children learn fast.`')))
      .toBe('Life is short. Children learn fast.')
  })

  it('sépare d\'une virgule les formes non ponctuées', () => {
    expect(ruleSpeech(rule('`depend on`, `rely on`'))).toBe('depend on, rely on')
  })

  it('se tait sur un article seul, trop bref pour s\'entendre', () => {
    expect(ruleSpeech(rule('Un nom de métier prend `a`, contrairement au français.'))).toBeNull()
  })
})
