// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider, useAuth } from '@/store/authStore'

// Pages
import LoginPage          from '@/pages/LoginPage'
import RegisterPage       from '@/pages/RegisterPage'
import DashboardPage      from '@/pages/DashboardPage'
import DocumentLibraryPage from '@/pages/DocumentLibraryPage'
import UploadPage         from '@/pages/UploadPage'
import CollectionsPage    from '@/pages/CollectionsPage'
import SearchPage         from '@/pages/SearchPage'
import ChatPage           from '@/pages/ChatPage'
import UsersPage          from '@/pages/UsersPage'
import AuditLogsPage      from '@/pages/AuditLogsPage'
import SettingsPage       from '@/pages/SettingsPage'
import NotFoundPage       from '@/pages/NotFoundPage'

// Layout
import AppLayout from '@/components/layout/AppLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Route Guards ─────────────────────────────────────────────────────────────

function PrivateRoute() {
  const { state } = useAuth()
  if (state.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  return state.isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function PublicRoute() {
  const { state } = useAuth()
  if (state.isLoading) return null
  return state.isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}

function AdminRoute({ permission }: { permission: string }) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? <Outlet /> : <Navigate to="/dashboard" replace />
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route element={<PublicRoute />}>
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected */}
            <Route element={<PrivateRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"  element={<DashboardPage />} />
                <Route path="/documents"  element={<DocumentLibraryPage />} />
                <Route path="/upload"     element={<UploadPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/search"     element={<SearchPage />} />
                <Route path="/chat"       element={<ChatPage />} />
                <Route path="/chat/:id"   element={<ChatPage />} />
                <Route path="/settings"   element={<SettingsPage />} />

                {/* Admin-only */}
                <Route element={<AdminRoute permission="users:read" />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
                <Route element={<AdminRoute permission="audit:read" />}>
                  <Route path="/audit" element={<AuditLogsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
