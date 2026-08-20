import { motion } from 'framer-motion'
import type { UnitNodeKind } from '@/engine/unitPath'
import type { PlacedNode } from '@/engine/unitPathLayout'
import { FINAL_TONE, type Tone } from './pathTone'
import { BoltIcon, BookIcon, CheckIcon, FlagIcon, LockIcon, RefreshIcon, SkipIcon, StarIcon } from './icons'

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
 *
 * Un checkpoint fait exception à ce silence : lui seul porte un badge (pour
 * qu'on le repère de loin, verrouillé ou non) et une bulle affichant ce qu'il
 * ouvre (les lettres d'une section entière, par exemple) — sans elle, choisir
 * vers quel checkpoint sauter demanderait de deviner à l'aveugle, ou d'ouvrir
 * chacun pour voir.
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
  const checkpoint = node.checkpoint
  // Un checkpoint reste ouvrable même verrouillé : c'est tout son rôle,
  // atteindre directement une section plus loin dans l'unité (voir
  // `UnitPathScreen`).
  const reachable = !locked || checkpoint
  // Le diamètre vient du placement : c'est lui qui a calculé les écarts, deux
  // sources pour la même mesure finiraient par diverger.
  const size = r * 2

  // La séance finale garde sa teinte propre quelle que soit celle de l'unité :
  // elle n'arrive qu'une fois, et l'amber la désigne comme une arrivée.
  const isFinal = node.kind === 'final'
  const tone = isFinal ? FINAL_TONE : unitTone

  // Trois états, trois traitements : le franchi est un pavé plein mais éteint,
  // l'étape courante une face vive, le reste un simple contour. Le chemin se
  // pave ainsi derrière soi au lieu de changer seulement d'icône. Un
  // checkpoint verrouillé fait bande à part : sa face reste vive, comme celle
  // d'une étape jouable, puisqu'il l'est.
  const circle =
    locked && !checkpoint
      ? `border-2 ${tone.faintBorder} ${tone.faintBg} ${tone.faintText}`
      : done
        ? `border-2 ${tone.doneBorder} ${tone.doneBg} ${tone.doneText}`
        : `${tone.face} text-white`

  // Chaque cercle porte l'ombre en tranche qui fait le langage visuel du
  // reste de l'app (boutons, cartes) : sans elle, tout ce qui n'est pas
  // l'étape courante retombait à plat, hors style. Elle s'assombrit avec
  // l'importance de l'étape plutôt que de disparaître.
  const shadow =
    current || (checkpoint && locked)
      ? `0 5px 0 0 ${tone.edge}`
      : done
        ? `0 3px 0 0 color-mix(in srgb, ${tone.edge} 55%, var(--color-line))`
        : `0 2px 0 0 color-mix(in srgb, ${tone.edge} 18%, var(--color-line))`

  const statusLabel =
    checkpoint && locked ? 'section accessible directement' : locked ? 'verrouillé' : done ? 'terminé' : 'à faire'

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
            en hauteur, contrairement à une pastille « Commencer ». Réservé à
            la vraie étape courante — un checkpoint a son propre badge, le
            confondre avec le halo laisserait croire qu'il y en a deux. */}
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
          disabled={!reachable}
          whileTap={reachable ? { y: 4 } : undefined}
          aria-label={`${node.title}${node.checkpointLabel ? ` — ${node.checkpointLabel}` : ''}, ${statusLabel}`}
          className={`relative flex items-center justify-center rounded-full transition-colors ${circle}`}
          style={{ width: size, height: size, boxShadow: shadow }}
        >
          {/* Un cadenas ne veut rien dire sur un checkpoint : il reste
              ouvrable, le badge en dessous le dit déjà autrement. Sinon,
              seule une leçon verrouillée en porte un — sans titre pour
              annoncer son contenu, c'est ce qui dit « quelque chose de
              nouveau vous attend ici ». Une étape garde son icône propre. La
              séance finale garde son drapeau : c'est le symbole de
              l'arrivée, le remplacer par un cadenas défait tout ce qui en
              fait une destination. */}
          {locked && !checkpoint && node.kind === 'lesson' ? (
            <LockIcon size={Math.round(size * 0.4)} />
          ) : done ? (
            <CheckIcon size={Math.round(size * 0.46)} />
          ) : (
            <Icon size={Math.round(size * 0.46)} />
          )}
        </motion.button>

        {/* Badge du checkpoint : visible qu'il soit verrouillé, courant ou
            déjà franchi, pour que le chemin garde ses repères de section une
            fois qu'on les a dépassés. */}
        {checkpoint && (
          <span
            aria-hidden
            className={`absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream ${tone.face} text-white`}
          >
            <SkipIcon size={13} />
          </span>
        )}

        {/* Bulle du checkpoint : les lettres travaillées dans la section
            qu'il ouvre, pour choisir où sauter sans avoir à ouvrir chaque
            checkpoint pour le découvrir. Seule exception au silence du
            chemin (voir le commentaire de tête), et assumée comme telle. */}
        {checkpoint && node.checkpointLabel && (
          <div
            className="pointer-events-none absolute left-1/2 flex w-max max-w-40 -translate-x-1/2 flex-col items-center"
            style={{ top: '100%' }}
          >
            <span
              aria-hidden
              className="h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent"
              style={{ borderBottomColor: 'var(--color-line)' }}
            />
            <div
              className={`-mt-px max-w-40 rounded-xl border-2 border-line bg-paper px-2 py-1 text-center text-xs leading-tight font-black tracking-wide text-balance ${tone.text}`}
            >
              {node.checkpointLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
