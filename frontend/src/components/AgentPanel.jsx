import { useState } from 'react';
import { API_BASE } from '../config';
import { Bot, ShieldCheck, Zap, Cpu } from 'lucide-react';

// Shows the two Grok agents for one recommendation: the Proposer's suggestion
// and the Verifier's independent cross-check. Data comes pre-baked on the rec
// (rec.proposer / rec.verification); the "Re-run live" button calls the agents
// on demand via /api/recommendations/{id}/analyze.
const decisionColor = (d) =>
  d === 'APPROVE' ? 'var(--success)' : d === 'OVERRIDE' ? 'var(--danger)' : 'var(--warning)';

const Chip = ({ text, color }) => (
  <span style={{
    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
    padding: '2px 8px', borderRadius: 999,
    color, border: `1px solid ${color}`, background: 'transparent',
  }}>{text}</span>
);

const AgentPanel = ({ rec }) => {
  const [proposer, setProposer] = useState(rec.proposer || null);
  const [verifier, setVerifier] = useState(rec.verification || null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(
    (rec.proposer?.ai_available && rec.verification?.ai_available) || false
  );

  const rerun = () => {
    setBusy(true);
    fetch(`${API_BASE}/api/recommendations/${rec.rec_id}/analyze`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setProposer(d.proposer);
        setVerifier(d.verifier);
        setAiAvailable(!!d.ai_available);
        setLive(true);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  if (!proposer && !verifier) {
    return (
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={rerun} disabled={busy}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Zap size={13} /> {busy ? 'Running agents…' : 'Analyze with AI agents'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Cpu size={12} color="var(--blue-400)" />
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--blue-400)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dual-Agent Review</span>
        <Chip text={aiAvailable ? 'xAI Grok · Live' : 'AI Offline · Fallback'}
          color={aiAvailable ? 'var(--success)' : 'var(--text-muted)'} />
        {live && <Chip text="RE-RUN" color="var(--blue-400)" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Proposer */}
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Bot size={13} color="var(--blue-400)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>PROPOSER</span>
            {proposer && (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Chip text={proposer.decision} color={decisionColor(proposer.decision)} />
                {proposer.confidence != null &&
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {Math.round(proposer.confidence * 100)}%
                  </span>}
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {proposer?.rationale || '—'}
          </p>
        </div>

        {/* Verifier */}
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(2,195,154,0.05)',
          border: '1px solid rgba(2,195,154,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ShieldCheck size={13} color="var(--success)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>VERIFIER</span>
            {verifier && (
              <span style={{ marginLeft: 'auto' }}>
                <Chip text={verifier.verdict} color={decisionColor(verifier.verdict)} />
              </span>
            )}
          </div>
          {verifier?.reasons?.length ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {verifier.reasons.map((r, i) => (
                <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Final: {verifier?.final_decision || '—'}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={rerun} disabled={busy}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Zap size={12} /> {busy ? 'Running…' : 'Re-run live'}
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Powered by xAI Grok</span>
      </div>
    </div>
  );
};

export default AgentPanel;
