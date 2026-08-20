import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, Boxes } from 'lucide-react'

const DEMO_USERS = [
  { email: 'admin@stockpilot.io',   role: 'Admin',   desc: 'Full access + user management' },
  { email: 'planner@stockpilot.io', role: 'Planner', desc: 'Approve POs, all operational tabs' },
  { email: 'analyst@stockpilot.io', role: 'Analyst', desc: 'View forecasts & simulations' },
  { email: 'viewer@stockpilot.io',  role: 'Viewer',  desc: 'Dashboard & savings only' },
]

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async (demoEmail) => {
    setError('')
    setIsLoading(true)
    setEmail(demoEmail)
    setPassword('demo123')
    try {
      await login(demoEmail, 'demo123')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-screen">
      {/* Animated background orbs */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />

      <div className="login-container">
        {/* Branding */}
        <div className="login-brand">
          <div className="login-logo-wrap">
            <img
              src="/logo.png"
              alt="StockPilot"
              className="login-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.nextElementSibling
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            <div className="login-logo-fallback" style={{ display: 'none' }}>
              <Boxes size={28} color="var(--accent)" />
            </div>
          </div>
          <h1 className="login-title">StockPilot</h1>
          <p className="login-subtitle">Control Tower</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email">Email</label>
              <div className="login-input-wrap">
                <Mail size={16} className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-wrap">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error animate-fade-up">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="login-spinner" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Demo quick-access */}
          <div className="login-demo-section">
            <div className="login-demo-divider">
              <span>Demo Accounts</span>
            </div>
            <div className="login-demo-grid">
              {DEMO_USERS.map((du) => (
                <button
                  key={du.email}
                  className="login-demo-btn"
                  onClick={() => handleDemoLogin(du.email)}
                  disabled={isLoading}
                  title={`Login as ${du.role}: ${du.desc}`}
                >
                  <span className={`login-role-badge role-${du.role.toLowerCase()}`}>
                    {du.role}
                  </span>
                  <span className="login-demo-desc">{du.desc}</span>
                </button>
              ))}
            </div>
            <p className="login-demo-hint">
              All demo accounts use password: <code>demo123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
