/**
 * Petits sons de réussite.
 *
 * Synthétisés plutôt que chargés depuis des fichiers : un son court reste
 * quelques lignes d'oscillateur, là où un asset alourdit l'APK, demande un
 * décodage et un chemin de chargement qui peut échouer. C'est le même parti
 * pris que les icônes, dessinées en SVG plutôt qu'importées — rien à
 * télécharger, rien à mettre en cache, disponible hors ligne par
 * construction.
 *
 * Tout échoue en silence : un appareil sans Web Audio, ou un contexte que le
 * navigateur refuse de réveiller, ne doit jamais casser une session. Le son
 * est un agrément, pas une information — ce qu'il signale est toujours déjà
 * dit à l'écran, en couleur et en toutes lettres.
 */

/** Do de la quatrième octave, en hertz : la fondamentale de nos accords. */
const ROOT = 523.25

/** Volume de crête d'une note. Assez pour s'entendre, jamais pour surprendre. */
const PEAK = 0.12

/**
 * L'accord majeur, étalé sur deux octaves, en demi-tons au-dessus de `ROOT` :
 * do, mi, sol, do, mi, sol.
 *
 * C'est la montée que suivent les réussites successives d'un même exercice
 * (voir `successNote`) : une paire trouvée donne la fondamentale, la
 * deuxième la tierce, la troisième la quinte, et ainsi de suite en montant.
 * Un accord plutôt qu'une gamme complète parce que ses notes s'accordent
 * entre elles quel que soit l'intervalle qui les sépare : deux paires
 * trouvées coup sur coup sonnent juste ensemble, ce que des degrés voisins
 * d'une gamme ne garantissent pas.
 */
const MAJOR_CHORD = [0, 4, 7, 12, 16, 19] as const

let context: AudioContext | null = null

/**
 * Le contexte audio, créé au premier son plutôt qu'au chargement.
 *
 * Les navigateurs livrent un contexte suspendu tant qu'un geste ne l'a pas
 * débloqué, et en créer un d'avance ne ferait que réserver une ressource
 * pour un son qui ne viendra peut-être jamais. Tous nos sons suivent un
 * appui : le réveiller ici suffit.
 */
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  try {
    context ??= new Ctor()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** Une note pincée : attaque immédiate, extinction douce. */
function pluck(ctx: AudioContext, semitones: number, at: number, duration: number): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  // Un triangle plutôt qu'une sinusoïde : ses harmoniques passent sur un
  // haut-parleur de téléphone, où une sinusoïde pure s'entend à peine.
  oscillator.type = 'triangle'
  oscillator.frequency.value = ROOT * 2 ** (semitones / 12)

  // L'extinction est exponentielle, comme celle d'une corde : une coupure
  // nette claquerait, et un palier tenu traînerait sur la note suivante.
  // La cible n'est jamais zéro, que `exponentialRampToValueAtTime` refuse.
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(PEAK, at + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(at)
  oscillator.stop(at + duration)
}

/**
 * Le son d'un exercice réussi : deux notes qui montent, la quinte puis
 * l'octave.
 *
 * Deux notes et pas une : un bip isolé ne dit pas s'il approuve ou signale,
 * là où une montée s'entend comme une résolution. Deux et pas trois non
 * plus — ce son revient à chaque exercice d'une session, il doit se faire
 * oublier plutôt que se faire fêter.
 */
export function playSuccess(): void {
  const ctx = audio()
  if (!ctx) return
  pluck(ctx, 7, ctx.currentTime, 0.12)
  pluck(ctx, 12, ctx.currentTime + 0.08, 0.22)
}

/**
 * La note d'une réussite partielle, dans un exercice qui en compte
 * plusieurs : une manche d'association, où chaque paire trouvée monte d'un
 * degré de l'accord.
 *
 * `index` part de zéro. Au-delà de l'accord, la montée s'arrête sur sa note
 * la plus haute plutôt que de continuer : une manche de conjugaison peut
 * compter douze paires, et deux octaves de plus finiraient dans les
 * fréquences qui font grincer.
 */
export function playSuccessNote(index: number): void {
  const ctx = audio()
  if (!ctx) return
  const step = MAJOR_CHORD[Math.min(index, MAJOR_CHORD.length - 1)]!
  pluck(ctx, step, ctx.currentTime, 0.2)
}
