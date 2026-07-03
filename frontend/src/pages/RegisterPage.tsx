// frontend/src/pages/RegisterPage.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@/services/api'
import { Brain, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

const registerSchema = z.object({
  email:      z.string().email('Please enter a valid email'),
  username:   z.string().min(3,'At least 3 chars').max(30,'Max 30 chars').regex(/^[a-zA-Z0-9_]+$/,'Letters, numbers, underscores only'),
  full_name:  z.string().min(2, 'At least 2 characters'),
  password:   z.string().min(8,'At least 8 chars').regex(/[A-Z]/,'Must contain uppercase').regex(/[0-9]/,'Must contain number'),
  department: z.string().optional(),
})
type RegisterForm = z.infer<typeof registerSchema>

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars',   pass: password.length >= 8 },
    { label: 'Uppercase',  pass: /[A-Z]/.test(password) },
    { label: 'Number',     pass: /[0-9]/.test(password) },
  ]
  const strength = checks.filter(c => c.pass).length
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors',
            i < strength ? (strength===3?'bg-green-500':strength===2?'bg-yellow-500':'bg-red-500') : 'bg-secondary'
          )} />
        ))}
      </div>
      <div className="flex gap-3">
        {checks.map(({ label, pass }) => (
          <span key={label} className={cn('flex items-center gap-1 text-[10px]', pass ? 'text-green-400' : 'text-muted-foreground')}>
            <CheckCircle className="h-2.5 w-2.5" />{label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })
  const password = watch('password', '')

  const onSubmit = async (data: RegisterForm) => {
    setError('')
    try {
      await authApi.register(data)
      navigate('/login')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Registration failed.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Join your team's knowledge workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          {([
            { name: 'full_name',  label: 'Full Name',   type: 'text',  placeholder: 'Jane Smith',        ac: 'name' },
            { name: 'email',      label: 'Work Email',  type: 'email', placeholder: 'jane@company.com',  ac: 'email' },
            { name: 'username',   label: 'Username',    type: 'text',  placeholder: 'janesmith',         ac: 'username' },
            { name: 'department', label: 'Department',  type: 'text',  placeholder: 'Engineering (opt)', ac: 'organization' },
          ] as const).map(({ name, label, type, placeholder, ac }) => (
            <div key={name} className="space-y-1.5">
              <label className="block text-sm font-medium" htmlFor={name}>{label}</label>
              <input id={name} type={type} autoComplete={ac} placeholder={placeholder} {...register(name)}
                className={cn('w-full rounded-lg border bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors[name as keyof RegisterForm] ? 'border-destructive' : 'border-border')} />
              {errors[name as keyof RegisterForm] && <p className="text-xs text-destructive">{errors[name as keyof RegisterForm]?.message}</p>}
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                placeholder="Min. 8 chars, 1 uppercase, 1 number" {...register('password')}
                className={cn('w-full rounded-lg border bg-secondary/50 px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.password ? 'border-destructive' : 'border-border')} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            {password && <PasswordStrength password={password} />}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          New accounts start as Viewer. Ask your admin to upgrade your role.
        </p>
      </div>
    </div>
  )
}
