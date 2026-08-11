import { describe, expect, it } from 'vitest'
import type { ConjugationLesson, GrammarLesson, PracticeItem, Vocab, VocabLesson } from '@/content/schema'
import {
  buildLessonSession,
  buildReviewSession,
  isAnswerCorrect,
  itemIdsOf,
  matchesAnswer,
  normalizeAnswer,
  splitGap,
  type Exercise,
} from './exercises'
import { createCard, type CardState } from './srs'

/** Emballe une liste de mots dans une leçon de vocabulaire. */
function lessonOf(id: string, vocab: Vocab[]): VocabLesson {
  return { kind: 'vocab', id, title: id, vocab }
}

const T0 = Date.UTC(2026, 0, 1)

function word(id: string, term: string, translation: string, example?: string, alt: string[] = []): Vocab {
  return {
    id,
    term,
    translation,
    alt,
    example: example ? { text: example, translation: '…' } : undefined,
  }
}

const LESSON: Vocab[] = [
  word('hello', 'hello', 'bonjour', 'Hello, my name is Anna.'),
  word('thank-you', 'thank you', 'merci', 'Thank you for your help.'),
  word('sorry', 'sorry', 'désolé', 'Sorry, I am late.', ['pardon']),
  word('please', 'please', "s'il vous plaît", 'A coffee, please.'),
  word('yes', 'yes', 'oui', 'Yes, I understand.'),
  word('no', 'no', 'non', 'No, thank you.'),
]

function kinds(session: Exercise[]): string[] {
  return session.map((exercise) => exercise.kind)
}

describe('session de leçon', () => {
  it('présente chaque mot avant de le tester au niveau 0', () => {
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0)
    const intros = session.filter((exercise) => exercise.kind === 'intro')
    expect(intros).toHaveLength(LESSON.length)

    for (const intro of intros) {
      const introIndex = session.indexOf(intro)
      const tested = session.findIndex(
        (exercise, index) =>
          index > introIndex && exercise.kind !== 'intro' && itemIdsOf(exercise).includes(intro.vocab.id),
      )
      expect(tested).toBeGreaterThan(introIndex)
    }
  })

  it('ne présente plus rien aux niveaux suivants', () => {
    expect(kinds(buildLessonSession(lessonOf('u1-l1', LESSON), 1))).not.toContain('intro')
    expect(kinds(buildLessonSession(lessonOf('u1-l1', LESSON), 2))).not.toContain('intro')
  })

  it('passe de la reconnaissance à la production selon le niveau', () => {
    const level0 = kinds(buildLessonSession(lessonOf('u1-l1', LESSON), 0))
    const level2 = kinds(buildLessonSession(lessonOf('u1-l1', LESSON), 2))
    expect(level0).not.toContain('type')
    expect(level2.filter((kind) => kind === 'type').length).toBeGreaterThan(0)
    expect(level2).not.toContain('flashcard')
  })

  it('propose une banque de mots au niveau 1, la retire au niveau 2', () => {
    const guided = buildLessonSession(lessonOf('u1-l1', LESSON), 1).filter((e) => e.kind === 'cloze')
    const free = buildLessonSession(lessonOf('u1-l1', LESSON), 2).filter((e) => e.kind === 'cloze')
    expect(guided.length).toBeGreaterThan(0)
    // La banque doit contenir une case qui vaut réellement la réponse, au
    // sens où l'écran la valide — pas seulement le terme de dictionnaire.
    expect(
      guided.every(
        (e) => e.bank !== null && e.bank.some((w) => normalizeAnswer(w) === normalizeAnswer(e.sentence.match)),
      ),
    ).toBe(true)
    expect(free.every((e) => e.bank === null)).toBe(true)
  })

  it('propose la forme fléchie, pas l’infinitif, quand le mot est irrégulier', () => {
    // Régression : la banque offrait « to fall out » alors que la phrase
    // attend « fell out », ce qui rendait l'exercice impossible à réussir.
    const irregular: Vocab[] = [
      { ...word('fall-out', 'to fall out', 'se brouiller', 'The brothers fell out over money.'), gap: 'fell out' },
      { ...word('book', 'to book', 'réserver', 'We booked a room online.'), gap: 'booked' },
      word('landlord', 'landlord', 'propriétaire', 'The landlord raised the rent.'),
      word('rent', 'rent', 'loyer', 'The rent is due today.'),
      word('cosy', 'cosy', 'douillet', 'The room is small but cosy.'),
    ]
    const guided = buildLessonSession(lessonOf('u2-l1', irregular), 1).filter((e) => e.kind === 'cloze')
    expect(guided.length).toBeGreaterThan(0)
    for (const exercise of guided) {
      expect(exercise.bank).not.toBeNull()
      expect(exercise.bank!.some((w) => normalizeAnswer(w) === normalizeAnswer(exercise.sentence.match))).toBe(true)
      // et une seule case doit être correcte
      const correct = exercise.bank!.filter((w) => normalizeAnswer(w) === normalizeAnswer(exercise.sentence.match))
      expect(correct).toHaveLength(1)
    }
  })

  it('est déterministe à graine égale, différente d’un niveau à l’autre', () => {
    expect(buildLessonSession(lessonOf('u1-l1', LESSON), 1)).toEqual(buildLessonSession(lessonOf('u1-l1', LESSON), 1))
    expect(buildLessonSession(lessonOf('u1-l1', LESSON), 1)).not.toEqual(buildLessonSession(lessonOf('u1-l1', LESSON), 2))
  })

  it('n’enchaîne pas deux exercices sur le même mot', () => {
    for (const level of [1, 2]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), level)
      for (let i = 1; i < session.length; i++) {
        const previous = new Set(itemIdsOf(session[i - 1]))
        const repeated = itemIdsOf(session[i]).filter((id) => previous.has(id))
        // Une manche d'association peut reprendre un mot déjà vu ; les autres non.
        if (session[i].kind !== 'match' && session[i - 1].kind !== 'match') {
          expect(repeated).toHaveLength(0)
        }
      }
    }
  })

  it('ignore les mots sans phrase d’exemple exploitable', () => {
    const vocab = [
      word('a', 'apple', 'pomme'),
      word('b', 'bread', 'pain', 'Une phrase sans le mot attendu.'),
      word('c', 'cheese', 'fromage', 'This cheese is good.'),
      word('d', 'milk', 'lait', 'There is no milk left.'),
    ]
    const clozes = buildLessonSession(lessonOf('x', vocab), 2).filter((e) => e.kind === 'cloze')
    expect(clozes.map((e) => e.vocab.id).sort()).toEqual(['c', 'd'])
  })

  it('n’ajoute pas de manche d’association sous quatre mots', () => {
    const tiny = LESSON.slice(0, 3)
    expect(kinds(buildLessonSession(lessonOf('x', tiny), 0))).not.toContain('match')
  })
})

describe('session de révision', () => {
  const entries = (states: Partial<CardState>[]): { card: CardState; item: PracticeItem }[] =>
    states.map((state, index) => ({
      card: { ...createCard(LESSON[index].id, T0), ...state },
      item: { kind: 'vocab', id: LESSON[index].id, vocab: LESSON[index] },
    }))

  it('est vide sans carte échue', () => {
    expect(buildReviewSession([])).toEqual([])
  })

  it('teste chaque carte au moins une fois', () => {
    const session = buildReviewSession(entries([{}, {}, {}, {}]))
    const covered = new Set(session.flatMap((exercise) => itemIdsOf(exercise)))
    expect(covered.size).toBeGreaterThanOrEqual(4)
  })

  it('demande la production sur les cartes solides', () => {
    const solid = entries([
      { step: null, interval: 40 },
      { step: null, interval: 60 },
      { step: null, interval: 90 },
      { step: null, interval: 120 },
    ])
    const session = buildReviewSession(solid).filter((e) => e.kind !== 'match')
    expect(session.every((e) => e.kind === 'type' || e.kind === 'cloze')).toBe(true)
  })

  it('reste en reconnaissance sur les cartes fragiles', () => {
    const fragile = entries([{ step: 0 }, { step: 0 }, { step: 1 }, { step: 0 }])
    const session = buildReviewSession(fragile).filter((e) => e.kind !== 'match')
    expect(session.every((e) => e.kind === 'flashcard' || (e.kind === 'cloze' && e.bank !== null))).toBe(true)
  })
})

describe('correction des réponses saisies', () => {
  const sorry = LESSON[2]

  it('accepte la traduction attendue', () => {
    expect(isAnswerCorrect(sorry, 'to-known', 'désolé')).toBe(true)
  })

  it('accepte les variantes déclarées', () => {
    expect(isAnswerCorrect(sorry, 'to-known', 'pardon')).toBe(true)
  })

  it('tolère accents, casse, espaces et ponctuation', () => {
    expect(isAnswerCorrect(sorry, 'to-known', '  Desole. ')).toBe(true)
  })

  it('tolère un article ou un « to » en tête', () => {
    const toGo = word('to-go', 'to go', 'aller')
    expect(isAnswerCorrect(toGo, 'to-learning', 'go')).toBe(true)
    const bread = word('bread', 'bread', 'pain')
    expect(isAnswerCorrect(bread, 'to-known', 'le pain')).toBe(true)
  })

  it('refuse une réponse vide ou fausse', () => {
    expect(isAnswerCorrect(sorry, 'to-known', '')).toBe(false)
    expect(isAnswerCorrect(sorry, 'to-known', '   ')).toBe(false)
    expect(isAnswerCorrect(sorry, 'to-known', 'merci')).toBe(false)
  })

  it('vérifie le mot anglais dans l’autre sens', () => {
    expect(isAnswerCorrect(sorry, 'to-learning', 'sorry')).toBe(true)
    expect(isAnswerCorrect(sorry, 'to-learning', 'désolé')).toBe(false)
  })

  it('ignore apostrophes droites, typographiques et accents', () => {
    expect(normalizeAnswer("S’il vous plaît !")).toBe(normalizeAnswer('sil vous plait'))
    expect(isAnswerCorrect(LESSON[3], 'to-known', "s’il vous plait")).toBe(true)
  })
})

// --- Grammaire et conjugaison -------------------------------------------

const GRAMMAR: GrammarLesson = {
  kind: 'grammar',
  id: 'g1-l1',
  title: 'Le conditionnel mixte',
  notes: 'Une hypothèse passée, une conséquence présente.',
  points: [
    { id: 'p1', sentence: 'If I had known, I ___ there.', answer: 'would be', alt: [], options: ['would be', 'would have been', 'will be'] },
    { id: 'p2', sentence: 'She ___ that message.', answer: 'would not have sent', alt: ["wouldn't have sent"], options: [] },
    { id: 'p3', sentence: 'We ___ stuck now.', answer: 'would not be', alt: [], options: ['would not be', 'had not been'] },
  ],
}

const CONJUGATION: ConjugationLesson = {
  kind: 'conjugation',
  id: 'c1-l1',
  title: 'Present perfect',
  notes: 'have / has + participe passé.',
  verbs: [
    {
      verb: 'to see',
      tense: 'present perfect',
      forms: [
        { id: 'f1', person: 'I / you / we / they', answer: 'have seen', alt: [] },
        { id: 'f2', person: 'he / she / it', answer: 'has seen', alt: [] },
      ],
    },
    {
      verb: 'to go',
      tense: 'present perfect',
      forms: [
        { id: 'f3', person: 'I / you / we / they', answer: 'have gone', alt: [] },
        { id: 'f4', person: 'he / she / it', answer: 'has gone', alt: [] },
      ],
    },
  ],
}

describe('session de grammaire', () => {
  it('ouvre sur le rappel de cours à la découverte, plus après', () => {
    expect(kinds(buildLessonSession(GRAMMAR, 0))[0]).toBe('rule')
    expect(kinds(buildLessonSession(GRAMMAR, 1))).not.toContain('rule')
  })

  it('teste chaque point de la leçon', () => {
    const gaps = buildLessonSession(GRAMMAR, 1).filter((e) => e.kind === 'grammar-gap')
    expect(gaps.map((e) => e.point.id).sort()).toEqual(['p1', 'p2', 'p3'])
  })

  it('propose les formes à la découverte, les retire ensuite', () => {
    const guided = buildLessonSession(GRAMMAR, 0).filter((e) => e.kind === 'grammar-gap')
    const free = buildLessonSession(GRAMMAR, 2).filter((e) => e.kind === 'grammar-gap')
    // p2 n'a pas d'options : il reste au clavier même à la découverte.
    expect(guided.find((e) => e.point.id === 'p1')?.bank).toContain('would be')
    expect(guided.find((e) => e.point.id === 'p2')?.bank).toBeNull()
    expect(free.every((e) => e.bank === null)).toBe(true)
  })

  it('n’ajoute pas de rappel quand la leçon n’en déclare pas', () => {
    const { notes: _notes, ...bare } = GRAMMAR
    expect(kinds(buildLessonSession(bare as GrammarLesson, 0))).not.toContain('rule')
  })
})

describe('session de conjugaison', () => {
  it('relie les paradigmes avant de faire produire', () => {
    const session = kinds(buildLessonSession(CONJUGATION, 0))
    expect(session[0]).toBe('rule')
    expect(session.indexOf('conjugation-match')).toBeLessThan(session.indexOf('conjugation'))
  })

  it('ne demande plus que la production au dernier niveau', () => {
    const session = kinds(buildLessonSession(CONJUGATION, 2))
    expect(session.every((kind) => kind === 'conjugation')).toBe(true)
  })

  it('couvre toutes les formes déclarées', () => {
    const typed = buildLessonSession(CONJUGATION, 2).filter((e) => e.kind === 'conjugation')
    expect(typed.map((e) => e.form.id).sort()).toEqual(['f1', 'f2', 'f3', 'f4'])
  })

  it('note les formes, pas les verbes', () => {
    const match = buildLessonSession(CONJUGATION, 0).find((e) => e.kind === 'conjugation-match')!
    expect(itemIdsOf(match).sort()).toEqual(['f1', 'f2'])
  })
})

describe('révision toutes natures confondues', () => {
  it('rend à chaque élément son exercice propre', () => {
    const items: { card: CardState; item: PracticeItem }[] = [
      { card: createCard('p1', T0), item: { kind: 'grammar', id: 'p1', point: GRAMMAR.points[0] } },
      { card: createCard('f1', T0), item: { kind: 'conjugation', id: 'f1', form: CONJUGATION.verbs[0].forms[0], verb: CONJUGATION.verbs[0] } },
      { card: createCard(LESSON[0].id, T0), item: { kind: 'vocab', id: LESSON[0].id, vocab: LESSON[0] } },
    ]
    const session = buildReviewSession(items)
    expect(session.some((e) => e.kind === 'grammar-gap')).toBe(true)
    expect(session.some((e) => e.kind === 'conjugation')).toBe(true)
  })
})

describe('correction grammaire et conjugaison', () => {
  it('découpe la phrase autour du marqueur', () => {
    expect(splitGap('If I ___ there.')).toEqual({ before: 'If I ', after: ' there.' })
  })

  it('renvoie la phrase entière sans marqueur', () => {
    expect(splitGap('Pas de trou ici.')).toEqual({ before: 'Pas de trou ici.', after: '' })
  })

  it('accepte la réponse attendue et ses variantes', () => {
    expect(matchesAnswer('would not have sent', ["wouldn't have sent"], "wouldn't have sent")).toBe(true)
    expect(matchesAnswer('has seen', [], 'HAS SEEN')).toBe(true)
    expect(matchesAnswer('has seen', [], 'have seen')).toBe(false)
    expect(matchesAnswer('has seen', [], '')).toBe(false)
  })
})
