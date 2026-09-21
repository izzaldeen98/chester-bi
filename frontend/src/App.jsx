import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './lib/AppLayout'
import FullscreenLayout from './lib/FullscreenLayout'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import UsersPage from './pages/UsersPage'
import ModelsPage from './pages/ModelsPage'
import ConnectionsPage from './pages/ConnectionsPage'
import ModelEditorPage from './pages/ModelEditorPage'
import FilesPage from './pages/FilesPage'
import SettingsProvidersPage from './pages/SettingsProvidersPage'
import ArtifactsPage from './pages/ArtifactsPage'
import ArtifactWorkspace from './pages/ArtifactWorkspace'
import RegisterPage from './pages/RegisterPage'

// Placeholder for pages not yet built
function ComingSoon({ name }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-h)' }}>{name}</span> — coming soon
      </p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"          element={<LandingPage />} />
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/register"  element={<RegisterPage />} />

        {/* Protected — sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/home"        element={<HomePage />} />
          <Route path="/artifacts"   element={<ArtifactsPage />} />
          <Route path="/artifacts/new" element={<ArtifactWorkspace />} />
          <Route path="/artifacts/:artifactId" element={<ArtifactWorkspace />} />
          <Route path="/settings/ai-providers" element={<SettingsProvidersPage />} />
          <Route path="/files"       element={<FilesPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/models"                    element={<ModelsPage />} />
          <Route path="/models/:modelId/editor"  element={<ModelEditorPage />} />
          <Route path="/users"       element={<UsersPage />} />
        </Route>

        {/* Fullscreen — no app sidebar */}
        <Route element={<FullscreenLayout />}>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
