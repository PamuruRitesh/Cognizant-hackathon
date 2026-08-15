import { useState, useEffect } from 'react';

const RiskHeatmap = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/risk')
      .then(res => res.json())
      .then(json => {
        setData(json.grid || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="glass-panel" style={{ padding: '24px', flex: 1 }}>Loading Risk Heatmap...</div>;
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
