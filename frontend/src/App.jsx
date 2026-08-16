import { useState } from 'react'
import KPIGrid from './components/KPIGrid'
import RiskHeatmap from './components/RiskHeatmap'
import SKUDetail from './components/SKUDetail'
import ApprovalQueue from './components/ApprovalQueue'
import WhatIfSimulator from './components/WhatIfSimulator'
import AuditTrace from './components/AuditTrace'
import {
  LayoutDashboard,
  PackageSearch,
  CheckSquare,
  SlidersHorizontal,
  ScrollText,
  RefreshCw,
  Bell,
  ChevronRight,
} from 'lucide-react'
import './App.css'

const navItems = [
  { id: 'overview',        label: 'Command Center',   icon: LayoutDashboard,     desc: 'KPIs & Risk Overview'  },
  { id: 'sku_detail',      label: 'SKU Detail',        icon: PackageSearch,       desc: 'Forecast Fan Charts'   },
  { id: 'recommendations', label: 'Approval Queue',    icon: CheckSquare,         desc: 'Pending PO Approvals'  },
  { id: 'whatif',          label: 'What-If Simulator', icon: SlidersHorizontal,   desc: 'Scenario Analysis'     },
  { id: 'audit',           label: 'Audit & Trace',     icon: ScrollText,          desc: 'Agent Event Log'       },
]

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const active = navItems.find(n => n.id === activeTab)

  return (
    <div className="app-container">

      {/* ─── SIDEBAR ─────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="brand">
          <div className="brand-logo">SP</div>
          <div className="brand-text">
            <span className="brand-name">StockPilot</span>
            <span className="brand-sub">Control Tower</span>
          </div>
        </div>

        {/* Nav */}
        <span className="nav-section-label">Navigation</span>
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon"><Icon size={16} /></span>
              {item.label}
            </button>
          )
        })}

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="live-indicator">
            <span className="status-dot live" />
            <span>Live — API connected</span>
          </div>
          <div className="user-card">
            <div className="avatar">P</div>
            <div className="user-info">
              <span className="user-name">Planner</span>
              <span className="user-role">Supply Chain Lead</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── MAIN ─────────────────────────────────── */}
      <main className="main-content">

        {/* Top Bar */}
        <header className="top-bar">
          <div className="page-title">
            <h1>{active?.label}</h1>
            <p>{active?.desc}</p>
          </div>
          <div className="top-bar-actions">
            <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={14} />
              Alerts
              <span style={{
                background: 'var(--danger)',
                color: 'white',
                borderRadius: '999px',
                fontSize: '0.6rem',
                padding: '1px 5px',
                fontWeight: 700,
              }}>3</span>
            </button>
            <button className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} />
              Sync
            </button>
          </div>
        </header>

        {/* Page Body */}
        <div className="page-body" key={activeTab}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <KPIGrid />
              <RiskHeatmap />
            </div>
          )}
          {activeTab === 'sku_detail'      && <SKUDetail />}
          {activeTab === 'recommendations' && <ApprovalQueue />}
          {activeTab === 'whatif'          && <WhatIfSimulator />}
          {activeTab === 'audit'           && <AuditTrace />}
        </div>
      </main>
    </div>
  )
}

export default App
