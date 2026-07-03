// frontend/src/pages/DashboardPage.tsx
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { FileText, Users, FolderOpen, Search, MessageSquare, Clock } from 'lucide-react'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']

function StatCard({
  icon: Icon, label, value, sub, color = 'text-primary',
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-lg bg-primary/10 p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      </div>
    )
  }

  const docsTypeData = Object.entries(stats?.documents_by_type ?? {}).map(([name, value]) => ({
    name: name.toUpperCase(), value,
  }))

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">System overview and AI activity metrics</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={FileText}      label="Total Documents"   value={stats?.total_documents ?? 0} />
        <StatCard icon={Users}         label="Active Users"      value={stats?.total_users ?? 0} />
        <StatCard icon={FolderOpen}    label="Collections"       value={stats?.total_collections ?? 0} />
        <StatCard icon={Search}        label="Searches Today"    value={stats?.total_searches_today ?? 0} />
        <StatCard icon={MessageSquare} label="Chats Today"       value={stats?.total_chats_today ?? 0} />
        <StatCard
          icon={Clock}
          label="Avg Response"
          value={stats?.avg_response_time_ms
            ? `${(stats.avg_response_time_ms / 1000).toFixed(1)}s`
            : '—'}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Queries per day */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Query Activity — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats?.queries_per_day ?? []}>
              <defs>
                <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Queries"
                stroke="#3b82f6"
                fill="url(#qGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Documents by type */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Documents by Type</h2>
          {docsTypeData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No documents yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={docsTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {docsTypeData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Legend
                  formatter={(v) => <span style={{ fontSize: 12, color: 'hsl(var(--foreground))' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
