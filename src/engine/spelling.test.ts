import { afterEach, describe, expect, it } from 'vitest'
import type { Vocab } from '@/content/schema'
import { isAnswerCorrect, matchesAnswer } from './exercises'
import { foldDarija, setSpellingLanguage } from './spelling'

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
