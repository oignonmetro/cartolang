import { Mascot } from 'cartolang'

/**
 * Éventail des humeurs de Kartu à sa taille par défaut (120) : celle qu'on
 * voit en tête d'écran (accueil de session, fin d'unité). Quatre expressions
 * suffisent à couvrir les usages réels — idle, contente, déçue, en fête.
 */
export function Moods() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <Mascot mood="idle" />
      <Mascot mood="happy" />
      <Mascot mood="disappointed" />
      <Mascot mood="cheer" />
    </div>
  )
}

/**
 * Les deux humeurs restantes — rassurante et pensive — moins fréquentes mais
 * bien réelles (encouragement après une erreur, indice avant réponse).
 */
export function MoreMoods() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <Mascot mood="reassuring" />
      <Mascot mood="think" />
    </div>
  )
}

/**
 * Petite taille (64), comme utilisée à côté d'une question à choix — la
 * mascotte y accompagne l'énoncé sans dominer l'écran.
 */
export function Small() {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Mascot mood="idle" size={64} />
      <Mascot mood="happy" size={64} />
      <Mascot mood="disappointed" size={64} />
    </div>
  )
}
