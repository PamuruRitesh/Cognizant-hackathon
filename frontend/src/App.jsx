import { useState } from 'react'
import KPIGrid from './components/KPIGrid'
import RiskHeatmap from './components/RiskHeatmap'
import SKUDetail from './components/SKUDetail'
import ApprovalQueue from './components/ApprovalQueue'
import WhatIfSimulator from './components/WhatIfSimulator'
import AuditTrace from './components/AuditTrace'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const navItems = [
    { id: 'overview', label: 'Command Center', icon: '📊' },
    { id: 'sku_detail', label: 'SKU Detail', icon: '📦' },
    { id: 'recommendations', label: 'Approval Queue', icon: '📋' },
    { id: 'whatif', label: 'What-If Simulator', icon: '🎛️' },
    { id: 'chat', label: 'Audit & Trace', icon: '✨' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">SP</div>
          <h2>StockPilot</h2>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="user-profile">
          <div className="avatar">P</div>
          <div className="user-info">
            <p>Planner</p>
            <span>Control Tower</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-header">
            <h1>
              {navItems.find(item => item.id === activeTab)?.label}
            </h1>
            <p className="subtitle">Real-time autonomous demand insights</p>
          </div>
          
          <div className="actions">
            <div className="glass-button">
              <span>🔄</span> Sync Data
            </div>
          </div>
        </header>

        {/* Dynamic Content Rendering */}
        <div className="page-container" key={activeTab}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <KPIGrid />
              <div style={{ display: 'flex', gap: '20px' }}>
                <RiskHeatmap />
              </div>
            </div>
          )}
          {activeTab === 'sku_detail' && <SKUDetail />}
          {activeTab === 'recommendations' && <ApprovalQueue />}
          {activeTab === 'whatif' && <WhatIfSimulator />}
          {activeTab === 'chat' && <AuditTrace />}
        </div>
      </main>
    </div>
  )
}

export default App
