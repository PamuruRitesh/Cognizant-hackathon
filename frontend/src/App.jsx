import { useState, useEffect, useRef } from 'react'
import { API_BASE, shortenId } from './config'
import KPIGrid from './components/KPIGrid'
import RiskHeatmap from './components/RiskHeatmap'
import SKUDetail from './components/SKUDetail'
import ApprovalQueue from './components/ApprovalQueue'
import WhatIfSimulator from './components/WhatIfSimulator'
import SavingsDashboard from './components/SavingsDashboard'
import AuditTrace from './components/AuditTrace'
import SplashScreen from './components/SplashScreen'
import LocationsGraph from './components/LocationsGraph'
import VendorHub from './components/VendorHub'
import {
  LayoutDashboard,
  PackageSearch,
  CheckSquare,
  SlidersHorizontal,
  ScrollText,
  RefreshCw,
  Bell,
  AlertTriangle,
  Boxes,
  TrendingUp,
  Search,
  User,
  Settings,
  Upload,
  CalendarDays,
  Moon,
  Users
} from 'lucide-react'
import './App.css'

const navItems = [
  { id: 'overview', label: 'Command Center', icon: LayoutDashboard, desc: 'KPIs & Risk Overview' },
  { id: 'sku_detail', label: 'SKU Detail', icon: PackageSearch, desc: 'Forecast Fan Charts' },
  { id: 'vendors', label: 'Vendor Hub', icon: Users, desc: 'Vendor Comparison & Logs' },
  { id: 'recommendations', label: 'Approval Queue', icon: CheckSquare, desc: 'Pending PO Approvals' },
  { id: 'whatif', label: 'What-If Simulator', icon: SlidersHorizontal, desc: 'Scenario Analysis' },
  { id: 'savings', label: 'Simulation Results', icon: TrendingUp, desc: 'Value & Savings' },
  { id: 'audit', label: 'Audit & Trace', icon: ScrollText, desc: 'Agent Event Log' },
]

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLaunching, setIsLaunching] = useState(true)
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [kpiData, setKpiData] = useState(null)
  const [globalToast, setGlobalToast] = useState(null)
  const [alertsList, setAlertsList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [riskCounts, setRiskCounts] = useState({ all: 0, high: 0, med: 0, low: 0 })
  const [selectedDate, setSelectedDate] = useState('')
  const [latestDate, setLatestDate] = useState('')
  const [availableDates, setAvailableDates] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [showFilters, setShowFilters] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [isWarmTheme, setIsWarmTheme] = useState(true)
  const alertsRef = useRef(null)

  const active = navItems.find(n => n.id === activeTab)

  const loadHeaderData = () => {
    fetch(`${API_BASE}/api/kpis`)
      .then(res => res.json())
      .then(json => setKpiData(json))
      .catch(console.error)

    Promise.all([
      fetch(`${API_BASE}/api/risk?limit=100${selectedDate && selectedDate !== 'all' ? `&date=${selectedDate}` : ''}`).then(r => r.json()),
      fetch(`${API_BASE}/api/recommendations?status=all&limit=100`).then(r => r.json())
    ]).then(([riskRes, recRes]) => {
      const newAlerts = []
      const riskRows = riskRes.grid || []
      const nextCounts = riskRows.reduce((counts, row) => {
        const score = Number(row.risk_score || 0)
        // Updated thresholds to make medium/low visible for the mock data distribution
        const level = score > 0.9 ? 'high' : score > 0.45 ? 'med' : 'low'
        counts.all += 1
        counts[level] += 1
        return counts
      }, { all: 0, high: 0, med: 0, low: 0 })
      setRiskCounts(nextCounts)
      setRiskFilter(current => nextCounts[current] === 0 ? 'all' : current)

      const criticalRisks = riskRows.filter(r => r.risk_score > 0.1).slice(0, 3)
      criticalRisks.forEach(r => {
        newAlerts.push({
          id: `risk-${r.store_id}-${r.product_id}`,
          title: `Critical Stockout: ${r.store_id}`,
          message: `SKU ${shortenId(r.product_id)} risks stockout in ${r.days_to_stockout} days.`,
          icon: AlertTriangle,
          color: 'var(--danger)',
          bg: 'var(--danger-muted)',
          border: 'rgba(255, 91, 43, 0.24)',
          action: () => {
            setSelectedStore(r.store_id)
            setSelectedProduct(r.product_id)
            setActiveTab('sku_detail')
            setIsAlertsOpen(false)
          }
        })
      })

      const dates = [...new Set((recRes.items || []).map(item => item.date).filter(Boolean))].sort((a,b) => b.localeCompare(a)) // Sort descending
      const newest = dates[0] || ''
      setAvailableDates(dates)
      setLatestDate(newest)
      setSelectedDate(current => current || newest)

      const pendingRecs = (recRes.items || []).filter(item => item.status === 'pending').slice(0, 3)
      pendingRecs.forEach(r => {
        newAlerts.push({
          id: `rec-${r.rec_id}`,
          title: 'Approval Required',
          message: `PO for ${r.recommended_qty} units at ${r.store_id}.`,
          icon: Boxes,
          color: 'var(--accent)',
          bg: 'rgba(255, 122, 48, 0.12)',
          border: 'rgba(255, 122, 48, 0.24)',
          action: () => {
            setActiveTab('recommendations')
            setIsAlertsOpen(false)
          }
        })
      })
      setAlertsList(newAlerts)
    }).catch(err => {
      console.error(err);
      setAvailableDates(['Error fetching dates']);
    })
  }

  useEffect(() => {
    loadHeaderData()
    const handleClickOutside = (event) => {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setIsAlertsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedDate])

  useEffect(() => {
    document.body.classList.toggle('cool-theme', !isWarmTheme)
  }, [isWarmTheme])

  const handleSync = () => {
    setRefreshKey(key => key + 1)
    loadHeaderData()
    setGlobalToast({ title: 'Synced', message: 'Dashboard data refreshed from the API.' })
  }

  const handleExport = async () => {
    try {
      const [kpis, risk, recommendations] = await Promise.all([
        fetch(`${API_BASE}/api/kpis`).then(r => r.json()),
        fetch(`${API_BASE}/api/risk?limit=100${selectedDate ? `&date=${selectedDate}` : ''}`).then(r => r.json()),
        fetch(`${API_BASE}/api/recommendations?status=pending&limit=100`).then(r => r.json()),
      ])
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), kpis, risk, recommendations }, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stockpilot-dashboard-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setGlobalToast({ title: 'Export Ready', message: 'Current dashboard snapshot downloaded as JSON.' })
    } catch (err) {
      setGlobalToast({ title: 'Export Failed', message: err.message })
    }
  }

  const totalAlerts = (kpiData?.stockout_risk_skus || 0) + (kpiData?.pending_approvals || 0)

  useEffect(() => {
    if (totalAlerts > 0) {
      const timer = setTimeout(() => {
        setGlobalToast({
          title: 'Action Required',
          message: `You have ${totalAlerts} pending tasks demanding your attention.`,
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [totalAlerts])

  return (
    <>
      {isLaunching && <SplashScreen onComplete={() => setIsLaunching(false)} />}
      <div className="app-container">
        <main className="main-content">
          <header className="header-container">
            <div className="top-bar">
              <div className="brand">
                <img src="/logo.png" alt="StockPilot Logo" className="brand-mark" />
                <div className="brand-text">
                  <span className="brand-name">StockPilot</span>
                  <span className="brand-sub">Control Tower</span>
                </div>
              </div>
              
              <div className="top-bar-actions">
                <label className="search-box" aria-label="Search">
                  <Search size={14} />
                  <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search store or SKU" />
                </label>
                <button className="btn btn-ghost btn-sm theme-toggle" onClick={() => setIsWarmTheme(value => !value)}>
                  <Moon size={13} /> {isWarmTheme ? 'Warm' : 'Cool'}
                </button>
                <div className="alerts-wrap" ref={alertsRef}>
                  <button className={`btn btn-ghost btn-sm ${isAlertsOpen ? 'active' : ''}`} onClick={() => setIsAlertsOpen(!isAlertsOpen)}>
                    <Bell size={14} />
                    Alerts
                    {totalAlerts > 0 && <span className="alert-count">{totalAlerts}</span>}
                  </button>

                  {isAlertsOpen && (
                    <div className="glass-panel alerts-menu animate-fade-up">
                      <div className="alerts-menu-head">
                        <span>Notifications</span>
                        <button onClick={() => setAlertsList([])}>Mark all read</button>
                      </div>

                      <div className="alerts-list">
                        {alertsList.length > 0 ? alertsList.map(alert => {
                          const Icon = alert.icon
                          return (
                            <div key={alert.id} className="alert-item" onClick={alert.action}>
                              <div className="alert-icon" style={{ background: alert.bg, borderColor: alert.border }}>
                                <Icon size={16} color={alert.color} />
                              </div>
                              <div>
                                <div className="alert-title">{alert.title}</div>
                                <div className="alert-message">{alert.message}</div>
                              </div>
                            </div>
                          )
                        }) : (
                          <div className="empty-alerts">
                            <Bell size={20} color="var(--text-muted)" />
                            <div>
                              <div className="alert-title">You're all caught up</div>
                              <div className="alert-message">No new alerts to display.</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button className="alerts-footer" onClick={() => { setActiveTab('audit'); setIsAlertsOpen(false) }}>
                        View all activity
                      </button>
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleSync}><RefreshCw size={14} /> Sync</button>
                <button className="btn btn-ghost btn-sm" onClick={handleExport}><Upload size={13} /> Export</button>
                <button className="icon-button" title="Settings" onClick={() => setShowFilters(value => !value)}><Settings size={14} /></button>
                <div className="profile-wrap">
                  <button className="profile-button" title="User profile" onClick={() => setShowProfile(value => !value)}><User size={16} /></button>
                  {showProfile && (
                    <div className="glass-panel profile-menu animate-fade-up">
                      <strong>Planner</strong>
                      <span>Supply Chain Lead</span>
                      <small><span className="status-dot live" /> API connected</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="nav-bar">
              <nav className="top-nav" aria-label="Primary navigation">
                {navItems.map(item => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                      onClick={() => setActiveTab(item.id)}
                      title={item.label}
                    >
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </header>

          <div className="page-body" key={activeTab}>
            <div className="content-header">
              <div className="page-title">
                <h1>{active?.label}</h1>
                <p>{active?.desc}</p>
              </div>
              {showFilters && <div className="filter-strip">
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <CalendarDays size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                  <select
                    className={`filter-chip ${selectedDate === latestDate ? 'active' : ''}`}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ paddingLeft: 28, paddingRight: 24, cursor: 'pointer', outline: 'none', appearance: 'none', background: 'rgba(255, 255, 255, 0.025)' }}
                    title="Select Date"
                  >
                    <option value="all">All Dates</option>
                    {availableDates.length > 0 && availableDates[0] !== 'Error fetching dates' ? (
                      availableDates.map(date => (
                        <option key={date} value={date}>{date} {date === latestDate ? '(Latest)' : ''}</option>
                      ))
                    ) : availableDates[0] === 'Error fetching dates' ? (
                      <option value="">Error fetching dates</option>
                    ) : (
                      <option value="">Loading...</option>
                    )}
                  </select>
                  <div style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--text-secondary)' }}>▼</div>
                </div>
                {[
                  ['all', 'All Risk', riskCounts.all],
                  ['high', 'High', riskCounts.high],
                  ['med', 'Medium', riskCounts.med],
                  ['low', 'Low', riskCounts.low],
                ].map(([value, label, count]) => (
                  <button
                    key={value}
                    className={`filter-chip ${riskFilter === value ? 'active' : ''}`}
                    title={`${count} matching record${count === 1 ? '' : 's'}`}
                    onClick={() => setRiskFilter(value)}
                  >
                    {label} <span>{count}</span>
                  </button>
                ))}
              </div>}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <KPIGrid key={`kpi-${refreshKey}`} selectedDate={selectedDate} />
                <div className="overview-grid">
                  <RiskHeatmap
                    key={`risk-${refreshKey}`}
                    searchQuery={searchQuery}
                    riskFilter={riskFilter}
                    selectedDate={selectedDate}
                    onViewSKU={(store, product) => {
                      setSelectedStore(store)
                      setSelectedProduct(product)
                      setActiveTab('sku_detail')
                    }}
                  />
                  <LocationsGraph
                    refreshKey={refreshKey}
                    searchQuery={searchQuery}
                    riskFilter={riskFilter}
                    selectedDate={selectedDate}
                    onViewSKU={(store, product) => {
                      setSelectedStore(store)
                      setSelectedProduct(product)
                      setActiveTab('sku_detail')
                    }}
                  />
                </div>
              </div>
            )}
            {activeTab === 'sku_detail' && <SKUDetail key={`${selectedStore}-${selectedProduct}`} initialStore={selectedStore} initialProduct={selectedProduct} />}
            {activeTab === 'vendors' && <VendorHub />}
            {activeTab === 'recommendations' && <ApprovalQueue />}
            {activeTab === 'whatif' && <WhatIfSimulator />}
            {activeTab === 'savings' && <SavingsDashboard selectedDate={selectedDate} />}
            {activeTab === 'audit' && <AuditTrace />}
          </div>
        </main>

        {globalToast && (
          <div className="glass-panel global-toast animate-fade-up">
            <div className="toast-icon">
              <AlertTriangle size={16} color="var(--warning)" />
            </div>
            <div>
              <div className="toast-title">{globalToast.title}</div>
              <div className="toast-message">{globalToast.message}</div>
              <div className="toast-actions">
                <button className="btn btn-primary btn-sm" onClick={() => { setIsAlertsOpen(true); setGlobalToast(null) }}>View Alerts</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setGlobalToast(null)}>Dismiss</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default App
