import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, PackageCheck, DollarSign, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../config';
import SkeletonLoader from './SkeletonLoader';
import ErrorState from './ErrorState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ── Safe formatting helpers (handle null/undefined/NaN from API) ──────────────
const fmt = (val, decimals = 0) => {
  const n = Number(val);
  if (val === null || val === undefined || isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtCurrency = (val) => {
  const n = Number(val);
  if (val === null || val === undefined || isNaN(n)) return '—';
  return `₹${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtPct = (val) => {
  const n = Number(val);
  if (val === null || val === undefined || isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
};

const SavingsDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/simulation`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <SkeletonLoader type="grid" count={4} />;
  if (error) return <ErrorState message={error} />;
  if (!data || !data.totals) return <div>No simulation data available</div>;

  const chartData = [
    { name: 'A: Simple MA',             value: data.totals.A_current_practice,  fill: 'var(--text-muted)' },
    { name: 'B: LightGBM (Point)',      value: data.totals.B_incumbent_forecast, fill: 'var(--blue-400)'  },
    { name: 'C: StockPilot (Quantile)', value: data.totals.C_stockpilot,         fill: 'var(--success)'   },
  ];

  // Derived percentages (computed only in the frontend, from existing API fields)
  const savingsPctVsMA   = data.totals.A_current_practice
    ? data.C_vs_A_system_lift.net_benefit / data.totals.A_current_practice * 100
    : null;
  const savingsPctVsLGBM = data.totals.B_incumbent_forecast
    ? data.C_vs_B_forecast_lift.net_benefit / data.totals.B_incumbent_forecast * 100
    : null;

  // Head-to-head comparison rows — all values from existing API fields
  const comparisonRows = [
    {
      metric: 'Total Cost (Hold + Stockout)',
      A: fmtCurrency(data.totals.A_current_practice),
      B: fmtCurrency(data.totals.B_incumbent_forecast),
      C: fmtCurrency(data.totals.C_stockpilot),
      highlight: true,
    },
    {
      metric: 'Net Savings vs Arm',
      A: '—',
      B: `${fmtCurrency(data.C_vs_B_forecast_lift.net_benefit)} (${fmtPct(savingsPctVsLGBM)}↓)`,
      C: `${fmtCurrency(data.C_vs_A_system_lift.net_benefit)} (${fmtPct(savingsPctVsMA)}↓)`,
      highlight: false,
    },
    {
      metric: 'Stockout Days Reduced',
      A: '—',
      B: `${fmt(data.C_vs_B_forecast_lift.stockout_days_reduced)} days`,
      C: `${fmt(data.C_vs_A_system_lift.stockout_days_reduced)} days`,
      highlight: false,
    },
    {
      metric: 'Sellers Simulated',
      A: fmt(data.assumptions.sellers_simulated),
      B: fmt(data.assumptions.sellers_simulated),
      C: fmt(data.assumptions.sellers_simulated),
      highlight: false,
    },
    {
      metric: 'Test Window',
      A: `${fmt(data.assumptions.window_days)} days`,
      B: `${fmt(data.assumptions.window_days)} days`,
      C: `${fmt(data.assumptions.window_days)} days`,
      highlight: false,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 2 }}>Simulation Results</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Comparing StockPilot against incumbent approaches over a {fmt(data.assumptions.window_days)}-day test window ({fmt(data.assumptions.sellers_simulated)} SKUs)
          </p>
        </div>
        <div className="badge-success" style={{ padding: '6px 14px', borderRadius: 999, display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
          <TrendingUp size={15} />
          vs LightGBM: {fmtCurrency(data.C_vs_B_forecast_lift.net_benefit)} saved
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>

        {/* Card 1 — Cost avoided vs Simple MA */}
        <div className="glass-panel animate-fade-up" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={20} color="var(--success)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Avoided vs Simple MA</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                {fmtCurrency(data.C_vs_A_system_lift.net_benefit)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{fmtPct(savingsPctVsMA)}↓</span>
            lower total cost vs fixed-quantity ordering.
          </div>
        </div>

        {/* Card 2 — Stockout days eliminated */}
        <div className="glass-panel animate-fade-up" style={{ padding: '22px 24px', animationDelay: '0.08s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={20} color="var(--blue-400)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stockout Days Eliminated</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                {fmt(data.C_vs_A_system_lift.stockout_days_reduced)} days
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            vs Simple MA • also <strong style={{ color: 'var(--blue-400)' }}>{fmt(data.C_vs_B_forecast_lift.stockout_days_reduced)} days</strong> fewer than LightGBM.
          </div>
        </div>

        {/* Card 3 — Forecast accuracy lift */}
        <div className="glass-panel animate-fade-up" style={{ padding: '22px 24px', animationDelay: '0.16s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PackageCheck size={20} color="var(--warning)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecast Accuracy Lift</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                {data.forecast_lift_pct_vs_MA != null ? `+${Number(data.forecast_lift_pct_vs_MA).toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            StockPilot quantile forecast vs simple moving average baseline.
          </div>
        </div>

        {/* Card 4 — Cost avoided vs LightGBM */}
        <div className="glass-panel animate-fade-up" style={{ padding: '22px 24px', animationDelay: '0.24s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={20} color="var(--cyan-400)" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Avoided vs LightGBM</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                {fmtCurrency(data.C_vs_B_forecast_lift.net_benefit)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--cyan-400)', fontWeight: 700 }}>{fmtPct(savingsPctVsLGBM)}↓</span>
            lower cost vs point-forecast model.
          </div>
        </div>
      </div>

      {/* ── Chart + Comparison Table side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>

        {/* Bar Chart */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 4 }}>Total Expected Cost Comparison</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 20 }}>
            Inventory holding + stockout risk, across all 3 arms
          </p>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 4 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={val => `₹${(val / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={170} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: 'rgba(5, 12, 26, 0.95)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                  formatter={(val) => [fmtCurrency(val), 'Total Cost']}
                />
                <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Head-to-Head Comparison Table */}
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>Head-to-Head Comparison</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              Arm C = StockPilot &nbsp;·&nbsp; Arm B = LightGBM &nbsp;·&nbsp; Arm A = Simple MA
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 'var(--text-xs)' }}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style={{ color: 'var(--text-muted)' }}>Arm A (MA)</th>
                  <th style={{ color: 'var(--blue-400)' }}>Arm B (LGBM)</th>
                  <th style={{ color: 'var(--success)' }}>Arm C ✦</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} style={{ background: row.highlight ? 'rgba(16,185,129,0.04)' : undefined }}>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.metric}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.A}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--blue-400)' }}>{row.B}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--success)', fontWeight: 700 }}>{row.C}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Assumptions (expanded, all 7 fields from the API) ── */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 16 }}>Simulation Assumptions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            ['Unit Economics',       data.assumptions.unit_economics],
            ['Service Level Target', `${(data.assumptions.service_level * 100).toFixed(0)}%`],
            ['Initial Stock',        data.assumptions.initial_on_hand],
            ['Lead Time',            data.assumptions.lead_time],
            ['Arm A Strategy',       data.assumptions.arm_A],
            ['Arm B Strategy',       data.assumptions.arm_B],
            ['Arm C Strategy',       data.assumptions.arm_C],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--bg-surface-2)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{value ?? '—'}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default SavingsDashboard;
