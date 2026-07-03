// frontend/src/pages/UsersPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/services/api'
import { useAuth } from '@/store/authStore'
import { Users, Shield, Search, UserX, UserCheck, Mail, Calendar } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDistanceToNow, format } from 'date-fns'
import type { User } from '@/types'

const ROLE_COLORS: Record<string, string> = {
  super_admin:      'bg-red-500/15 text-red-400',
  admin:            'bg-orange-500/15 text-orange-400',
  knowledge_manager:'bg-purple-500/15 text-purple-400',
  analyst:          'bg-blue-500/15 text-blue-400',
  viewer:           'bg-secondary text-muted-foreground',
}

const ROLES = ['super_admin', 'admin', 'knowledge_manager', 'analyst', 'viewer']

function UserRow({
  user,
  onDeactivate,
  canManage,
  currentUserId,
}: {
  user: User
  onDeactivate: (id: string) => void
  canManage: boolean
  currentUserId: string
}) {
  const isSelf = user.id === currentUserId
  const roleLabel = user.role.replace(/_/g, ' ')

  return (
    <tr className="hover:bg-secondary/20 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            user.is_active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
          )}>
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">
              {user.full_name}
              {isSelf && (
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(you)</span>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-2.5 w-2.5" />
              {user.email}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <p className="text-xs text-muted-foreground font-mono">@{user.username}</p>
      </td>

      <td className="px-4 py-3.5">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
          ROLE_COLORS[user.role] ?? 'bg-secondary text-muted-foreground'
        )}>
          <Shield className="h-2.5 w-2.5" />
          {roleLabel}
        </span>
      </td>

      <td className="px-4 py-3.5">
        {user.department
          ? <span className="text-xs text-muted-foreground">{user.department}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>
        }
      </td>

      <td className="px-4 py-3.5">
        <span className={cn(
          'text-xs font-medium',
          user.is_active ? 'text-green-400' : 'text-muted-foreground line-through'
        )}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>

      <td className="px-4 py-3.5">
        {user.last_login_at
          ? (
            <div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })}
              </p>
            </div>
          )
          : <span className="text-xs text-muted-foreground/40">Never</span>
        }
      </td>

      <td className="px-4 py-3.5">
        <p className="text-xs text-muted-foreground">
          {format(new Date(user.created_at), 'MMM d, yyyy')}
        </p>
      </td>

      <td className="px-4 py-3.5 text-right">
        {canManage && !isSelf && user.is_active && (
          <button
            onClick={() => {
              if (confirm(`Deactivate user "${user.full_name}"? They will no longer be able to log in.`)) {
                onDeactivate(user.id)
              }
            }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground
                       hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
          >
            <UserX className="h-3 w-3" />
            Deactivate
          </button>
        )}
      </td>
    </tr>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const { state: authState } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, page_size: 20 }],
    queryFn: () => usersApi.list({ page, page_size: 20 }),
    staleTime: 30_000,
  })

  const deactivateMut = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const canManage = authState.user?.permissions.includes('users:update') ?? false

  const filtered = (data?.items ?? []).filter(u => {
    const matchesSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} registered user{data?.total !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Role breakdown pills */}
        <div className="hidden lg:flex items-center gap-2">
          {ROLES.map(role => {
            const count = (data?.items ?? []).filter(u => u.role === role).length
            if (count === 0) return null
            return (
              <span key={role} className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                ROLE_COLORS[role]
              )}>
                {role.replace(/_/g, ' ')}: {count}
              </span>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or username…"
            className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All roles</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {['User', 'Username', 'Role', 'Department', 'Status', 'Last Login', 'Joined', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 animate-pulse rounded bg-secondary" />
                      </td>
                    ))}
                  </tr>
                ))
                : filtered.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onDeactivate={id => deactivateMut.mutate(id)}
                    canManage={canManage}
                    currentUserId={authState.user?.id ?? ''}
                  />
                ))
              }
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && !isLoading && (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No users match your filter</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {data?.total} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs
                         disabled:opacity-40 hover:bg-secondary transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs
                         disabled:opacity-40 hover:bg-secondary transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
