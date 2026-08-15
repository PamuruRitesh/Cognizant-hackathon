import { useState } from 'react'
import KPIGrid from './components/KPIGrid'
import RiskHeatmap from './components/RiskHeatmap'
import './App.css'

// Temporary placeholders for components
const Placeholder = ({ title }) => (
  <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginTop: '20px' }}>
    <h3 style={{ color: 'var(--text-muted)' }}>{title} Component Area</h3>
    <p style={{ marginTop: '10px' }}>This component will connect to the API shortly.</p>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const navItems = [
    { id: 'overview', label: 'Overview KPIs', icon: '📊' },
    { id: 'heatmap', label: 'Risk Heatmap', icon: '🔥' },
    { id: 'recommendations', label: 'Recommendations', icon: '📋' },
    { id: 'whatif', label: 'What-If Simulator', icon: '🎛️' },
    { id: 'chat', label: 'AI Insights', icon: '✨' },
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
          {activeTab === 'heatmap' && <RiskHeatmap />}
          {activeTab === 'recommendations' && <Placeholder title="Recommendations" />}
          {activeTab === 'whatif' && <Placeholder title="What-If Simulator" />}
          {activeTab === 'chat' && <Placeholder title="AI Chat" />}
        </div>
      </main>
    </div>
  )
}

export default App
