const EmptyState = ({ title, message, icon }) => {
  return (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', opacity: 0.8 }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>{icon || '📭'}</div>
      <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>{title || 'No Data Found'}</h3>
      <p style={{ color: 'var(--text-muted)' }}>{message || 'There is currently no data to display here.'}</p>
    </div>
  );
};

export default EmptyState;
