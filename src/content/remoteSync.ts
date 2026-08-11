import { Capacitor } from '@capacitor/core'
import { courseSchema, manifestSchema, type Manifest } from './schema'
import { cachedManifest, writeCachedCourse, writeCachedManifest } from './contentCache'

/**
 * Canal de mise à jour du contenu pour l'APK.
 *
 * L'APK embarque le contenu au moment du build (`npx cap sync android`) :
 * sans ce module, corriger un mot ou ajouter une leçon demanderait de
 * reconstruire et redistribuer tout l'APK. Ce module vérifie en tâche de
 * fond, au démarrage et uniquement dans l'app native, si une version plus
 * récente est publiée sur GitHub Pages ; si oui, il la télécharge et
 * l'enregistre dans `contentCache` — disponible dès le prochain démarrage.
 *
 * Le web n'en a pas besoin : servi directement depuis GitHub Pages, il
 * charge déjà l'origine la plus fraîche à chaque visite, et son service
 * worker gère sa propre mise à jour (voir `UpdatePrompt.tsx`).
 *
 * Rien ici n'est bloquant ni ne remonte d'erreur : hors-ligne, origine
 * injoignable ou contenu invalide, l'app continue sur ce qu'elle a déjà
 * (cache existant, ou à défaut le contenu embarqué). On retentera au
 * prochain démarrage.
 */

// Doit correspondre à la publication de .github/workflows/pages.yml
// (APP_BASE = "/<nom du dépôt>/"). Réexporté pour `appUpdate.ts`, qui vérifie
// depuis la même origine si une nouvelle version de l'app est disponible.
export const REMOTE_BASE = 'https://oignonmetro.github.io/cartolang/'
const REMOTE_TIMEOUT_MS = 8000

async function fetchRemoteJson(path: string): Promise<unknown> {
  const response = await fetch(`${REMOTE_BASE}content/${path}`, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${path} : ${response.status} ${response.statusText}`)
  return response.json()
}

function versionOf(manifest: Manifest | null, courseId: string): number {
  return manifest?.courses.find((entry) => entry.id === courseId)?.version ?? 0
}

export async function syncContentFromRemote(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    const remoteManifest = manifestSchema.parse(await fetchRemoteJson('manifest.json'))
    const localManifest = cachedManifest()

    const stale = remoteManifest.courses.filter((entry) => entry.version > versionOf(localManifest, entry.id))
    if (stale.length === 0) return

    for (const entry of stale) {
      const course = courseSchema.parse(await fetchRemoteJson(entry.file))
      writeCachedCourse(course)
    }

    // Le manifeste n'est écrit qu'une fois tous les cours téléchargés avec
    // succès. Si un cours échoue en cours de route, on s'arrête ici sans
    // l'écrire : le prochain démarrage retentera tout depuis la version
    // locale connue, plutôt que d'annoncer des cours partiellement à jour.
    writeCachedManifest(remoteManifest)
  } catch {
    // Voir le commentaire de tête de fichier : on se tait et on réessaiera.
  }
}
