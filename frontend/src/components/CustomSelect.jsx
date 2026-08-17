import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        className="input-field"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', paddingLeft: 36, paddingRight: 12,
          border: isOpen ? '1px solid var(--blue-400)' : '1px solid var(--border-subtle)',
          background: isOpen ? 'rgba(5, 12, 26, 0.8)' : 'rgba(5, 12, 26, 0.4)',
          transition: 'all 0.2s ease',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div className="animate-fade-up" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
          maxHeight: 280, overflowY: 'auto', zIndex: 1000, padding: '6px 0',
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg), 0 10px 40px rgba(0,0,0,0.8)',
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              className="alert-item"
              style={{
                padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                background: value === opt.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                borderLeft: value === opt.value ? '2px solid var(--blue-400)' : '2px solid transparent',
              }}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
              {value === opt.value && <Check size={14} color="var(--blue-400)" style={{ flexShrink: 0, marginLeft: 8 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
