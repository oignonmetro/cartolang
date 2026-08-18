import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

/**
 * Prononciation des mots anglais.
 *
 * L'orthographe anglaise ne donne pas la prononciation : on peut savoir
 * écrire « cogent » ou « thorough » sans pouvoir les dire ni les reconnaître
 * à l'oral, ce qui laisse la moitié du mot non apprise. D'où ce module.
 *
 * Deux chemins, parce qu'un seul ne suffit pas :
 *
 *   - dans l'APK, le moteur TTS du système via le plugin Capacitor. C'est
 *     obligatoire : `speechSynthesis` est absent de la WebView Android — il
 *     répond `undefined` là où il fonctionne dans Chrome sur le même
 *     téléphone. S'appuyer sur l'API web seule donnerait une app muette une
 *     fois empaquetée, et muette sans erreur, ce qui est pire ;
 *   - dans le navigateur et la PWA, `speechSynthesis`, que le plugin ne
 *     couvre pas.
 *
 * Aucun des deux n'est garanti : la voix anglaise peut ne pas être installée
 * sur l'appareil, et l'API web peut manquer. Tout échoue donc en silence — on
 * n'interrompt jamais une session pour un son, et l'appelant peut demander à
 * l'avance si le bouton vaut la peine d'être affiché.
 */

/**
 * Étiquette de voix pour chaque langue enseignée.
 *
 * Le code court vient du champ `learning` du cours ; le moteur de synthèse,
 * lui, attend une étiquette complète. Faire lire du russe par une voix
 * anglaise ne donnerait pas un accent approximatif mais du charabia : la
 * langue doit suivre le cours, pas être figée.
 */
const VOICES: Record<string, string> = {
  en: 'en-US',
  ru: 'ru-RU',
}

const FALLBACK = 'en-US'
let LANG = FALLBACK

/** Appelé au chargement d'un cours (voir `CourseProvider`). */
export function setSpokenLanguage(learning: string): void {
  LANG = VOICES[learning] ?? FALLBACK
}

const native = Capacitor.isNativePlatform()

function webVoices(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

/**
 * Y a-t-il une chance qu'on puisse parler ?
 *
 * Sur l'appareil on répond oui sans interroger le moteur : la vérification
 * est asynchrone alors que l'affichage du bouton ne l'est pas, et un bouton
 * qui reste muet une fois sur cent vaut mieux qu'un bouton jamais affiché.
 */
export const canSpeak: boolean = native || webVoices() !== null

/**
 * Prononce un mot ou une phrase en anglais.
 *
 * Ne renvoie jamais d'erreur : une prononciation est un confort, pas une
 * étape de la session. Un `await` reste possible pour enchaîner, mais rien
 * n'oblige à l'attendre.
 */
export async function speak(text: string): Promise<void> {
  const trimmed = text.trim()
  if (trimmed.length === 0) return

  try {
    if (native) {
      // Couper d'abord : deux appuis rapprochés se chevaucheraient, et le
      // moteur Android empile les demandes au lieu de les remplacer.
      await TextToSpeech.stop().catch(() => {})
      await TextToSpeech.speak({ text: trimmed, lang: LANG, rate: 0.95 })
      return
    }

    const synth = webVoices()
    if (!synth) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = LANG
    utterance.rate = 0.95
    synth.speak(utterance)
  } catch {
    // Voix absente, moteur indisponible, permission refusée : on se tait.
  }
}

/** Interrompt la lecture en cours, par exemple en quittant un écran. */
export async function stopSpeaking(): Promise<void> {
  try {
    if (native) await TextToSpeech.stop()
    else webVoices()?.cancel()
  } catch {
    // Rien à interrompre.
  }
}
