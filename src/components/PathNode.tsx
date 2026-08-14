import { motion } from 'framer-motion'
import type { UnitNodeKind } from '@/engine/unitPath'
import type { PlacedNode } from '@/engine/unitPathLayout'
import type { Tone } from './pathTone'
import { BoltIcon, BookIcon, ChestIcon, CheckIcon, FlagIcon, LockIcon, RefreshIcon } from './icons'

const NODE_ICONS: Record<UnitNodeKind, (props: { size?: number }) => React.ReactElement> = {
  lesson: BookIcon,
  review: RefreshIcon,
  drill: BoltIcon,
  workout: ChestIcon,
  final: FlagIcon,
}

/**
 * Un nœud du parcours d'unité : un cercle en relief, positionné au point que
 * `placePath` lui a calculé, avec son icône et — selon sa nature — son
 * libellé sous le cercle.
 */
export function PathNode({ spot, tone, onOpen }: { spot: PlacedNode; tone: Tone; onOpen: () => void }) {
  const { node, x, y, r } = spot
  const Icon = NODE_ICONS[node.kind]
  const locked = node.status === 'locked'
  const done = node.status === 'done'
  const current = node.status === 'available'
  // Le diamètre vient du placement : c'est lui qui a calculé les écarts, deux
  // sources pour la même mesure finiraient par diverger.
  const size = r * 2

  // Révision, entraînement, approfondissement reviennent plusieurs fois par
  // unité : leur nom en toutes lettres finissait par tapisser le chemin de
  // texte répété. Leur icône propre (déjà là pour chaque nature de nœud) les
  // distingue tout aussi bien. Une leçon garde son titre — c'est un nom
  // propre, pas une catégorie —, la séance finale aussi : elle n'apparaît
  // qu'une fois par unité, la répétition ne la concerne pas.
  const iconOnly = node.kind === 'review' || node.kind === 'drill' || node.kind === 'workout'

  // Un seul cercle plein à la fois, l'étape courante : les étapes franchies
  // passent en teinte claire, les suivantes restent teintées mais à peine —
  // gris pur les aurait fait sortir de la couleur de l'unité, comme si le
  // chemin changeait de nature au lieu de simplement attendre.
  const circle = locked
    ? `border-2 ${tone.faintBorder} ${tone.faintBg} ${tone.faintText}`
    : done
      ? `border-2 ${tone.border} ${tone.soft} ${tone.text}`
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
      style={{ left: `calc(50% + ${x}px)`, top: y, transform: 'translate(-50%, -50%)' }}
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

          <motion.button
            type="button"
            onClick={onOpen}
            disabled={locked}
            whileTap={locked ? undefined : { y: 4 }}
            aria-label={`${node.title} — ${locked ? 'verrouillé' : done ? 'terminé' : 'à faire'}`}
            className={`relative flex items-center justify-center rounded-full transition-colors ${circle}`}
            style={{ width: size, height: size, boxShadow: shadow }}
          >
            {/* Un nœud verrouillé affiche d'ordinaire un cadenas, quelle que
                soit sa nature : sans texte à côté, ce serait le seul indice
                qui reste, et un cadenas ne dit pas s'il s'agit d'une révision
                ou d'un entraînement. Ces nœuds gardent donc leur icône propre
                même verrouillés — atténuée par la teinte du cercle comme
                le reste. Une leçon ou la séance finale, elles, restent
                identifiées par leur nom : le cadenas peut y rester générique. */}
            {locked && !iconOnly ? (
              <LockIcon size={20} />
            ) : done ? (
              <CheckIcon size={24} />
            ) : (
              <Icon size={locked ? 20 : 30} />
            )}
          </motion.button>
        </div>

        {/* Les libellés sortent du flux : leur hauteur est déjà réservée par
            la descente calculée, et les laisser peser ici décalerait le
            cercle de son point. */}
        {(!iconOnly || current) && (
          <div className="absolute top-full left-1/2 flex w-max -translate-x-1/2 flex-col items-center pt-1">
            {!iconOnly && (
              <p
                className={`max-w-[13rem] text-center text-xs leading-tight font-extrabold ${
                  locked ? 'text-ink-faint' : current ? tone.text : 'text-ink-soft'
                }`}
              >
                {node.title}
              </p>
            )}
            {/* Le sous-titre n'a d'utilité que là où l'on va cliquer : partout
                ailleurs il double la hauteur d'un nœud pour rien. */}
            {current && (
              <p
                className={`max-w-[15rem] text-center text-[0.68rem] leading-tight text-ink-faint ${
                  iconOnly ? '' : 'mt-0.5'
                }`}
              >
                {node.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
