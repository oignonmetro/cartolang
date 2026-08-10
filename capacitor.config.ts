import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Empaquetage Android.
 *
 * `webDir` pointe sur le build Vite : `npm run android:sync` reconstruit
 * l'application puis recopie `dist/` dans le projet Android. L'APK n'a besoin
 * d'aucun serveur — tout, contenu des cours compris, est embarqué.
 */
const config: CapacitorConfig = {
  appId: 'app.cartolang',
  appName: 'Cartolang',
  webDir: 'dist',
  android: {
    backgroundColor: '#FFF8EE',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#FFF8EE',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
}

export default config
