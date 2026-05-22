import { useState, useEffect } from 'react';

const ENGINES = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex CLI' },
];

function Dot({ status }) {
  const color = status === 'ok' ? '#34d399' : status === 'not_logged_in' ? '#fbbf24' : status === 'checking' ? '#94a3b8' : '#f87171';
  const label = status === 'ok' ? '연결됨' : status === 'not_logged_in' ? '로그인 필요' : status === 'checking' ? '확인 중' : '미설치';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block',
        boxShadow: status === 'ok' ? `0 0 6px ${color}` : 'none',
      }} />
      {label}
    </span>
  );
}

async function checkEngine(engine) {
  try {
    const res = await fetch(`/api/check-ai?engine=${engine}`);
    const data = await res.json();
    return data.ok ? { status: 'ok', version: data.version || '' } : { status: data.reason || 'not_installed', version: '' };
  } catch {
    return { status: 'not_installed', version: '' };
  }
}

export default function AiEngineChecker() {
  const [engines, setEngines] = useState({
    claude: { status: 'checking', version: '' },
    codex: { status: 'checking', version: '' },
  });

  async function refreshAll() {
    const [claude, codex] = await Promise.all([checkEngine('claude'), checkEngine('codex')]);
    setEngines({ claude, codex });
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {ENGINES.map(({ id, label }) => {
        const { status, version } = engines[id];
        return (
          <div key={id} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.05)', borderRadius: 10,
            border: `1px solid ${status === 'ok' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)'}`,
            padding: '12px 14px',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{label}</div>
              {version && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'monospace' }}>{version}</div>}
            </div>
            <Dot status={status} />
          </div>
        );
      })}
    </div>
  );
}
