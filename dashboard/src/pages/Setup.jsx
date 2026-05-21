import { useState } from 'react';
import NotionGuide from '../components/NotionGuide.jsx';

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#374151' };
const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const errorStyle = { color: '#ef4444', fontSize: 13, marginTop: 4 };

export default function Setup({ onComplete }) {
  const [form, setForm] = useState({
    notionToken: '', wardrobePageId: '', city: '',
    preferredStyles: '', excludeItems: '',
    aiEngine: 'claude', schedule: '0 8 * * *',
  });
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

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
          notionToken: form.notionToken,
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

  return (
    <div style={{ maxWidth: 540, margin: '60px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>👗 wardrobeAI 설정</h1>
      <p style={{ color: '#6b7280', marginBottom: 32, fontSize: 14 }}>
        아래 정보를 입력하면 매일 자동으로 코디를 추천해드립니다.
      </p>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={labelStyle}>노션 Integration Token *</label>
          <input style={inputStyle} type="password" placeholder="secret_xxxx..." value={form.notionToken} onChange={e => set('notionToken', e.target.value)} />
          <NotionGuide />
        </div>
        <div>
          <label style={labelStyle}>옷장 노션 페이지 URL 또는 ID *</label>
          <input style={inputStyle} placeholder="https://notion.so/..." value={form.wardrobePageId} onChange={e => set('wardrobePageId', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>도시명 (날씨용) *</label>
          <input style={inputStyle} placeholder="Seoul" value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>선호 스타일 (쉼표 구분)</label>
          <input style={inputStyle} placeholder="미니멀, 캐주얼" value={form.preferredStyles} onChange={e => set('preferredStyles', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>제외할 아이템 (쉼표 구분)</label>
          <input style={inputStyle} placeholder="빨간 후드" value={form.excludeItems} onChange={e => set('excludeItems', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>AI 엔진</label>
          <select style={inputStyle} value={form.aiEngine} onChange={e => set('aiEngine', e.target.value)}>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex CLI</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>추천 스케줄 (cron)</label>
          <input style={inputStyle} placeholder="0 8 * * *" value={form.schedule} onChange={e => set('schedule', e.target.value)} />
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>매일 오전 8시: <code>0 8 * * *</code> / 매일 오전 7시 30분: <code>30 7 * * *</code></p>
        </div>
        {error && <p style={errorStyle}>{error}</p>}
        <button
          type="submit"
          disabled={testing}
          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 15, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer' }}
        >
          {testing ? '저장 중...' : '저장하고 시작하기'}
        </button>
      </form>
    </div>
  );
}
