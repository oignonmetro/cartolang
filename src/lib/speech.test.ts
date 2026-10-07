import { describe, expect, it } from 'vitest'
import { speechFor, voiceFor } from './speech'

describe('speechFor', () => {
  it('épelle une consonne russe isolée plutôt que de la lire telle quelle', () => {
    // Une consonne seule n'est pas une syllabe : plusieurs moteurs de
    // synthèse la rendent en silence faute de voyelle pour la porter.
    expect(speechFor({ term: 'Т', pos: 'lettre' })).toBe('тэ')
    expect(speechFor({ term: 'К', pos: 'lettre' })).toBe('ка')
  })

  it('épelle le signe dur et le signe mou, muets en isolation', () => {
    expect(speechFor({ term: 'Ъ', pos: 'lettre' })).toBe('твёрдый знак')
    expect(speechFor({ term: 'Ь', pos: 'lettre' })).toBe('мягкий знак')
  })

  it('laisse une voyelle russe telle quelle', () => {
    expect(speechFor({ term: 'А', pos: 'lettre' })).toBe('а')
  })

  it('laisse un mot ordinaire tel quel, même hors alphabet couvert', () => {
    expect(speechFor({ term: 'hitherto', pos: 'adverbe' })).toBe('hitherto')
    expect(speechFor({ term: 'мама', pos: 'nom' })).toBe('мама')
  })

  it("lit la forme arabe d'un mot de darija transcrit en lettres latines", () => {
    // La voix arabe ânonnerait « chokran » lettre à lettre.
    expect(speechFor({ term: 'chokran', pos: 'expression', speech: 'شكرا' })).toBe('شكرا')
  })
})

describe('voiceFor', () => {
  const voice = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice

  it('préfère la variante exacte, sinon une voix de la même langue', () => {
    expect(voiceFor([voice('ar-SA'), voice('ar-MA')], 'ar-MA')?.lang).toBe('ar-MA')
    expect(voiceFor([voice('en-US'), voice('ar_SA')], 'ar-MA')?.lang).toBe('ar_SA')
  })

  it("ne prend pas une voix d'une autre langue", () => {
    expect(voiceFor([voice('en-US'), voice('fr-FR')], 'ar-MA')).toBeNull()
  })
})
