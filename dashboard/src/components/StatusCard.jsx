function cronToHuman(cron) {
  if (!cron) return '미설정';
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, , , dow] = parts;
  const h = parseInt(hour, 10);
  const m = parseInt(min, 10);
  if (isNaN(h) || isNaN(m)) return cron;
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const minStr = m === 0 ? '' : ` ${m}분`;
  const dayStr = dow === '1-5' ? '평일' : '매일';
  return `${dayStr} ${ampm} ${h12}시${minStr}`;
}

function formatTime(iso) {
  if (!iso) return '없음';
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StatusCard({ lastRun, schedule, running }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
    }}>
      {[
        { label: '마지막 추천', value: formatTime(lastRun) },
        { label: '다음 추천', value: cronToHuman(schedule) },
        { label: '상태', value: running ? '실행 중' : '대기 중', color: running ? '#fbbf24' : '#34d399' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)', padding: '16px 18px',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
          <p style={{ fontWeight: 700, margin: '6px 0 0', fontSize: 14, color: color || '#f1f5f9' }}>{value}</p>
        </div>
      ))}
    </div>
  );
}
