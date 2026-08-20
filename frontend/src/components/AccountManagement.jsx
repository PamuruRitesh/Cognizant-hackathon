import { useEffect, useState } from 'react'
import { Eye, Plus, Trash2, Users } from 'lucide-react'
import { API_BASE } from '../config'

const errorMessage = (detail, fallback) => {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(error => {
      const field = Array.isArray(error.loc) ? error.loc.at(-1) : ''
      return `${field ? `${String(field).replaceAll('_', ' ')}: ` : ''}${error.msg || 'Invalid value'}`
    }).join(' ')
  }
  return fallback
}

export default function AccountManagement({ token }) {
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VIEWER' })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(true)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const loadAccounts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/accounts`, { headers })
      const result = await response.json()
      if (!response.ok) throw new Error(errorMessage(result.detail, 'Could not load accounts'))
      setAccounts(result)
    } catch (err) { setStatus({ type: 'error', message: err.message }) } finally { setLoading(false) }
  }
  useEffect(() => { loadAccounts() }, [])

  const submit = async (event) => {
    event.preventDefault(); setStatus({ type: '', message: '' })
    try {
      const response = await fetch(`${API_BASE}/api/auth/accounts`, { method: 'POST', headers, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(errorMessage(result.detail, 'Could not create viewer'))
      setAccounts(current => [...current, result])
      setForm({ name: '', email: '', password: '', role: 'VIEWER' })
      setStatus({ type: 'success', message: `${result.name} can now sign in as a ${result.role.toLowerCase()}.` })
    } catch (err) { setStatus({ type: 'error', message: err.message }) }
  }

  const changeRole = async (email, role) => {
    setStatus({ type: '', message: '' })
    try {
      const response = await fetch(`${API_BASE}/api/auth/accounts/${encodeURIComponent(email)}/role`, { method: 'PATCH', headers, body: JSON.stringify({ role }) })
      const result = await response.json()
      if (!response.ok) throw new Error(errorMessage(result.detail, 'Could not update role'))
      setAccounts(current => current.map(account => account.email === email ? result : account))
      setStatus({ type: 'success', message: `${result.name}'s role is now ${result.role.toLowerCase()}.` })
    } catch (err) { setStatus({ type: 'error', message: err.message }) }
  }

  const deleteUser = async (email, name) => {
    if (!window.confirm(`Delete ${name}'s account? This cannot be undone.`)) return
    setStatus({ type: '', message: '' })
    try {
      const response = await fetch(`${API_BASE}/api/auth/accounts/${encodeURIComponent(email)}`, { method: 'DELETE', headers })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(errorMessage(result.detail, 'Could not delete account'))
      }
      setAccounts(current => current.filter(account => account.email !== email))
      setStatus({ type: 'success', message: `${name}'s account was deleted.` })
    } catch (err) { setStatus({ type: 'error', message: err.message }) }
  }

  return <div className="grid-2" style={{ alignItems: 'start' }}>
    <section className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}><div className="toast-icon" style={{ width: 36, height: 36 }}><Plus size={17} color="var(--blue-400)" /></div><div><h2 style={{ fontSize: 'var(--text-lg)' }}>Add company account</h2><p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 3 }}>Assign Planner, Analyst, or Viewer access.</p></div></div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 22 }}>
        <label className="input-group"><span className="input-label">Full name</span><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength="2" placeholder="e.g. Priya Shah" /></label>
        <label className="input-group"><span className="input-label">Company email</span><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="priya@company.com" /></label>
        <label className="input-group"><span className="input-label">Role</span><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="VIEWER">Viewer — read-only</option><option value="ANALYST">Analyst — run scenarios</option><option value="PLANNER">Planner — approve orders</option></select></label>
        <label className="input-group"><span className="input-label">Temporary password</span><input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength="8" placeholder="8+ chars with upper-case, lower-case, and number" /></label>
        {status.message && <p className={status.type === 'error' ? 'login-error' : 'badge badge-success'} style={{ textTransform: 'none', letterSpacing: 0 }}>{status.message}</p>}
        <button className="btn btn-primary" type="submit"><Plus size={15} /> Create account</button>
      </form>
    </section>
    <section className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><div><h2 style={{ fontSize: 'var(--text-lg)' }}>Company accounts</h2><p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 3 }}>Roles and dashboard access</p></div><Users size={20} color="var(--blue-400)" /></div>
      {loading ? <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading accounts…</p> : <div style={{ display: 'grid', gap: 9 }}>{accounts.map(account => {
        const builtIn = ['admin@stockpilot.ai', 'planner@stockpilot.ai'].includes(account.email)
        return <div key={account.email} className="surface-sm" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><Eye size={15} color={account.role === 'VIEWER' ? 'var(--text-muted)' : 'var(--blue-400)'} /><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: 'var(--text-sm)' }}>{account.name}</strong><span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{account.email}</span></div>{builtIn ? <span className={`badge ${account.role === 'ADMIN' ? 'badge-danger' : 'badge-blue'}`}>{account.role}</span> : <><select className="input" aria-label={`Role for ${account.name}`} value={account.role} onChange={e => changeRole(account.email, e.target.value)} style={{ width: 112, padding: '6px 8px', fontSize: 'var(--text-xs)' }}><option value="VIEWER">Viewer</option><option value="ANALYST">Analyst</option><option value="PLANNER">Planner</option></select><button className="btn btn-danger btn-sm" title={`Delete ${account.name}`} onClick={() => deleteUser(account.email, account.name)}><Trash2 size={13} /></button></>}</div>
      })}</div>}
    </section>
  </div>
}
