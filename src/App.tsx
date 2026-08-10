import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CourseProvider } from '@/content/CourseProvider'
import { PathScreen } from '@/screens/PathScreen'
import { LessonRoute } from '@/screens/LessonRoute'
import { ReviewRoute } from '@/screens/ReviewRoute'
import { ProfileScreen } from '@/screens/ProfileScreen'
import { UpdatePrompt } from '@/components/UpdatePrompt'

/**
 * Routage par ancre (`#/...`) : c'est le seul mode qui fonctionne à la fois
 * sur GitHub Pages, où il n'y a pas de réécriture d'URL, et dans la WebView
 * de l'APK, où les pages sont servies depuis le système de fichiers.
 */
export default function App() {
  return (
    <HashRouter>
      <CourseProvider>
        <Routes>
          <Route path="/" element={<PathScreen />} />
          <Route path="/lecon/:lessonId" element={<LessonRoute />} />
          <Route path="/revision" element={<ReviewRoute />} />
          <Route path="/profil" element={<ProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <UpdatePrompt />
      </CourseProvider>
    </HashRouter>
  )
}
