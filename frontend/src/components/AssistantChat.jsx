import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';
import { Send, Bot, User, Cpu, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Grok-powered assistant. Answers questions about anything on the dashboard by
// sending the user's message plus a live snapshot of dashboard data to
// POST /api/chat. When opened via an "Explain" icon it receives a `seed`
// (question + the specific chart's data) and auto-asks it.
const SUGGESTIONS = [
  'What are the biggest stockout risks right now?',
  'Explain the Simulation Results in simple terms.',
  'Why is a recommendation escalated instead of auto-approved?',
  'What does P10 / P50 / P90 mean here?',
];

const AssistantChat = ({ seed, onConsumed }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi — I'm the StockPilot assistant, powered by xAI Grok. Ask me anything about the KPIs, risks, forecasts, recommendations, or the simulation. You can also click the ✨ Explain icon on any chart to have me break it down." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState({});
  const scrollRef = useRef(null);
  const seedRef = useRef(null);

  // Pull a compact snapshot of the dashboard once, so answers are grounded.
  useEffect(() => {
    const grab = async (path) => {
      try { const r = await fetch(`${API_BASE}${path}`); return r.ok ? await r.json() : null; }
      catch { return null; }
    };
    Promise.all([grab('/api/kpis'), grab('/api/simulation'), grab('/api/risk?limit=8')])
      .then(([kpis, simulation, risk]) => setCtx({
        kpis,
        simulation_summary: simulation && {
          totals: simulation.totals,
          system_lift: simulation.C_vs_A_system_lift,
          forecast_lift: simulation.C_vs_B_forecast_lift,
        },
        top_risks: risk?.grid?.slice(0, 8),
      }));
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async (text, extraContext) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, context: { ...ctx, ...(extraContext || {}) } }),
      });
      const d = await res.json();
      setMessages(m => [...m, {
        role: 'assistant',
        text: d.response || 'No response.',
        offline: d.ai_available === false,
      }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: `Error reaching the assistant: ${e.message}`, offline: true }]);
    } finally {
      setBusy(false);
    }
  };

  // Auto-ask when opened from an "Explain" icon.
  useEffect(() => {
    if (seed && seed !== seedRef.current) {
      seedRef.current = seed;
      send(seed.question, { focus_element: seed.title, element_data: seed.data });
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 460, padding: 0, overflow: 'hidden' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={16} color="var(--blue-400)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>StockPilot Assistant</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Ask about anything on the dashboard</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <Cpu size={12} color="var(--blue-400)" /> xAI Grok
        </span>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: m.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(59,130,246,0.12)' }}>
              {m.role === 'user' ? <User size={14} color="var(--text-secondary)" /> : <Bot size={14} color="var(--blue-400)" />}
            </div>
            <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: 12,
              background: m.role === 'user' ? 'var(--blue-500)' : 'rgba(255,255,255,0.04)',
              color: m.role === 'user' ? '#fff' : 'var(--text-secondary)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              fontSize: 'var(--text-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {m.role === 'user' ? m.text : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({node, ...props}) => <div style={{overflowX: 'auto', margin: '12px 0'}}><table className="data-table" {...props} /></div>,
                    p: ({node, ...props}) => <p style={{margin: '0 0 10px 0'}} {...props} />
                  }}
                >
                  {m.text}
                </ReactMarkdown>
              )}
              {m.offline && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--warning)' }}>AI offline — add XAI_API_KEY to go live.</div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={14} color="var(--blue-400)" />
            </div>
            <div style={{ padding: '10px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Thinking…</div>
          </div>
        )}
      </div>

      {/* suggestions (only before the user has asked anything) */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 18px 12px' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} className="btn btn-ghost btn-sm" onClick={() => send(s)}
              style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12 }}>
              <Sparkles size={11} color="var(--blue-400)" /> {s}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--border-subtle)' }}>
        <input
          className="input-field"
          style={{ flex: 1 }}
          placeholder="Ask about the dashboard…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          disabled={busy}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={busy || !input.trim()}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Send size={14} /> Send
        </button>
      </div>
    </div>
  );
};

export default AssistantChat;
