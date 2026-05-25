import { useState, useEffect } from 'react';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [configured, setConfigured] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  function handleReset() {
    setEditing(true);
    setConfigured(false);
  }

  if (configured === null) return (
    <div style={{ minHeight: '100vh', background: '#03030a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui' }}>
      로딩 중...
    </div>
  );
  if (!configured) return (
    <Setup
      onComplete={() => { setEditing(false); setConfigured(true); }}
      onCancel={editing ? () => { setEditing(false); setConfigured(true); } : null}
    />
  );
  return <Dashboard onReset={handleReset} />;
}
