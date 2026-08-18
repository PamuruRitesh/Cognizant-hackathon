import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import SkeletonLoader from './SkeletonLoader';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, Boxes } from 'lucide-react';
import { API_BASE } from '../config';

const cardDefs = [
  {
    key: 'value_at_risk',
    label: 'Value at Risk',
    sub: 'Potential revenue exposure',
    format: v => `₹${(v / 1000).toFixed(1)}k`,
    color: 'var(--danger)',
    bgGlow: 'rgba(244,63,94,0.07)',
    Icon: DollarSign,
    trend: 'Needs Action',
    TrendIcon: TrendingDown,
    trendColor: 'var(--danger)',
  },
  {
    key: 'stockout_risk_skus',
    label: 'Stockout Risk',
    sub: 'SKUs under safety stock',
    format: v => v,
    color: 'var(--warning)',
    bgGlow: 'rgba(245,158,11,0.07)',
    Icon: AlertTriangle,
    trend: 'Critical',
    TrendIcon: TrendingDown,
    trendColor: 'var(--warning)',
  },
  {
    key: 'pending_approvals',
    label: 'Pending Approvals',
    sub: 'Purchase orders awaiting review',
    format: v => v,
    color: 'var(--blue-400)',
    bgGlow: 'rgba(59,130,246,0.07)',
    Icon: Boxes,
    trend: 'Actionable',
    TrendIcon: TrendingUp,
    trendColor: 'var(--blue-400)',
  },
  {
    key: 'avg_forecast_accuracy_lift_pct',
    label: 'Accuracy Lift',
    sub: 'vs incumbent baseline model',
    format: v => {
      const n = Number(v);
      if (v === null || v === undefined || v === '—' || isNaN(n)) return '—';
      return `+${n.toFixed(1)}%`;
    },
    color: 'var(--success)',
    bgGlow: 'rgba(16,185,129,0.07)',
    Icon: CheckCircle,
    trend: 'Improved ↑',
    TrendIcon: TrendingUp,
    trendColor: 'var(--success)',
  },
];

const SPARKLINE = "M0,28 Q8,16 16,20 T32,18 T48,10 T64,22 T80,12 T96,18 T112,14";

const KPIGrid = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKPIs = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/kpis`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchKPIs(); }, []);

  if (loading) return <SkeletonLoader type="kpi" count={4} />;
  if (error)   return <ErrorState message={error} onRetry={fetchKPIs} />;

  return (
    <div className="grid-4">
      {cardDefs.map((def, idx) => {
        const { key, label, sub, format, color, bgGlow, Icon, trend, TrendIcon, trendColor } = def;
        const value = data?.[key] ?? '—';
        return (
          <div
            key={key}
            className="glass-panel kpi-card animate-fade-up"
            style={{
              padding: 20,
              position: 'relative',
              overflow: 'hidden',
              animationDelay: `${idx * 0.07}s`,
            }}
          >
            {/* Background glow blob */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse 80% 80% at 80% 100%, ${bgGlow}, transparent)`,
              pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={color} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendIcon size={12} color={trendColor} />
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: trendColor }}>{trend}</span>
                </div>
              </div>

              {/* Value */}
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: 2, lineHeight: 1 }}>
                {format(value)}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {sub}
              </div>
            </div>

            {/* Mini sparkline */}
            <svg
              viewBox="0 0 112 36"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 36, pointerEvents: 'none' }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`sg-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${SPARKLINE} L112,36 L0,36 Z`} fill={`url(#sg-${idx})`} />
              <path d={SPARKLINE} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export default KPIGrid;
