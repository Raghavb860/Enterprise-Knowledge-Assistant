// frontend/src/components/documents/DocumentStatusBadge.tsx
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { documentsApi } from '@/services/api'
import { cn } from '@/utils/cn'
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { DocumentStatus } from '@/types'

interface DocumentStatusBadgeProps {
  documentId: string
  initialStatus: DocumentStatus
  onReady?: () => void
}

const STATUS_CONFIG: Record<DocumentStatus, { icon: React.ElementType; label: string; className: string; spin?: boolean }> = {
  pending:    { icon: Clock,       label: 'Pending',    className: 'bg-yellow-500/15 text-yellow-400' },
  processing: { icon: Loader2,     label: 'Processing', className: 'bg-blue-500/15 text-blue-400', spin: true },
  ready:      { icon: CheckCircle, label: 'Ready',      className: 'bg-green-500/15 text-green-400' },
  failed:     { icon: AlertCircle, label: 'Failed',     className: 'bg-red-500/15 text-red-400' },
}

export function DocumentStatusBadge({ documentId, initialStatus, onReady }: DocumentStatusBadgeProps) {
  const shouldPoll = initialStatus === 'pending' || initialStatus === 'processing'

  const { data } = useQuery({
    queryKey: ['document-status', documentId],
    queryFn: () => documentsApi.getStatus(documentId),
    enabled: shouldPoll,
    refetchInterval: (data) => {
      const s = data?.status as DocumentStatus
      return (s === 'ready' || s === 'failed') ? false : 3000
    },
    initialData: { document_id: documentId, status: initialStatus, chunk_count: 0 },
  })

  const currentStatus = (data?.status ?? initialStatus) as DocumentStatus

  useEffect(() => {
    if (currentStatus === 'ready') onReady?.()
  }, [currentStatus, onReady])

  const config = STATUS_CONFIG[currentStatus]
  const Icon = config.icon

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      <Icon className={cn('h-3 w-3', config.spin && 'animate-spin')} />
      {config.label}
      {currentStatus === 'ready' && data?.chunk_count > 0 && (
        <span className="opacity-60">· {data.chunk_count} chunks</span>
      )}
    </span>
  )
}

export default DocumentStatusBadge
