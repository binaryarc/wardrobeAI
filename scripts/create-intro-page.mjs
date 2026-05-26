#!/usr/bin/env node
// wardrobeAI 공개용 제품 소개 / 사용 가이드 페이지를 노션에 생성합니다.
// config.json의 토큰·wardrobePageId를 인증·부모로만 사용하며, 본문에는 개인정보를 넣지 않습니다.
// 생성 후 페이지 URL을 출력합니다. 공개(Share to web)와 위치 이동은 노션 UI에서 직접 하세요.
//
// 토스 블로그(노션 페이지 스타일)를 참고한 랜딩페이지형 구성:
//   표지 후킹 → 문제 제시 → 솔루션(3컬럼) → 작동 방식 → 사용 가이드 → CTA → FAQ → 태그
//
// 노션 API 제약: append children 요청은 column_list만 중첩 children을 허용(2단계).
//   column_list.children[].column.children[] 형태로 SDK 스키마에 맞춰야 함.
//
// 사용: node scripts/create-intro-page.mjs

import { Client } from '@notionhq/client';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../server/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const config = loadConfig();
if (!config.notionToken || !config.wardrobePageId) {
  console.error('config.json에 notionToken과 wardrobePageId가 필요합니다.');
  process.exit(1);
}

const notion = new Client({ auth: config.notionToken });

function rt(content) {
  return [{ type: 'text', text: { content } }];
}
function heading1(text) {
  return { type: 'heading_1', heading_1: { rich_text: rt(text) } };
}
function heading2(text) {
  return { type: 'heading_2', heading_2: { rich_text: rt(text) } };
}
function heading3(text) {
  return { type: 'heading_3', heading_3: { rich_text: rt(text) } };
}
function paragraph(text) {
  return { type: 'paragraph', paragraph: { rich_text: rt(text) } };
}
function bullet(text) {
  return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(text) } };
}
function numbered(text) {
  return { type: 'numbered_list_item', numbered_list_item: { rich_text: rt(text) } };
}
function quote(text) {
  return { type: 'quote', quote: { rich_text: rt(text) } };
}
function divider() {
  return { type: 'divider', divider: {} };
}
function callout(text, emoji, color = 'gray_background') {
  return {
    type: 'callout',
    callout: { rich_text: rt(text), icon: { type: 'emoji', emoji }, color },
  };
}
function codeBlock(content, language = 'bash') {
  return { type: 'code', code: { rich_text: rt(content), language } };
}
// 스크린샷 자리: file(로컬 png)이 있으면 업로드해 이미지 블록, 없으면 안내 콜아웃.
// 업로드가 비동기라 여기선 플레이스홀더만 남기고, append 직전에 resolveBlocks가 변환한다.
function screenshot(label, file = null) {
  return { _screenshot: { label, file } };
}

// 로컬 파일을 노션 file_upload API로 업로드하고 file_upload ID 반환 (writer.js 패턴)
async function uploadLocalImage(filePath) {
  const buf = readFileSync(filePath);
  const ext = filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg') ? 'jpg'
    : filePath.toLowerCase().endsWith('.webp') ? 'webp' : 'png';
  const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';

  const initRes = await fetch('https://api.notion.com/v1/file_uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: `screenshot.${ext}`, content_type: contentType }),
  });
  if (!initRes.ok) throw new Error(`file_upload init 실패: ${initRes.status}`);
  const { id: fileUploadId, upload_url: uploadUrl } = await initRes.json();

  const formData = new FormData();
  formData.append('file', new Blob([buf], { type: contentType }), `screenshot.${ext}`);
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.notionToken}`, 'Notion-Version': '2022-06-28' },
    body: formData,
  });
  if (!uploadRes.ok) throw new Error(`file_upload 업로드 실패: ${uploadRes.status}`);
  return fileUploadId;
}

// 블록 배열의 _screenshot 플레이스홀더를 실제 블록으로 변환
async function resolveBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (!b._screenshot) { out.push(b); continue; }
    const { label, file } = b._screenshot;
    const path = file ? join(ROOT, file) : null;
    if (path && existsSync(path)) {
      const id = await uploadLocalImage(path);
      out.push({ type: 'image', image: { type: 'file_upload', file_upload: { id }, caption: rt(label) } });
    } else {
      out.push(callout(`여기에 «${label}» 스크린샷을 넣어주세요`, '📸', 'yellow_background'));
    }
  }
  return out;
}

// ── 도입부: 표지 후킹 → 문제 제시 → 솔루션 헤딩 (컬럼 직전까지) ───────────
const mainBlocks = [
  // 표지 후킹 (랜딩 히어로)
  heading1('오늘 뭐 입지? 옷장이 매일 답해드립니다.'),
  callout(
    'wardrobeAI — 날씨와 취향에 맞는 오늘의 코디를, 당신의 노션 옷장에서.',
    '👕',
    'blue_background',
  ),
  quote('설치 한 줄, 노션 연결, 끝. 옷장 사진만 올려두면 매일 입을 옷을 골라드립니다.'),
  divider(),

  // 문제 제시 (토스식: 공감되는 문제부터)
  heading2('이런 고민, 매일 하고 계신가요?'),
  callout('옷장은 가득한데 매일 아침 "입을 게 없다"는 느낌', '🌀', 'gray_background'),
  callout('날씨를 깜빡하고 나갔다가 춥거나 더웠던 경험', '🌦', 'gray_background'),
  callout('가진 옷이 뭐가 있는지조차 한눈에 안 들어옴', '🤔', 'gray_background'),
  paragraph('wardrobeAI는 이 세 가지를 한 번에 해결합니다. 옷장 사진을 노션에 올려두기만 하면, 매일 날씨와 취향에 맞는 코디를 골라 노션에 정리해드립니다.'),
  divider(),

  // 솔루션 헤딩 (3컬럼은 아래에서 별도 삽입)
  heading2('wardrobeAI는 이렇게 해결합니다'),
];

// 컬럼 이후로 이어지는 본문 (역시 2단계 이내)
const restBlocks = [
  divider(),

  // 작동 방식 — 한눈에 보는 흐름 (토스식 넘버링)
  heading2('어떻게 작동하나요?'),
  numbered('옷장 사진을 노션 페이지에 올립니다'),
  numbered('wardrobeAI가 사진을 분석하고 오늘 날씨를 확인합니다'),
  numbered('취향에 맞는 코디 세트를 골라냅니다'),
  numbered('추천 결과를 다시 노션 페이지에 정리해드립니다'),
  callout('필요한 건 단 한 줄. 매일 아침 자동으로 받아볼 수도 있습니다.', '⚡', 'yellow_background'),
  divider(),

  // CTA — 지금 시작하기 (토스식 행동 유도)
  heading2('🚀 지금 바로 시작하기'),
  paragraph('Node.js 18 이상이 설치돼 있다면, 터미널에 아래 한 줄이면 됩니다.'),
  codeBlock('npx wardrobeai'),
  callout('명령을 실행하면 로컬 서버가 뜨고 브라우저가 자동으로 열립니다(기본 포트 3847). 설정이 비어 있으면 Setup 화면이, 이미 설정돼 있으면 Dashboard가 보입니다. 종료는 터미널에서 Ctrl+C.', '💻', 'gray_background'),
  screenshot('npx wardrobeai 실행 직후 — 설정(Setup) 화면', 'wardrobe-setup.png'),
  divider(),

  // 사용 가이드 안내
  heading2('📖 처음이라면, 4단계만 따라오세요'),
  paragraph('아래 순서대로 한 번만 설정하면, 그다음부터는 버튼 한 번이면 끝납니다.'),

  // STEP 1
  heading2('1️⃣ 노션 준비'),
  heading3('Integration 토큰 발급'),
  numbered('notion.so → 우측 상단 Settings & members'),
  numbered('좌측 Connections → Develop or manage integrations'),
  numbered('+ New integration → 이름 입력(예: wardrobeAI) → Submit'),
  numbered('Internal Integration Secret 값을 복사 (이후 토큰으로 사용)'),
  paragraph('wardrobeAI 설정 화면에서도 같은 절차를 바로 안내받을 수 있습니다.'),
  screenshot('Integration Token 발급 방법 안내 (wardrobeAI 설정 화면)', 'wardrobe-setup-guide.png'),
  heading3('옷장 페이지 만들고 연결하기'),
  numbered('노션에 옷장으로 쓸 빈 페이지를 하나 만듭니다 (예: 내 옷장)'),
  numbered('페이지 우측 상단 ⋯ → Connections → 방금 만든 Integration 추가'),
  numbered('옷 사진을 업로드합니다. 드래그&드롭하면 image 블록이 되고, 컬럼으로 정렬해도 인식됩니다'),
  numbered('페이지 URL 끝의 32자리 hex가 옷장 페이지 ID입니다 (URL 전체를 붙여넣어도 ID만 추출됩니다)'),
  screenshot('옷장 페이지에 사진 업로드 + Connections 연결 화면'),
  callout('이미지 아래 캡션을 직접 적으면 AI 분석을 건너뛰고 그 텍스트를 그대로 씁니다. 예: 화이트 오버핏 셔츠 · 상의 · 미니멀 (이름 · 카테고리 · 스타일). 비워두면 AI가 자동으로 채워줍니다.', '💡', 'gray_background'),
  divider(),

  // STEP 2
  heading2('2️⃣ AI CLI 로그인'),
  paragraph('추천에는 Claude Code 또는 Codex CLI가 필요합니다. 둘 중 하나만 있으면 됩니다.'),
  heading3('Claude Code (권장)'),
  codeBlock('npm install -g @anthropic-ai/claude-code\nclaude   # 첫 실행 시 브라우저로 로그인'),
  heading3('Codex CLI'),
  codeBlock('npm install -g @openai/codex\ncodex    # 첫 실행 시 OpenAI 계정 로그인'),
  paragraph('대시보드의 "AI 엔진 체크" 버튼으로 설치/로그인 여부를 점검할 수 있습니다.'),
  divider(),

  // STEP 3
  heading2('3️⃣ 대시보드에서 설정'),
  paragraph('Setup 화면에서 아래 항목을 입력하고 저장합니다.'),
  bullet('Notion Integration Token — 위에서 복사한 secret'),
  bullet('옷장 페이지 URL/ID — 옷장 페이지 URL'),
  bullet('도시 — 날씨 조회용 (예: Seoul, 서울)'),
  bullet('선호 스타일 — 쉼표로 구분 (예: 미니멀, 캐주얼, 스트릿)'),
  bullet('제외 아이템 — 추천에서 빼고 싶은 옷 이름'),
  bullet('AI 엔진 — claude 또는 codex'),
  bullet('스케줄 — cron 표현식. 기본 0 8 * * * = 매일 오전 8시'),
  callout('저장하면 설정은 여러분 컴퓨터의 홈 디렉터리(~/.wardrobeai/config.json)에만 기록됩니다.', '💾', 'gray_background'),
  screenshot('Setup 설정 입력 화면'),
  divider(),

  // STEP 4
  heading2('4️⃣ 추천 받기'),
  paragraph('설정을 마치면 대시보드가 나타납니다. 받고 싶은 코디 개수를 고르고 "지금 추천받기"를 누르세요.'),
  screenshot('대시보드 — 코디 개수 선택 & 지금 추천받기', 'wardrobe-dashboard.png'),
  paragraph('버튼을 누르면 실시간 진행 상황이 표시됩니다.'),
  codeBlock(
    '[wardrobe] 옷장 불러오는 중...\n[analyze]  이미지 분석 중 (3/10)\n[weather]  날씨 확인 완료 — 구름 조금 17°C\n[prompt]   옷 10개 분석 완료, AI 추천 생성 중...\n[writing]  추천 3세트 노션에 작성 중...\n[done]     완료 — 코디 3세트',
    'plain text',
  ),
  paragraph('완료되면 옷장 페이지 하위에 새 페이지가 생성됩니다. 각 코디별로 날씨·아이템·추천 이유 카드와 아이템 이미지가 함께 정리됩니다. 스케줄을 설정해두면 백그라운드에서 매일 자동으로 같은 작업을 돌립니다.'),
  screenshot('추천 결과가 노션에 작성된 화면'),
  divider(),

  // FAQ — Q/A 콜아웃 카드
  heading2('❓ 자주 묻는 질문'),
  callout('Q. 추천 결과가 매번 비슷해요.\nA. 옷장에 카테고리별 아이템 수가 불균형할 수 있습니다(예: 하의가 1개). 다양한 옷을 추가하거나, 자주 나오는 옷을 "제외 아이템"에 넣어보세요.', '❓', 'gray_background'),
  callout('Q. 이미지 분석이 너무 느려요.\nA. 첫 실행은 사진 한 장당 약 9초가 걸립니다. 두 번째부터는 캐시되어 거의 즉시 끝납니다.', '❓', 'gray_background'),
  callout('Q. 노션 페이지에 아무것도 안 써져요.\nA. Integration이 옷장 페이지에 연결돼 있는지 다시 확인하세요 (⋯ → Connections).', '❓', 'gray_background'),
  callout('Q. 캡션을 직접 적었는데 자동으로 바뀌어요.\nA. 캡션이 비어 있을 때만 자동으로 채워집니다. 원하는 텍스트를 직접 적어두면 그 캡션이 우선됩니다.', '❓', 'gray_background'),
  divider(),

  // 마무리 CTA (토스식 행동 유도 반복)
  heading2('지금 바로 입어보세요'),
  callout('터미널에 npx wardrobeai 한 줄. 옷장 사진만 있으면 오늘의 코디가 시작됩니다.', '✨', 'blue_background'),
  divider(),

  // 푸터
  paragraph('#노션 #데일리코디 #날씨코디 #옷장정리 #AI추천'),
  callout('GitHub: https://github.com/binaryarc/wardrobeAI', '🔗', 'default'),
  callout('이 도구는 로컬에서 동작하며, 토큰·설정·캐시는 모두 여러분의 컴퓨터에만 저장됩니다.', '🔒', 'green_background'),
];

// ── 3컬럼 기능 하이라이트 (column_list > column > content = 3단계 → 분리 처리) ──
// 1) column_list + column 골격(각 column에 임시 child 1개)만 먼저 생성
// 2) 생성된 각 column의 ID로 실제 content를 append
const featureColumns = [
  {
    emoji: '🌤',
    title: '날씨 자동 반영',
    desc: '도시별 실시간 날씨를 읽어 기온이 낮으면 아우터를 자동으로 더합니다.',
  },
  {
    emoji: '👕',
    title: '이미지 자동 인식',
    desc: '옷 사진에서 이름·카테고리·스타일·소재·색상을 AI가 분석합니다.',
  },
  {
    emoji: '✍️',
    title: '노션에 바로 정리',
    desc: '추천 코디 세트가 날씨·아이템·이유 카드와 함께 노션에 작성됩니다.',
  },
];

async function appendFeatureColumns(parentId) {
  // SDK 스키마: column_list.children[].column.children[] (children이 각 객체 안쪽)
  const columnList = {
    type: 'column_list',
    column_list: {
      children: featureColumns.map((f) => ({
        type: 'column',
        column: {
          children: [
            callout(f.title, f.emoji, 'gray_background'),
            paragraph(f.desc),
          ],
        },
      })),
    },
  };
  await notion.blocks.children.append({ block_id: parentId, children: [columnList] });
}

console.log('소개 페이지 생성 중...');

const page = await notion.pages.create({
  parent: { page_id: config.wardrobePageId },
  properties: { title: { title: rt('wardrobeAI — 제품 소개 & 사용 가이드') } },
});

// 스크린샷 플레이스홀더 → 실제 이미지/안내 콜아웃 변환 (로컬 png 업로드)
const mainResolved = await resolveBlocks(mainBlocks);
const restResolved = await resolveBlocks(restBlocks);

// 1) 표지 + "한눈에 보는" 헤딩까지
for (let i = 0; i < mainResolved.length; i += 50) {
  await notion.blocks.children.append({ block_id: page.id, children: mainResolved.slice(i, i + 50) });
}
// 2) 3컬럼 기능 하이라이트
await appendFeatureColumns(page.id);
// 3) 나머지 본문
for (let i = 0; i < restResolved.length; i += 50) {
  await notion.blocks.children.append({ block_id: page.id, children: restResolved.slice(i, i + 50) });
}

const url = `https://www.notion.so/${page.id.replace(/-/g, '')}`;
console.log('\n완료!');
console.log('페이지 URL:', url);
console.log('\n다음 단계:');
console.log('  1) 노션에서 이 페이지를 원하는 위치로 옮길 수 있습니다');
console.log('  2) 📸 표시된 노란 콜아웃 자리에 스크린샷을 끼워넣으세요');
console.log('  3) 우측 상단 Share → "Share to web"로 공개한 뒤 링크를 README에 거세요');
