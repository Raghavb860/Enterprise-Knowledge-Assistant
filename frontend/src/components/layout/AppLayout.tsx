// frontend/src/components/layout/AppLayout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/authStore'
import {
  LayoutDashboard, FileText, Upload, FolderOpen, Search,
  MessageSquare, Users, ScrollText, Settings, LogOut, Brain,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const navItems = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',       permission: 'dashboard:view' },
  { to: '/documents',   icon: FileText,         label: 'Documents',       permission: 'documents:read' },
  { to: '/upload',      icon: Upload,           label: 'Upload',          permission: 'documents:upload' },
  { to: '/collections', icon: FolderOpen,       label: 'Collections',     permission: 'collections:read' },
  { to: '/search',      icon: Search,           label: 'Search',          permission: 'search:perform' },
  { to: '/chat',        icon: MessageSquare,    label: 'Chat',            permission: 'chat:create' },
]

const adminItems = [
  { to: '/users',   icon: Users,      label: 'Users',       permission: 'users:read' },
  { to: '/audit',   icon: ScrollText, label: 'Audit Logs',  permission: 'audit:read' },
  { to: '/settings',icon: Settings,   label: 'Settings',    permission: null },
]

export default function AppLayout() {
  const { state, logout, hasPermission } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const visibleNav    = navItems.filter(i => !i.permission || hasPermission(i.permission))
  const visibleAdmin  = adminItems.filter(i => !i.permission || hasPermission(i.permission))

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="flex w-60 flex-col border-r border-border bg-card/50">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-semibold text-sm tracking-tight">Knowledge AI</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}

          {visibleAdmin.length > 0 && (
            <>
              <div className="my-3 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Administration
                </p>
              </div>
              {visibleAdmin.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User profile */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-md p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-semibold shrink-0">
              {state.user?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{state.user?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{state.user?.role?.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
