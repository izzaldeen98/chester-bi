import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RequirePermission from './components/RequirePermission'
import AppLayout from './layouts/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import DashboardsPage from './pages/DashboardsPage'
import DashboardWorkspacePage from './pages/DashboardWorkspacePage'
import ConnectionsPage from './pages/ConnectionsPage'
import UsersPage from './pages/UsersPage'
import PackagesPage from './pages/PackagesPage'
import PackageDetailPage from './pages/PackageDetailPage'
import QueryPage from './pages/QueryPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>

          {/* Full-screen workspace routes (no AppLayout wrapper) */}
          <Route path="/home/dashboards/:dashboardId" element={
            <RequirePermission permissions={['dashboards:view', 'dashboards:edit', 'dashboards:*']}>
              <DashboardWorkspacePage />
            </RequirePermission>
          } />

          <Route path="/home/query" element={
            <RequirePermission permissions={['packages:list', 'packages:*']}>
              <QueryPage />
            </RequirePermission>
          } />

          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />

            <Route path="/home/dashboards" element={
              <RequirePermission permissions={['dashboards:list', 'dashboards:*']}>
                <DashboardsPage />
              </RequirePermission>
            } />

            <Route path="/home/packages" element={
              <RequirePermission permissions={['packages:list', 'packages:*']}>
                <PackagesPage />
              </RequirePermission>
            } />

            <Route path="/home/packages/:packageId" element={
              <RequirePermission permissions={['packages:list', 'packages:*']}>
                <PackageDetailPage />
              </RequirePermission>
            } />

            <Route path="/home/connections" element={
              <RequirePermission permissions={['connections:list', 'connections:*']}>
                <ConnectionsPage />
              </RequirePermission>
            } />

            <Route path="/home/users" element={
              <RequirePermission permissions={['users:list', 'users:*']}>
                <UsersPage />
              </RequirePermission>
            } />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
