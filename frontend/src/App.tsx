import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth, RedirectIfAuthed } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TeamLayout } from './pages/TeamLayout'
import { MyFeesPage } from './pages/team/MyFeesPage'
import { SuggestPage } from './pages/team/SuggestPage'
import { PendingPage } from './pages/team/PendingPage'
import { TeamFeesPage } from './pages/team/TeamFeesPage'
import { TeamAdminPage } from './pages/team/TeamAdminPage'
import { GlobalAdminPage } from './pages/GlobalAdminPage'
import { PublicTeamViewPage } from './pages/PublicTeamViewPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/team/:teamId" element={<RequireAuth><TeamLayout /></RequireAuth>}>
            <Route index element={<MyFeesPage />} />
            <Route path="ehdota" element={<SuggestPage />} />
            <Route path="odottaa" element={<PendingPage />} />
            <Route path="joukkue" element={<TeamFeesPage />} />
            <Route path="hallinta" element={<TeamAdminPage />} />
          </Route>
          <Route path="/admin" element={<RequireAuth><GlobalAdminPage /></RequireAuth>} />
          <Route path="/katso/:token" element={<PublicTeamViewPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
