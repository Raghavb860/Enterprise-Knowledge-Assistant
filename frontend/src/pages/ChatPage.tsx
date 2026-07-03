// frontend/src/pages/ChatPage.tsx
import { useState, useRef, useEffect, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/services/api'
import { cn } from '@/utils/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Plus, MessageSquare, Loader2, ChevronDown, ChevronUp,
  FileText, BookOpen, Sparkles, Trash2, AlertCircle
} from 'lucide-react'
import type { ChatMessage, Citation } from '@/types'
import { format } from 'date-fns'

// ─── Citation Card ─────────────────────────────────────────────────────────────

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false)
  const score = Math.round(citation.similarity_score * 100)

  return (
    <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors"
      >
        <FileText className="h-3 w-3 shrink-0 text-primary" />
        <span className="font-medium truncate flex-1 text-left">{citation.document_name}</span>
        <span className="shrink-0 text-muted-foreground">
          p.{citation.page_number} · {score}%
        </span>
        {open ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 text-muted-foreground leading-relaxed">
          <div className="mb-1 flex gap-3 text-[10px] font-mono">
            <span>Chunk {citation.chunk_index}</span>
            <span>Score {citation.similarity_score.toFixed(3)}</span>
          </div>
          <p className="line-clamp-5">{citation.excerpt}</p>
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [showCitations, setShowCitations] = useState(false)
  const hasCitations = message.citations && message.citations.length > 0

  return (
    <div className={cn('flex gap-3 animate-fade-in', isUser && 'justify-end')}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      <div className={cn('max-w-[80%] space-y-2', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm bg-card border border-border'
        )}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none
              [&>p]:mb-2 [&>p:last-child]:mb-0
              [&>ul]:mb-2 [&>ol]:mb-2
              [&>pre]:bg-secondary [&>pre]:rounded [&>pre]:p-3 [&>pre]:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer: timing + citations toggle */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.created_at), 'HH:mm')}
            {message.response_time_ms && ` · ${(message.response_time_ms / 1000).toFixed(1)}s`}
          </span>
          {hasCitations && (
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              {message.citations!.length} source{message.citations!.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Citations */}
        {showCitations && hasCitations && (
          <div className="space-y-1.5">
            {message.citations!.map((c, i) => (
              <CitationCard key={i} citation={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Session List ──────────────────────────────────────────────────────────────

function SessionList({
  onSelect,
  onDelete,
  currentId,
}: {
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  currentId?: string
}) {
  const { data } = useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: () => chatApi.listSessions({ page: 1, page_size: 30 }),
  })

  return (
    <div className="w-56 shrink-0 border-r border-border bg-card/30 flex flex-col">
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {data?.items.map((s: any) => (
          <div
            key={s.id}
            className={cn(
              'group relative flex w-full items-center rounded-md text-xs transition-colors',
              s.id === currentId
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <button
              onClick={() => onSelect(s.id)}
              className="flex-1 text-left min-w-0 px-3 py-2.5 pr-8"
            >
              <p className="truncate font-medium">{s.title}</p>
              <p className="mt-0.5 text-[10px] opacity-70">
                {s.message_count} messages
              </p>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Permanently delete this conversation?')) {
                  onDelete(s.id)
                }
              }}
              className="absolute right-2 p-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all rounded"
              title="Delete conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!data?.items.length && (
          <p className="p-3 text-xs text-muted-foreground">No conversations yet</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Chat Page ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [sessionId, setSessionId] = useState(routeId ?? '')
  const [input, setInput] = useState('')
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load existing session messages
  const { data: sessionData } = useQuery({
    queryKey: ['chat', 'session', sessionId],
    queryFn: () => chatApi.getSession(sessionId),
    enabled: !!sessionId,
  })

  useEffect(() => {
    if (sessionData?.messages) {
      setLocalMessages(sessionData.messages)
    }
  }, [sessionData])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  const createSession = useMutation({
    mutationFn: () => chatApi.createSession({ title: 'New Conversation' }),
    onSuccess: (session) => {
      setSessionId(session.id)
      navigate(`/chat/${session.id}`, { replace: true })
      qc.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })

  const deleteSession = useMutation({
    mutationFn: chatApi.deleteSession,
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['chat', 'sessions'] })
      if (sessionId === deletedId) {
        setLocalMessages([])
        setSessionId('')
        navigate('/chat', { replace: true })
      }
    }
  })

  const handleNewChat = async () => {
    setLocalMessages([])
    setSessionId('')
    setSendError(null)
    navigate('/chat', { replace: true })
    createSession.mutate()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return

    let sid = sessionId
    if (!sid) {
      const session = await createSession.mutateAsync()
      sid = session.id
    }

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sid,
      role: 'user',
      content: input.trim(),
      citations: null,
      model_used: null,
      response_time_ms: null,
      created_at: new Date().toISOString(),
    }
    
    const tempAssistantId = `temp-assistant-${Date.now()}`
    const initialAssistantMsg: ChatMessage = {
      id: tempAssistantId,
      session_id: sid,
      role: 'assistant',
      content: '',
      citations: null,
      model_used: null,
      response_time_ms: null,
      created_at: new Date().toISOString(),
    }
    
    setLocalMessages(prev => [...prev, userMsg, initialAssistantMsg])
    const msgText = input.trim()
    setInput('')
    setSendError(null)
    setIsGenerating(true)

    chatApi.streamMessage(
      { session_id: sid, message: msgText },
      (chunk) => {
        setLocalMessages(prev => prev.map(m => 
          m.id === tempAssistantId ? { ...m, content: m.content + chunk } : m
        ))
      },
      (citations) => {
        setLocalMessages(prev => prev.map(m => 
          m.id === tempAssistantId ? { ...m, citations } : m
        ))
      },
      (messageId) => {
        setLocalMessages(prev => prev.map(m => 
          m.id === tempAssistantId ? { ...m, id: messageId } : m
        ))
        setIsGenerating(false)
        qc.invalidateQueries({ queryKey: ['chat', 'sessions'] })
      },
      (errorMsg) => {
        setLocalMessages(prev => prev.filter(m => m.id !== tempAssistantId && m.id !== userMsg.id))
        setInput(msgText)
        setSendError(errorMsg)
        setIsGenerating(false)
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <SessionList
        onSelect={(id) => { setSessionId(id); setSendError(null); navigate(`/chat/${id}`) }}
        onDelete={(id) => deleteSession.mutate(id)}
        currentId={sessionId}
      />

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              {sessionData?.title ?? 'New Conversation'}
            </span>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5
                       text-xs font-medium hover:bg-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {localMessages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ask your documents anything</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Your AI assistant answers strictly from uploaded documents and shows you the exact source.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 max-w-md w-full">
                {[
                  'Summarize the key findings in the annual report',
                  'What are the main risk factors mentioned?',
                  'Compare the Q3 and Q4 performance metrics',
                  'List all action items from the meeting notes',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-lg border border-border bg-card/50 p-3 text-left text-xs
                               text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {localMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isGenerating && localMessages[localMessages.length - 1]?.content === '' && (
            <div className="flex gap-3 animate-fade-in">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs text-muted-foreground animate-pulse">
                    Reading documents and generating answer...
                  </span>
                </div>
              </div>
            </div>
          )}

          {sendError && (
            <div className="flex gap-3 animate-fade-in">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {sendError}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (sendError) setSendError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{ resize: 'none' }}
              className="flex-1 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                         min-h-[44px] max-h-[200px] overflow-y-auto"
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = `${t.scrollHeight}px`
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating || createSession.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                         bg-primary text-primary-foreground transition-opacity
                         hover:opacity-90 disabled:opacity-40"
            >
              {isGenerating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Answers are generated strictly from your uploaded documents · Sources are shown for each response
          </p>
        </div>
      </div>
    </div>
  )
}
