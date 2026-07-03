// frontend/src/test/LoginPage.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from '../pages/LoginPage'
import { AuthProvider } from '../store/authStore'

// Mock authApi
vi.mock('../services/api', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('Not authenticated')),
    logout: vi.fn(),
  },
  tokenStorage: {
    getAccess: vi.fn().mockReturnValue(null),
    getRefresh: vi.fn().mockReturnValue(null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
  apiClient: { interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
)

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation error for empty form', async () => {
    render(<LoginPage />, { wrapper: Wrapper })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
    })
  })

  it('shows demo credentials', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByText(/admin@eka.local/i)).toBeInTheDocument()
  })
})
