import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { Buzz } from '@/engine/combo'

/**
 * Retour haptique.
 *
 * Ce module ne fait que *traduire* une sensation en vibration ; c'est
 * `engine/combo.ts` qui décide laquelle et quand, et c'est là qu'est écrit
 * le parti pris (vibrer rarement, et jamais pour ce que l'écran dit déjà).
 * La séparation vaut celle de `lib/sound.ts` et `useSessionSounds` : aucune
 * dépendance à React ni au store ici, et aucune dépendance à la plateforme
 * dans le moteur.
 *
 * Deux chemins, comme pour la prononciation :
 *
 *   - dans l'APK, le plugin Capacitor. C'est lui qui donne la *force* :
 *     l'API web ne règle que la durée, là où Android sait moduler
 *     l'amplitude du moteur (110, 180, 255 sur 255 pour nos trois
 *     impulsions). Trois durées différentes à pleine puissance ne se
 *     distinguent pas dans la main ; trois amplitudes, oui ;
 *   - dans le navigateur et la PWA, `navigator.vibrate`, avec des motifs
 *     calqués sur les durées natives — le peu qu'on puisse faire pour que
 *     les deux se ressemblent.
 *
 * Tout échoue en silence, comme le son : une vibration est un agrément.
 * Aucun appareil n'est tenu d'avoir un moteur, aucun navigateur d'exposer
 * l'API, et Android refuse la vibration dans certains modes d'économie ou
 * de concentration — rien de tout cela ne doit interrompre une session.
 */

const native = Capacitor.isNativePlatform()

/**
 * Motifs de repli pour `navigator.vibrate`, en millisecondes (vibration,
 * pause, vibration…).
 *
 * Les durées reprennent celles du plugin natif, faute de pouvoir en
 * reprendre les amplitudes : `rising` et `falling` gardent donc au moins
 * leur *forme* à deux temps, seule différence que l'API web sait rendre. Les
 * trois impulsions, elles, ne peuvent se distinguer que par la durée — d'où
 * un écart plus large qu'en natif, pour qu'il reste perceptible.
 */
const WEB_PATTERNS: Record<Buzz, readonly number[]> = {
  light: [15],
  medium: [35],
  heavy: [60],
  // Faible puis fort : la rupture. Le crescendo se lit comme un contretemps.
  rising: [20, 45, 55],
  // Fort puis faible : la conclusion. Reprend le motif « tâche accomplie »
  // du plugin natif, qui suit exactement ce dessin.
  falling: [35, 65, 21],
}

/** Appel natif correspondant à chaque sensation. */
const NATIVE_CALLS: Record<Buzz, () => Promise<void>> = {
  light: () => Haptics.impact({ style: ImpactStyle.Light }),
  medium: () => Haptics.impact({ style: ImpactStyle.Medium }),
  heavy: () => Haptics.impact({ style: ImpactStyle.Heavy }),
  rising: () => Haptics.notification({ type: NotificationType.Error }),
  falling: () => Haptics.notification({ type: NotificationType.Success }),
}

/**
 * Y a-t-il une chance que l'appareil vibre ?
 *
 * Sert à ne pas afficher le réglage là où il ne ferait rien — un ordinateur
 * de bureau, un navigateur sans l'API. Optimiste comme `canSpeak` : sur
 * l'appareil on répond oui sans interroger le moteur, et l'API web déclarée
 * mais inopérante (le cas de Chrome sur ordinateur) reste indétectable.
 */
export const canVibrate: boolean =
  native || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')

/**
 * Joue une sensation. Ne renvoie jamais d'erreur et ne s'attend pas : rien
 * dans une session ne doit dépendre d'une vibration.
 */
export function vibrate(buzz: Buzz): void {
  try {
    if (native) {
      void NATIVE_CALLS[buzz]().catch(() => {})
      return
    }
    navigator.vibrate?.([...WEB_PATTERNS[buzz]])
  } catch {
    // Pas de moteur, permission refusée, mode économie d'énergie : on ne
    // vibre pas, et c'est tout.
  }
}
