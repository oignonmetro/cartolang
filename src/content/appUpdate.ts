import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { z } from 'zod'
import { REMOTE_BASE } from './remoteSync'

/**
 * Canal de mise à jour de l'application (code, interface), pour l'APK.
 *
 * Contrairement au contenu des cours (`remoteSync.ts`), l'APK ne peut pas
 * s'installer lui-même : Android exige toujours une confirmation de
 * l'utilisateur pour installer un paquet. Ce module se contente donc de
 * détecter qu'une version plus récente existe, au démarrage et uniquement
 * dans l'app native ; `AppUpdateBanner.tsx` propose ensuite de la
 * télécharger, et l'installation reste un geste volontaire.
 *
 * `app-version.json` est republié sur GitHub Pages par
 * `.github/workflows/android.yml` à chaque tag `v*`, avec le même
 * `versionCode` que celui gravé dans l'APK correspondant.
 */

const REMOTE_TIMEOUT_MS = 8000

const appUpdateSchema = z.object({
  versionCode: z.number().int().positive(),
  versionName: z.string(),
  url: z.string().url(),
})

export type AppUpdate = z.infer<typeof appUpdateSchema>

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  if (!Capacitor.isNativePlatform()) return null

  try {
    const [response, info] = await Promise.all([
      fetch(`${REMOTE_BASE}app-version.json`, { cache: 'no-cache', signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) }),
      App.getInfo(),
    ])
    if (!response.ok) return null

    const remote = appUpdateSchema.parse(await response.json())
    const installed = Number.parseInt(info.build, 10)
    if (!Number.isFinite(installed) || remote.versionCode <= installed) return null

    return remote
  } catch {
    // Hors-ligne, origine injoignable ou fichier invalide : aucune bannière,
    // on retentera au prochain démarrage.
    return null
  }
}
