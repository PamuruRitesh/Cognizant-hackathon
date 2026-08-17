import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';
import { AlertTriangle, CheckCircle, Clock, ArrowUpRight } from 'lucide-react';

const getRisk = (score) => {
  if (score > 0.1) return { label: 'HIGH', cls: 'badge-high', bar: 'var(--danger)', width: `${Math.min(score * 500, 100)}%` };
  if (score > 0.05) return { label: 'MED', cls: 'badge-med', bar: 'var(--warning)', width: `${Math.min(score * 800, 100)}%` };
  return { label: 'LOW', cls: 'badge-low', bar: 'var(--success)', width: `${Math.min(score * 1200, 100)}%` };
};

const getDaysColor = (days) => {
  if (days <= 3) return { cls: 'badge-high', color: 'var(--danger)' };
  if (days <= 7) return { cls: 'badge-med', color: 'var(--warning)' };
  return { cls: 'badge-low', color: 'var(--success)' };
};

const RiskHeatmap = ({ onViewSKU }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 6;

  const fetchRisk = () => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:8000/api/risk?page=${currentPage}&limit=${itemsPerPage}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => {
        setData(json.grid || []);
        setTotalItems(json.total || 0);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchRisk(); }, [currentPage]);

  if (loading) return <SkeletonLoader type="table" count={6} />;
  if (error)   return <ErrorState message={error} onRetry={fetchRisk} />;
  if (!data?.length) return <EmptyState title="All Clear" message="No SKUs at risk right now." icon={<CheckCircle size={32} color="var(--success)" />} />;

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'var(--danger-muted)',
            border: '1px solid rgba(244,63,94,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={14} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Risk Heatmap</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Live stockout risk by SKU</div>
          </div>
        </div>
        <span className="risk-badge badge-high" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="status-dot danger" style={{ width: 6, height: 6 }} />
          {data.filter(r => r.risk_score > 0.1).length} Critical
        </span>
      </div>

      {/* Pagination Controls */}
      {Math.ceil(totalItems / itemsPerPage) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '4px 10px' }}
            >
              Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontWeight: 600 }}>
              {currentPage} / {Math.ceil(totalItems / itemsPerPage)}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalItems / itemsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(totalItems / itemsPerPage)}
              style={{ padding: '4px 10px' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Store ID</th>
              <th>Product ID</th>
              <th>Risk Score</th>
              <th style={{ minWidth: 120 }}>Risk Level</th>
              <th>Days to Stockout</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const risk = getRisk(row.risk_score);
              const days = getDaysColor(row.days_to_stockout);
              return (
                <tr key={idx} className="animate-fade-up" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {row.store_id}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {row.product_id}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: risk.width, height: '100%', background: risk.bar, borderRadius: 2, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: risk.bar, minWidth: 30, textAlign: 'right' }}>
                        {row.risk_score?.toFixed(3)}
                      </span>
                    </div>
                  </td>
                  <td><span className={`risk-badge ${risk.cls}`}>{risk.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} color={days.color} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: days.color }}>{row.days_to_stockout}d</span>
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                      onClick={() => onViewSKU && onViewSKU(row.store_id, row.product_id)}
                    >
                      <ArrowUpRight size={12} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RiskHeatmap;
