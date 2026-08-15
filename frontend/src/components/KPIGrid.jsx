import { useState, useEffect } from 'react';

const KPIGrid = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/kpis')
      .then(res => res.json())
      .then(json => {
        // Map actual API response to our UI cards
        setData([
          { 
            label: 'VALUE AT RISK', subtitle: 'Potential Revenue Loss', 
            value: `$${(json.value_at_risk / 1000).toFixed(1)}k`, 
            trend: 'Needs Action', color: 'var(--danger)' 
          },
          { 
            label: 'STOCKOUT RISK', subtitle: 'SKUs under safety stock', 
            value: json.stockout_risk_skus, 
            trend: 'Critical', color: 'var(--warning)' 
          },
          { 
            label: 'PENDING APPROVALS', subtitle: 'Purchase Orders', 
            value: json.pending_approvals, 
            trend: 'Actionable', color: 'var(--primary)' 
          },
          { 
            label: 'ACCURACY LIFT', subtitle: 'Forecast vs Baseline', 
            value: `+${json.avg_forecast_accuracy_lift_pct}%`, 
            trend: 'Improved ▲', color: 'var(--success)' 
          }
        ]);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>Loading KPI Data...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
      {data.map((kpi, idx) => (
        <div key={idx} className="glass-panel animate-fade-in kpi-card" style={{ padding: '24px', animationDelay: `${idx * 0.1}s`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <h3 style={{ color: 'var(--text-main)', fontSize: '0.85rem', letterSpacing: '0.5px' }}>{kpi.label}</h3>
            <span style={{ color: kpi.color, fontSize: '0.8rem', fontWeight: 'bold' }}>{kpi.trend}</span>
          </div>
          
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '8px', minHeight: '16px' }}>
            {kpi.subtitle}
          </div>
          
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {kpi.value}
          </div>

          {/* Decorative Sparkline representation */}
          <svg style={{ position: 'absolute', bottom: 0, right: 0, width: '60%', height: '50%', opacity: 0.6 }} viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,30 Q10,10 20,20 T40,25 T60,10 T80,30 T100,15 L100,40 L0,40 Z" fill="url(#grad1)" opacity="0.1" />
            <path d="M0,30 Q10,10 20,20 T40,25 T60,10 T80,30 T100,15" fill="none" stroke={kpi.color} strokeWidth="2" />
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: kpi.color, stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'transparent', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      ))}
    </div>
  );
};

export default KPIGrid;
