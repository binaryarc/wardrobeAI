export default function StatusCard({ lastRun, schedule, running }) {
  function formatTime(iso) {
    if (!iso) return '없음';
    return new Date(iso).toLocaleString('ko-KR');
  }
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', gap: 32, fontSize: 14 }}>
        <div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>마지막 추천</p>
          <p style={{ fontWeight: 600, margin: '4px 0 0' }}>{formatTime(lastRun)}</p>
        </div>
        <div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>스케줄</p>
          <p style={{ fontWeight: 600, margin: '4px 0 0', fontFamily: 'monospace' }}>{schedule || '미설정'}</p>
        </div>
        <div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>상태</p>
          <p style={{ fontWeight: 600, margin: '4px 0 0', color: running ? '#f59e0b' : '#10b981' }}>
            {running ? '⏳ 실행 중' : '✓ 대기'}
          </p>
        </div>
      </div>
    </div>
  );
}
