import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';
import { Bot, User, ShieldCheck, CheckCircle2, XCircle, Clock, ScrollText } from 'lucide-react';

const getStatusStyle = (action) => {
  if (action === 'approved') return { cls: 'badge-success', color: 'var(--success)', label: 'Approved' };
  if (action === 'rejected') return { cls: 'badge-danger',  color: 'var(--danger)',  label: 'Rejected' };
  return { cls: 'badge-blue', color: 'var(--blue-400)', label: action ? action.toUpperCase() : 'EVENT' };
};

const getStatusIcon = (action) => {
  if (action === 'approved') return <CheckCircle2 size={14} color="var(--success)" />;
  if (action === 'rejected') return <XCircle size={14} color="var(--danger)" />;
  return <Clock size={14} color="var(--blue-400)" />;
};

const getActorIcon = (approver) => {
  if (!approver || approver.toLowerCase().includes('agent')) return <Bot size={15} color="var(--cyan-400)" />;
  return <User size={15} color="var(--blue-400)" />;
};

const AuditTrace = () => {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 8;

  const fetchAudit = () => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:8000/api/audit?action=${filter}&page=${currentPage}&limit=${itemsPerPage}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => {
        setTraces(json.items || []);
        setTotalItems(json.total || 0);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchAudit(); }, [filter, currentPage]);

  if (loading) return <SkeletonLoader type="list" count={4} />;
  if (error)   return <ErrorState message={error} onRetry={fetchAudit} />;
  if (!traces.length) return (
    <EmptyState
      title="No Audit Records"
      message="No agent or human actions have been recorded yet."
      icon={<ScrollText size={36} color="var(--text-muted)" />}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 4 }}>Audit & Agent Trace</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Immutable log of all agent decisions and human interventions
          </p>
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', background: 'rgba(5, 12, 26, 0.6)', padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          {['all', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
              style={{
                padding: '6px 16px',
                background: filter === f ? 'var(--blue-500)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute',
          left: 19, top: 0, bottom: 0,
          width: 1,
          background: 'linear-gradient(to bottom, var(--border-muted), transparent)',
          zIndex: 0,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {traces.map((trace, idx) => {
            const status = getStatusStyle(trace.action);
            const isAgent = !trace.approver || trace.approver.toLowerCase().includes('agent');
            return (
              <div
                key={idx}
                className="animate-fade-up"
                style={{
                  display: 'flex',
                  gap: 16,
                  paddingBottom: 24,
                  animationDelay: `${idx * 0.05}s`,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: isAgent ? 'rgba(6,182,212,0.12)' : 'rgba(59,130,246,0.12)',
                  border: `1px solid ${isAgent ? 'rgba(6,182,212,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isAgent ? '0 0 12px rgba(6,182,212,0.2)' : '0 0 12px rgba(59,130,246,0.2)',
                  marginTop: 4
                }}>
                  {getActorIcon(trace.approver)}
                </div>

                {/* Content card */}
                <div className="glass-panel surface-hover" style={{ flex: 1, padding: '16px 20px' }}>
                  {/* Top Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {getStatusIcon(trace.action)}
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {trace.rec_id || 'System Event'}
                      </span>
                      <span className={`risk-badge ${status.cls}`}>{status.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {trace.timestamp
                          ? new Date(trace.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Actor</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isAgent
                          ? <><Bot size={12} color="var(--cyan-400)"/> Agent System</>
                          : <><User size={12} color="var(--blue-400)"/> {trace.approver || 'Unknown User'}</>
                        }
                      </div>
                    </div>
                    
                    {trace.action === 'approved' && trace.qty !== undefined && (
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Approved Qty</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>
                          {trace.qty} units
                        </div>
                      </div>
                    )}
                    
                    {(trace.note || trace.reason) && (
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          {trace.action === 'rejected' ? 'Rejection Reason' : 'Approval Note'}
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(5, 12, 26, 0.4)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                          {trace.reason || trace.note}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

export default AuditTrace;
