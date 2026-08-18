import { useState, useEffect } from 'react';
import { API_BASE, shortenId } from '../config';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';
import { CheckCircle2, XCircle, ShieldCheck, Package, Clock, Sparkles } from 'lucide-react';

const ApprovalQueue = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [acting, setActing] = useState({});
  const [expandedRec, setExpandedRec] = useState(null);
  const [actionData, setActionData] = useState({ qty: 0, reason: 'Budget Constraints', note: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 5;

  const fetchQueue = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/recommendations?status=pending&page=${currentPage}&limit=${itemsPerPage}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => {
        setRecommendations(json.items || []);
        setTotalItems(json.total || 0);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchQueue(); }, [currentPage]);

  const handleInitiateAction = (rec, action) => {
    if (expandedRec?.id === rec.rec_id && expandedRec?.action === action) {
      setExpandedRec(null);
      return;
    }
    setExpandedRec({ id: rec.rec_id, action });
    setActionData({ qty: rec.recommended_qty, reason: 'Budget Constraints', note: '' });
  };

  const handleConfirmAction = (recId, action) => {
    setActing(prev => ({ ...prev, [recId]: action }));
    const endpoint = action === 'approve'
      ? `/api/recommendations/${recId}/approve`
      : `/api/recommendations/${recId}/reject`;
    const body = action === 'approve'
      ? { qty: Number(actionData.qty), approver: 'Planner (UI)', note: actionData.note }
      : { reason: actionData.reason, approver: 'Planner (UI)' };

    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => {
      if (res.ok) {
        setToast({ msg: action === 'approve' ? `✓ Approved PO for ${recId}` : `✗ Rejected ${recId}`, type: action });
        setTimeout(() => setToast(null), 3500);
        setRecommendations(prev => prev.filter(r => r.rec_id !== recId));
        setExpandedRec(null);
      }
    }).catch(console.error)
      .finally(() => setActing(prev => ({ ...prev, [recId]: null })));
  };

  if (loading) return <SkeletonLoader type="list" count={3} />;
  if (error)   return <ErrorState message={error} onRetry={fetchQueue} />;

  if (!totalItems) return (
    <EmptyState
      title="All Caught Up!"
      message="No purchase orders are waiting for your approval."
      icon={<CheckCircle2 size={40} color="var(--success)" />}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type === 'approve' ? 'success' : 'error'} animate-slide-in`}>
          {toast.type === 'approve' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 2 }}>Approval Queue</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {totalItems} purchase order{totalItems !== 1 ? 's' : ''} pending your review
          </p>
        </div>
        <span className="risk-badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
          <Clock size={11} /> Awaiting approval
        </span>
      </div>

      {/* Recommendation Cards */}
      {recommendations.map((rec, idx) => (
        <div
          key={rec.rec_id}
          className="glass-panel animate-fade-up"
          style={{ padding: 0, animationDelay: `${idx * 0.06}s`, overflow: 'hidden' }}
        >
          {/* Colored left border by risk */}
          <div style={{ display: 'flex' }}>
            <div style={{
              width: 4, flexShrink: 0,
              background: rec.risk_type === 'stockout'
                ? 'var(--danger)'
                : rec.risk_type === 'overstock'
                ? 'var(--warning)'
                : 'var(--blue-500)',
            }} />

            <div style={{ flex: 1, padding: '20px 22px' }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Package size={14} color="var(--text-secondary)" />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {rec.store_id} — {shortenId(rec.product_id)}
                    </span>
                    <span className={`risk-badge ${rec.risk_type === 'stockout' ? 'badge-high' : 'badge-med'}`}>
                      {rec.risk_type}
                    </span>
                    {rec.guardrail_status && (
                      <span className="risk-badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={10} /> {rec.guardrail_status}
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Recommended Qty</div>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--blue-400)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {rec.recommended_qty}
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginLeft: 4, color: 'var(--text-secondary)' }}>units</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Days to Stockout</div>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: rec.days_to_stockout <= 3 ? 'var(--danger)' : 'var(--warning)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {rec.days_to_stockout}
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginLeft: 4, color: 'var(--text-secondary)' }}>days</span>
                      </div>
                    </div>
                    {rec.cost_impact != null && (
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Cost Impact</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                          ₹{Number(rec.cost_impact).toLocaleString()}
                          <span style={{ fontSize: 'var(--text-xs)', marginLeft: 4, color: 'var(--success)' }}>saved</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    className={`btn btn-sm ${expandedRec?.id === rec.rec_id && expandedRec?.action === 'reject' ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => handleInitiateAction(rec, 'reject')}
                    disabled={!!acting[rec.rec_id]}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <XCircle size={13} /> Reject
                  </button>
                  <button
                    className={`btn btn-sm ${expandedRec?.id === rec.rec_id && expandedRec?.action === 'approve' ? 'btn-success' : 'btn-ghost'}`}
                    onClick={() => handleInitiateAction(rec, 'approve')}
                    disabled={!!acting[rec.rec_id]}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                </div>
              </div>

              {/* Rationale */}
              {rec.rationale && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: 'rgba(59,130,246,0.05)',
                  borderRadius: 8,
                  borderLeft: '3px solid rgba(59,130,246,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Sparkles size={11} color="var(--blue-400)" />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--blue-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Rationale</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{rec.rationale}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Expansion Area */}
          {expandedRec?.id === rec.rec_id && (
            <div className="animate-fade-in" style={{
              padding: '20px 24px',
              background: 'rgba(5, 12, 26, 0.4)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap'
            }}>
              {expandedRec.action === 'approve' ? (
                <>
                  <div style={{ flex: '1 1 120px' }}>
                    <label className="input-label">Approved Quantity</label>
                    <input type="number" className="input-field" value={actionData.qty} onChange={e => setActionData(prev => ({ ...prev, qty: e.target.value }))} />
                  </div>
                  <div style={{ flex: '2 1 200px' }}>
                    <label className="input-label">Approval Note (Optional)</label>
                    <input type="text" className="input-field" placeholder="e.g. Adjusted based on Q3 budget" value={actionData.note} onChange={e => setActionData(prev => ({ ...prev, note: e.target.value }))} />
                  </div>
                  <button className="btn btn-success" onClick={() => handleConfirmAction(rec.rec_id, 'approve')} disabled={!!acting[rec.rec_id]} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CheckCircle2 size={14} /> {acting[rec.rec_id] ? 'Processing...' : 'Confirm Approval'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ flex: '1 1 200px' }}>
                    <label className="input-label">Rejection Reason</label>
                    <div style={{ position: 'relative' }}>
                      <select className="input-field" style={{ appearance: 'none', width: '100%' }} value={actionData.reason} onChange={e => setActionData(prev => ({ ...prev, reason: e.target.value }))}>
                        <option>Budget Constraints</option>
                        <option>Overstocked</option>
                        <option>Duplicate Request</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={() => handleConfirmAction(rec.rec_id, 'reject')} disabled={!!acting[rec.rec_id]} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <XCircle size={14} /> {acting[rec.rec_id] ? 'Processing...' : 'Confirm Rejection'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Pagination Controls */}
      {Math.ceil(totalItems / itemsPerPage) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 0' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', padding: '0 8px', fontWeight: 600 }}>
              Page {currentPage} of {Math.ceil(totalItems / itemsPerPage)}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalItems / itemsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(totalItems / itemsPerPage)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;
