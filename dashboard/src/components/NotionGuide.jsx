import { useState } from 'react';

export default function NotionGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.7)', cursor: 'pointer', fontSize: 13, padding: 0 }}
      >
        {open ? '▲ 가이드 닫기' : '▼ Integration Token 발급 방법'}
      </button>
      {open && (
        <ol style={{ fontSize: 13, lineHeight: 2, marginTop: 10, paddingLeft: 20, color: 'rgba(255,255,255,0.5)' }}>
          <li><strong style={{ color: 'rgba(255,255,255,0.75)' }}>notion.so</strong> → Settings &amp; members 클릭</li>
          <li>Connections → <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Develop or manage integrations</strong></li>
          <li><strong style={{ color: 'rgba(255,255,255,0.75)' }}>+ New integration</strong> → 이름 입력 → Submit</li>
          <li>Internal Integration Secret 복사 → 위 입력란 붙여넣기</li>
          <li>옷장 페이지 → ⋯ → <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Connections → wardrobeAI 연결</strong></li>
        </ol>
      )}
    </div>
  );
}
