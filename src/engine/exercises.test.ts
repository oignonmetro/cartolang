import { describe, expect, it } from 'vitest'
import type { Vocab } from '@/content/schema'
import {
  isAnswerCorrect,
  matchesAnswer,
  normalizeAnswer,
  normalizeForm,
  normalizeKnownAnswer,
  splitGap,
} from './exercises'

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
    expect(normalizeKnownAnswer("S’il vous plaît !")).toBe(normalizeKnownAnswer('sil vous plait'))
    expect(isAnswerCorrect(LESSON[3], 'to-known', "s’il vous plait")).toBe(true)
  })

  it('exige les accents dans la langue apprise, pas en français', () => {
    // Dans la langue apprise l'accent est de l'orthographe : « qué » n'est
    // pas « que ». Le français tapé, lui, garde sa tolérance.
    const what = word('que', 'qué', 'quoi')
    expect(isAnswerCorrect(what, 'to-learning', 'qué')).toBe(true)
    expect(isAnswerCorrect(what, 'to-learning', 'que')).toBe(false)
    const year = word('ano', 'año', 'année')
    expect(isAnswerCorrect(year, 'to-learning', 'ano')).toBe(false)
    expect(isAnswerCorrect(year, 'to-known', 'annee')).toBe(true)
  })

  it('accepte une lettre accentuée tapée décomposée', () => {
    // Selon le clavier, « é » arrive précomposé ou en e + accent combinant.
    const what = word('que', 'qué', 'quoi')
    expect(isAnswerCorrect(what, 'to-learning', 'qué'.normalize('NFD'))).toBe(true)
    expect(normalizeAnswer('мой'.normalize('NFD'))).toBe(normalizeAnswer('мой'))
  })

  it('distingue Й de И et Ё de Е, même côté français', () => {
    // Régression : retirer toutes les marques combinantes faisait de « Мой »
    // et « Мои » la même réponse — la brève de Й est une lettre, pas un accent.
    const my = word('moi', 'мой', 'mon')
    expect(isAnswerCorrect(my, 'to-learning', 'мои')).toBe(false)
    expect(isAnswerCorrect(my, 'to-learning', 'Мой')).toBe(true)
    expect(normalizeKnownAnswer('мой')).not.toBe(normalizeKnownAnswer('мои'))
    expect(normalizeKnownAnswer('ёлка')).not.toBe(normalizeKnownAnswer('елка'))
    expect(normalizeKnownAnswer('Ёлка')).toBe('ёлка')
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

  it('distingue l’article et le « to », qui font l’objet de l’exercice', () => {
    // Régression : la comparaison lâche du vocabulaire retirait l'article et
    // le « to », si bien qu'une leçon sur « little » vs « a little » acceptait
    // les deux, et qu'un leurre comme « the shorter » passait pour correct.
    expect(matchesAnswer('little', [], 'a little')).toBe(false)
    expect(matchesAnswer('shorter', [], 'the shorter')).toBe(false)
    expect(matchesAnswer('to postpone', [], 'postpone')).toBe(false)
    // Une variante réellement acceptable reste déclarée par l'auteur.
    expect(matchesAnswer('boils', ['boiled'], 'boiled')).toBe(true)
  })

  it('distingue les options qui ne diffèrent que par un accent ou une brève', () => {
    // Régression : « Мой » / « Мои » (rg1-moi-*) et « que » / « qué »
    // (g5-creo-*) sont des options d'un même point ; la saisie de l'une
    // passait pour l'autre, et le choix de l'une comptait juste pour l'autre.
    expect(matchesAnswer('Мой', [], 'Мои')).toBe(false)
    expect(matchesAnswer('Мой', [], 'мой')).toBe(true)
    expect(matchesAnswer('Её', [], 'Ее')).toBe(false)
    expect(matchesAnswer('qué', [], 'que')).toBe(false)
    expect(matchesAnswer('que', [], 'qué')).toBe(false)
    expect(normalizeForm('Мой')).not.toBe(normalizeForm('Мои'))
    expect(normalizeForm('Qué')).toBe(normalizeForm('qué'.normalize('NFD')))
  })

  it('reste souple sur l’article pour le vocabulaire', () => {
    const vocab: Vocab = { id: 'w', term: 'to tackle', translation: "s'attaquer à", alt: [] }
    expect(isAnswerCorrect(vocab, 'to-learning', 'tackle')).toBe(true)
    expect(isAnswerCorrect(vocab, 'to-learning', 'to tackle')).toBe(true)
  })
})
