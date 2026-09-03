export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * Couleur de la barre système (encoche, barre de statut Android en PWA) —
 * doit suivre le thème réel, sombre ou clair, pas rester figée sur l'accent
 * clair d'origine.
 */
const LIGHT_THEME_COLOR = '#14b8a6'
const DARK_THEME_COLOR = '#1b1a2b'

function prefersDark(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
}

function setMetaThemeColor(dark: boolean): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
}

/**
 * Applique le réglage de thème au document : l'attribut qui force `light`
 * ou `dark` envers et contre le système (voir la feuille de style), ou son
 * absence pour laisser `system` suivre le système sans rien imposer.
 *
 * Le script de tête dans `index.html` fait le même geste, plus tôt, avant le
 * premier rendu : c'est lui qui évite le flash du mauvais thème au
 * chargement, pas cette fonction — appelée seulement après, à chaque
 * changement de réglage en cours de session.
 */
export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement
  if (theme === 'system') {
    delete root.dataset.theme
    setMetaThemeColor(prefersDark())
  } else {
    root.dataset.theme = theme
    setMetaThemeColor(theme === 'dark')
  }
}
