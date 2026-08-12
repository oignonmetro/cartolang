import { useEffect } from 'react'
import type { Course } from '@/content/schema'
import { useCourse } from '@/content/CourseProvider'
import { lessonsOf } from '@/content/course'
import { starsFromMastery } from '@/engine/progress'
import { useProgress } from '@/store/progressStore'
import { LibraryScreen } from './LibraryScreen'
import { PathScreen } from './PathScreen'

/**
 * Accueil : l'agencement déclaré par le cours décide de l'écran.
 * Un parcours guidé pour les cours débutants, une bibliothèque en accès
 * libre pour les cours de consolidation.
 */
export function HomeScreen() {
  const { course } = useCourse()
  useStarSync(course)
  return course.layout === 'library' ? <LibraryScreen course={course} /> : <PathScreen course={course} />
}

/**
 * Relève le plancher d'étoiles des leçons que les dernières réponses ont fait
 * progresser. C'est ici, et pas dans les écrans de session, parce qu'une
 * révision touche des éléments de plusieurs leçons à la fois : on repasse de
 * toute façon par l'accueil en sortant d'une session, quelle qu'elle soit.
 */
function useStarSync(course: Course) {
  const cards = useProgress((state) => state.cards)
  const lessons = useProgress((state) => state.lessons)
  const raiseLessonStars = useProgress((state) => state.raiseLessonStars)

  useEffect(() => {
    const raised: Record<string, number> = {}
    for (const { lesson } of lessonsOf(course)) {
      const stars = starsFromMastery(lesson, cards)
      if (stars > (lessons[lesson.id]?.level ?? 0)) raised[lesson.id] = stars
    }
    // L'écriture change `lessons`, donc relance cet effet — mais plus rien n'y
    // dépasse alors le plancher, et il s'arrête au deuxième tour.
    if (Object.keys(raised).length > 0) raiseLessonStars(raised)
  }, [course, cards, lessons, raiseLessonStars])
}
