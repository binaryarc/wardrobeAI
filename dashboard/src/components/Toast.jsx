import { useState, useEffect, useCallback } from 'react';

const STYLES = `
@keyframes toastIn {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(8px) scale(0.95); }
}
.toast-item { animation: toastIn 0.25s ease forwards; }
.toast-item.leaving { animation: toastOut 0.2s ease forwards; }
`;

const COLORS = {
  success: { bg: '#ffffff', border: '#d1fae5', icon: '✓', color: '#059669', textColor: '#064e3b' },
  error:   { bg: '#ffffff', border: '#fee2e2', icon: '✕', color: '#dc2626', textColor: '#7f1d1d' },
  info:    { bg: '#ffffff', border: '#e0e7ff', icon: 'ℹ', color: '#4f46e5', textColor: '#1e1b4b' },
};

let _push = null;
export function toast(message, type = 'info') {
  if (_push) _push(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type, leaving: false }]);
    setTimeout(() => {
      setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x));
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 220);
    }, 3500);
  }, []);

  useEffect(() => { _push = push; return () => { _push = null; }; }, [push]);

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
      }}>
        {toasts.map(({ id, message, type, leaving }) => {
          const c = COLORS[type] || COLORS.info;
          return (
            <div key={id} className={`toast-item${leaving ? ' leaving' : ''}`} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: c.bg, border: `2px solid ${c.border}`,
              borderRadius: 14, padding: '18px 24px', maxWidth: 460, minWidth: 280,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              fontFamily: 'system-ui, sans-serif',
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: c.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: c.color, fontWeight: 800, fontSize: 18,
              }}>{c.icon}</span>
              <span style={{ color: c.textColor, fontSize: 17, lineHeight: 1.5, fontWeight: 600 }}>{message}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
