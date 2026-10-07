import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import type { Vocab } from '@/content/schema'

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
const VOICES: Record<string, string | null> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  // Peu d'appareils ont une voix darija à proprement parler : `ar-MA` prend
  // la voix marocaine quand elle existe (Edge en propose), sinon une voix
  // arabe. Elle ne lit que l'écriture arabe — voir `SPOKEN_SCRIPTS`.
  ary: 'ar-MA',
}

/**
 * Écriture que la voix sait lire, pour une langue dont le cours s'écrit dans
 * une autre.
 *
 * Le darija s'enseigne en transcription latine (`chokran`), qu'une voix arabe
 * ânonnerait lettre à lettre. Chaque mot porte donc sa forme arabe dans
 * `speech` (`شكرا`), confiée à la voix et jamais affichée ; tout le reste —
 * phrases d'exemple, grammaire, conjugaison, rappels — n'a que la
 * transcription, et se tait. Mieux vaut pas de bouton qu'un bouton qui lit
 * du charabia.
 */
const SPOKEN_SCRIPTS: Record<string, RegExp> = {
  ary: /\p{Script=Arabic}/u,
}

const FALLBACK = 'en-US'
let LANG: string | null = FALLBACK
let LEARNING = 'en'
let LEARNING_NAME = 'anglais'

/** Appelé au chargement d'un cours (voir `CourseProvider`). */
export function setSpokenLanguage(learning: string): void {
  LANG = learning in VOICES ? VOICES[learning]! : FALLBACK
  LEARNING = learning
}

/**
 * Code court de la langue enseignée par le cours actif (« en », « ru »…).
 *
 * Sert à l'attribut HTML `lang` des champs où l'on tape la langue apprise
 * (thème, production en révision) : c'est ce qui fait proposer au clavier du
 * téléphone la disposition correspondante, pourvu qu'elle soit installée.
 * Ailleurs qu'à l'oral, le nom peut surprendre — il vient de `setSpokenLanguage`
 * parce que la voix et le clavier suivent la même langue, et qu'un deuxième
 * réglage à synchroniser avec le cours n'aurait rien ajouté.
 */
export function learningLanguage(): string {
  return LEARNING
}

/**
 * Nom de la langue apprise, tel qu'affiché dans une consigne (« russe »,
 * « anglais »). Vient de `course.name` — la seule source qui l'écrive en
 * toutes lettres — et non d'une liste figée ici, qui aurait fini par
 * diverger du contenu réel à mesure que des cours s'ajoutent.
 */
export function setLearningLanguageName(name: string): void {
  LEARNING_NAME = name.toLowerCase()
}

export function learningLanguageName(): string {
  return LEARNING_NAME
}

/**
 * Nom de chaque lettre de l'alphabet russe, tel qu'on l'épèle à l'oral.
 *
 * Une consonne seule (« Т », « К »…) n'est pas une syllabe : sans voyelle
 * pour la porter, plusieurs moteurs de synthèse ne produisent aucun son
 * audible — silence total plutôt qu'un accent approximatif. Le signe dur et
 * le signe mou n'ont même pas de son propre en isolation. On fait donc dire
 * au moteur le nom de la lettre, pas la lettre elle-même — ce qu'un
 * locuteur ferait aussi en l'épelant.
 */
const RUSSIAN_LETTER_NAMES: Record<string, string> = {
  А: 'а',
  Б: 'бэ',
  В: 'вэ',
  Г: 'гэ',
  Д: 'дэ',
  Е: 'е',
  Ё: 'ё',
  Ж: 'жэ',
  З: 'зэ',
  И: 'и',
  Й: 'ий',
  К: 'ка',
  Л: 'эль',
  М: 'эм',
  Н: 'эн',
  О: 'о',
  П: 'пэ',
  Р: 'эр',
  С: 'эс',
  Т: 'тэ',
  У: 'у',
  Ф: 'эф',
  Х: 'ха',
  Ц: 'цэ',
  Ч: 'че',
  Ш: 'ша',
  Щ: 'ща',
  Ъ: 'твёрдый знак',
  Ы: 'ы',
  Ь: 'мягкий знак',
  Э: 'э',
  Ю: 'ю',
  Я: 'я',
}

/**
 * Texte à envoyer au moteur de synthèse pour un mot du vocabulaire.
 *
 * Pour une lettre isolée, c'est son nom épelé (voir `RUSSIAN_LETTER_NAMES`) ;
 * pour un mot dont la transcription ne se lit pas telle quelle, sa forme
 * `speech` (voir `SPOKEN_SCRIPTS`) ; sinon, le mot lui-même.
 */
export function speechFor(vocab: Pick<Vocab, 'term' | 'pos' | 'speech'>): string {
  if (vocab.speech) return vocab.speech
  if (vocab.pos !== 'lettre') return vocab.term
  return RUSSIAN_LETTER_NAMES[vocab.term] ?? vocab.term
}

const native = Capacitor.isNativePlatform()

function webVoices(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

const engineAvailable: boolean = native || webVoices() !== null

/**
 * Y a-t-il une chance qu'on puisse parler ?
 *
 * Sur l'appareil on répond oui sans interroger le moteur : la vérification
 * est asynchrone alors que l'affichage du bouton ne l'est pas, et un bouton
 * qui reste muet une fois sur cent vaut mieux qu'un bouton jamais affiché.
 * Seule exception : une langue qui n'a pas de voix du tout (voir `VOICES`).
 */
export function canSpeak(): boolean {
  return engineAvailable && LANG !== null
}

/**
 * La voix peut-elle lire ce texte-là ? Toujours, sauf pour une langue dont
 * la voix ne lit qu'une autre écriture que celle du cours (`SPOKEN_SCRIPTS`).
 */
export function canSpeakText(text: string): boolean {
  const script = SPOKEN_SCRIPTS[LEARNING]
  return canSpeak() && (script === undefined || script.test(text))
}

/**
 * Le moteur d'exercices peut-il bâtir des exercices d'écoute (dictée,
 * QCM à l'oreille) ?
 *
 * Pas pour une langue lue à travers une autre écriture : seuls les mots y
 * ont une voix, et une voix approchée — de quoi entendre un mot qu'on vient
 * de lire, pas de quoi deviner son orthographe à l'oreille.
 */
export function canSpeakExercises(): boolean {
  return canSpeak() && SPOKEN_SCRIPTS[LEARNING] === undefined
}

/**
 * Sur Android, l'écran système ne s'ouvre que depuis l'app native — dans le
 * navigateur, les voix se gèrent au niveau du système d'exploitation, hors
 * de portée de l'app.
 */
export const canInstallVoice: boolean = native

/**
 * Attend la liste des voix du navigateur.
 *
 * Certains navigateurs la renvoient vide au premier appel et ne la peuplent
 * qu'après coup, en déclenchant `voiceschanged` — d'autres ne déclenchent
 * jamais cet évènement. Le filet d'une seconde couvre ce second cas.
 */
function loadWebVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const initial = synth.getVoices()
  if (initial.length > 0) return Promise.resolve(initial)
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done)
      clearTimeout(timeout)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', done)
    const timeout = setTimeout(done, 1000)
  })
}

/**
 * La voix de la langue actuellement enseignée est-elle vraiment disponible ?
 *
 * `canSpeak` répond si un moteur existe ; celle-ci répond si la langue en
 * cours a une voix installée dessus — deux choses différentes. Un moteur TTS
 * présent mais sans le paquet de voix russe reste un moteur « disponible »
 * qui ne dira jamais un mot de russe, en silence, sans jamais le signaler.
 * Asynchrone et jamais appelée à l'affichage d'un bouton (voir `canSpeak`) :
 * elle sert à diagnostiquer, dans le profil, pourquoi le bouton reste muet.
 */
export async function isSpokenLanguageInstalled(): Promise<boolean> {
  if (LANG === null) return false
  const lang = LANG
  try {
    if (native) {
      const { supported } = await TextToSpeech.isLanguageSupported({ lang })
      return supported
    }
    const synth = webVoices()
    if (!synth) return false
    const voices = await loadWebVoices(synth)
    const prefix = lang.split('-')[0]!.toLowerCase()
    return voices.some((voice) => voice.lang.toLowerCase().startsWith(prefix))
  } catch {
    return false
  }
}

/** Ouvre l'écran système d'installation des voix. N'a d'effet que sur Android — voir `canInstallVoice`. */
export async function installSpokenLanguage(): Promise<void> {
  if (!canInstallVoice) return
  try {
    await TextToSpeech.openInstall()
  } catch {
    // Rien à faire si l'écran système ne s'ouvre pas.
  }
}

/**
 * Prononce un mot ou une phrase en anglais.
 *
 * Ne renvoie jamais d'erreur : une prononciation est un confort, pas une
 * étape de la session. Un `await` reste possible pour enchaîner, mais rien
 * n'oblige à l'attendre.
 */
export async function speak(text: string): Promise<void> {
  const trimmed = text.trim()
  if (trimmed.length === 0 || LANG === null || !canSpeakText(trimmed)) return
  const lang = LANG

  try {
    if (native) {
      // Couper d'abord : deux appuis rapprochés se chevaucheraient, et le
      // moteur Android empile les demandes au lieu de les remplacer.
      await TextToSpeech.stop().catch(() => {})
      await TextToSpeech.speak({ text: trimmed, lang, rate: 0.95 })
      return
    }

    const synth = webVoices()
    if (!synth) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = lang
    const voice = voiceFor(synth.getVoices(), lang)
    if (voice) utterance.voice = voice
    utterance.rate = 0.95
    synth.speak(utterance)
  } catch {
    // Voix absente, moteur indisponible, permission refusée : on se tait.
  }
}

/**
 * La voix du navigateur la plus proche de l'étiquette demandée : la variante
 * exacte d'abord (`ar-MA`, marocaine), sinon n'importe quelle voix de la même
 * langue (`ar-SA`). Sans choix explicite, certains navigateurs ne retiennent
 * que la variante exacte et, faute de la trouver, lisent avec la voix par
 * défaut — une voix anglaise lisant de l'arabe.
 */
export function voiceFor(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const wanted = lang.toLowerCase().replace('_', '-')
  const prefix = wanted.split('-')[0]!
  const normalized = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace('_', '-')
  return (
    voices.find((voice) => normalized(voice) === wanted) ??
    voices.find((voice) => normalized(voice).split('-')[0] === prefix) ??
    null
  )
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
