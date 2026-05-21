import { useState } from 'react';

const PRESETS = [
  { label: '매일 오전 7시', cron: '0 7 * * *' },
  { label: '매일 오전 8시', cron: '0 8 * * *' },
  { label: '매일 오전 9시', cron: '0 9 * * *' },
  { label: '직접 입력', cron: 'custom' },
];

export default function SchedulePicker({ schedule, onChange }) {
  const [custom, setCustom] = useState('');
  const isPreset = PRESETS.some(p => p.cron === schedule);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESETS.map(p => (
          <button
            key={p.cron}
            type="button"
            onClick={() => p.cron === 'custom' ? onChange('') : onChange(p.cron)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              background: schedule === p.cron ? '#6366f1' : '#f3f4f6',
              color: schedule === p.cron ? '#fff' : '#374151',
              border: 'none',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {!isPreset && (
        <input
          style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
          placeholder="cron 표현식 (예: 0 8 * * *)"
          value={custom || schedule}
          onChange={e => { setCustom(e.target.value); onChange(e.target.value); }}
        />
      )}
    </div>
  );
}
