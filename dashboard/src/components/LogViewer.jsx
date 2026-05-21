const levelColor = { success: '#10b981', error: '#ef4444', info: '#6366f1' };

export default function LogViewer({ logs }) {
  if (!logs.length) return <p style={{ color: '#9ca3af', fontSize: 13 }}>로그 없음</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {logs.map((log, i) => (
        <li key={i} style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(log.time).toLocaleTimeString('ko-KR')}</span>
          <span style={{ color: levelColor[log.level] || '#374151' }}>{log.message}</span>
        </li>
      ))}
    </ul>
  );
}
