import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ManifestEntry } from '@/content/schema'
import { groupCoursesByLanguage } from '@/content/course'
import { CheckIcon } from './icons'

/**
 * Sélecteur de niveau : une feuille qui remonte du bas, avec la liste des
 * cours disponibles. Même mécanique que la boîte de confirmation de sortie
 * de session (fond assombri cliquable pour fermer, feuille qui glisse).
 *
 * Les cours sont groupés par langue apprise (drapeau + nom une seule fois),
 * chaque niveau apparaissant comme une ligne du groupe : un francophone qui
 * apprend l'anglais choisit d'abord sa langue, puis son niveau — pas
 * l'inverse, et la liste à plat mélangeait déjà les deux avant que le russe
 * ne s'ajoute à l'anglais.
 */
export function CoursePicker({
  courses,
  activeId,
  onSelect,
  onClose,
}: {
  courses: ManifestEntry[]
  activeId: string
  onSelect: (courseId: string) => Promise<void>
  onClose: () => void
}) {
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const groups = groupCoursesByLanguage(courses)

  async function pick(courseId: string) {
    if (courseId === activeId || switchingTo) return
    setSwitchingTo(courseId)
    setError(null)
    try {
      await onSelect(courseId)
      onClose()
    } catch (cause) {
      setError((cause as Error).message)
      setSwitchingTo(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-blob bg-paper p-5"
      >
        <h2 className="text-lg font-extrabold">Choisir un niveau</h2>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.learning} className="flex flex-col gap-2">
              <p className="flex items-center gap-2 px-1 text-xs font-black tracking-wide text-ink-faint uppercase">
                <span className="text-base" aria-hidden>
                  {group.flag}
                </span>
                {group.name}
              </p>
              <ul className="flex flex-col gap-2">
                {group.courses.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => pick(entry.id)}
                      disabled={switchingTo !== null}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                        entry.id === activeId ? 'border-teal bg-teal/10' : 'border-line bg-paper'
                      }`}
                    >
                      <span className="flex-1">
                        {/* Le drapeau et la langue sont déjà dans l'en-tête du
                            groupe : la ligne ne porte plus que ce qui distingue
                            un niveau de l'autre. */}
                        <span className="text-sm font-extrabold">{entry.level ?? entry.name}</span>
                        {entry.tagline && (
                          <span className="mt-0.5 block text-xs text-ink-soft">{entry.tagline}</span>
                        )}
                      </span>
                      {entry.id === activeId ? (
                        <CheckIcon size={20} className="text-teal" />
                      ) : switchingTo === entry.id ? (
                        <span className="text-xs font-bold text-ink-faint">…</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {error && <p className="text-sm font-bold text-error">{error}</p>}

        <button
          type="button"
          onClick={onClose}
          className="mt-1 rounded-2xl border-2 border-line py-3 text-center font-extrabold text-ink-soft"
        >
          Fermer
        </button>
      </motion.div>
    </motion.div>
  )
}
