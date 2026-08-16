import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorState = ({ message, onRetry }) => (
  <div
    className="glass-panel"
    style={{
      padding: '40px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 14,
      border: '1px solid rgba(244, 63, 94, 0.2)',
      background: 'rgba(244, 63, 94, 0.04)',
    }}
  >
    <div style={{
      width: 52, height: 52, borderRadius: '50%',
      background: 'rgba(244, 63, 94, 0.1)',
      border: '1px solid rgba(244, 63, 94, 0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <AlertTriangle size={22} color="var(--danger)" />
    </div>
    <div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 4, color: 'var(--danger)' }}>
        Connection Error
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 340 }}>
        {message || 'Failed to fetch data from the API.'}
      </div>
    </div>
    {onRetry && (
      <button
        className="btn btn-ghost btn-sm"
        onClick={onRetry}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <RefreshCw size={13} /> Retry
      </button>
    )}
  </div>
);

export default ErrorState;
