import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { API_BASE } from '../config'
import {
  UserPlus, Trash2, Shield, ShieldCheck, ShieldAlert,
  BarChart3, Eye, AlertCircle, RefreshCw, Search
} from 'lucide-react'

const ROLE_META = {
  admin:   { icon: ShieldAlert, color: '#ff5b2b', label: 'Admin' },
  planner: { icon: ShieldCheck, color: '#ff7a30', label: 'Planner' },
  analyst: { icon: BarChart3,   color: '#6c8aff', label: 'Analyst' },
  viewer:  { icon: Eye,         color: '#7c8da6', label: 'Viewer' },
}

export default function UserManagement() {
  const { token } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // New user form
  const [showForm, setShowForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [newPassword, setNewPassword] = useState('demo123')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const fetchUsers = () => {
    setLoading(true)
    fetch(`${API_BASE}/api/auth/users`, { headers })
      .then(r => { if (!r.ok) throw new Error('Failed to fetch users'); return r.json() })
      .then(data => { setUsers(data.users || []); setError('') })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: newEmail, role: newRole, password: newPassword }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to create user')
      }
      setShowForm(false)
      setNewEmail('')
      setNewRole('viewer')
      setNewPassword('demo123')
      fetchUsers()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (userId, email) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to delete user')
      }
      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="user-mgmt">
      {/* Toolbar */}
      <div className="user-mgmt-toolbar">
        <div className="user-mgmt-search">
          <Search size={14} />
          <input
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="user-mgmt-actions">
          <button className="btn btn-ghost btn-sm" onClick={fetchUsers}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            <UserPlus size={14} /> Add User
          </button>
        </div>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="glass-panel user-mgmt-form animate-fade-up">
          <h3>Create New User</h3>
          <form onSubmit={handleCreate}>
            <div className="user-mgmt-form-row">
              <div className="login-field">
                <label>Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@company.com"
                  required
                  className="user-mgmt-input"
                />
              </div>
              <div className="login-field">
                <label>Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="user-mgmt-input"
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="planner">Planner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="login-field">
                <label>Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Initial password"
                  required
                  className="user-mgmt-input"
                />
              </div>
            </div>
            {formError && (
              <div className="login-error" style={{ marginBottom: 12 }}>
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={formLoading}>
                {formLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="login-error" style={{ margin: '12px 0' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel user-mgmt-table-wrap">
        <table className="user-mgmt-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Created</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="user-mgmt-empty">Loading users...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="user-mgmt-empty">No users found</td></tr>
            ) : filtered.map(u => {
              const meta = ROLE_META[u.role] || ROLE_META.viewer
              const Icon = meta.icon
              return (
                <tr key={u.user_id}>
                  <td>
                    <div className="user-mgmt-email">
                      <div className="user-mgmt-avatar" style={{ background: meta.color + '22', color: meta.color }}>
                        {u.email[0].toUpperCase()}
                      </div>
                      <span>{u.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`login-role-badge role-${u.role}`} style={{ fontSize: 11 }}>
                      <Icon size={12} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="user-mgmt-date">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm user-mgmt-delete"
                      onClick={() => handleDelete(u.user_id, u.email)}
                      title="Delete user"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Role Legend */}
      <div className="glass-panel user-mgmt-legend">
        <h4><Shield size={14} /> Permission Matrix</h4>
        <div className="user-mgmt-legend-grid">
          {Object.entries(ROLE_META).map(([role, meta]) => {
            const Icon = meta.icon
            return (
              <div key={role} className="user-mgmt-legend-item">
                <span className={`login-role-badge role-${role}`}>
                  <Icon size={12} />
                  {meta.label}
                </span>
                <ul>
                  {role === 'admin' && <li>Full access to all features</li>}
                  {role === 'admin' && <li>User management</li>}
                  {role === 'planner' && <li>All operational tabs</li>}
                  {role === 'planner' && <li>Approve/reject POs</li>}
                  {role === 'analyst' && <li>View forecasts & simulations</li>}
                  {role === 'analyst' && <li>What-If analysis</li>}
                  {role === 'viewer' && <li>Command Center overview</li>}
                  {role === 'viewer' && <li>Simulation results only</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
