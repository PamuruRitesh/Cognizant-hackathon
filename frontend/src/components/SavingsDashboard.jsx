import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Activity, PackageCheck, Zap, ArrowDown, DollarSign } from 'lucide-react';
import { API_BASE } from '../config';
import SkeletonLoader from './SkeletonLoader';
import ErrorState from './ErrorState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const SavingsDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/simulation`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <SkeletonLoader type="grid" count={4} />;
  if (error) return <ErrorState message={error} />;
  if (!data || !data.totals) return <div>No simulation data available</div>;

  const chartData = [
    { name: 'A: Simple MA', value: data.totals.A_current_practice, fill: 'var(--text-muted)' },
    { name: 'B: LightGBM (Point)', value: data.totals.B_incumbent_forecast, fill: 'var(--blue-400)' },
    { name: 'C: StockPilot (Quantile)', value: data.totals.C_stockpilot, fill: 'var(--success)' }
  ];

  const formatCurrency = (val) => `₹${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 2 }}>Simulation Results</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Comparing StockPilot against incumbent approaches over a 14-day test window (50 SKUs)
          </p>
        </div>
        <div className="badge-success" style={{ padding: '6px 12px', borderRadius: 999, display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
          <TrendingUp size={16} /> 
          System Cost Lift: {formatCurrency(data.C_vs_A_system_lift.net_benefit)} saved
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* KPI 1 */}
        <div className="glass-panel animate-fade-up" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} color="var(--success)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cost Avoided</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                {formatCurrency(data.C_vs_A_system_lift.net_benefit)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>-{(data.C_vs_A_system_lift.net_benefit / data.totals.A_current_practice * 100).toFixed(1)}%</span> vs simple moving average baseline.
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-panel animate-fade-up" style={{ padding: '24px', animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="var(--blue-400)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stockout Days Reduced</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                {data.C_vs_A_system_lift.stockout_days_reduced} days
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Eliminated {data.C_vs_B_forecast_lift.stockout_days_reduced} stockout days even vs the point forecast.
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-panel animate-fade-up" style={{ padding: '24px', animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PackageCheck size={20} color="var(--warning)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Efficiency</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                {data.C_vs_A_system_lift.avg_inventory_change_pct > 0 ? '+' : ''}{data.C_vs_A_system_lift.avg_inventory_change_pct.toFixed(1)}%
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Change in average inventory units held.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'stretch' }}>
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 20 }}>Total Expected Cost (Inventory Holding + Stockout Risk)</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" tickFormatter={val => `₹${val/1000}k`} />
                <YAxis dataKey="name" type="category" width={150} stroke="var(--text-muted)" style={{ fontSize: '0.8rem' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: 'rgba(5, 12, 26, 0.95)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}
                  formatter={(val) => [formatCurrency(val), "Total Cost"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 4 }}>Assumptions</h3>
          <div style={{ background: 'var(--bg-surface-2)', padding: 12, borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Unit Economics:</strong> {data.assumptions.unit_economics}
          </div>
          <div style={{ background: 'var(--bg-surface-2)', padding: 12, borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Service Level Target:</strong> {(data.assumptions.service_level * 100).toFixed(0)}%
          </div>
          <div style={{ background: 'var(--bg-surface-2)', padding: 12, borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Initial Stock:</strong> {data.assumptions.initial_on_hand}
          </div>
          <div style={{ background: 'var(--bg-surface-2)', padding: 12, borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Lead Time:</strong> {data.assumptions.lead_time}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SavingsDashboard;
