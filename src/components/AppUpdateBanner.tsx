import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { checkForAppUpdate, type AppUpdate } from '@/content/appUpdate'
import { RefreshIcon } from './icons'

const DISMISSED_KEY = 'cartolang.dismissed-app-version'

/**
 * Bandeau de mise à jour de l'app (APK), pendant de `UpdatePrompt.tsx` côté
 * web. La différence : ici, un tap ouvre le navigateur système pour
 * télécharger le nouvel APK — l'installation reste toujours confirmée par
 * l'utilisateur, Android ne permet rien d'automatique.
 */
export function AppUpdateBanner() {
  const [update, setUpdate] = useState<AppUpdate | null>(null)

  useEffect(() => {
    void checkForAppUpdate().then((found) => {
      if (!found) return
      const dismissed = Number.parseInt(localStorage.getItem(DISMISSED_KEY) ?? '', 10)
      if (dismissed === found.versionCode) return
      setUpdate(found)
    })
  }, [])

  if (!update) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(update.versionCode))
    setUpdate(null)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg"
      >
        <RefreshIcon size={20} />
        <p className="flex-1 text-sm font-bold">Nouvelle version disponible ({update.versionName}).</p>
        <button
          type="button"
          onClick={() => {
            window.open(update.url, '_blank', 'noopener,noreferrer')
            dismiss()
          }}
          className="rounded-xl bg-teal px-3 py-2 text-xs font-extrabold uppercase"
        >
          Télécharger
        </button>
        <button type="button" onClick={dismiss} aria-label="Plus tard" className="text-xs font-bold text-white/60">
          Plus tard
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
