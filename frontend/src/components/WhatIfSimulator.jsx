import { useState } from 'react';
import ErrorState from './ErrorState';
import SkeletonLoader from './SkeletonLoader';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

const WhatIfSimulator = () => {
  const [params, setParams] = useState({
    store_id: 'S1',
    product_id: 'P0001',
    discount: 0,
    price: 100,
    promo: false,
    lead_time: 7
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSimulation = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/api/whatif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(json => {
        setResult(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  const handleChange = (field, value) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
      {/* Controls */}
      <div className="glass-panel" style={{ padding: '24px', flex: '0 0 300px' }}>
        <h3 style={{ marginBottom: '20px' }}>Simulation Parameters</h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Store ID</label>
          <input className="input-field" value={params.store_id} onChange={e => handleChange('store_id', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Product ID</label>
          <input className="input-field" value={params.product_id} onChange={e => handleChange('product_id', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Price (₹)</label>
          <input type="number" className="input-field" value={params.price} onChange={e => handleChange('price', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Discount (%)</label>
          <input type="number" className="input-field" value={params.discount} onChange={e => handleChange('discount', parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Lead Time (days)</label>
          <input type="number" className="input-field" value={params.lead_time} onChange={e => handleChange('lead_time', parseInt(e.target.value, 10))} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" id="promo" checked={params.promo} onChange={e => handleChange('promo', e.target.checked)} />
          <label htmlFor="promo" style={{ color: 'var(--text-muted)' }}>Active Promotion</label>
        </div>

        <button className="glass-button" style={{ width: '100%', justifyContent: 'center' }} onClick={runSimulation} disabled={loading}>
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <SkeletonLoader type="chart" />
        ) : error ? (
          <ErrorState message={error} />
        ) : result ? (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '20px' }}>Simulation Results</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px', flex: '1 1 200px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>P50 Forecasted Demand</div>
                <div style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>{result.p50} units</div>
              </div>
              <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px', flex: '1 1 200px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>P90 Upside</div>
                <div style={{ fontSize: '1.5rem', color: 'var(--success)', fontWeight: 'bold' }}>{result.p90} units</div>
              </div>
              <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px', flex: '1 1 200px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>P10 Downside</div>
                <div style={{ fontSize: '1.5rem', color: 'var(--warning)', fontWeight: 'bold' }}>{result.p10} units</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px', flex: 1, opacity: 0.5 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Stockout Risk Score</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Not provided by API</div>
              </div>
              <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px', flex: 1, opacity: 0.5 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Recommended Order</div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Not provided by API</div>
              </div>
            </div>
            
            <h4 style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Cost Impact Analysis</h4>
            <div style={{ width: '100%', height: 100 }}>
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                  Cost impact details not provided by API. Waiting for WS-1/WS-2 integration.
                </div>
            </div>
            {result.note && (
              <p style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                Note: {result.note}
              </p>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', opacity: 0.6, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Adjust parameters and click "Run Simulation" to see results.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfSimulator;
