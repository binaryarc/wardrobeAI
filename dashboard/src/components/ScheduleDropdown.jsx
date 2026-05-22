const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function parseCron(cron) {
  const parts = cron.split(' ');
  if (parts.length !== 5) return { hour: 8, minute: 0 };
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  return {
    hour: isNaN(hour) ? 8 : hour,
    minute: MINUTES.includes(minute) ? minute : 0,
  };
}

function toCron(hour, minute) {
  return `${minute} ${hour} * * *`;
}

function pad(n) { return String(n).padStart(2, '0'); }

export default function ScheduleDropdown({ value, onChange }) {
  const { hour, minute } = parseCron(value);

  function handleHour(e) { onChange(toCron(Number(e.target.value), minute)); }
  function handleMinute(e) { onChange(toCron(hour, Number(e.target.value))); }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <select className="wardrobe-select" value={hour} onChange={handleHour}>
          {HOURS.map(h => (
            <option key={h} value={h}>{pad(h)}시</option>
          ))}
        </select>
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>▾</span>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <select className="wardrobe-select" value={minute} onChange={handleMinute}>
          {MINUTES.map(m => (
            <option key={m} value={m}>{pad(m)}분</option>
          ))}
        </select>
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>▾</span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, whiteSpace: 'nowrap' }}>
        매일 {pad(hour)}:{pad(minute)}
      </span>
    </div>
  );
}
