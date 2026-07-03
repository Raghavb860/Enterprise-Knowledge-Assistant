// frontend/src/store/authStore.tsx
/**
 * Auth state management using React Context + useReducer.
 * No external state library required.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type { AuthUser, AuthTokens } from '@/types'
import { authApi, tokenStorage } from '@/services/api'

// ─── State ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

type AuthAction =
  | { type: 'SET_USER'; payload: AuthUser }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: true, isLoading: false }
    case 'LOGOUT':
      return { user: null, isAuthenticated: false, isLoading: false }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // On mount: try to restore session via /auth/me
  useEffect(() => {
    const restore = async () => {
      const token = tokenStorage.getAccess()
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }
      try {
        const user = await authApi.me()
        dispatch({ type: 'SET_USER', payload: user })
      } catch {
        tokenStorage.clear()
        dispatch({ type: 'LOGOUT' })
      }
    }
    restore()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const tokens: AuthTokens = await authApi.login(email, password)
      const user: AuthUser = {
        id: tokens.user_id,
        email,
        username: tokens.username,
        full_name: tokens.full_name,
        department: null,
        role: tokens.role,
        permissions: tokens.permissions,
        is_active: true,
        last_login_at: null,
      }
      dispatch({ type: 'SET_USER', payload: user })
    } catch (err) {
      dispatch({ type: 'SET_LOADING', payload: false })
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    dispatch({ type: 'LOGOUT' })
  }, [])

  const hasPermission = useCallback(
    (permission: string) => state.user?.permissions.includes(permission) ?? false,
    [state.user]
  )

  const hasRole = useCallback(
    (...roles: string[]) => roles.includes(state.user?.role ?? ''),
    [state.user]
  )

  return (
    <AuthContext.Provider value={{ state, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
