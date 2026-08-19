import React, { useState, useEffect } from 'react'
import { API_BASE } from '../config'
import { 
  Users, 
  Search, 
  Package, 
  ChevronRight, 
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'

export default function VendorHub() {
  const [parts, setParts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPart, setSelectedPart] = useState(null)
  
  const [vendors, setVendors] = useState([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [logs, setLogs] = useState({ purchase_orders: [], quality_incidents: [] })
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Fetch Parts on Mount
  useEffect(() => {
    fetch(`${API_BASE}/api/aerospace/parts`)
      .then(res => res.json())
      .then(data => {
        setParts(data)
      })
      .catch(console.error)
  }, [])

  // Fetch Vendors when a part is selected
  useEffect(() => {
    if (selectedPart) {
      setLoadingVendors(true)
      setSelectedVendor(null)
      fetch(`${API_BASE}/api/aerospace/parts/${selectedPart.part_id}/vendors`)
        .then(res => res.json())
        .then(data => {
          setVendors(data)
          setLoadingVendors(false)
        })
        .catch(err => {
          console.error(err)
          setLoadingVendors(false)
        })
    }
  }, [selectedPart])

  // Fetch Logs when a vendor is selected
  useEffect(() => {
    if (selectedPart && selectedVendor) {
      setLoadingLogs(true)
      fetch(`${API_BASE}/api/aerospace/parts/${selectedPart.part_id}/vendors/${selectedVendor.supplier_id}/logs`)
        .then(res => res.json())
        .then(data => {
          setLogs(data)
          setLoadingLogs(false)
        })
        .catch(err => {
          console.error(err)
          setLoadingLogs(false)
        })
    }
  }, [selectedVendor])

  const filteredParts = parts.filter(p => 
    p.part_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.part_family?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 50) // Limit to 50 for performance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      
      {/* 1. PRODUCT SELECTION */}
      <div className="surface" style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={20} className="text-accent" /> 1. Select Product / Part
        </h2>
        
        <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
          <input 
            className="input-field" 
            style={{ paddingLeft: 38 }}
            placeholder="Search by Part ID or Family..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {parts.length === 0 ? (
          <div className="skeleton" style={{ height: 150, width: '100%' }}></div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-0)' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-2)', zIndex: 1 }}>
                <tr>
                  <th>Part ID</th>
                  <th>Family</th>
                  <th>Criticality</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.map(part => (
                  <tr 
                    key={part.part_id} 
                    style={{ 
                      cursor: 'pointer', 
                      background: selectedPart?.part_id === part.part_id ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                    }}
                    onClick={() => setSelectedPart(part)}
                  >
                    <td className="font-mono">{part.part_id}</td>
                    <td>{part.part_family}</td>
                    <td>
                      <span className={`badge ${part.criticality_class === 'High' ? 'badge-danger' : part.criticality_class === 'Medium' ? 'badge-warning' : 'badge-success'}`}>
                        {part.criticality_class}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedPart(part); }}>
                        Select <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredParts.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No parts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. VENDOR COMPARISON */}
      {selectedPart && (
        <div className="surface animate-fade-up" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} className="text-accent" /> 2. Vendor Comparison <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>for {selectedPart.part_id}</span>
            </h2>
          </div>

          {loadingVendors ? (
            <div className="skeleton" style={{ height: 200, width: '100%' }}></div>
          ) : vendors.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface-0)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
              <p>No vendor data available for this part.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table" style={{ minWidth: 800 }}>
                <thead style={{ background: 'var(--bg-surface-2)' }}>
                  <tr>
                    <th>Metric</th>
                    {vendors.map(v => (
                      <th key={v.supplier_id} style={{ textAlign: 'center', color: 'var(--text-primary)', fontSize: '1rem' }}>
                        {v.supplier_id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>Orders Fulfilled</td>
                    {vendors.map(v => <td key={v.supplier_id} style={{ textAlign: 'center', fontWeight: 500 }}>{v.orders}</td>)}
                  </tr>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>Total Quantity</td>
                    {vendors.map(v => <td key={v.supplier_id} style={{ textAlign: 'center' }}>{v.total_quantity?.toLocaleString()}</td>)}
                  </tr>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>Unit Cost</td>
                    {vendors.map(v => <td key={v.supplier_id} style={{ textAlign: 'center' }}>${v.unit_cost?.toFixed(2) || '0.00'}</td>)}
                  </tr>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>Avg Lead Time</td>
                    {vendors.map(v => {
                      let leadStr = v.avg_lead_time;
                      if (typeof leadStr === 'number') leadStr = leadStr.toFixed(1) + ' days';
                      return <td key={v.supplier_id} style={{ textAlign: 'center' }}>{leadStr || 'N/A'}</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>On-Time Delivery</td>
                    {vendors.map(v => {
                      const pct = v.on_time_delivery_pct || 0;
                      return (
                        <td key={v.supplier_id} style={{ textAlign: 'center' }}>
                          <span style={{ color: pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)', fontWeight: 600 }}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>Defect / Scrap Rate</td>
                    {vendors.map(v => {
                      const pct = v.defect_rate_pct || 0;
                      return (
                        <td key={v.supplier_id} style={{ textAlign: 'center' }}>
                          <span style={{ color: pct <= 1 ? 'var(--success)' : pct <= 3 ? 'var(--warning)' : 'var(--danger)' }}>
                            {pct.toFixed(2)}%
                          </span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.incidents} incidents</div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="label-caps" style={{ color: 'var(--text-secondary)' }}>Supplier Risk</td>
                    {vendors.map(v => (
                      <td key={v.supplier_id} style={{ textAlign: 'center' }}>
                        <span className={`badge ${v.supplier_risk_class === 'High' ? 'badge-danger' : v.supplier_risk_class === 'Medium' ? 'badge-warning' : 'badge-success'}`}>
                          {v.supplier_risk_class || 'Unknown'}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: 'var(--bg-surface-0)' }}>
                    <td></td>
                    {vendors.map(v => (
                      <td key={v.supplier_id} style={{ textAlign: 'center', padding: '16px 12px' }}>
                        <button 
                          className={`btn ${selectedVendor?.supplier_id === v.supplier_id ? 'btn-primary' : 'btn-ghost'}`} 
                          onClick={() => setSelectedVendor(v)}
                        >
                          <History size={14} /> View Logs
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. VENDOR LOGS */}
      {selectedPart && selectedVendor && (
        <div className="surface animate-fade-up" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={20} className="text-accent" /> 3. Historical Logs <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>{selectedVendor.supplier_id} • {selectedPart.part_id}</span>
          </h2>

          {loadingLogs ? (
            <div className="skeleton" style={{ height: 300, width: '100%' }}></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              
              {/* Purchase Orders */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-0)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', fontWeight: 600 }}>
                  Purchase Orders
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-2)' }}>
                      <tr>
                        <th>Date</th>
                        <th>PO #</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th>Delivery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.purchase_orders?.map((po, i) => {
                        const isLate = po.receipt_date > po.promised_date;
                        return (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{po.order_date}</td>
                            <td className="font-mono text-xs">{po.po_id}</td>
                            <td style={{ textAlign: 'right' }}>{po.ordered_qty}</td>
                            <td style={{ textAlign: 'right' }}>${po.unit_cost?.toFixed(2)}</td>
                            <td>
                              {isLate ? (
                                <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                                  <Clock size={12} /> Late
                                </span>
                              ) : (
                                <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                                  <CheckCircle2 size={12} /> On Time
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {(!logs.purchase_orders || logs.purchase_orders.length === 0) && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No POs found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quality Incidents */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-0)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-2)', fontWeight: 600 }}>
                  Quality Incidents
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-2)' }}>
                      <tr>
                        <th>Date</th>
                        <th>Incident</th>
                        <th>Severity</th>
                        <th style={{ textAlign: 'right' }}>Scrap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.quality_incidents?.map((qi, i) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{qi.incident_date}</td>
                          <td>
                            <div className="font-mono text-xs">{qi.incident_id}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{qi.defect_type}</div>
                          </td>
                          <td>
                            <span className={`badge ${qi.defect_severity === 'Major' ? 'badge-danger' : 'badge-warning'}`}>
                              {qi.defect_severity}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{qi.scrap_qty}</td>
                        </tr>
                      ))}
                      {(!logs.quality_incidents || logs.quality_incidents.length === 0) && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                          <CheckCircle2 size={24} style={{ color: 'var(--success)', margin: '0 auto 8px', opacity: 0.5 }} />
                          No quality incidents recorded.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  )
}
