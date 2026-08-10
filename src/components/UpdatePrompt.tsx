import { useRegisterSW } from 'virtual:pwa-register/react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshIcon } from './icons'

/**
 * Bandeau de mise à jour.
 *
 * L'application fonctionne entièrement hors-ligne ; quand une connexion est
 * disponible, le service worker télécharge la version suivante en arrière-plan
 * et propose ici de l'appliquer. C'est le canal de mise à jour du contenu.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg"
        >
          <RefreshIcon size={20} />
          <p className="flex-1 text-sm font-bold">Une nouvelle version est disponible.</p>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="rounded-xl bg-teal px-3 py-2 text-xs font-extrabold uppercase"
          >
            Mettre à jour
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Plus tard"
            className="text-xs font-bold text-white/60"
          >
            Plus tard
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
