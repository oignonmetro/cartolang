import { useEffect } from 'react'
import { CoursePicker } from 'cartolang'

/**
 * CoursePicker's root is `fixed inset-0`, sized against the real viewport in
 * the app. The capture harness wraps a single-story render in a
 * `transform`-ed container so `fixed` descendants stay contained within the
 * card instead of escaping across the page (see .ds-sync/lib/emit.mjs) — but
 * that wrapper has no explicit size of its own, so an all-`fixed` root like
 * this one collapses its containing block to near-zero height and the sheet
 * renders as a sliver. Sizing the wrapper directly from here is the only
 * preview-level fix available (the harness itself isn't forkable).
 */
function useFullBleedCapture() {
  useEffect(() => {
    const root = document.getElementById('r0')
    if (!root) return
    root.style.width = '900px'
    root.style.height = '700px'
  }, [])
}

const courses = [
  { id: 'en-a2', name: 'Anglais A2', learning: 'en', known: 'fr', flag: '🇬🇧', level: 'A2', tagline: 'Débutant', layout: 'path' as const, status: 'available' as const },
  { id: 'en-b1', name: 'Anglais B1', learning: 'en', known: 'fr', flag: '🇬🇧', level: 'B1', tagline: 'Intermédiaire', layout: 'path' as const, status: 'available' as const },
  { id: 'en-b2', name: 'Anglais B2', learning: 'en', known: 'fr', flag: '🇬🇧', level: 'B2', tagline: 'Intermédiaire avancé', layout: 'library' as const, status: 'available' as const },
]

/**
 * Feuille ouverte avec le niveau B1 actif : trois cours réalistes, l'un coché
 * (le cours en cours), les deux autres cliquables. C'est l'état de repos de
 * la feuille, avant tout changement de niveau.
 */
export function Open() {
  useFullBleedCapture()
  return (
    <CoursePicker
      courses={courses}
      activeId="en-b1"
      onSelect={async () => {}}
      onClose={() => {}}
    />
  )
}

/**
 * Un cours archivé dans la liste (fin de saison, plus proposé aux nouveaux
 * apprenants mais toujours accessible s'il était déjà en cours) : même style
 * de ligne, `status` ne change rien à l'affichage — seul le manifeste filtre
 * ce qui est proposé en amont.
 */
export function WithArchived() {
  useFullBleedCapture()
  return (
    <CoursePicker
      courses={[...courses, { id: 'en-a1', name: 'Anglais A1', learning: 'en', known: 'fr', flag: '🇬🇧', level: 'A1', tagline: 'Grands débutants', layout: 'path' as const, status: 'archived' as const }]}
      activeId="en-a2"
      onSelect={async () => {}}
      onClose={() => {}}
    />
  )
}
