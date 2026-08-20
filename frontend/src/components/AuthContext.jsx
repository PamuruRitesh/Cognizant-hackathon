import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../config'

const AuthContext = createContext(null)

// Permission matrix: which tabs each role can access
const ROLE_PERMISSIONS = {
  admin:   ['overview', 'sku_detail', 'vendors', 'recommendations', 'whatif', 'savings', 'audit', 'assistant', 'users'],
  planner: ['overview', 'sku_detail', 'vendors', 'recommendations', 'whatif', 'savings', 'audit', 'assistant'],
  analyst: ['overview', 'sku_detail', 'whatif', 'savings', 'assistant'],
  viewer:  ['overview', 'savings'],
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('sp_token'))
  const [loading, setLoading] = useState(true)

  // Validate existing token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Invalid token')
        return res.json()
      })
      .then(data => {
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('sp_token')
        setToken(null)
        setUser(null)
        setLoading(false)
      })
  }, [token])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('sp_token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sp_token')
    setToken(null)
    setUser(null)
  }, [])

  const hasRole = useCallback(
    (...roles) => user && roles.includes(user.role),
    [user]
  )

  const canAccess = useCallback(
    (tabId) => {
      if (!user) return false
      const perms = ROLE_PERMISSIONS[user.role]
      return perms ? perms.includes(tabId) : false
    },
    [user]
  )

  // Helper to build auth headers for API calls
  const authHeaders = useCallback(() => {
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        canAccess,
        authHeaders,
        ROLE_PERMISSIONS,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export default AuthContext
