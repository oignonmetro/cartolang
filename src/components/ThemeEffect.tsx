import { useEffect } from 'react'
import { useProgress } from '@/store/progressStore'
import { applyTheme } from '@/lib/theme'

/**
 * Applique le réglage de thème au document, sans rien afficher.
 *
 * Rejoue aussi `applyTheme` quand le système change de thème en cours de
 * session (l'appareil qui bascule au coucher du soleil, par exemple) : la
 * feuille de style suit déjà le système toute seule en réglage « système »,
 * mais la couleur de la barre système, elle, ne se corrige que si on la
 * repose — voir `applyTheme`.
 */
export function ThemeEffect() {
  const theme = useProgress((state) => state.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') applyTheme('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  return null
}
