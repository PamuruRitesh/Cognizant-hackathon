import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import SkeletonLoader from './SkeletonLoader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Play, RotateCcw, SlidersHorizontal, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import CustomSelect from './CustomSelect';

const SliderField = ({ label, value, min, max, step = 1, onChange, format = v => v, color = 'var(--blue-500)' }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color, fontFamily: 'monospace' }}>{format(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ '--val': `${((value - min) / (max - min)) * 100}%` }}
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{format(min)}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{format(max)}</span>
    </div>
  </div>
);

const DEFAULT_PARAMS = { store_id: '', product_id: '', discount: 0, price: 100, promo: false, lead_time: 7 };

const WhatIfSimulator = () => {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableSkus, setAvailableSkus] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/skus')
      .then(res => res.json())
      .then(json => setAvailableSkus(json.skus || []))
      .catch(console.error);
  }, []);

  const set = (field, value) => setParams(prev => ({ ...prev, [field]: value }));

  const runSimulation = () => {
    if (!params.store_id || !params.product_id) return;
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/api/whatif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => { setResult(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  const chartData = result ? [
    { name: 'P10 (Low)', value: Number(Number(result.p10).toFixed(1)), color: 'var(--warning)' },
    { name: 'P50 (Mid)', value: Number(Number(result.p50).toFixed(1)), color: 'var(--blue-400)' },
    { name: 'P90 (High)', value: Number(Number(result.p90).toFixed(1)), color: 'var(--success)' },
  ] : [];

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

      {/* ── Controls Panel ───────────────────── */}
      <div className="glass-panel" style={{ flex: '0 0 280px', position: 'relative', zIndex: 50 }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <SlidersHorizontal size={14} color="var(--blue-400)" />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Parameters</span>
        </div>

        <div style={{ padding: '20px 20px 16px' }}>
          {/* ID Selection */}
          <div style={{ marginBottom: 24 }}>
            <label className="input-label">Select SKU</label>
            <div style={{ position: 'relative' }}>
              <CustomSelect
                value={params.store_id && params.product_id ? `${params.store_id}|${params.product_id}` : ''}
                onChange={val => {
                  const [s, p] = val.split('|');
                  set('store_id', s);
                  set('product_id', p);
                }}
                placeholder="-- Select Store & Product --"
                options={availableSkus.map(sku => ({
                  value: `${sku.store_id}|${sku.product_id}`,
                  label: `${sku.store_id} • ${sku.product_id}`
                }))}
              />
            </div>
          </div>

          {/* Sliders */}
          <SliderField label="Price"       value={params.price}     min={10}  max={500}  step={5}   onChange={v => set('price', v)}      format={v => `₹${v}`}  color="var(--cyan-400)" />
          <SliderField label="Discount"    value={params.discount}  min={0}   max={50}   step={1}   onChange={v => set('discount', v)}   format={v => `${v}%`}  color="var(--pink-400)" />
          <SliderField label="Lead Time"   value={params.lead_time} min={1}   max={30}   step={1}   onChange={v => set('lead_time', v)}  format={v => `${v}d`}  color="var(--warning)" />

          {/* Promo toggle */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: params.promo ? 'rgba(59,130,246,0.1)' : 'rgba(5,12,26,0.5)',
              borderRadius: 8,
              border: `1px solid ${params.promo ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }} onClick={() => set('promo', !params.promo)}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: params.promo ? 'var(--blue-400)' : 'var(--text-secondary)' }}>
                Active Promotion
              </span>
              {/* Toggle */}
              <div style={{
                width: 36, height: 20, borderRadius: 10, position: 'relative',
                background: params.promo ? 'var(--blue-500)' : 'var(--border-muted)',
                transition: 'background 0.2s ease',
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute',
                  top: 2, left: params.promo ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            className="btn btn-primary btn-full"
            onClick={runSimulation}
            disabled={loading || !params.store_id || !params.product_id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
          >
            <Play size={14} />
            {loading ? 'Simulating…' : 'Run Simulation'}
          </button>
          {result && (
            <button
              className="btn btn-ghost btn-full"
              onClick={() => { setResult(null); setParams(DEFAULT_PARAMS); }}
              style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading ? (
          <SkeletonLoader type="chart" />
        ) : error ? (
          <ErrorState message={error} />
        ) : result ? (
          <>
            {/* Quantile Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {[
                { label: 'P10 Downside', value: Number(Number(result.p10).toFixed(1)), color: 'var(--warning)',   Icon: TrendingDown },
                { label: 'P50 Median',   value: Number(Number(result.p50).toFixed(1)), color: 'var(--blue-400)', Icon: TrendingUp   },
                { label: 'P90 Upside',   value: Number(Number(result.p90).toFixed(1)), color: 'var(--success)',  Icon: TrendingUp   },
              ].map(({ label, value, color, Icon }) => (
                <div key={label} className="glass-panel" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon size={13} color={color} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {value}
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 5 }}>units</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bar Chart */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Demand Scenario Distribution</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>Quantile forecast output for configured parameters</div>
              </div>
              <div style={{ padding: '16px', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(96,165,250,0.07)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(5,12,26,0.96)', border: '1px solid var(--border-muted)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' }}
                      cursor={{ fill: 'rgba(96,165,250,0.05)' }}
                    />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Note */}
            {result.note && (
              <div style={{ padding: '12px 16px', background: 'var(--warning-muted)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', fontSize: 'var(--text-sm)', color: 'var(--warning)' }}>
                ⚠ {result.note}
              </div>
            )}
          </>
        ) : (
          <div className="glass-panel" style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.5 }}>
            <SlidersHorizontal size={36} color="var(--text-muted)" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Ready to Simulate</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Adjust parameters and run the simulation</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfSimulator;
