import { describe, it, expect } from 'vitest'
import {
  conjugationVerbRemarks,
  duplicateAcrossCourses,
  grammarPointRemarks,
  initialSound,
  insertedToken,
  phraseNumber,
} from './difficulty.ts'
import type { ConjugationVerb, GrammarPoint } from '../../src/content/schema.ts'

function point(partial: Partial<GrammarPoint> & Pick<GrammarPoint, 'sentence' | 'answer'>): GrammarPoint {
  return { id: 'p1', alt: [], options: [], ...partial }
}

function verb(tense: string, answers: string[]): ConjugationVerb {
  return {
    verb: 'to test',
    tense,
    forms: answers.map((answer, i) => ({ id: `f${i}`, person: `p${i}`, answer, alt: [] })),
  }
}

describe('initialSound', () => {
  it('suit le son, pas la lettre', () => {
    expect(initialSound('hour')).toBe('vowel')
    expect(initialSound('honest')).toBe('vowel')
    expect(initialSound('university')).toBe('consonant')
    expect(initialSound('European')).toBe('consonant')
    expect(initialSound('United')).toBe('consonant')
    expect(initialSound('apple')).toBe('vowel')
    expect(initialSound('car')).toBe('consonant')
  })

  it('lit le premier segment d\'un mot composé', () => {
    expect(initialSound('once-in-a-lifetime')).toBe('consonant')
  })

  it('ne tranche pas sur un sigle, qui se prononce lettre à lettre', () => {
    expect(initialSound('MP')).toBe('unknown')
    expect(initialSound('NGO')).toBe('unknown')
  })
})

describe('phraseNumber', () => {
  it('lit le déterminant quand il tranche', () => {
    expect(phraseNumber('a researcher')).toBe('sing')
    expect(phraseNumber('these reforms')).toBe('plur')
  })

  it('lit la tête sinon', () => {
    expect(phraseNumber('The water')).toBe('sing')
    expect(phraseNumber('The waters')).toBe('plur')
    expect(phraseNumber('Life')).toBe('sing')
    expect(phraseNumber('The lives')).toBe('plur')
  })

  it('ne se laisse pas piéger par les noms en -s toujours singuliers', () => {
    expect(phraseNumber('The news')).toBe('sing')
    expect(phraseNumber('politics')).toBe('sing')
    expect(phraseNumber('progress')).toBe('sing')
  })
})

describe('grammarPointRemarks — règle a/an', () => {
  it('signale « an » devant un son de consonne', () => {
    const remarks = grammarPointRemarks(
      point({ sentence: '___ car is red.', answer: 'The', options: ['The', 'An', 'Some'] }),
    )
    expect(remarks.join(' ')).toMatch(/« An » est impossible devant « car »|An » est impossible/)
  })

  it('se tait quand le point porte justement sur a/an', () => {
    const remarks = grammarPointRemarks(
      point({ sentence: "It's ___ once-in-a-lifetime opportunity.", answer: 'a', options: ['a', 'an', 'the'] }),
    )
    expect(remarks).toEqual([])
  })

  it('se tait devant un sigle, faute de savoir comment il se prononce', () => {
    const remarks = grammarPointRemarks(
      point({ sentence: 'She met ___ MP yesterday.', answer: 'the', options: ['the', 'a'] }),
    )
    expect(remarks).toEqual([])
  })

  it('accepte « a » devant le [j] de « United »', () => {
    const remarks = grammarPointRemarks(
      point({ sentence: '___ United States signed it.', answer: 'The', options: ['The', 'A', 'This'] }),
    )
    expect(remarks).toEqual([])
  })
})

describe('grammarPointRemarks — accord', () => {
  it('signale un sujet qui casse l\'accord avec le verbe', () => {
    const remarks = grammarPointRemarks(
      point({
        sentence: '___ in this bottle is not drinkable.',
        answer: 'The water',
        options: ['The water', 'Water', 'The waters'],
      }),
    )
    expect(remarks.join(' ')).toMatch(/The waters/)
    expect(remarks.join(' ')).not.toMatch(/« Water »/)
  })

  it('se tait quand le trou est le verbe, l\'accord étant alors la règle', () => {
    const remarks = grammarPointRemarks(
      point({ sentence: 'The news ___ better than expected.', answer: 'is', options: ['is', 'are', 'were'] }),
    )
    expect(remarks).toEqual([])
  })

  it('signale un attribut au pluriel nu après un verbe singulier', () => {
    const remarks = grammarPointRemarks(
      point({
        sentence: 'She is now ___ at the university.',
        answer: 'a researcher',
        options: ['a researcher', 'researcher', 'researchers'],
      }),
    )
    expect(remarks.join(' ')).toMatch(/researchers/)
  })

  // Faux positifs relevés sur le corpus réel au premier passage : le contrôle
  // d'accord ne vaut que pour des groupes nominaux, et « would have » n'accorde
  // rien. Ces trois cas verrouillent les garde-fous correspondants.
  it('se tait quand le trou accueille un auxiliaire et non un sujet', () => {
    const remarks = grammarPointRemarks(
      point({
        sentence: '___ we known earlier, we would have cancelled.',
        answer: 'Had',
        options: ['Had', 'Have', 'Were', 'If'],
      }),
    )
    expect(remarks).toEqual([])
  })

  it('se tait quand le trou accueille une locution prépositionnelle', () => {
    const remarks = grammarPointRemarks(
      point({
        sentence: '___ the storm, the ceremony would have gone ahead as planned.',
        answer: 'But for',
        options: ['But for', 'Except for', 'Apart from', 'Unless for'],
      }),
    )
    expect(remarks).toEqual([])
  })

  it('ne prend pas une conjonction en -s pour un nom pluriel', () => {
    const remarks = grammarPointRemarks(
      point({
        sentence: 'The plan was dropped ___ the increase in costs.',
        answer: 'because of',
        options: ['because of', 'because', 'since', 'as'],
      }),
    )
    expect(remarks).toEqual([])
  })

  it('ne signale rien quand tous les distracteurs sont accordés', () => {
    const remarks = grammarPointRemarks(
      point({
        sentence: '___ is short, and we waste it.',
        answer: 'Life',
        options: ['Life', 'The life', 'A life'],
      }),
    )
    expect(remarks).toEqual([])
  })
})

describe('insertedToken', () => {
  it('trouve le mot inséré', () => {
    expect(insertedToken('will win', 'will not win')).toBe('not')
    expect(insertedToken('will win', 'will you win')).toBe('you')
  })

  it('ne voit pas d\'insertion quand les formes diffèrent autrement', () => {
    expect(insertedToken('would have passed', 'would pass')).toBeNull()
    expect(insertedToken('have been working', 'has been working')).toBeNull()
    expect(insertedToken('used to live', 'did not use to live')).toBeNull()
    expect(insertedToken('turn down the offer', 'turn it down')).toBeNull()
  })
})

describe('conjugationVerbRemarks', () => {
  it('signale la paire affirmatif/négatif au-delà de B1', () => {
    const remarks = conjugationVerbRemarks(verb('1er conditionnel', ['will win', 'will not win']), 'B2')
    expect(remarks).toHaveLength(1)
    expect(remarks[0]).toMatch(/« not »/)
  })

  it('signale aussi la paire affirmatif/interrogatif', () => {
    expect(conjugationVerbRemarks(verb('1er conditionnel', ['will win', 'will you win']), 'B2')).toHaveLength(1)
  })

  it('laisse passer une opposition de construction réelle', () => {
    expect(
      conjugationVerbRemarks(verb('conditionnel', ['would have passed', 'would pass']), 'B2'),
    ).toEqual([])
  })

  it('tolère la négation en B1, où elle est encore l\'objet du cours', () => {
    expect(conjugationVerbRemarks(verb('futur', ['will go', 'will not go']), 'B1')).toEqual([])
  })
})

describe('duplicateAcrossCourses', () => {
  it('signale une phrase reprise d\'un cours à l\'autre', () => {
    const remarks = duplicateAcrossCourses([
      { courseId: 'fr-en-b2', where: 'g1-wish-3', sentence: 'I wish you would stop interrupting me.' },
      { courseId: 'fr-en-c1', where: 'g2-wish-3', sentence: 'I wish you would stop interrupting me.' },
    ])
    expect(remarks).toHaveLength(1)
    expect(remarks[0]).toMatch(/fr-en-b2 et fr-en-c1/)
  })

  it('laisse une phrase réutilisée dans un même cours', () => {
    const remarks = duplicateAcrossCourses([
      { courseId: 'fr-en-b2', where: 'a', sentence: 'The decision was taken in March that year.' },
      { courseId: 'fr-en-b2', where: 'b', sentence: 'The decision was taken in March that year.' },
    ])
    expect(remarks).toEqual([])
  })

  it('ignore les fragments trop courts pour être signifiants', () => {
    const remarks = duplicateAcrossCourses([
      { courseId: 'a', where: 'x', sentence: 'I wish I knew.' },
      { courseId: 'b', where: 'y', sentence: 'I wish I knew.' },
    ])
    expect(remarks).toEqual([])
  })
})
