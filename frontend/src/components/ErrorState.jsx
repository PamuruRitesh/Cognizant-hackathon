const ErrorState = ({ message, onRetry }) => {
  return (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderColor: 'var(--danger-border)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
      <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Error Loading Data</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button className="glass-button" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
