const levelColor = { success: '#34d399', error: '#f87171', info: '#a78bfa' };
const levelIcon  = { success: '✓', error: '✕', info: 'ℹ' };

export default function LogViewer({ logs }) {
  if (!logs.length) return (
    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, margin: 0 }}>아직 실행 기록이 없습니다</p>
  );
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {logs.map((log, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: levelColor[log.level] || '#94a3b8', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>
            {levelIcon[log.level] || '·'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{log.message}</p>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              {new Date(log.time).toLocaleTimeString('ko-KR')}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
