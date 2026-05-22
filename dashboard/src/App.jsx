import { useState, useEffect } from 'react';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [configured, setConfigured] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  function handleReset() {
    setConfigured(false);
  }

  if (configured === null) return (
    <div style={{ minHeight: '100vh', background: '#03030a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui' }}>
      로딩 중...
    </div>
  );
  if (!configured) return <Setup onComplete={() => setConfigured(true)} />;
  return <Dashboard onReset={handleReset} />;
}
