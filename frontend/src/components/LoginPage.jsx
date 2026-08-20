import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { API_BASE } from '../config'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(''); setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to sign in')
      onLogin({ token: result.access_token, user: result.user })
    } catch (err) { setError(err.message) } finally { setIsSubmitting(false) }
  }
  return <main className="login-page"><section className="login-panel">
    <div className="login-brand"><img src="/logo.png" alt="StockPilot" /><div><strong>StockPilot</strong><span>Control Tower</span></div></div>
    <div className="login-copy"><span className="login-eyebrow"><ShieldCheck size={14} /> Secure workspace</span><h1>Sign in to your control tower.</h1><p>Access is tailored to your operational role and every approval is attributed to the signed-in user.</p></div>
    <form className="login-form" onSubmit={submit}>
      <label><span>Email</span><div><Mail size={16} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></div></label>
      <label><span>Password</span><div><LockKeyhole size={16} /><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></div></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg login-submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
    </form>
  </section></main>
}
