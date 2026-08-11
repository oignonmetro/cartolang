import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { z } from 'zod'
import { REMOTE_BASE } from './remoteSync'

/**
 * Canal de mise à jour de l'application (code, interface), pour l'APK.
 *
 * Ce module détecte qu'une version plus récente existe, au démarrage et
 * uniquement dans l'app native ; `AppUpdateBanner.tsx` propose ensuite de
 * l'installer via `downloadAndInstallUpdate`, qui télécharge l'APK et ouvre
 * directement l'installateur système (`AppUpdaterPlugin.java`), sans repasser
 * par le navigateur. Android exige toujours une confirmation explicite de
 * l'utilisateur pour installer un paquet hors store : ceci raccourcit le
 * chemin jusqu'à cette confirmation, ça ne la supprime pas.
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

interface AppUpdaterPlugin {
  downloadAndInstall(options: { url: string }): Promise<void>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

export type DownloadOutcome = 'started' | 'permission-required' | 'failed'

/**
 * Télécharge l'APK et ouvre l'installateur système. `permission-required`
 * signale que Android a ouvert ses réglages pour autoriser Cartolang à
 * installer des applications — une fois accordée, l'utilisateur n'a qu'à
 * retaper sur le bouton, l'autorisation reste valable pour la suite.
 */
export async function downloadAndInstallUpdate(url: string): Promise<DownloadOutcome> {
  try {
    await AppUpdater.downloadAndInstall({ url })
    return 'started'
  } catch (cause) {
    return (cause as Error).message === 'permission-denied' ? 'permission-required' : 'failed'
  }
}

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
