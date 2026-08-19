const SkeletonLoader = ({ type, count = 1 }) => {
  switch (type) {

    case 'kpi':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="glass-panel" style={{ padding: 20, height: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <div className="skeleton-pulse" style={{ width: 60, height: 16, borderRadius: 4, marginTop: 4 }} />
              </div>
              <div className="skeleton-pulse" style={{ width: '70%', height: 28, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-pulse" style={{ width: '50%', height: 13, borderRadius: 4, marginBottom: 5 }} />
              <div className="skeleton-pulse" style={{ width: '80%', height: 11, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      );

    case 'table':
      return (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="skeleton-pulse" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <div>
              <div className="skeleton-pulse" style={{ width: 120, height: 14, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-pulse" style={{ width: 180, height: 11, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ padding: '12px 22px' }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: i < count - 1 ? '1px solid rgba(96,165,250,0.05)' : 'none' }}>
                <div className="skeleton-pulse" style={{ flex: 1, height: 13, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ flex: 1, height: 13, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ flex: 1.5, height: 13, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ width: 48, height: 20, borderRadius: 12 }} />
                <div className="skeleton-pulse" style={{ width: 50, height: 13, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ width: 40, height: 24, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'chart':
      return (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="skeleton-pulse" style={{ width: 160, height: 14, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-pulse" style={{ width: 240, height: 11, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton-pulse" style={{ width: 80, height: 22, borderRadius: 12 }} />
              <div className="skeleton-pulse" style={{ width: 80, height: 22, borderRadius: 12 }} />
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <div className="skeleton-pulse" style={{ width: '100%', height: 320, borderRadius: 10 }} />
          </div>
        </div>
      );

    case 'list':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex' }}>
                <div className="skeleton-pulse" style={{ width: 4 }} />
                <div style={{ flex: 1, padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div className="skeleton-pulse" style={{ width: 18, height: 18, borderRadius: 4 }} />
                      <div className="skeleton-pulse" style={{ width: 140, height: 15, borderRadius: 4 }} />
                      <div className="skeleton-pulse" style={{ width: 50, height: 20, borderRadius: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div className="skeleton-pulse" style={{ width: 72, height: 32, borderRadius: 6 }} />
                      <div className="skeleton-pulse" style={{ width: 80, height: 32, borderRadius: 6 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div>
                      <div className="skeleton-pulse" style={{ width: 80, height: 10, borderRadius: 4, marginBottom: 6 }} />
                      <div className="skeleton-pulse" style={{ width: 60, height: 26, borderRadius: 4 }} />
                    </div>
                    <div>
                      <div className="skeleton-pulse" style={{ width: 80, height: 10, borderRadius: 4, marginBottom: 6 }} />
                      <div className="skeleton-pulse" style={{ width: 60, height: 26, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 14, height: 58, borderRadius: 8 }} className="skeleton-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    default:
      return <div className="skeleton-pulse" style={{ width: '100%', height: 80, borderRadius: 8 }} />;
  }
};

export default SkeletonLoader;
