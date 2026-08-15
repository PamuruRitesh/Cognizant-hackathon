import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';

const AuditTrace = () => {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAudit = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/api/audit')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(json => {
        setTraces(json.audit_trail || json || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  if (loading) return <SkeletonLoader type="list" count={4} />;
  if (error) return <ErrorState message={error} onRetry={fetchAudit} />;
  if (traces.length === 0) return <EmptyState title="No Audit Records" message="No agent or human actions have been recorded yet." icon="📜" />;

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '24px' }}>System Audit & Agent Trace</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {traces.map((trace, idx) => (
          <div key={idx} style={{ 
            padding: '16px', 
            background: 'var(--bg-dark)', 
            borderRadius: '8px',
            borderLeft: `4px solid ${trace.status === 'Approved' ? 'var(--success)' : trace.status === 'Rejected' ? 'var(--danger)' : 'var(--primary)'}` 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ color: 'var(--text-main)' }}>{trace.timestamp || new Date().toISOString()}</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>User: {trace.user || 'System Agent'}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Action</p>
                <p>{trace.action}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Details</p>
                <p>{trace.details || `Recommended: ${trace.recommendation} | Guardrail: ${trace.guardrail_result}`}</p>
              </div>
            </div>
            
            <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
              <span className={`risk-badge badge-${trace.status === 'Approved' ? 'low' : trace.status === 'Rejected' ? 'high' : 'med'}`} style={{ opacity: 0.8 }}>
                Status: {trace.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditTrace;
