// frontend/src/pages/SettingsPage.tsx
import React from 'react'
import { useState } from 'react'
import { useAuth } from '@/store/authStore'
import { User, Shield, Bell, Palette, Key, Save } from 'lucide-react'
import { cn } from '@/utils/cn'

function SectionCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { state } = useAuth()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const MODELS = [
    { value: 'qwen3:8b',   label: 'Qwen3 8B (default)' },
    { value: 'llama3',     label: 'Llama 3 8B' },
    { value: 'mistral',    label: 'Mistral 7B' },
    { value: 'gemma:7b',   label: 'Gemma 7B' },
  ]

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account preferences and system configuration</p>
      </div>

      {/* Account */}
      <SectionCard title="Account" icon={User}>
        <InfoRow label="Full Name"   value={state.user?.full_name} />
        <InfoRow label="Email"       value={state.user?.email} />
        <InfoRow label="Username"    value={`@${state.user?.username}`} />
        <InfoRow label="Department"  value={state.user?.department ?? '—'} />
        <InfoRow
          label="Account Status"
          value={
            <span className="text-green-400 text-xs font-medium">Active</span>
          }
        />
      </SectionCard>

      {/* Role & Permissions */}
      <SectionCard title="Role & Permissions" icon={Shield}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary capitalize">
              {state.user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Granted permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {(state.user?.permissions ?? []).sort().map(p => (
                <span
                  key={p}
                  className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {p}
                </span>
              ))}
              {!state.user?.permissions.length && (
                <span className="text-xs text-muted-foreground">No permissions assigned</span>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* AI Preferences */}
      <SectionCard title="AI Preferences" icon={Palette}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Default Language Model</label>
            <p className="text-xs text-muted-foreground">
              The model used for chat when no override is specified.
              You can also switch per conversation.
            </p>
            <select
              defaultValue="qwen3:8b"
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Default Search Type</label>
            <select
              defaultValue="hybrid"
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="hybrid">Hybrid (Recommended)</option>
              <option value="semantic">Semantic</option>
              <option value="keyword">Keyword</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Show citations by default</p>
              <p className="text-xs text-muted-foreground">
                Automatically expand source citations in chat
              </p>
            </div>
            <div className="h-5 w-9 rounded-full bg-primary relative cursor-pointer">
              <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
            </div>
          </div>

          <button
            onClick={handleSave}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              saved
                ? 'bg-green-500/20 text-green-400'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            )}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      </SectionCard>

      {/* System Info */}
      <SectionCard title="System Information" icon={Key}>
        <div className="space-y-2.5 text-xs font-mono text-muted-foreground">
          {[
            ['API Endpoint',   'http://localhost:8000/api/v1'],
            ['Default LLM',    'qwen3:8b (Ollama local)'],
            ['Embeddings',     'nomic-embed-text (Ollama local)'],
            ['Vector Store',   'ChromaDB (local filesystem)'],
            ['Database',       'MySQL 8 (localhost:3306)'],
            ['App Version',    '1.0.0'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-1.5 border-b border-border last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground truncate text-right">{v}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
