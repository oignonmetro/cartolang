import { motion } from 'framer-motion'
import type { UnitNodeKind } from '@/engine/unitPath'
import type { PlacedNode } from '@/engine/unitPathLayout'
import { FINAL_TONE, type Tone } from './pathTone'
import { BoltIcon, BookIcon, CheckIcon, FlagIcon, LockIcon, RefreshIcon, StarIcon } from './icons'

const NODE_ICONS: Record<UnitNodeKind, (props: { size?: number }) => React.ReactElement> = {
  lesson: BookIcon,
  review: RefreshIcon,
  drill: StarIcon,
  workout: BoltIcon,
  final: FlagIcon,
}

/**
 * Un nœud du parcours d'unité : un cercle en relief, positionné au point que
 * `placePath` lui a calculé, avec son icône. Aucun texte ne l'accompagne —
 * l'icône et la couleur suffisent à distinguer une leçon d'une révision, d'un
 * entraînement ou de la séance finale ; le nom de l'étape s'apprend en
 * l'ouvrant, comme sur le chemin de leçons (voir `PathScreen`). Le titre reste
 * lu par un lecteur d'écran, dans l'aria-label du bouton.
 */
export function PathNode({
  spot,
  tone: unitTone,
  depth,
  onOpen,
}: {
  spot: PlacedNode
  tone: Tone
  /**
   * Nombre d'étapes qui séparent ce nœud de l'étape courante, vers l'avant.
   * Sert à faire reculer ce qui est loin : sans ça, une unité vierge est un
   * mur de neuf cercles identiques où le regard n'a aucune raison de préférer
   * le haut au bas.
   */
  depth: number
  onOpen: () => void
}) {
  const { node, x, y, r } = spot
  const Icon = NODE_ICONS[node.kind]
  const locked = node.status === 'locked'
  const done = node.status === 'done'
  const current = node.status === 'available'
  // Le diamètre vient du placement : c'est lui qui a calculé les écarts, deux
  // sources pour la même mesure finiraient par diverger.
  const size = r * 2

  // La séance finale garde sa teinte propre quelle que soit celle de l'unité :
  // elle n'arrive qu'une fois, et l'amber la désigne comme une arrivée.
  const isFinal = node.kind === 'final'
  const tone = isFinal ? FINAL_TONE : unitTone

  // Trois états, trois traitements : le franchi est un pavé plein mais éteint,
  // l'étape courante une face vive, le reste un simple contour. Le chemin se
  // pave ainsi derrière soi au lieu de changer seulement d'icône.
  const circle = locked
    ? `border-2 ${tone.faintBorder} ${tone.faintBg} ${tone.faintText}`
    : done
      ? `border-2 ${tone.doneBorder} ${tone.doneBg} ${tone.doneText}`
      : `${tone.face} text-white`

  // Chaque cercle porte l'ombre en tranche qui fait le langage visuel du
  // reste de l'app (boutons, cartes) : sans elle, tout ce qui n'est pas
  // l'étape courante retombait à plat, hors style. Elle s'assombrit avec
  // l'importance de l'étape plutôt que de disparaître.
  const shadow = current
    ? `0 5px 0 0 ${tone.edge}`
    : done
      ? `0 3px 0 0 color-mix(in srgb, ${tone.edge} 55%, var(--color-line))`
      : `0 2px 0 0 color-mix(in srgb, ${tone.edge} 18%, var(--color-line))`

  return (
    <div
      className="absolute"
      style={{
        left: `calc(50% + ${x}px)`,
        top: y,
        transform: 'translate(-50%, -50%)',
        // Le lointain s'efface, mais jamais au point de devenir illisible :
        // il faut encore pouvoir compter ce qui reste. La séance finale garde
        // un plancher plus haut — une destination qu'on ne distingue pas de
        // loin ne donne envie d'aller nulle part.
        opacity: depth === 0 ? 1 : Math.max(isFinal ? 0.72 : 0.42, 1 - depth * 0.085),
      }}
    >
      <div className="relative flex items-center justify-center">
        {/* Halo pulsé sur l'étape courante : attire l'œil sans rien coûter
            en hauteur, contrairement à une pastille « Commencer ». */}
        {current && (
          <motion.span
            aria-hidden
            className={`absolute inset-0 rounded-full ${tone.face}`}
            animate={{ scale: [1, 1.35], opacity: [0.35, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}

        {/* Anneau de la séance finale : le chemin doit visiblement mener
            quelque part. Un cercle plus large ne suffit pas — c'est la
            couronne, à distance du bord, qui en fait une arrivée. */}
        {isFinal && (
          <span
            aria-hidden
            className={`absolute rounded-full border-2 ${locked ? tone.faintBorder : tone.border}`}
            style={{ width: size + 16, height: size + 16 }}
          />
        )}

        <motion.button
          type="button"
          onClick={onOpen}
          disabled={locked}
          whileTap={locked ? undefined : { y: 4 }}
          aria-label={`${node.title}, ${locked ? 'verrouillé' : done ? 'terminé' : 'à faire'}`}
          className={`relative flex items-center justify-center rounded-full transition-colors ${circle}`}
          style={{ width: size, height: size, boxShadow: shadow }}
        >
          {/* Seule une leçon verrouillée porte un cadenas : sans titre pour
              annoncer son contenu, c'est ce qui dit « quelque chose de
              nouveau vous attend ici ». Une étape garde son icône propre. La
              séance finale garde son drapeau : c'est le symbole de
              l'arrivée, le remplacer par un cadenas défait tout ce qui en
              fait une destination. */}
          {locked && node.kind === 'lesson' ? (
            <LockIcon size={Math.round(size * 0.4)} />
          ) : done ? (
            <CheckIcon size={Math.round(size * 0.46)} />
          ) : (
            <Icon size={Math.round(size * 0.46)} />
          )}
        </motion.button>
      </div>
    </div>
  )
}
