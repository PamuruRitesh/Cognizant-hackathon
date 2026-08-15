const SkeletonLoader = ({ type, count = 1 }) => {
  const renderSkeletons = () => {
    switch (type) {
      case 'kpi':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="glass-panel" style={{ padding: '24px', height: '140px' }}>
                <div className="skeleton-pulse" style={{ width: '40%', height: '14px', marginBottom: '16px', borderRadius: '4px' }}></div>
                <div className="skeleton-pulse" style={{ width: '60%', height: '10px', marginBottom: '24px', borderRadius: '4px' }}></div>
                <div className="skeleton-pulse" style={{ width: '80%', height: '36px', borderRadius: '4px' }}></div>
              </div>
            ))}
          </div>
        );
      case 'table':
        return (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="skeleton-pulse" style={{ width: '200px', height: '18px', marginBottom: '24px', borderRadius: '4px' }}></div>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                <div className="skeleton-pulse" style={{ flex: 1, height: '14px', borderRadius: '4px' }}></div>
                <div className="skeleton-pulse" style={{ flex: 1, height: '14px', borderRadius: '4px' }}></div>
                <div className="skeleton-pulse" style={{ flex: 1, height: '14px', borderRadius: '4px' }}></div>
                <div className="skeleton-pulse" style={{ flex: 1, height: '14px', borderRadius: '4px' }}></div>
              </div>
            ))}
          </div>
        );
      case 'chart':
        return (
          <div className="glass-panel" style={{ padding: '24px', height: '500px', display: 'flex', flexDirection: 'column' }}>
            <div className="skeleton-pulse" style={{ width: '250px', height: '24px', marginBottom: '32px', borderRadius: '4px' }}></div>
            <div className="skeleton-pulse" style={{ flex: 1, width: '100%', borderRadius: '8px' }}></div>
          </div>
        );
      case 'list':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="skeleton-pulse" style={{ width: '40%', height: '20px', marginBottom: '12px', borderRadius: '4px' }}></div>
                  <div className="skeleton-pulse" style={{ width: '60%', height: '12px', marginBottom: '8px', borderRadius: '4px' }}></div>
                  <div className="skeleton-pulse" style={{ width: '80%', height: '12px', borderRadius: '4px' }}></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="skeleton-pulse" style={{ width: '80px', height: '36px', borderRadius: '8px' }}></div>
                  <div className="skeleton-pulse" style={{ width: '80px', height: '36px', borderRadius: '8px' }}></div>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return <div className="skeleton-pulse" style={{ width: '100%', height: '100px', borderRadius: '8px' }}></div>;
    }
  };

  return <>{renderSkeletons()}</>;
};

export default SkeletonLoader;
