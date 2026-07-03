// frontend/src/test/authStore.test.tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../store/authStore'

vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({
      access_token: 'tok', refresh_token: 'ref',
      user_id: 'u1', username: 'admin', full_name: 'Admin',
      role: 'super_admin', permissions: ['documents:read'],
      expires_in: 1800, token_type: 'bearer',
    }),
    me: vi.fn().mockRejectedValue(new Error('no session')),
    logout: vi.fn(),
  },
  tokenStorage: {
    getAccess: vi.fn().mockReturnValue(null),
    getRefresh: vi.fn().mockReturnValue(null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}))

describe('authStore', () => {
  it('starts unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })
    await waitFor(() => expect(result.current.state.isLoading).toBe(false))
    expect(result.current.state.isAuthenticated).toBe(false)
  })

  it('sets authenticated after login', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })
    await waitFor(() => expect(result.current.state.isLoading).toBe(false))
    await act(async () => {
      await result.current.login('admin@eka.local', 'Admin@123')
    })
    expect(result.current.state.isAuthenticated).toBe(true)
    expect(result.current.state.user?.role).toBe('super_admin')
  })

  it('hasPermission returns true for granted permissions', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await act(async () => { await result.current.login('a@b.com', 'pass') })
    expect(result.current.hasPermission('documents:read')).toBe(true)
    expect(result.current.hasPermission('roles:manage')).toBe(false)
  })
})
