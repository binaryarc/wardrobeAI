import { useState, useEffect, useCallback, useRef } from 'react';
import StatusCard from '../components/StatusCard.jsx';
import ScheduleDropdown from '../components/ScheduleDropdown.jsx';
import LogViewer from '../components/LogViewer.jsx';
import AiEngineChecker from '../components/AiEngineChecker.jsx';
import ToastContainer, { toast } from '../components/Toast.jsx';

const DASH_STYLES = `
  @keyframes db1 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(30px,20px) scale(1.15)} }
  @keyframes db2 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-20px,-30px) scale(1.2)} }
  @keyframes db3 { 0%{transform:translate(-50%,-50%) scale(0.9)} 100%{transform:translate(-50%,-50%) scale(1.25)} }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes progressPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
  .dash-section { margin-top: 28px; }
  .dash-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(167,139,250,0.7); margin-bottom: 12px;
  }
  .dash-glass {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 20px 22px; backdrop-filter: blur(12px);
  }
  .wardrobe-select {
    width: 100%; padding: 12px 16px;
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px; color: #f1f5f9; font-size: 15px;
    box-sizing: border-box; backdrop-filter: blur(8px);
    outline: none; appearance: none; cursor: pointer; transition: border-color 0.2s;
  }
  .wardrobe-select:focus { border-color: rgba(167,139,250,0.5); }
  .wardrobe-select option { background: #1e1b4b; color: #f1f5f9; }
  .progress-bar-track {
    background: rgba(255,255,255,0.08); border-radius: 99px; height: 6px; overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, #6366f1, #ec4899);
    transition: width 0.4s ease;
  }
`;

function ProgressPanel({ progress }) {
  if (!progress) return null;
  return (
    <div className="dash-glass" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#e2e8f0', animation: 'progressPulse 1.5s infinite' }}>
            {progress.message || '처리 중...'}
          </span>
          {progress.total > 0 && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {progress.processed}/{progress.total}
            </span>
          )}
        </div>
        {progress.total > 0 && (
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
        <span style={{ fontSize: 14 }}>⚠️</span>
        <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.85)' }}>추천 중에는 노션 옷장 페이지를 수정하지 마세요</span>
      </div>
    </div>
  );
}

export default function Dashboard({ onReset }) {
  const [status, setStatus] = useState({ lastRun: null, schedule: '', running: false });
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [scheduleEdit, setScheduleEdit] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const sseRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
      ]);
      setStatus(s);
      setLogs(l);
      setScheduleEdit(prev => prev === '' ? (s.schedule || '0 8 * * *') : prev);
      if (!s.running) { setRunning(false); setProgress(null); }
    } catch {}
  }, []);

  // SSE 연결
  useEffect(() => {
    const es = new EventSource('/api/stream');
    sseRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'init') {
        setRunning(data.running);
        if (data.progress) setProgress(data.progress);
      } else if (data.type === 'status') {
        setRunning(data.running);
        if (!data.running) { setProgress(null); refresh(); }
      } else if (data.type === 'progress') {
        setProgress(data);
      } else if (data.type === 'log') {
        setLogs(prev => [{ level: data.level, message: data.message, time: new Date().toISOString() }, ...prev].slice(0, 20));
        if (data.level === 'success') toast(data.message, 'success');
        if (data.level === 'error') toast(data.message, 'error');
      }
    };

    es.onerror = () => { es.close(); };
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleRun() {
    setRunning(true);
    setProgress({ step: 'start', message: '시작 중...' });
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      if (!res.ok) throw new Error('서버 오류');
      toast('추천 생성을 시작했습니다', 'info');
    } catch (e) {
      toast(e.message || '추천 실행 실패', 'error');
      setRunning(false);
      setProgress(null);
    }
  }

  async function handleScheduleSave() {
    setScheduleSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: scheduleEdit }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '저장 실패');
      toast('스케줄이 저장되었습니다', 'success');
      refresh();
    } catch (e) {
      toast(e.message || '스케줄 저장 실패', 'error');
    } finally {
      setScheduleSaving(false);
    }
  }

  const isRunning = running || status.running;

  return (
    <div style={{ minHeight: '100vh', background: '#03030a', position: 'relative', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      <style>{DASH_STYLES}</style>
      <ToastContainer />

      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'rgba(99,102,241,0.25)', filter: 'blur(90px)', top: '-120px', left: '-120px', animation: 'db1 7s ease-in-out infinite alternate' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(167,139,250,0.2)', filter: 'blur(80px)', bottom: '-80px', right: '-80px', animation: 'db2 6s ease-in-out infinite alternate' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'rgba(236,72,153,0.12)', filter: 'blur(70px)', top: '50%', left: '50%', animation: 'db3 8s ease-in-out infinite alternate' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>wardrobeAI</h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '4px 0 0' }}>오늘의 코디를 추천해드립니다</p>
          </div>
          <button onClick={onReset} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            재설정
          </button>
        </div>

        <StatusCard lastRun={status.lastRun} schedule={status.schedule} running={status.running} />

        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{
            marginTop: 20, width: '100%', padding: '18px 0',
            background: isRunning ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #ec4899)',
            color: isRunning ? 'rgba(255,255,255,0.4)' : '#fff',
            border: 'none', borderRadius: 14, fontSize: 17, fontWeight: 800,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            boxShadow: isRunning ? 'none' : '0 4px 32px rgba(99,102,241,0.4)',
            transition: 'all 0.2s', letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {isRunning
            ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />추천 생성 중...</>
            : '지금 추천받기'
          }
        </button>

        {/* 진행 상황 패널 */}
        {isRunning && <ProgressPanel progress={progress} />}

        <div className="dash-section">
          <p className="dash-label">추천 스케줄</p>
          <div className="dash-glass">
            <ScheduleDropdown value={scheduleEdit} onChange={setScheduleEdit} />
            <button
              onClick={handleScheduleSave}
              disabled={scheduleSaving}
              style={{ marginTop: 14, padding: '10px 22px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, color: '#c4b5fd', fontSize: 14, fontWeight: 700, cursor: scheduleSaving ? 'not-allowed' : 'pointer' }}
            >
              {scheduleSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        <div className="dash-section">
          <p className="dash-label">AI 엔진</p>
          <AiEngineChecker />
        </div>

        <div className="dash-section">
          <p className="dash-label">실행 로그</p>
          <div className="dash-glass">
            <LogViewer logs={logs} />
          </div>
        </div>

      </div>
    </div>
  );
}
