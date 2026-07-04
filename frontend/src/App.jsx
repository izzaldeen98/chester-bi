import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './lib/AppLayout'
import FullscreenLayout from './lib/FullscreenLayout'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import UsersPage from './pages/UsersPage'
import DashboardsPage from './pages/DashboardsPage'
import PackagesPage from './pages/PackagesPage'
import ConnectionsPage from './pages/ConnectionsPage'
import PackageEditorPage from './pages/PackageEditorPage'
import QueryPage from './pages/QueryPage'
import QueriesPage from './pages/QueriesPage'
import FilesPage from './pages/FilesPage'
import DashboardWorkSpace from './pages/DashboardWorkSpace'
import DashboardViewPage from './pages/DashboardViewPage'
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
          <Route path="/dashboard"   element={<DashboardsPage />} />
          <Route path="/queries"     element={<QueriesPage />} />
          <Route path="/files"       element={<FilesPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/packages"                      element={<PackagesPage />} />
          <Route path="/packages/:packageId/editor"  element={<PackageEditorPage />} />
          <Route path="/users"       element={<UsersPage />} />
        </Route>

        {/* Fullscreen — no app sidebar */}
        <Route element={<FullscreenLayout />}>
          <Route path="/queries/new"             element={<QueryPage />} />
          <Route path="/queries/:queryId/edit"   element={<QueryPage />} />
          <Route path="/workspace"                element={<DashboardWorkSpace />} />
          <Route path="/workspace/:dashboardId"   element={<DashboardWorkSpace />} />
          <Route path="/view/:dashboardId"         element={<DashboardViewPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
