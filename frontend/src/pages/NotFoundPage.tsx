// frontend/src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom'
import { Brain, ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border">
        <Brain className="h-10 w-10 text-muted-foreground/30" />
      </div>
      <div>
        <p className="text-7xl font-bold text-muted-foreground/20 leading-none">404</p>
        <h1 className="mt-2 text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Link
        to="/dashboard"
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm
                   font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <ArrowLeft className="h-4 w-4" />
        Go to Dashboard
      </Link>
    </div>
  )
}
