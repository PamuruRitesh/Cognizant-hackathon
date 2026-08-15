import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Bar } from 'recharts';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';

const SKUDetail = () => {
  const [storeId, setStoreId] = useState('S1');
  const [productId, setProductId] = useState('P0001');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSKUData = () => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:8000/api/forecast?store_id=${storeId}&product_id=${productId}&horizon=14`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(json => {
        // Assume API returns an array or an object with forecast_data array
        setData(json.forecast_data || json || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSKUData();
  }, [storeId, productId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Store ID</label>
          <input 
            type="text" 
            className="input-field" 
            value={storeId} 
            onChange={(e) => setStoreId(e.target.value)} 
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>SKU / Product ID</label>
          <input 
            type="text" 
            className="input-field" 
            value={productId} 
            onChange={(e) => setProductId(e.target.value)} 
          />
        </div>
        <button className="glass-button" style={{ marginTop: '24px' }} onClick={fetchSKUData}>
          Load SKU Data
        </button>
      </div>

      {loading ? (
        <SkeletonLoader type="chart" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchSKUData} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No Forecast Data" message="No data available for this Store and SKU." icon="📈" />
      ) : (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Forecast Fan Chart & Inventory Projection</h3>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                <XAxis dataKey="date" stroke="var(--text-muted)" />
                <YAxis yAxisId="left" stroke="var(--text-muted)" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-deep)', borderColor: 'var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }} />
                <Legend />
                <defs>
                  <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Fan Chart Area (P10 to P90) */}
                <Area yAxisId="left" type="monotone" dataKey="p90" stroke="none" fill="url(#colorP90)" />
                <Area yAxisId="left" type="monotone" dataKey="p10" stroke="none" fill="var(--bg-dark)" fillOpacity={1} />
                
                {/* Lines */}
                <Line yAxisId="left" type="monotone" dataKey="p50" stroke="var(--primary)" strokeWidth={2} dot={false} name="P50 Forecast" />
                <Line yAxisId="left" type="monotone" dataKey="incumbent" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Incumbent Forecast" />
                <Line yAxisId="left" type="stepAfter" dataKey="actual" stroke="var(--success)" strokeWidth={2} dot={{ r: 4 }} name="Actual Demand" />
                
                {/* Inventory info mapped on right axis or bars */}
                <Line yAxisId="right" type="step" dataKey="inventory_projection" stroke="var(--warning)" name="Inventory Projection" />
                <Line yAxisId="right" type="step" dataKey="reorder_point" stroke="var(--danger)" strokeDasharray="3 3" name="Reorder Point" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default SKUDetail;
