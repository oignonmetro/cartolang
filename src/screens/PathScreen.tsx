import { Fragment, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { PathCourse, Unit } from '@/content/schema'
import { courseLabel } from '@/content/course'
import { buildPath, dayKey, displayedStreak, levelFromXp, type LessonNode } from '@/engine/progress'
import { dueCards } from '@/engine/srs'
import { EMPTY_CARDS, EMPTY_LESSON_PROGRESS, useProgress } from '@/store/progressStore'
import { Mascot } from '@/components/Mascot'
import { BoltIcon, CheckIcon, ChestIcon, FlameIcon, LockIcon, StarIcon, UnitIcon, UNIT_TONES } from '@/components/icons'

/**
 * Le chemin : la carte du cours.
 *
 * Les leçons se suivent en serpentin, regroupées par unité. Une bannière
 * annonce chaque unité, un coffre marque sa fin.
 */
export function PathScreen({ course }: { course: PathCourse }) {
  const navigate = useNavigate()
  const lessons = useProgress((state) => state.lessons[course.id] ?? EMPTY_LESSON_PROGRESS)
  const cards = useProgress((state) => state.cards[course.id] ?? EMPTY_CARDS)
  const xp = useProgress((state) => state.xp)
  const streak = useProgress((state) => state.streak)

  const path = useMemo(() => buildPath(course, lessons), [course, lessons])
  const due = useMemo(() => dueCards(Object.values(cards), Date.now()).length, [cards])
  const { level } = levelFromXp(xp)
  const currentStreak = displayedStreak(streak, dayKey(Date.now()))

  // Le chemin est linéaire ; on le redécoupe par unité pour l'affichage.
  const groups = useMemo(() => groupByUnit(path), [path])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-line bg-cream/95 px-4 py-3 backdrop-blur">
        <span className="text-2xl" aria-label={courseLabel(course)}>
          {course.flag}
        </span>
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
      </header>

      {due > 0 && (
        <button
          type="button"
          onClick={() => navigate('/revision')}
          className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border-2 border-amber bg-amber/15 px-4 py-3 text-left"
        >
          <StarIcon filled size={24} className="text-amber" />
          <span className="flex-1 text-sm font-extrabold">
            {due} mot{due > 1 ? 's' : ''} à réviser
          </span>
          <span className="text-xs font-bold uppercase text-amber">Réviser</span>
        </button>
      )}

      <main className="flex flex-1 flex-col gap-2 px-4 pt-4 pb-16">
        {groups.map(({ unit, nodes }, unitIndex) => (
          <Fragment key={unit.id}>
            <UnitBanner unit={unit} index={unitIndex} nodes={nodes} />
            <div className="flex flex-col items-center pt-6 pb-2">
              {nodes.map((node, index) => (
                <LessonBubble
                  key={node.lesson.id}
                  node={node}
                  offset={serpentine(index)}
                  onOpen={() => navigate(`/lecon/${node.lesson.id}`)}
                />
              ))}
              <ChestNode unlocked={nodes.every((node) => node.status === 'done')} />
            </div>
          </Fragment>
        ))}
      </main>
    </div>
  )
}

/** Décalage horizontal en serpentin, comme sur un plateau de jeu. */
function serpentine(index: number): number {
  const pattern = [0, 46, 66, 46, 0, -46, -66, -46]
  return pattern[index % pattern.length]
}

function groupByUnit(path: LessonNode[]): { unit: Unit; nodes: LessonNode[] }[] {
  const groups: { unit: Unit; nodes: LessonNode[] }[] = []
  for (const node of path) {
    const last = groups[groups.length - 1]
    if (last && last.unit.id === node.unit.id) last.nodes.push(node)
    else groups.push({ unit: node.unit, nodes: [node] })
  }
  return groups
}

function UnitBanner({ unit, index, nodes }: { unit: Unit; index: number; nodes: LessonNode[] }) {
  const tone = UNIT_TONES[unit.color]
  const done = nodes.filter((node) => node.status === 'done').length

  return (
    <div
      className={`sticky top-16 z-[5] mt-6 flex items-center gap-3 rounded-2xl ${tone.bg} px-4 py-4 text-white`}
      style={{ boxShadow: `0 4px 0 0 ${tone.deep}` }}
    >
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">
          Unité {index + 1} · {done}/{nodes.length}
        </p>
        <h2 className="text-lg leading-tight font-extrabold">{unit.title}</h2>
        {unit.subtitle && <p className="text-xs opacity-90">{unit.subtitle}</p>}
      </div>
      <UnitIcon name={unit.icon} size={32} />
    </div>
  )
}

function LessonBubble({ node, offset, onOpen }: { node: LessonNode; offset: number; onOpen: () => void }) {
  const tone = UNIT_TONES[node.unit.color]
  const locked = node.status === 'locked'
  const done = node.status === 'done'
  const active = node.status === 'available'

  return (
    <div className="relative flex flex-col items-center py-3" style={{ transform: `translateX(${offset}px)` }}>
      {/* Le badge se place sur le côté : au-dessus, il chevaucherait la
          bulle précédente sur le serpentin. */}
      {active && (
        <motion.span
          initial={{ x: offset >= 0 ? 8 : -8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`absolute top-6 whitespace-nowrap rounded-full bg-paper px-3 py-1 text-[0.65rem] font-black uppercase tracking-wide text-teal shadow-sm ${
            offset >= 0 ? 'right-full mr-3' : 'left-full ml-3'
          }`}
        >
          Commencer
        </motion.span>
      )}

      <motion.button
        type="button"
        onClick={onOpen}
        disabled={locked}
        whileTap={locked ? undefined : { scale: 0.92, y: 4 }}
        aria-label={`${node.lesson.title}${locked ? ' (verrouillée)' : ''}`}
        className={`flex h-18 w-18 items-center justify-center rounded-full text-white transition-colors ${
          locked ? 'bg-line text-ink-faint' : tone.bg
        }`}
        style={{
          width: '4.5rem',
          height: '4.5rem',
          boxShadow: `0 6px 0 0 ${locked ? 'var(--color-line)' : tone.deep}`,
        }}
      >
        {locked ? <LockIcon size={26} /> : done ? <CheckIcon size={30} /> : <UnitIcon name={node.unit.icon} size={28} />}
      </motion.button>
    </div>
  )
}

function ChestNode({ unlocked }: { unlocked: boolean }) {
  return (
    <div className="relative mt-4 flex items-center gap-4">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl ${unlocked ? 'bg-amber text-white' : 'bg-line text-ink-faint'}`}
        style={{ boxShadow: `0 5px 0 0 ${unlocked ? 'var(--color-amber-deep)' : 'var(--color-line)'}` }}
      >
        <ChestIcon size={30} />
      </div>
      {unlocked && <Mascot mood="happy" size={70} />}
    </div>
  )
}
