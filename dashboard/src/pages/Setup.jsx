import { useState, useEffect } from 'react';
import NotionGuide from '../components/NotionGuide.jsx';
import ScheduleDropdown from '../components/ScheduleDropdown.jsx';
import AiEngineChecker from '../components/AiEngineChecker.jsx';

const styles = `
  @keyframes blob1Move {
    0%   { transform: translate(0, 0) scale(1); }
    100% { transform: translate(40px, 30px) scale(1.2); }
  }
  @keyframes blob2Move {
    0%   { transform: translate(0, 0) scale(1); }
    100% { transform: translate(-30px, -40px) scale(1.25); }
  }
  @keyframes blob3Move {
    0%   { transform: translate(-50%, -50%) scale(0.85); }
    100% { transform: translate(-50%, -50%) scale(1.35); }
  }
  @keyframes blob4Move {
    0%   { transform: translate(0, 0) scale(1); }
    100% { transform: translate(20px, -30px) scale(1.15); }
  }
  .wardrobe-input {
    width: 100%;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: #f1f5f9;
    font-size: 16px;
    box-sizing: border-box;
    backdrop-filter: blur(12px);
    transition: border-color 0.2s, background 0.2s;
    outline: none;
  }
  .wardrobe-input::placeholder { color: rgba(255,255,255,0.3); }
  .wardrobe-input:focus {
    border-color: rgba(167, 139, 250, 0.6);
    background: rgba(255, 255, 255, 0.1);
  }
  .wardrobe-select {
    width: 100%;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: #f1f5f9;
    font-size: 16px;
    box-sizing: border-box;
    backdrop-filter: blur(12px);
    outline: none;
    appearance: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .wardrobe-select:focus { border-color: rgba(167, 139, 250, 0.6); }
  .wardrobe-select option { background: #1e1b4b; color: #f1f5f9; }
`;

export default function Setup({ onComplete }) {
  const [form, setForm] = useState({
    notionToken: '', wardrobePageId: '', city: '',
    preferredStyles: '', excludeItems: '',
    aiEngine: 'claude', schedule: '0 8 * * *',
  });
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        setForm(f => ({
          ...f,
          notionToken: cfg.notionToken === '***' ? '***' : (cfg.notionToken || ''),
          wardrobePageId: cfg.wardrobePageId || '',
          city: cfg.city || '',
          preferredStyles: Array.isArray(cfg.preferredStyles) ? cfg.preferredStyles.join(', ') : '',
          excludeItems: Array.isArray(cfg.excludeItems) ? cfg.excludeItems.join(', ') : '',
          aiEngine: cfg.aiEngine || 'claude',
          schedule: cfg.schedule || '0 8 * * *',
        }));
      })
      .catch(() => {});
  }, []);

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  function pageIdFromUrl(val) {
    const match = val.match(/([a-f0-9]{32})|([a-f0-9-]{36})/i);
    return match ? match[0].replace(/-/g, '') : val;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.notionToken || !form.wardrobePageId || !form.city) {
      setError('노션 토큰, 페이지 URL, 도시명은 필수입니다.');
      return;
    }
    setTesting(true);
    setError('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form.notionToken ? { notionToken: form.notionToken } : {}),
          wardrobePageId: pageIdFromUrl(form.wardrobePageId),
          city: form.city,
          preferredStyles: form.preferredStyles.split(',').map(s => s.trim()).filter(Boolean),
          excludeItems: form.excludeItems.split(',').map(s => s.trim()).filter(Boolean),
          aiEngine: form.aiEngine,
          schedule: form.schedule,
          outputPageId: null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '저장 실패');
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  const labelStyle = {
    display: 'block', fontSize: 13, fontWeight: 600,
    marginBottom: 8, color: 'rgba(167,139,250,0.9)', letterSpacing: '0.04em', textTransform: 'uppercase',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#03030a', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{styles}</style>

      {/* Liquid gradient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'rgba(99,102,241,0.35)', filter: 'blur(80px)',
          top: '-150px', left: '-150px',
          animation: 'blob1Move 7s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(167,139,250,0.3)', filter: 'blur(80px)',
          bottom: '-100px', right: '-100px',
          animation: 'blob2Move 6s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(236,72,153,0.18)', filter: 'blur(70px)',
          top: '50%', left: '50%',
          animation: 'blob3Move 8s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(79,70,229,0.25)', filter: 'blur(60px)',
          top: '20%', right: '20%',
          animation: 'blob4Move 5s ease-in-out infinite alternate',
        }} />
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 560,
        margin: '40px 20px',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '44px 48px',
        boxShadow: '0 8px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
            wardrobeAI 설정
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 14 }}>
            노션 옷장을 연결하면 매일 코디를 추천해드립니다
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <label style={labelStyle}>노션 Integration Token *</label>
            <input
              className="wardrobe-input"
              type="password"
              placeholder="secret_xxxx..."
              value={form.notionToken}
              onFocus={e => { if (form.notionToken === '***') set('notionToken', ''); }}
              onChange={e => set('notionToken', e.target.value)}
            />
            <NotionGuide />
          </div>
          <div>
            <label style={labelStyle}>옷장 노션 페이지 URL *</label>
            <input className="wardrobe-input" placeholder="https://notion.so/..." value={form.wardrobePageId} onChange={e => set('wardrobePageId', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>도시명 (날씨용) *</label>
            <input className="wardrobe-input" placeholder="Seoul" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>선호 스타일</label>
            <input className="wardrobe-input" placeholder="미니멀, 캐주얼" value={form.preferredStyles} onChange={e => set('preferredStyles', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>제외할 아이템</label>
            <input className="wardrobe-input" placeholder="빨간 후드" value={form.excludeItems} onChange={e => set('excludeItems', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>추천 스케줄</label>
            <ScheduleDropdown value={form.schedule} onChange={v => set('schedule', v)} />
          </div>

          <div>
            <label style={labelStyle}>AI 엔진</label>
            <AiEngineChecker />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={testing}
            style={{
              marginTop: 4, padding: '16px 0', borderRadius: 12, border: 'none',
              background: testing ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #ec4899)',
              color: '#fff', fontSize: 17, fontWeight: 700, cursor: testing ? 'not-allowed' : 'pointer',
              boxShadow: testing ? 'none' : '0 4px 24px rgba(99,102,241,0.4)',
              transition: 'opacity 0.2s, box-shadow 0.2s',
            }}
          >
            {testing ? '저장 중...' : '저장하고 시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
