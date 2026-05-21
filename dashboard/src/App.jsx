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

  if (configured === null) return <div style={{ padding: 40 }}>로딩 중...</div>;
  if (!configured) return <Setup onComplete={() => setConfigured(true)} />;
  return <Dashboard />;
}
