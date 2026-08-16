import { useState, useEffect } from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';
import { Bot, User, ShieldCheck, CheckCircle2, XCircle, Clock, ScrollText } from 'lucide-react';

const getStatusStyle = (status) => {
  if (!status) return { cls: 'badge-blue',    color: 'var(--blue-400)',  label: 'Pending' };
  if (status === 'Approved') return { cls: 'badge-success', color: 'var(--success)', label: 'Approved' };
  if (status === 'Rejected') return { cls: 'badge-danger',  color: 'var(--danger)',  label: 'Rejected' };
  return { cls: 'badge-blue', color: 'var(--blue-400)', label: status };
};

const getStatusIcon = (status) => {
  if (status === 'Approved') return <CheckCircle2 size={13} color="var(--success)" />;
  if (status === 'Rejected') return <XCircle size={13} color="var(--danger)" />;
  return <Clock size={13} color="var(--blue-400)" />;
};

const getActorIcon = (user) => {
  if (!user || user === 'System Agent' || user === 'agent') return <Bot size={14} color="var(--cyan-400)" />;
  return <User size={14} color="var(--blue-400)" />;
};

const AuditTrace = () => {
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAudit = () => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8000/api/audit')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => { setTraces(json.audit_trail || json || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { fetchAudit(); }, []);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 2 }}>Audit & Agent Trace</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Immutable log of all agent decisions and human interventions
          </p>
        </div>
        <span className="risk-badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {traces.length} events
        </span>
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
            const status = getStatusStyle(trace.status);
            const isAgent = !trace.user || trace.user === 'System Agent' || trace.user === 'agent';
            return (
              <div
                key={idx}
                className="animate-fade-up"
                style={{
                  display: 'flex',
                  gap: 16,
                  paddingBottom: 20,
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
                  boxShadow: isAgent ? '0 0 10px rgba(6,182,212,0.15)' : '0 0 10px rgba(59,130,246,0.15)',
                }}>
                  {getActorIcon(trace.user)}
                </div>

                {/* Content card */}
                <div className="glass-panel" style={{ flex: 1, padding: '14px 18px' }}>
                  {/* Top Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {getStatusIcon(trace.status)}
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {trace.action || 'System Event'}
                      </span>
                      <span className={`risk-badge ${status.cls}`}>{status.label}</span>
                    </div>
                    <div style={{ display: 'flex', align: 'center', gap: 10 }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {trace.timestamp
                          ? new Date(trace.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Actor</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {isAgent
                          ? <><Bot size={11} /> Agent System</>
                          : <><User size={11} /> {trace.user}</>
                        }
                      </div>
                    </div>
                    {(trace.details || trace.recommendation) && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Details</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {trace.details || `Rec: ${trace.recommendation} · Guardrail: ${trace.guardrail_result}`}
                        </div>
                      </div>
                    )}
                    {trace.guardrail_result && !trace.details && (
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Guardrail</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-sm)' }}>
                          <ShieldCheck size={12} color="var(--success)" />
                          <span style={{ color: 'var(--success)' }}>{trace.guardrail_result}</span>
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
    </div>
  );
};

export default AuditTrace;
