import { useEffect, useState } from 'react'
import { checkForAppUpdate, downloadAndInstallUpdate, type AppUpdate } from './appUpdate'

export type AppUpdateStatus = 'idle' | 'downloading' | 'permission-required' | 'failed'

/**
 * Partagé par `AppUpdateBanner.tsx` (bandeau flottant, ignorable) et le
 * profil (case toujours visible, pour retrouver la mise à jour après avoir
 * ignoré le bandeau) : vérifie une fois au montage, expose le téléchargement.
 */
export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdate | null>(null)
  const [status, setStatus] = useState<AppUpdateStatus>('idle')

  useEffect(() => {
    void checkForAppUpdate().then(setUpdate)
  }, [])

  const download = async () => {
    if (!update) return
    setStatus('downloading')
    const outcome = await downloadAndInstallUpdate(update.url)
    setStatus(outcome === 'started' ? 'idle' : outcome)
  }

  return { update, status, download }
}
