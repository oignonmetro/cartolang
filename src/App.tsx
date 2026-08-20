import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CourseProvider } from '@/content/CourseProvider'
import { HomeScreen } from '@/screens/HomeScreen'
import { LessonRoute } from '@/screens/LessonRoute'
import { ReviewRoute } from '@/screens/ReviewRoute'
import { UnitPathScreen } from '@/screens/UnitPathScreen'
import { StepRoute } from '@/screens/StepRoute'
import { CheckpointTestRoute } from '@/screens/CheckpointTestRoute'
import { HardWordsScreen } from '@/screens/HardWordsScreen'
import { ProfileScreen } from '@/screens/ProfileScreen'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { AppUpdateBanner } from '@/components/AppUpdateBanner'

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
          <Route path="/" element={<HomeScreen />} />
          <Route path="/lecon/:lessonId" element={<LessonRoute />} />
          <Route path="/revision" element={<ReviewRoute />} />
          <Route path="/unite/:unitId" element={<UnitPathScreen />} />
          <Route path="/etape/:unitId/:stepId" element={<StepRoute />} />
          <Route path="/test/:unitId/:lessonId" element={<CheckpointTestRoute />} />
          <Route path="/profil" element={<ProfileScreen />} />
          {/* Prototype de conception, données en dur — pas encore relié au moteur. */}
          <Route path="/difficiles" element={<HardWordsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <UpdatePrompt />
        <AppUpdateBanner />
      </CourseProvider>
    </HashRouter>
  )
}
