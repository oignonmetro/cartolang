import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LibraryCourse, Track, Unit } from '@/content/schema'
import { countLabel, itemsOfLesson, itemsOfUnit, masteredLabel } from '@/content/course'
import {
  dayKey,
  displayedStreak,
  lessonMastery,
  levelFromXp,
  masteryOf,
  MAX_LEVEL,
  unitMastery,
} from '@/engine/progress'
import { dueCards } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { ProgressRing } from '@/components/ProgressRing'
import { BoltIcon, ChevronLeftIcon, FlameIcon, StarIcon, UnitIcon } from '@/components/icons'

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
  const lessons = useProgress((state) => state.lessons)
  const cards = useProgress((state) => state.cards)
  const xp = useProgress((state) => state.xp)
  const streak = useProgress((state) => state.streak)

  const [activeTrackId, setActiveTrackId] = useState(course.tracks[0]!.id)
  const [openUnitId, setOpenUnitId] = useState<string | null>(null)

  const track = course.tracks.find((candidate) => candidate.id === activeTrackId) ?? course.tracks[0]!
  const tone = TRACK_TONES[track.color] ?? TRACK_TONES.teal

  const { level } = levelFromXp(xp)
  const currentStreak = displayedStreak(streak, dayKey(Date.now()))

  const trackItemIds = useMemo(
    () => track.units.flatMap((unit) => itemsOfUnit(unit).map((item) => item.id)),
    [track],
  )
  const trackMastery = useMemo(() => masteryOf(trackItemIds, cards), [trackItemIds, cards])
  const trackDue = useMemo(() => {
    const inTrack = new Set(trackItemIds)
    return dueCards(
      Object.values(cards).filter((card) => inTrack.has(card.itemId)),
      Date.now(),
    ).length
  }, [trackItemIds, cards])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-label={course.name}>
              {course.flag}
            </span>
            {course.level && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-black tracking-wide text-white">
                {course.level}
              </span>
            )}
          </div>
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

        <TrackTabs tracks={course.tracks} activeId={track.id} onSelect={(id) => {
          setActiveTrackId(id)
          setOpenUnitId(null)
        }} />
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-16">
        <TrackSummary
          track={track}
          tone={tone}
          known={trackMastery.known}
          seen={trackMastery.seen}
          total={trackMastery.total}
          due={trackDue}
          onReview={() => navigate(`/revision?piste=${track.id}`)}
        />

        {track.units.map((unit) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            tone={tone}
            open={openUnitId === unit.id}
            onToggle={() => setOpenUnitId((current) => (current === unit.id ? null : unit.id))}
            mastery={unitMastery(unit, cards)}
            lessonLevel={(lessonId) => lessons[lessonId]?.level ?? 0}
            lessonMastery={(lesson) => lessonMastery(lesson, cards)}
            onOpenLesson={(lessonId) => navigate(`/lecon/${lessonId}`)}
          />
        ))}
      </main>
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

function TrackSummary({
  track,
  tone,
  known,
  seen,
  total,
  due,
  onReview,
}: {
  track: Track
  tone: (typeof TRACK_TONES)[string]
  known: number
  seen: number
  total: number
  due: number
  onReview: () => void
}) {
  return (
    <section className="card-3d flex flex-col gap-3 px-5 py-4">
      <div className="flex items-start gap-4">
        <ProgressRing
          ratio={total === 0 ? 0 : known / total}
          seenRatio={total === 0 ? 0 : seen / total}
          size={52}
          color={tone.css}
        />
        <div className="flex-1">
          <h2 className="text-base leading-tight font-extrabold">{track.title}</h2>
          <p className="text-xs text-ink-soft">{masteredLabel(track.kind, known, total)}</p>
          {track.subtitle && <p className="mt-0.5 text-xs text-ink-faint">{track.subtitle}</p>}
        </div>
      </div>

      {due > 0 && (
        <button
          type="button"
          onClick={onReview}
          className={`flex items-center gap-2 rounded-2xl border-2 ${tone.border} ${tone.soft} px-4 py-2.5 text-left`}
        >
          <StarIcon filled size={18} className={tone.text} />
          <span className="flex-1 text-sm font-extrabold">
            {due} à réviser dans cette piste
          </span>
          <span className={`text-xs font-black uppercase ${tone.text}`}>Réviser</span>
        </button>
      )}
    </section>
  )
}

function UnitCard({
  unit,
  tone,
  open,
  onToggle,
  mastery,
  lessonLevel,
  lessonMastery,
  onOpenLesson,
}: {
  unit: Unit
  tone: (typeof TRACK_TONES)[string]
  open: boolean
  onToggle: () => void
  mastery: { known: number; seen: number; total: number; ratio: number }
  lessonLevel: (lessonId: string) => number
  lessonMastery: (lesson: Unit['lessons'][number]) => { ratio: number; seen: number; total: number }
  onOpenLesson: (lessonId: string) => void
}) {
  return (
    <section className="card-3d overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-4 text-left"
      >
        <ProgressRing
          ratio={mastery.ratio}
          seenRatio={mastery.total === 0 ? 0 : mastery.seen / mastery.total}
          color={tone.css}
        />
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="text-base leading-tight font-extrabold">{unit.title}</span>
            {unit.level && (
              <span className={`rounded-full ${tone.soft} px-2 py-0.5 text-[0.6rem] font-black ${tone.text}`}>
                {unit.level}
              </span>
            )}
          </span>
          {unit.subtitle && <span className="mt-0.5 block text-xs text-ink-soft">{unit.subtitle}</span>}
          <span className="mt-0.5 block text-xs text-ink-faint">
            {unit.lessons.length} leçons · {countLabel(unit.kind, mastery.total)}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? -90 : -180 }} className="text-ink-faint">
          <ChevronLeftIcon size={20} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <ul className="flex flex-col gap-1 border-t-2 border-line px-3 py-3">
              {unit.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => onOpenLesson(lesson.id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-cream"
                  >
                    <ProgressRing
                      ratio={lessonMastery(lesson).ratio}
                      seenRatio={
                        lessonMastery(lesson).total === 0
                          ? 0
                          : lessonMastery(lesson).seen / lessonMastery(lesson).total
                      }
                      size={32}
                      stroke={4}
                      color={tone.css}
                      label=" "
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-extrabold">{lesson.title}</span>
                      <span className="block text-[0.7rem] text-ink-faint">
                        {countLabel(lesson.kind, itemsOfLesson(lesson).length)}
                      </span>
                    </span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: MAX_LEVEL }, (_, index) => (
                        <StarIcon
                          key={index}
                          filled={index < lessonLevel(lesson.id)}
                          size={12}
                          className={index < lessonLevel(lesson.id) ? 'text-amber' : 'text-line'}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
