import { motion } from 'framer-motion'
import type { UnitNodeKind } from '@/engine/unitPath'
import type { PlacedNode } from '@/engine/unitPathLayout'
import { showsTitle } from '@/engine/unitPathLayout'
import { FINAL_TONE, type Tone } from './pathTone'
import { BoltIcon, BookIcon, ChestIcon, CheckIcon, FlagIcon, LockIcon, RefreshIcon } from './icons'

const NODE_ICONS: Record<UnitNodeKind, (props: { size?: number }) => React.ReactElement> = {
  lesson: BookIcon,
  review: RefreshIcon,
  drill: BoltIcon,
  workout: ChestIcon,
  final: FlagIcon,
}

/**
 * Nom court des natures qui n'affichent pas de titre sous leur cercle.
 *
 * Il s'écrit en marge du cercle, pas dessous : le serpentin n'oscille que de
 * 80 px de part et d'autre de l'axe dans une colonne qui en fait 400, si bien
 * que les marges latérales sont vides sur toute la hauteur. Une étiquette
 * posée là ne coûte pas un pixel de descente, et sans elle l'apprenant se
 * retrouve devant trois pictogrammes que rien, nulle part, n'explique.
 */
const ASIDE_LABELS: Partial<Record<UnitNodeKind, string>> = {
  review: 'Révision',
  drill: 'Approfondir',
  workout: 'Entraînement',
}

/**
 * Un nœud du parcours d'unité : un cercle en relief, positionné au point que
 * `placePath` lui a calculé, avec son icône et — selon sa nature — son
 * libellé sous le cercle ou en marge.
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

  const title = showsTitle(node)
  const aside = !title ? ASIDE_LABELS[node.kind] : undefined

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
    // Le cercle est centré sur son point ; les libellés pendent en dessous
    // sans peser sur la position, la place qu'il leur faut ayant déjà été
    // comptée dans la descente jusqu'au nœud suivant.
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
      <div className="relative flex flex-col items-center">
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
            aria-label={`${node.title} — ${locked ? 'verrouillé' : done ? 'terminé' : 'à faire'}`}
            className={`relative flex items-center justify-center rounded-full transition-colors ${circle}`}
            style={{ width: size, height: size, boxShadow: shadow }}
          >
            {/* Seule une leçon verrouillée porte un cadenas : son titre dit
                déjà de quoi il s'agit, le cadenas peut y rester générique. Une
                étape garde son icône propre — c'est elle, avec l'étiquette en
                marge, qui distingue une révision d'un entraînement, et un
                cadenas les rendrait toutes identiques. La séance finale garde
                son drapeau : c'est le symbole de l'arrivée, le remplacer par un
                cadenas défait tout ce qui en fait une destination. */}
            {locked && node.kind === 'lesson' ? (
              <LockIcon size={Math.round(size * 0.4)} />
            ) : done ? (
              <CheckIcon size={Math.round(size * 0.46)} />
            ) : (
              <Icon size={Math.round(size * 0.46)} />
            )}
          </motion.button>

          {/* L'étiquette part du côté où le serpentin laisse de la place : un
              nœud rejeté à gauche l'écrit à sa droite, et réciproquement. */}
          {aside && (
            <span
              className={`path-label absolute top-1/2 w-max -translate-y-1/2 text-[0.6rem] leading-none font-extrabold tracking-wider uppercase ${
                locked ? 'text-ink-faint' : tone.text
              } ${x <= 0 ? 'left-full ml-2.5' : 'right-full mr-2.5'}`}
            >
              {aside}
            </span>
          )}
        </div>

        {/* Les libellés sortent du flux : leur hauteur est déjà réservée par
            la descente calculée, et les laisser peser ici décalerait le
            cercle de son point. */}
        {title && (
          <div className="absolute top-full left-1/2 flex w-max -translate-x-1/2 flex-col items-center pt-1">
            <p
              className={`path-label max-w-[13rem] text-center text-xs leading-tight font-extrabold ${
                locked ? 'text-ink-faint' : current ? tone.text : 'text-ink-soft'
              }`}
            >
              {node.title}
            </p>
            {/* Le sous-titre n'a d'utilité que là où l'on va cliquer : partout
                ailleurs il double la hauteur d'un nœud pour rien. */}
            {current && (
              <p className="path-label mt-0.5 max-w-[15rem] text-center text-[0.68rem] leading-tight text-ink-faint">
                {node.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
