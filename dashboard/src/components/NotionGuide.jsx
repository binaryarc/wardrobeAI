import { useState } from 'react';

export default function NotionGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13, padding: 0 }}
      >
        {open ? '▲ 가이드 닫기' : '▼ 노션 Integration Token 발급 방법'}
      </button>
      {open && (
        <ol style={{ fontSize: 13, lineHeight: 2, marginTop: 8, paddingLeft: 20, color: '#374151' }}>
          <li><strong>notion.so</strong>에 로그인 후 <strong>Settings &amp; members</strong> 클릭</li>
          <li>왼쪽 메뉴에서 <strong>Connections → Develop or manage integrations</strong> 클릭</li>
          <li><strong>+ New integration</strong> 버튼 클릭</li>
          <li>이름 입력 (예: wardrobeAI), <strong>Submit</strong></li>
          <li>생성된 페이지에서 <strong>Internal Integration Secret</strong> 복사 → 위 입력란에 붙여넣기</li>
          <li>옷장 노션 페이지로 이동 → 우상단 <strong>⋯ → Connections → wardrobeAI 연결</strong></li>
        </ol>
      )}
    </div>
  );
}
