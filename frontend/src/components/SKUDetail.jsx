import { useState, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { API_BASE } from '../config';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';
import CustomSelect from './CustomSelect';
import { Search, TrendingUp, BarChart2 } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
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
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.value?.toFixed ? p.value.toFixed(0) : p.value}</span>
        </div>
      ))}
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
                  label: `Store: ${sku.store_id}   •   Product: ${sku.product_id}`
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

      {/* Chart Panel */}
      {loading ? (
        <SkeletonLoader type="chart" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSKUData} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No Forecast Data" message="No data available for this Store and SKU." icon={<BarChart2 size={32} color="var(--text-muted)" />} />
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
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
              <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
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
                <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

                {/* P10-P90 Confidence Band */}
                <Area yAxisId="left" type="monotone" dataKey="p90" stroke="none" fill="url(#bandGrad)" name="P90 Upper" legendType="none" />
                <Area yAxisId="left" type="monotone" dataKey="p10" stroke="none" fill="var(--bg-canvas)" fillOpacity={1} name="P10 Lower" legendType="none" />

                {/* Main Lines */}
                <Line yAxisId="left" type="monotone" dataKey="p50" stroke="var(--blue-400)" strokeWidth={2.5} dot={false} name="P50 Forecast" />
                <Line yAxisId="left" type="monotone" dataKey="p10" stroke="rgba(96,165,250,0.4)" strokeWidth={1} strokeDasharray="4 3" dot={false} name="P10 Band" />
                <Line yAxisId="left" type="monotone" dataKey="p90" stroke="rgba(96,165,250,0.4)" strokeWidth={1} strokeDasharray="4 3" dot={false} name="P90 Band" />
                <Line yAxisId="left" type="monotone" dataKey="actual" stroke="var(--success)" strokeWidth={2} dot={{ r: 3, fill: 'var(--success)' }} name="Actual Demand" />
                <Line yAxisId="left" type="monotone" dataKey="incumbent" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Incumbent" />

                {/* Inventory */}
                <Area yAxisId="right" type="step" dataKey="inventory_projection" stroke="var(--warning)" strokeWidth={1.5} fill="url(#invGrad)" name="Inventory Level" />
                <Line yAxisId="right" type="step" dataKey="reorder_point" stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Reorder Point" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default SKUDetail;
