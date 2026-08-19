const EmptyState = ({ title, message, icon }) => (
  <div
    className="glass-panel"
    style={{
      padding: '60px 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 14,
      opacity: 0.7,
    }}
  >
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: 'rgba(96,165,250,0.08)',
      border: '1px solid rgba(96,165,250,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {typeof icon === 'string' ? (
        <span style={{ fontSize: '1.8rem' }}>{icon}</span>
      ) : (
        icon
      )}
    </div>
    <div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: 300 }}>{message}</div>
    </div>
  </div>
);

export default EmptyState;
