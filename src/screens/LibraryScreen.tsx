import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LibraryCourse, Track, Unit } from '@/content/schema'
import { countLabel, itemsOfUnit } from '@/content/course'
import type { LessonProgressMap } from '@/engine/progress'
import { dayKey, displayedStreak, levelFromXp, masteryOf, unitMastery } from '@/engine/progress'
import { buildUnitPath } from '@/engine/unitPath'
import { dueCards } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { useCourse } from '@/content/CourseProvider'
import { availableCourses } from '@/content/loader'
import { ProgressRing } from '@/components/ProgressRing'
import { CoursePicker } from '@/components/CoursePicker'
import { BoltIcon, ChevronLeftIcon, FlameIcon, StarIcon, UnitIcon } from '@/components/icons'

/** Avancement d'une unité sur son parcours, pour la carte de la bibliothèque. */
function doneNodes(
  unit: Unit,
  lessons: LessonProgressMap,
  steps: Record<string, number>,
): { count: number; total: number } {
  const path = buildUnitPath(unit, lessons, steps)
  return { count: path.filter((node) => node.status === 'done').length, total: path.length }
}

/**
 * Écran d'accueil des cours en accès libre.
 *
 * Trois onglets — vocabulaire, grammaire, conjugaison — chacun avec sa
 * couleur. Rien n'est verrouillé : à la place du parcours, un anneau de
 * maîtrise par unité indique où l'on en est, et les unités s'ouvrent en
 * accordéon pour éviter un niveau de navigation supplémentaire.
 */

/** Chaque piste a sa teinte : on sait au premier regard où l'on se trouve. */
const TRACK_TONES: Record<string, { text: string; bg: string; soft: string; border: string; css: string; deep: string }> = {
  teal: {
    text: 'text-teal',
    bg: 'bg-teal',
    soft: 'bg-teal/10',
    border: 'border-teal',
    css: 'var(--color-teal)',
    deep: 'var(--color-teal-deep)',
  },
  violet: {
    text: 'text-violet',
    bg: 'bg-violet',
    soft: 'bg-violet/10',
    border: 'border-violet',
    css: 'var(--color-violet)',
    deep: 'var(--color-violet-deep)',
  },
  sky: {
    text: 'text-sky',
    bg: 'bg-sky',
    soft: 'bg-sky/10',
    border: 'border-sky',
    css: 'var(--color-sky)',
    deep: 'var(--color-sky-deep)',
  },
  coral: {
    text: 'text-coral',
    bg: 'bg-coral',
    soft: 'bg-coral/10',
    border: 'border-coral',
    css: 'var(--color-coral)',
    deep: 'var(--color-coral-deep)',
  },
  amber: {
    text: 'text-amber',
    bg: 'bg-amber',
    soft: 'bg-amber/10',
    border: 'border-amber',
    css: 'var(--color-amber)',
    deep: 'var(--color-amber-deep)',
  },
}

export function LibraryScreen({ course }: { course: LibraryCourse }) {
  const navigate = useNavigate()
  const { manifest, switchCourse, itemsById } = useCourse()
  const lessons = useProgress((state) => state.lessons)
  const steps = useProgress((state) => state.steps)
  const cards = useProgress((state) => state.cards)
  const xp = useProgress((state) => state.xp)
  const streak = useProgress((state) => state.streak)

  const [activeTrackId, setActiveTrackId] = useState(course.tracks[0]!.id)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickableCourses = useMemo(() => availableCourses(manifest), [manifest])

  // `course` change de référence quand on bascule de niveau : l'onglet actif
  // se réinitialise plutôt que de garder celui (potentiellement inexistant)
  // du cours précédent.
  useEffect(() => {
    setActiveTrackId(course.tracks[0]!.id)
  }, [course.id])

  const track = course.tracks.find((candidate) => candidate.id === activeTrackId) ?? course.tracks[0]!
  const tone = TRACK_TONES[track.color] ?? TRACK_TONES.teal

  const { level } = levelFromXp(xp)
  const currentStreak = displayedStreak(streak, dayKey(Date.now()))

  const trackItemIds = useMemo(
    () => track.units.flatMap((unit) => itemsOfUnit(unit).map((item) => item.id)),
    [track],
  )
  const trackMastery = useMemo(() => masteryOf(trackItemIds, cards), [trackItemIds, cards])

  // Toutes pistes confondues, et restreint au cours affiché — les cartes d'un
  // autre niveau resteraient sinon comptées ici sans être révisables.
  const due = useMemo(
    () => dueCards(Object.values(cards).filter((card) => itemsById.has(card.itemId)), Date.now()).length,
    [cards, itemsById],
  )

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={`${course.name} — changer de niveau`}
            className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-ink/5 active:bg-ink/10"
          >
            <span className="text-2xl" aria-hidden>
              {course.flag}
            </span>
            {course.level && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-black tracking-wide text-white">
                {course.level}
              </span>
            )}
            <ChevronLeftIcon size={14} className="-rotate-90 text-ink-faint" />
          </button>
          <div className="flex items-center gap-4 text-sm font-extrabold">
            <span className="flex items-center gap-1 text-coral">
              <FlameIcon size={20} /> {currentStreak}
            </span>
            <span className="flex items-center gap-1 text-amber">
              <BoltIcon size={20} /> {xp}
            </span>
            <button
              type="button"
              onClick={() => navigate('/profil')}
              className="rounded-full bg-violet px-3 py-1 text-white"
            >
              Niv. {level}
            </button>
          </div>
        </div>

        <TrackTabs tracks={course.tracks} activeId={track.id} onSelect={setActiveTrackId} />
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-16">
        {/* Avant le résumé de piste, et non dedans : c'est l'action du jour,
            celle qui fait revenir ce qui a été appris. Elle vaut pour les
            trois pistes à la fois — mélanger les natures d'exercices vaut
            mieux que réviser le vocabulaire d'un bloc. */}
        {due > 0 && <ReviewCallout due={due} onReview={() => navigate('/revision')} />}

        <TrackSummary
          track={track}
          tone={tone}
          known={trackMastery.known}
          seen={trackMastery.seen}
          total={trackMastery.total}
        />

        {track.units.length === 0 ? (
          <EmptyTrack tone={tone} />
        ) : (
          track.units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              tone={tone}
              mastery={unitMastery(unit, cards)}
              done={doneNodes(unit, lessons, steps)}
              onOpen={() => navigate(`/unite/${unit.id}`)}
            />
          ))
        )}
      </main>

      <AnimatePresence>
        {pickerOpen && (
          <CoursePicker
            courses={pickableCourses}
            activeId={course.id}
            onSelect={switchCourse}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function TrackTabs({
  tracks,
  activeId,
  onSelect,
}: {
  tracks: Track[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-1 px-3 pb-2" role="tablist">
      {tracks.map((track) => {
        const tone = TRACK_TONES[track.color] ?? TRACK_TONES.teal
        const active = track.id === activeId
        return (
          <button
            key={track.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(track.id)}
            className="relative flex-1 rounded-xl px-2 py-2 text-center"
          >
            {/* La pilule glisse d'un onglet à l'autre : le changement se voit sans clignoter. */}
            {active && (
              <motion.span
                layoutId="track-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={`absolute inset-0 rounded-xl ${tone.soft} border-2 ${tone.border}`}
              />
            )}
            <span
              className={`relative flex flex-col items-center gap-0.5 text-[0.7rem] font-extrabold uppercase tracking-wide ${
                active ? tone.text : 'text-ink-faint'
              }`}
            >
              <UnitIcon name={track.icon} size={18} />
              {track.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Piste sans la moindre unité : le niveau existe, son contenu arrive encore. */
function EmptyTrack({ tone }: { tone: (typeof TRACK_TONES)[string] }) {
  return (
    <section
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed ${tone.border} px-6 py-10 text-center`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.soft} ${tone.text}`}>
        <UnitIcon name="clock" size={24} />
      </span>
      <p className="text-sm font-extrabold text-ink">Cette piste est en préparation</p>
      <p className="max-w-xs text-xs text-ink-soft">
        Les premières leçons arrivent bientôt. En attendant, une autre piste ou un autre niveau vous attend.
      </p>
    </section>
  )
}

/**
 * Appel à réviser, en tête d'écran.
 *
 * C'est le cœur du système : les leçons font découvrir, les révisions font
 * revenir et approfondir. Tant qu'elles restaient un bouton discret au fond
 * d'un panneau de piste, l'app n'était qu'une liste de leçons à cocher.
 */
function ReviewCallout({ due, onReview }: { due: number; onReview: () => void }) {
  return (
    <button
      type="button"
      onClick={onReview}
      className="card-3d flex items-center gap-4 border-teal bg-teal/10 px-5 py-4 text-left"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal text-white">
        <StarIcon filled size={24} />
      </span>
      <span className="flex-1">
        <span className="block text-base font-extrabold text-ink">
          {due} élément{due > 1 ? 's' : ''} à réviser
        </span>
        <span className="mt-0.5 block text-xs text-ink-soft">
          Les revoir maintenant, c'est ce qui les fera tenir.
        </span>
      </span>
      <span className="text-xs font-black uppercase text-teal">Réviser</span>
    </button>
  )
}

function TrackSummary({
  track,
  tone,
  known,
  seen,
  total,
}: {
  track: Track
  tone: (typeof TRACK_TONES)[string]
  known: number
  seen: number
  total: number
}) {
  return (
    // Pas de `card-3d` ici : ce bloc n'est pas cliquable, et lui donner la
    // même carte blanche à ombre que les unités en dessous laissait croire
    // le contraire. Le fond teinté signale un panneau d'ensemble, pas une ligne.
    <section className={`rounded-2xl ${tone.soft} px-5 py-4`}>
      <div className="flex items-start gap-4">
        <ProgressRing
          ratio={total === 0 ? 0 : known / total}
          seenRatio={total === 0 ? 0 : seen / total}
          size={52}
          color={tone.css}
        />
        <div className="flex-1">
          {/* Ni « Vue d'ensemble » ni le nom de la piste : l'onglet juste
              au-dessus les dit déjà. Le sous-titre porte l'intention de la
              piste ; le chiffre qui avance est déjà dans l'anneau, inutile
              de le répéter en toutes lettres à côté. */}
          {track.subtitle && <p className="text-sm leading-snug font-extrabold text-ink">{track.subtitle}</p>}
        </div>
      </div>
    </section>
  )
}

function UnitCard({
  unit,
  tone,
  mastery,
  done,
  onOpen,
}: {
  unit: Unit
  tone: (typeof TRACK_TONES)[string]
  mastery: { known: number; seen: number; total: number; ratio: number }
  /** Étapes franchies sur le parcours de l'unité, et total. */
  done: { count: number; total: number }
  onOpen: () => void
}) {
  return (
    <section className="card-3d overflow-hidden">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 px-4 py-4 text-left">
        <ProgressRing
          ratio={mastery.ratio}
          seenRatio={mastery.total === 0 ? 0 : mastery.seen / mastery.total}
          color={tone.css}
        />
        <span className="flex-1">
          {/* `unit.level` (B2.1/B2.2) reste dans les données mais n'est plus
              affiché : c'était une convention maison, pas une échelle
              officielle, et son badge prêtait à confusion avec le CECRL. */}
          <span className="text-base leading-tight font-extrabold">{unit.title}</span>
          {unit.subtitle && <span className="mt-0.5 block text-xs text-ink-soft">{unit.subtitle}</span>}
          <span className={`mt-0.5 block text-xs font-bold ${done.count > 0 ? tone.text : 'text-ink-faint'}`}>
            {done.count} / {done.total} étapes · {countLabel(unit.kind, mastery.total)}
          </span>
        </span>
        <span className="-rotate-180 text-ink-faint">
          <ChevronLeftIcon size={20} />
        </span>
      </button>
    </section>
  )
}
