import { useState, useEffect, useCallback } from 'react';
import StatusCard from '../components/StatusCard.jsx';
import SchedulePicker from '../components/SchedulePicker.jsx';
import LogViewer from '../components/LogViewer.jsx';

export default function Dashboard() {
  const [status, setStatus] = useState({ lastRun: null, schedule: '', running: false });
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [scheduleEdit, setScheduleEdit] = useState('');
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    const [s, l] = await Promise.all([
      fetch('/api/status').then(r => r.json()),
      fetch('/api/logs').then(r => r.json()),
    ]);
    setStatus(s);
    setLogs(l);
    setScheduleEdit(prev => prev === '' ? (s.schedule || '0 8 * * *') : prev);
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);

  async function handleRun() {
    setRunning(true);
    try {
      await fetch('/api/run', { method: 'POST' });
      setTimeout(() => { refresh(); setRunning(false); }, 1000);
    } catch {
      setRunning(false);
    }
  }

  async function handleScheduleSave() {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: scheduleEdit }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>👗 wardrobeAI</h1>

      <StatusCard lastRun={status.lastRun} schedule={status.schedule} running={status.running} />

      <button
        onClick={handleRun}
        disabled={running || status.running}
        style={{
          marginTop: 20, width: '100%', padding: '14px 0',
          background: running || status.running ? '#e5e7eb' : '#6366f1',
          color: running || status.running ? '#9ca3af' : '#fff',
          border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: running || status.running ? 'not-allowed' : 'pointer',
        }}
      >
        {running || status.running ? '⏳ 추천 생성 중...' : '✨ 지금 추천받기'}
      </button>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>추천 스케줄</h2>
        <SchedulePicker schedule={scheduleEdit} onChange={setScheduleEdit} />
        <button
          onClick={handleScheduleSave}
          style={{ marginTop: 10, padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
        >
          {saved ? '✓ 저장됨' : '스케줄 저장'}
        </button>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>실행 로그</h2>
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
