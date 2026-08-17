import { useState, useEffect, useRef } from 'react'
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
  AlertTriangle,
  Boxes,
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
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [kpiData, setKpiData] = useState(null)
  const [globalToast, setGlobalToast] = useState(null)
  const [alertsList, setAlertsList] = useState([])
  const alertsRef = useRef(null)

  const active = navItems.find(n => n.id === activeTab)

  useEffect(() => {
    fetch('http://localhost:8000/api/kpis')
      .then(res => res.json())
      .then(json => setKpiData(json))
      .catch(console.error);
      
    Promise.all([
      fetch('http://localhost:8000/api/risk?limit=20').then(r => r.json()),
      fetch('http://localhost:8000/api/recommendations?status=pending&limit=5').then(r => r.json())
    ]).then(([riskRes, recRes]) => {
      const newAlerts = [];
      const criticalRisks = (riskRes.grid || []).filter(r => r.risk_score > 0.1).slice(0, 3);
      criticalRisks.forEach(r => {
        newAlerts.push({
          id: `risk-${r.store_id}-${r.product_id}`,
          type: 'risk',
          title: `Critical Stockout: ${r.store_id}`,
          message: `SKU ${r.product_id} risks stockout in ${r.days_to_stockout} days.`,
          icon: AlertTriangle,
          color: 'var(--danger)',
          bg: 'var(--danger-muted)',
          border: 'rgba(244,63,94,0.2)',
          action: () => {
             setSelectedStore(r.store_id);
             setSelectedProduct(r.product_id);
             setActiveTab('sku_detail');
             setIsAlertsOpen(false);
          }
        });
      });

      const pendingRecs = (recRes.items || []).slice(0, 3);
      pendingRecs.forEach(r => {
        newAlerts.push({
          id: `rec-${r.rec_id}`,
          type: 'approval',
          title: 'Approval Required',
          message: `PO for ${r.recommended_qty} units at ${r.store_id}.`,
          icon: Boxes,
          color: 'var(--blue-400)',
          bg: 'rgba(59,130,246,0.12)',
          border: 'rgba(59,130,246,0.2)',
          action: () => {
            setActiveTab('recommendations');
            setIsAlertsOpen(false);
          }
        });
      });
      setAlertsList(newAlerts);
    }).catch(console.error);

    const handleClickOutside = (event) => {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalAlerts = (kpiData?.stockout_risk_skus || 0) + (kpiData?.pending_approvals || 0);

  useEffect(() => {
    if (totalAlerts > 0) {
      const timer = setTimeout(() => {
        setGlobalToast({
          title: 'Action Required',
          message: `You have ${totalAlerts} pending tasks demanding your attention.`,
          type: 'warning'
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [totalAlerts]);

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
            <div style={{ position: 'relative' }} ref={alertsRef}>
              <button 
                className={`btn btn-ghost btn-sm ${isAlertsOpen ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: isAlertsOpen ? 'var(--bg-surface-2)' : '' }}
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              >
                <Bell size={14} />
                Alerts
                {totalAlerts > 0 && (
                  <span style={{
                    background: 'var(--danger)',
                    color: 'white',
                    borderRadius: '999px',
                    fontSize: '0.6rem',
                    padding: '1px 5px',
                    fontWeight: 700,
                  }}>{totalAlerts}</span>
                )}
              </button>

              {/* Alerts Dropdown */}
              {isAlertsOpen && (
                <div className="glass-panel animate-fade-up" style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 12,
                  width: 320,
                  zIndex: 100,
                  padding: '0',
                  boxShadow: 'var(--shadow-lg), 0 0 40px rgba(59,130,246,0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5,12,26,0.6)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Notifications</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--blue-400)', cursor: 'pointer', fontWeight: 600 }}>Mark all read</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {alertsList.length > 0 ? alertsList.map(alert => {
                      const Icon = alert.icon;
                      return (
                        <div key={alert.id} className="alert-item" style={{ padding: '14px 16px', display: 'flex', gap: 12, cursor: 'pointer', borderBottom: '1px solid rgba(96,165,250,0.05)' }} onClick={alert.action}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: alert.bg, border: `1px solid ${alert.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Icon size={16} color={alert.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{alert.title}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>{alert.message}</div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ padding: '30px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Bell size={20} color="var(--text-muted)" />
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>You're all caught up!</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No new alerts to display.</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div 
                    className="alert-item"
                    style={{ padding: '10px 16px', background: 'rgba(5,12,26,0.4)', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
                    onClick={() => { setActiveTab('audit'); setIsAlertsOpen(false); }}
                  >
                    View all activity
                  </div>
                </div>
              )}
            </div>
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
              <RiskHeatmap onViewSKU={(store, product) => {
                setSelectedStore(store);
                setSelectedProduct(product);
                setActiveTab('sku_detail');
              }} />
            </div>
          )}
          {activeTab === 'sku_detail'      && <SKUDetail key={`${selectedStore}-${selectedProduct}`} initialStore={selectedStore} initialProduct={selectedProduct} />}
          {activeTab === 'recommendations' && <ApprovalQueue />}
          {activeTab === 'whatif'          && <WhatIfSimulator />}
          {activeTab === 'audit'           && <AuditTrace />}
        </div>
      </main>

      {/* Global Toast Notification */}
      {globalToast && (
        <div className="glass-panel animate-fade-up" style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          borderLeft: '4px solid var(--warning)',
          background: 'rgba(5, 12, 26, 0.85)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(245, 158, 11, 0.15)',
          maxWidth: 360,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'var(--warning-muted)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AlertTriangle size={16} color="var(--warning)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 4 }}>
              {globalToast.title}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {globalToast.message}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '0.7rem' }} onClick={() => { setIsAlertsOpen(true); setGlobalToast(null); }}>
                View Alerts
              </button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 12px', fontSize: '0.7rem' }} onClick={() => setGlobalToast(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
