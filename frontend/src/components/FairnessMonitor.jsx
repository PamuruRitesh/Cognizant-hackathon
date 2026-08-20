import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { Shield, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const FairnessMonitor = ({ selectedDate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/recommendations?status=all&limit=5000`)
      .then(res => res.json())
      .then(json => {
        setData(json.items || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading Fairness Metrics...</div>;
  }
  if (error) {
    return <div style={{ padding: 20, color: 'var(--danger)' }}>Error: {error}</div>;
  }

  // Calculate metrics
  const calcMetrics = (groupKey) => {
    const groups = {};
    const filteredData = selectedDate && selectedDate !== 'all' 
      ? data.filter(item => item.date === selectedDate) 
      : data;

    filteredData.forEach(item => {
      const val = item[groupKey] || 'Unknown';
      if (!groups[val]) {
        groups[val] = { total: 0, escalated: 0, approved: 0 };
      }
      groups[val].total += 1;
      // Define 'escalated' as pending or rejected (requires human intervention or was rejected)
      if (item.status === 'pending' || item.status === 'rejected') {
        groups[val].escalated += 1;
      } else if (item.status === 'approved' || item.status === 'executed') {
        groups[val].approved += 1;
      }
    });

    const keys = Object.keys(groups);
    const stats = keys.map(k => ({
      name: k,
      total: groups[k].total,
      escalated: groups[k].escalated,
      rate: groups[k].total > 0 ? groups[k].escalated / groups[k].total : 0
    }));

    return stats;
  };

  const sizeStats = calcMetrics('vendor_size');
  const regionStats = calcMetrics('vendor_region');

  // Compute Disparate Impact (Four-Fifths Rule: 0.8 to 1.25 is acceptable)
  const calculateDisparateImpact = (stats, baselineName) => {
    const baseline = stats.find(s => s.name === baselineName);
    if (!baseline || baseline.rate === 0) return { ratio: 1, flagged: false };

    const others = stats.filter(s => s.name !== baselineName);
    let maxDisparity = 1;
    let worstGroup = '';
    let flagged = false;

    others.forEach(s => {
      const ratio = s.rate / baseline.rate;
      if (ratio < 0.8 || ratio > 1.25) {
        flagged = true;
        if (Math.abs(1 - ratio) > Math.abs(1 - maxDisparity)) {
          maxDisparity = ratio;
          worstGroup = s.name;
        }
      }
    });

    return { ratio: maxDisparity, worstGroup, flagged };
  };

  const sizeImpact = calculateDisparateImpact(sizeStats, 'Enterprise');
  const regionImpact = calculateDisparateImpact(regionStats, 'Domestic');

  const renderCard = (title, stats, impact, baseline) => (
    <div className="glass-panel" style={{ padding: 20, flex: 1, minWidth: 300 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 4 }}>{title}</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Escalation & Rejection Rates</p>
        </div>
        {impact.flagged ? (
          <div className="badge badge-danger" style={{ display: 'flex', gap: 6 }}>
            <AlertTriangle size={14} /> Bias Risk Detected
          </div>
        ) : (
          <div className="badge badge-success" style={{ display: 'flex', gap: 6 }}>
            <CheckCircle size={14} /> Within Bounds
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.name} style={{ flex: 1, background: 'var(--bg-surface-2)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.name}</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: '4px 0' }}>{(s.rate * 100).toFixed(1)}%</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{s.escalated} of {s.total} items</div>
          </div>
        ))}
      </div>

      {impact.flagged && impact.worstGroup && (
        <div style={{ padding: 12, background: 'rgba(244, 63, 94, 0.1)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
          <p style={{ fontSize: 'var(--text-sm)', margin: 0, color: 'var(--text-primary)' }}>
            <strong>Disparate Impact Alert:</strong> {impact.worstGroup} vendors are escalated {(impact.ratio).toFixed(2)}x as often as {baseline}. 
            (Threshold: 0.8 - 1.25)
          </p>
        </div>
      )}

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-muted)', borderRadius: 'var(--radius-md)' }}
              formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Escalation Rate']}
            />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
              {stats.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={impact.flagged && entry.name === impact.worstGroup ? 'var(--danger)' : 'var(--blue-500)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fade-in 0.3s ease-out' }}>
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={24} color="var(--blue-400)" />
        </div>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: '0 0 4px 0' }}>Bias & Fairness Monitor</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: 800 }}>
            Demonstrates how the system would audit its own recommendations for disparate impact, using the EEOC 4/5ths Rule as the baseline indicator. The vendor segments below are derived attributes, not observed ones — the Olist dataset carries no vendor size or geography, so they are assigned deterministically per SKU to exercise the method. The methodology is real; the segment labels are illustrative.
          </p>
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.10)',
                    border: '1px solid rgba(245,158,11,0.35)', fontSize: 'var(--text-sm)',
                    color: 'var(--warning)' }}>
        Illustrative segments: vendor size and region are derived from the SKU identifier, not
        supplied by the source data. The fairness calculation is real; the groupings are a stand-in
        until vendor master data is connected.
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {renderCard("Vendor Size Equity", sizeStats, sizeImpact, "Enterprise")}
        {renderCard("Geographic Equity", regionStats, regionImpact, "Domestic")}
      </div>
    </div>
  );
};

export default FairnessMonitor;
