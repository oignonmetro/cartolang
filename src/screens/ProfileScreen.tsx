import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCourse } from '@/content/CourseProvider'
import { dayKey, displayedStreak, levelFromXp, lessonsOf } from '@/engine/progress'
import { cardStrength, dueCards } from '@/engine/srs'
import { useProgress } from '@/store/progressStore'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { BoltIcon, ChevronLeftIcon, FlameIcon } from '@/components/icons'

const STRENGTHS = ['nouvelle', 'en cours', 'connue', 'maîtrisée'] as const

const STRENGTH_TONE: Record<(typeof STRENGTHS)[number], string> = {
  nouvelle: 'bg-line',
  'en cours': 'bg-coral',
  connue: 'bg-sky',
  maîtrisée: 'bg-success',
}

export function ProfileScreen() {
  const navigate = useNavigate()
  const { course } = useCourse()
  const state = useProgress()
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const today = dayKey(Date.now())
  const { level, into, span } = levelFromXp(state.xp)
  const cards = useMemo(() => Object.values(state.cards), [state.cards])
  const due = useMemo(() => dueCards(cards, Date.now()).length, [cards])
  const totalVocab = useMemo(
    () => lessonsOf(course).reduce((total, entry) => total + entry.lesson.vocab.length, 0),
    [course],
  )

  const breakdown = useMemo(() => {
    const counts = Object.fromEntries(STRENGTHS.map((key) => [key, 0])) as Record<(typeof STRENGTHS)[number], number>
    for (const card of cards) counts[cardStrength(card)] += 1
    return counts
  }, [cards])

  function download() {
    const blob = new Blob([state.exportSave()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cartolang-${today}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Sauvegarde exportée.')
  }

  async function upload(file: File) {
    try {
      state.importSave(await file.text())
      setMessage('Sauvegarde restaurée.')
    } catch (error) {
      setMessage(`Import impossible : ${(error as Error).message}`)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-4 pb-16">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="rounded-full p-2 text-ink-faint hover:text-ink"
        >
          <ChevronLeftIcon size={24} />
        </button>
        <h1 className="text-xl font-black">Profil</h1>
      </header>

      <section className="card-3d flex items-center gap-4 px-5 py-5">
        <Mascot mood="idle" size={80} />
        <div className="flex-1">
          <p className="text-sm font-bold text-ink-soft">Niveau {level}</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-violet" style={{ width: `${(into / span) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {into} / {span} XP vers le niveau {level + 1}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Tile label="Série" value={String(displayedStreak(state.streak, today))} icon={<FlameIcon size={18} />} tone="text-coral" />
        <Tile label="XP total" value={String(state.xp)} icon={<BoltIcon size={18} />} tone="text-amber" />
        <Tile label="À réviser" value={String(due)} tone="text-teal" />
      </section>

      <section className="card-3d px-5 py-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-faint">Vocabulaire</h2>
        <p className="mt-1 text-2xl font-black">
          {cards.length}
          <span className="text-base font-bold text-ink-faint"> / {totalVocab} mots rencontrés</span>
        </p>

        <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-line">
          {STRENGTHS.map((key) => (
            <div
              key={key}
              className={STRENGTH_TONE[key]}
              style={{ width: cards.length ? `${(breakdown[key] / cards.length) * 100}%` : '0%' }}
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-ink-soft">
          {STRENGTHS.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${STRENGTH_TONE[key]}`} />
              {key} · {breakdown[key]}
            </li>
          ))}
        </ul>
      </section>

      <section className="card-3d flex flex-col gap-3 px-5 py-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-faint">Objectif quotidien</h2>
        <div className="flex gap-2">
          {[20, 30, 50, 80].map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => state.setDailyGoal(goal)}
              className={`flex-1 rounded-2xl border-2 py-3 text-sm font-extrabold ${
                state.dailyGoal === goal ? 'border-teal bg-teal/15 text-teal' : 'border-line text-ink-soft'
              }`}
            >
              {goal} XP
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">
          Aujourd'hui : {state.xpByDay[today] ?? 0} / {state.dailyGoal} XP
        </p>
      </section>

      <section className="card-3d flex flex-col gap-3 px-5 py-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-faint">Sauvegarde</h2>
        <p className="text-xs text-ink-soft">
          Toute la progression reste sur cet appareil. Exportez un fichier pour la transférer ou la conserver.
        </p>
        <div className="flex gap-3">
          <Button tone="neutral" className="flex-1 text-xs" onClick={download}>
            Exporter
          </Button>
          <Button tone="neutral" className="flex-1 text-xs" onClick={() => fileInput.current?.click()}>
            Importer
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.target.value = ''
          }}
        />
        {message && <p className="text-xs font-bold text-teal">{message}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <Button
          tone="error"
          onClick={() => {
            if (confirm('Effacer toute la progression ? Cette action est irréversible.')) {
              state.reset()
              setMessage('Progression effacée.')
            }
          }}
        >
          Réinitialiser
        </Button>
        <p className="text-center text-xs text-ink-faint">
          {course.name} · contenu v{course.version}
        </p>
      </section>
    </div>
  )
}

function Tile({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone: string }) {
  return (
    <div className="card-3d flex flex-col items-center gap-1 px-2 py-4">
      <span className={`flex items-center gap-1 text-xl font-black ${tone}`}>
        {icon}
        {value}
      </span>
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-faint">{label}</span>
    </div>
  )
}
