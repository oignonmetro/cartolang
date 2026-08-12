import { useCourse } from '@/content/CourseProvider'
import { LibraryScreen } from './LibraryScreen'
import { PathScreen } from './PathScreen'

/**
 * Accueil : l'agencement déclaré par le cours décide de l'écran.
 * Un parcours guidé pour les cours débutants, une bibliothèque en accès
 * libre pour les cours de consolidation.
 */
export function HomeScreen() {
  const { course } = useCourse()
  return course.layout === 'library' ? <LibraryScreen course={course} /> : <PathScreen course={course} />
}
