import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import {
  ACHIEVEMENTS,
  achievementStatus,
  lessonsCompletedCount,
  wordsLearnedCount,
  type AchievementId,
  type AchievementStatus,
} from '@/engine/achievements'
import { EMPTY_CARDS, EMPTY_LESSON_PROGRESS, useProgress } from '@/store/progressStore'
import { BookIcon, CheckIcon, ChevronLeftIcon, FlameIcon } from '@/components/icons'

/**
 * Écran des succès (voir `engine/achievements.ts`).
 *
 * Classes écrites en toutes lettres, pas assemblées par gabarit
 * (`bg-${tone}/15`) : Tailwind ne génère que ce qu'il peut lire littéralement
 * dans le source.
 */
const FAMILY_STYLE: Record<AchievementId, { Icon: typeof BookIcon; badge: string; bar: string }> = {
  words: { Icon: BookIcon, badge: 'bg-teal/15 text-teal', bar: 'bg-teal' },
  streak: { Icon: FlameIcon, badge: 'bg-coral/15 text-coral', bar: 'bg-coral' },
  lessons: { Icon: CheckIcon, badge: 'bg-violet/15 text-violet', bar: 'bg-violet' },
}

export function AchievementsScreen() {
  const navigate = useNavigate()
  const { course, itemsById } = useCourse()
  const cards = useProgress((state) => state.cards[course.id] ?? EMPTY_CARDS)
  const lessons = useProgress((state) => state.lessons[course.id] ?? EMPTY_LESSON_PROGRESS)
  const streakBest = useProgress((state) => state.streak.best)

  const values: Record<AchievementId, number> = useMemo(
    () => ({
      words: wordsLearnedCount(cards, itemsById),
      streak: streakBest,
      lessons: lessonsCompletedCount(lessons),
    }),
    [cards, itemsById, streakBest, lessons],
  )

  const statuses = ACHIEVEMENTS.map((family) => achievementStatus(family, values[family.id]))

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="rounded-full p-2 text-ink-faint hover:text-ink"
        >
          <ChevronLeftIcon size={24} />
        </button>
        <h1 className="text-xl font-black">Succès</h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-5 pb-16 [&>*]:shrink-0">
        <p className="text-sm text-ink-soft">
          Propres à {course.name} : un autre cours a ses propres paliers, à son propre rythme.
        </p>
        {statuses.map((status) => (
          <AchievementCard key={status.family.id} status={status} />
        ))}
      </main>
    </div>
  )
}

function AchievementCard({ status }: { status: AchievementStatus }) {
  const { family, value, unlocked, next } = status
  const { Icon, badge, bar } = FAMILY_STYLE[family.id]
  const currentLabel = unlocked > 0 ? family.tiers[unlocked - 1]!.label : 'Pas encore débloqué'

  return (
    <section className="card-3d flex flex-col gap-3 px-5 py-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badge}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">{family.title}</h2>
          <p className="truncate text-lg font-black">{currentLabel}</p>
        </div>
      </div>

      {/* Un segment par palier, plutôt qu'une seule barre continue : ça dit
          d'un coup d'œil combien il y en a au total, pas seulement où on en
          est sur le dernier en cours. */}
      <div className="flex gap-1.5">
        {family.tiers.map((tier, index) => (
          <span
            key={tier.threshold}
            aria-hidden
            className={`h-2 flex-1 rounded-full ${index < unlocked ? bar : 'bg-line'}`}
          />
        ))}
      </div>

      <p className="text-xs text-ink-faint">
        {next
          ? `${value} / ${next.threshold} ${family.unit} pour « ${next.label} »`
          : `Tous les paliers débloqués — ${value} ${family.unit}.`}
      </p>
    </section>
  )
}
