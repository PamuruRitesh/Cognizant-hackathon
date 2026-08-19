import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { Cpu } from 'lucide-react';

// Small header pill: shows whether the xAI Grok agents are live right now.
const AgentStatus = () => {
  const [st, setSt] = useState({ available: false, model: '', reason: 'checking' });

  const check = () => {
    fetch(`${API_BASE}/api/agent-status`)
      .then(r => r.json())
      .then(setSt)
      .catch(() => setSt({ available: false, model: '', reason: 'API offline' }));
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, []);

  const on = st.available;
  return (
    <div
      title={on ? `xAI Grok live · model ${st.model}` : `AI offline: ${st.reason}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 11px', borderRadius: 999,
        border: `1px solid ${on ? 'rgba(2,195,154,0.4)' : 'var(--border-subtle)'}`,
        background: on ? 'rgba(2,195,154,0.08)' : 'rgba(120,120,120,0.08)',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      <Cpu size={13} color={on ? 'var(--success)' : 'var(--text-muted)'} />
      <span style={{ color: on ? 'var(--success)' : 'var(--text-muted)' }}>xAI Grok</span>
      <span
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: on ? 'var(--success)' : 'var(--text-muted)',
          boxShadow: on ? '0 0 8px var(--success)' : 'none',
        }}
      />
      <span style={{ color: 'var(--text-secondary)' }}>{on ? 'Live' : 'Offline'}</span>
    </div>
  );
};

export default AgentStatus;
