import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';

const ApprovalQueue = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchQueue = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/api/recommendations?status=pending')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(json => {
        setRecommendations(json.recommendations || json || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleAction = (recId, action) => {
    const endpoint = action === 'approve' ? `/api/recommendations/${recId}/approve` : `/api/recommendations/${recId}/reject`;
    const body = action === 'approve' ? { qty: 0 /* default or modified */, approver: 'planner', note: 'Approved via UI' } : { reason: 'Rejected via UI', approver: 'planner' };
    
    fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(res => {
      if(res.ok) {
        setToast(`${action === 'approve' ? 'Approved' : 'Rejected'} recommendation for ${recId}`);
        setTimeout(() => setToast(null), 3000);
        setRecommendations(prev => prev.filter(r => r.id !== recId));
      }
    })
    .catch(console.error);
  };

  if (loading) return <SkeletonLoader type="list" count={3} />;
  if (error) return <ErrorState message={error} onRetry={fetchQueue} />;
  if (recommendations.length === 0) return <EmptyState title="All Caught Up!" message="There are no pending recommendations in the queue." icon="🎉" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
      
      {toast && (
        <div className="glass-panel animate-fade-in" style={{ 
          position: 'fixed', top: '20px', right: '20px', padding: '16px 24px', 
          background: 'var(--success)', color: 'white', zIndex: 1000, 
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)' 
        }}>
          {toast}
        </div>
      )}

      <h2 style={{ marginBottom: '10px' }}>Pending Approvals</h2>
      {recommendations.map(rec => (
        <div key={rec.id} className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>{rec.store_id} - {rec.product_id}</h3>
              <span className={`risk-badge badge-${rec.risk_type === 'stockout' ? 'high' : 'med'}`}>{rec.risk_type}</span>
              {rec.guardrail_status && (
                <span className="risk-badge badge-low" style={{ background: 'var(--primary)', color: 'white' }}>{rec.guardrail_status}</span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Recommended Order: <strong>{rec.recommended_qty} units</strong></p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Rationale: {rec.rationale}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="glass-button" style={{ borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => handleAction(rec.id, 'approve')}>
              Approve
            </button>
            <button className="glass-button" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleAction(rec.id, 'reject')}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ApprovalQueue;
