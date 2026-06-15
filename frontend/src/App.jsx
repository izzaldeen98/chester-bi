import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './lib/AppLayout'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import UsersPage from './pages/UsersPage'
import DashboardsPage from './pages/DashboardsPage'
import PackagesPage from './pages/PackagesPage'
import ConnectionsPage from './pages/ConnectionsPage'

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
        <Route path="/"       element={<LandingPage />} />
        <Route path="/login"  element={<LoginPage />} />

        {/* Protected — all share the sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/home"        element={<HomePage />} />
          <Route path="/dashboard"   element={<DashboardsPage />} />
          <Route path="/query"       element={<ComingSoon name="Query Builder" />} />
          <Route path="/files"       element={<ComingSoon name="Files" />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/packages"    element={<PackagesPage />} />
          <Route path="/users"       element={<UsersPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
