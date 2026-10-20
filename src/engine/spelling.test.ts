import { afterEach, describe, expect, it } from 'vitest'
import type { Vocab } from '@/content/schema'
import { isAnswerCorrect, matchesAnswer } from './exercises'
import { foldDarija, isExactSpelling, setSpellingLanguage } from './spelling'

const chokran: Vocab = { id: 'ary-chokran', term: 'chokran', translation: 'merci', alt: [] }

describe('foldDarija', () => {
  it('ramène les graphies usuelles à une même forme', () => {
    for (const variant of ['choukran', 'shukran', 'chukran']) {
      expect(foldDarija(variant)).toBe(foldDarija('chokran'))
    }
    expect(foldDarija('mezyan')).toBe(foldDarija('mzyan'))
    expect(foldDarija('mzian')).toBe(foldDarija('mzyan'))
    expect(foldDarija('bezzaf')).toBe(foldDarija('bzaf'))
    expect(foldDarija('lqahwa')).toBe(foldDarija('l9ahwa'))
    expect(foldDarija('mzyané')).toBe(foldDarija('mzyan'))
  })

  it("garde l'article assimilé en tête de mot", () => {
    expect(foldDarija('ddar')).not.toBe(foldDarija('dar'))
    expect(foldDarija('l ssouq')).not.toBe(foldDarija('l souq'))
  })

  it('garde distincts les sons que notent les chiffres', () => {
    expect(foldDarija('3afak')).not.toBe(foldDarija('afak'))
    expect(foldDarija('l7lib')).not.toBe(foldDarija('lhlib'))
  })

  it('ne confond pas deux personnes de la conjugaison', () => {
    expect(foldDarija('katkhdem')).not.toBe(foldDarija('katkhdmi'))
    expect(foldDarija('kankhdem')).not.toBe(foldDarija('kankhdmo'))
  })
})

describe('repli des graphies selon le cours', () => {
  afterEach(() => setSpellingLanguage('en'))

  it("s'applique à la langue apprise d'un cours de darija", () => {
    setSpellingLanguage('ary')
    expect(isAnswerCorrect(chokran, 'to-learning', 'Choukran')).toBe(true)
    expect(matchesAnswer('khdemt', [], 'khedmt')).toBe(true)
  })

  it('ne touche pas au français', () => {
    setSpellingLanguage('ary')
    expect(isAnswerCorrect(chokran, 'to-known', 'mrci')).toBe(false)
  })

  it("n'existe pas pour une langue qui n'en déclare pas", () => {
    setSpellingLanguage('en')
    expect(matchesAnswer('better', [], 'bettr')).toBe(false)
  })
})

describe('orthotypographie : comparaison au signe près', () => {
  afterEach(() => setSpellingLanguage('en'))

  it('distingue casse, ponctuation et espaces quand le cours apprend le français', () => {
    setSpellingLanguage('fr')
    expect(isExactSpelling()).toBe(true)
    expect(matchesAnswer('M.', [], 'M.')).toBe(true)
    expect(matchesAnswer('M.', [], 'M')).toBe(false)
    expect(matchesAnswer("l'Assemblée nationale", [], "l'assemblée nationale")).toBe(false)
    expect(matchesAnswer('prévu :', [], 'prévu:')).toBe(false)
    expect(matchesAnswer('12 500', [], '12,500')).toBe(false)
  })

  it('reste tolérante pour les autres langues', () => {
    setSpellingLanguage('en')
    expect(isExactSpelling()).toBe(false)
    expect(matchesAnswer('M.', [], 'm')).toBe(true)
  })
})
