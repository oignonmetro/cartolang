import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppUpdate } from '@/content/useAppUpdate'
import { RefreshIcon } from './icons'

const DISMISSED_KEY = 'cartolang.dismissed-app-version'

/**
 * Bandeau de mise à jour de l'app (APK), pendant de `UpdatePrompt.tsx` côté
 * web. La différence : ici, un tap télécharge le nouvel APK et ouvre
 * directement l'installateur système, sans repasser par le navigateur —
 * l'installation reste toujours confirmée par l'utilisateur, Android ne
 * permet rien d'automatique.
 *
 * « Plus tard » ne fait que masquer ce bandeau : la mise à jour reste
 * proposée dans une case du profil (`AppUpdateCard.tsx`) tant qu'elle n'est
 * pas installée.
 */
export function AppUpdateBanner() {
  const { update, status, download } = useAppUpdate()
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    const stored = localStorage.getItem(DISMISSED_KEY)
    return stored ? Number.parseInt(stored, 10) : null
  })

  if (!update || update.versionCode === dismissedVersion) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(update.versionCode))
    setDismissedVersion(update.versionCode)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg"
      >
        <div className="flex items-center gap-3">
          <RefreshIcon size={20} />
          <p className="flex-1 text-sm font-bold">Nouvelle version disponible ({update.versionName}).</p>
          <button
            type="button"
            onClick={() => void download()}
            disabled={status === 'downloading'}
            className="rounded-xl bg-teal px-3 py-2 text-xs font-extrabold uppercase disabled:opacity-60"
          >
            {status === 'downloading' ? 'Patientez…' : 'Télécharger'}
          </button>
          <button type="button" onClick={dismiss} aria-label="Plus tard" className="text-xs font-bold text-white/60">
            Plus tard
          </button>
        </div>
        {status === 'permission-required' && (
          <p className="text-xs text-white/80">
            Autorisez Cartolang à installer des applications dans les réglages qui viennent de s'ouvrir, puis retapez
            sur « Télécharger ».
          </p>
        )}
        {status === 'failed' && (
          <p className="text-xs text-white/80">Le téléchargement a échoué. Vérifiez votre connexion et réessayez.</p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
