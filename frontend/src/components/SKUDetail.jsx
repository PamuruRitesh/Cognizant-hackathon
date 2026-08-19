import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { API_BASE, shortenId } from '../config';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';
import CustomSelect from './CustomSelect';
import {
  Search, TrendingUp, TrendingDown, BarChart2, Activity,
  Package, AlertTriangle, Target, Layers, ArrowUpRight,
  ArrowDownRight, Minus, ShieldCheck, Gauge,
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.date || label;
  return (
    <div style={{
      background: 'rgba(5,12,26,0.96)',
      border: '1px solid var(--border-muted)',
      borderRadius: 10,
      padding: '12px 16px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontSize: 'var(--text-sm)',
      minWidth: 180,
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{displayLabel}</div>
      {payload.filter(p => !['P10 Lower', 'P90 Upper'].includes(p.name)).map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.value?.toFixed ? p.value.toFixed(0) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Helper: compute summary stats from forecast data ─── */
const computeSummary = (data, storeId, productId) => {
  if (!data || data.length === 0) return null;

  const vals = (key) => data.map(d => d[key]).filter(v => v != null && !isNaN(v));
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const max = (arr) => arr.length ? Math.max(...arr) : null;
  const min = (arr) => arr.length ? Math.min(...arr) : null;

  const p50 = vals('p50');
  const p10 = vals('p10');
  const p90 = vals('p90');
  const actuals = vals('actual');
  const inventory = vals('inventory_projection');
  const reorder = vals('reorder_point');

  const avgP50 = avg(p50);
  const peakP50 = max(p50);
  const minP50 = min(p50);
  const avgBandWidth = avg(p90.map((v, i) => (p10[i] != null ? v - p10[i] : null)).filter(v => v != null));

  // Trend: compare first-half avg vs second-half avg of P50
  const mid = Math.floor(p50.length / 2);
  const firstHalf = avg(p50.slice(0, mid));
  const secondHalf = avg(p50.slice(mid));
  const trendPct = firstHalf ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
  const trend = trendPct > 2 ? 'up' : trendPct < -2 ? 'down' : 'flat';

  // Forecast accuracy (if actuals present)
  const accuracyPairs = data.filter(d => d.actual != null && d.p50 != null);
  const mape = accuracyPairs.length > 2
    ? avg(accuracyPairs.map(d => Math.abs(d.actual - d.p50) / (Math.abs(d.actual) || 1))) * 100
    : null;

  // Inventory health
  const latestInv = inventory.length ? inventory[inventory.length - 1] : null;
  const latestReorder = reorder.length ? reorder[reorder.length - 1] : null;
  const invAboveReorder = (latestInv != null && latestReorder != null) ? latestInv > latestReorder : null;

  // Days of supply estimate
  const avgDailyDemand = avgP50 || 1;
  const daysOfSupply = latestInv != null ? latestInv / avgDailyDemand : null;

  return {
    storeId,
    productId,
    horizon: data.length,
    avgP50: avgP50?.toFixed(1),
    peakP50: peakP50?.toFixed(0),
    minP50: minP50?.toFixed(0),
    avgBandWidth: avgBandWidth?.toFixed(1),
    trend,
    trendPct: Math.abs(trendPct).toFixed(1),
    mape: mape != null ? mape.toFixed(1) : null,
    latestInv: latestInv?.toFixed(0),
    latestReorder: latestReorder?.toFixed(0),
    invAboveReorder,
    daysOfSupply: daysOfSupply?.toFixed(1),
    totalActualDemand: actuals.length ? actuals.reduce((a, b) => a + b, 0).toFixed(0) : null,
    dataPoints: data.length,
  };
};

/* ─── Summary Stat Row ─── */
const StatRow = ({ icon: Icon, iconColor, label, value, sub, highlight }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
    borderBottom: '1px solid var(--border-subtle)',
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
      background: `${iconColor}15`, border: `1px solid ${iconColor}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginTop: 1,
    }}>
      <Icon size={13} color={iconColor} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-sm)', fontWeight: 700,
        color: highlight || 'var(--text-primary)',
        fontFamily: 'JetBrains Mono, monospace',
      }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

/* ─── SKU Summary Side Panel ─── */
const SKUSummaryPanel = ({ summary }) => {
  if (!summary) return null;

  const TrendIcon = summary.trend === 'up' ? ArrowUpRight : summary.trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = summary.trend === 'up' ? 'var(--success)' : summary.trend === 'down' ? 'var(--danger)' : 'var(--text-muted)';
  const trendLabel = summary.trend === 'up' ? 'Upward' : summary.trend === 'down' ? 'Downward' : 'Stable';

  const invColor = summary.invAboveReorder === true ? 'var(--success)'
    : summary.invAboveReorder === false ? 'var(--danger)' : 'var(--text-muted)';
  const invLabel = summary.invAboveReorder === true ? 'Above Reorder'
    : summary.invAboveReorder === false ? 'Below Reorder' : '—';

  return (
    <div className="glass-panel" style={{
      width: 280, flexShrink: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)',
        background: 'linear-gradient(135deg, rgba(255,91,43,0.06) 0%, transparent 60%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Gauge size={15} color="var(--blue-400)" />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>SKU Summary</span>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Store <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{summary.storeId}</span>
          {' · '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{shortenId(summary.productId)}</span>
        </div>
      </div>

      {/* Stats List */}
      <div style={{ padding: '6px 16px 16px', flex: 1, overflowY: 'auto' }}>
        {/* Demand Trend Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 12px', margin: '10px 0',
          borderRadius: 8,
          background: `${trendColor}10`,
          border: `1px solid ${trendColor}25`,
        }}>
          <TrendIcon size={16} color={trendColor} />
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Demand Trend</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: trendColor }}>
              {trendLabel} {summary.trendPct}%
            </div>
          </div>
        </div>

        <StatRow
          icon={Activity} iconColor="var(--blue-400)"
          label="Avg Forecast (P50)"
          value={summary.avgP50}
          sub="Mean predicted demand"
        />
        <StatRow
          icon={ArrowUpRight} iconColor="var(--success)"
          label="Peak Demand"
          value={summary.peakP50}
          sub="Highest P50 in horizon"
        />
        <StatRow
          icon={ArrowDownRight} iconColor="var(--warning)"
          label="Min Demand"
          value={summary.minP50}
          sub="Lowest P50 in horizon"
        />
        <StatRow
          icon={Layers} iconColor="var(--cyan-400)"
          label="Avg Confidence Band"
          value={`± ${summary.avgBandWidth}`}
          sub="Avg P90 – P10 spread"
        />
        {summary.mape != null && (
          <StatRow
            icon={Target} iconColor={parseFloat(summary.mape) < 20 ? 'var(--success)' : 'var(--warning)'}
            label="Forecast MAPE"
            value={`${summary.mape}%`}
            sub={parseFloat(summary.mape) < 20 ? 'Good accuracy' : 'Needs review'}
            highlight={parseFloat(summary.mape) < 20 ? 'var(--success)' : 'var(--warning)'}
          />
        )}
        {summary.totalActualDemand && (
          <StatRow
            icon={BarChart2} iconColor="var(--success)"
            label="Total Actual Demand"
            value={summary.totalActualDemand}
            sub={`Over ${summary.dataPoints} data points`}
          />
        )}

      </div>
    </div>
  );
};

const SKUDetail = ({ initialStore = '', initialProduct = '' }) => {
  const [storeId, setStoreId] = useState(initialStore);
  const [productId, setProductId] = useState(initialProduct);
  const [data, setData] = useState(null);
  const [availableSkus, setAvailableSkus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSKUData = () => {
    if (!storeId || !productId) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/forecast?store_id=${storeId}&product_id=${productId}&horizon=14`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => { setData(json.forecast_data || json || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { 
    fetch(`${API_BASE}/api/skus`)
      .then(res => res.json())
      .then(json => setAvailableSkus(json.skus || []))
      .catch(console.error);
    if (storeId && productId) fetchSKUData(); 
  }, []);

  const summary = useMemo(() => computeSummary(data, storeId, productId), [data, storeId, productId]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d, i) => ({ ...d, uniqueIndex: i }));
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', position: 'relative', zIndex: 50 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 400px' }}>
            <label className="input-label">Select SKU to Forecast</label>
            <div style={{ position: 'relative' }}>
              <CustomSelect
                value={storeId && productId ? `${storeId}|${productId}` : ''}
                onChange={val => {
                  const [s, p] = val.split('|');
                  setStoreId(s);
                  setProductId(p);
                }}
                placeholder="-- Select a valid Store & Product --"
                options={availableSkus.map(sku => ({
                  value: `${sku.store_id}|${sku.product_id}`,
                  label: `Store: ${sku.store_id}   •   ${shortenId(sku.product_id)}`
                }))}
              />
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 10, pointerEvents: 'none' }} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={fetchSKUData} disabled={loading}>
            <TrendingUp size={14} />
            {loading ? 'Loading…' : 'Load Forecast'}
          </button>
        </div>
      </div>

      {/* Chart + Summary Layout */}
      {loading ? (
        <SkeletonLoader type="chart" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSKUData} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No Forecast Data" message="No data available for this Store and SKU." icon={<BarChart2 size={32} color="var(--text-muted)" />} />
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          {/* Chart Panel */}
          <div className="glass-panel" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            {/* Chart Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Forecast Fan Chart</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  P10 / P50 / P90 confidence bands · 14-day horizon
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="risk-badge badge-blue">LightGBM Quantile</span>
                <span className="risk-badge badge-low">SHAP Explained</span>
              </div>
            </div>

            <div style={{ padding: '24px 16px 16px', height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--blue-500)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--blue-500)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--warning)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(96,165,250,0.07)" vertical={false} />
                  <XAxis dataKey="uniqueIndex" tickFormatter={(val) => chartData[val]?.date} stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

                  {/* P10-P90 Confidence Band */}
                  <Area yAxisId="left" type="monotone" dataKey="p90" stroke="none" fill="url(#bandGrad)" name="P90 Upper" legendType="none" isAnimationActive={false} activeDot={false} />
                  <Area yAxisId="left" type="monotone" dataKey="p10" stroke="none" fill="var(--bg-canvas)" fillOpacity={1} name="P10 Lower" legendType="none" isAnimationActive={false} activeDot={false} />

                  {/* Main Lines */}
                  <Line yAxisId="left" type="monotone" dataKey="p50" stroke="var(--blue-400)" strokeWidth={2.5} dot={false} name="P50 Forecast" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="p10" stroke="rgba(96,165,250,0.4)" strokeWidth={1} strokeDasharray="4 3" dot={false} name="P10 Band" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="p90" stroke="rgba(96,165,250,0.4)" strokeWidth={1} strokeDasharray="4 3" dot={false} name="P90 Band" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="actual" stroke="var(--success)" strokeWidth={2} dot={{ r: 3, fill: 'var(--success)' }} name="Actual Demand" isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="incumbent" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Incumbent" isAnimationActive={false} />

                  {/* Inventory */}
                  <Area yAxisId="right" type="step" dataKey="inventory_projection" stroke="var(--warning)" strokeWidth={1.5} fill="url(#invGrad)" name="Inventory Level" isAnimationActive={false} />
                  <Line yAxisId="right" type="step" dataKey="reorder_point" stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Reorder Point" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SKU Summary Side Panel */}
          <SKUSummaryPanel summary={summary} />
        </div>
      )}
    </div>
  );
};

export default SKUDetail;
