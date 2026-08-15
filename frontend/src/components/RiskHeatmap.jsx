import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';

const RiskHeatmap = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRisk = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/api/risk')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(json => {
        setData(json.grid || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  if (loading) {
    return <SkeletonLoader type="table" count={5} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchRisk} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title="No Risk Data" message="There are currently no items at risk." icon="✅" />;
  }

  const columns = ['Store ID', 'Product ID', 'Risk Score', 'Days to Stockout'];
  
  const getRiskBadge = (score) => {
    if (score > 0.1) return <div className="risk-badge badge-high">High ({score})</div>;
    if (score > 0.05) return <div className="risk-badge badge-med">Med ({score})</div>;
    return <div className="risk-badge badge-low">Low ({score})</div>;
  };

  const getDaysBadge = (days) => {
    if (days <= 3) return <div className="risk-badge badge-high">{days} Days</div>;
    if (days <= 7) return <div className="risk-badge badge-med">{days} Days</div>;
    return <div className="risk-badge badge-low">{days} Days</div>;
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', flex: 1, overflowX: 'auto' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '20px', letterSpacing: '1px' }}>RISK HEATMAP (LIVE API)</h3>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} style={{ paddingBottom: '16px', color: 'var(--text-muted)', fontWeight: '500', fontSize: '0.85rem' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map((row, idx) => (
            <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
              <td style={{ padding: '8px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{row.store_id}</td>
              <td style={{ padding: '8px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{row.product_id}</td>
              <td style={{ padding: '6px 4px' }}>{getRiskBadge(row.risk_score)}</td>
              <td style={{ padding: '6px 4px' }}>{getDaysBadge(row.days_to_stockout)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RiskHeatmap;
