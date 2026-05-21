# wardrobeAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx wardrobeai` 한 줄로 실행되는 로컬 툴 — 노션 옷장 페이지를 읽어 날씨·스타일 기반 데일리 코디를 사용자 노션 페이지에 직접 작성해주는 서비스.

**Architecture:** Node.js + Express 백엔드가 스케줄러·추천 엔진을 관리하고, Vite + React 대시보드(설정 전용)를 정적 파일로 서빙. AI 호출은 `child_process.spawn`으로 사용자의 `claude` 또는 `codex` CLI를 직접 실행. DB 없음 — 설정은 `~/.wardrobeai/config.json`, 런타임 상태는 메모리.

**Tech Stack:** Node.js 18+, Express, node-cron, @notionhq/client, Vite, React, Vitest, node:test

---

## 파일 구조 맵

```
wardrobeAI/
├── package.json                 루트 — bin 진입점, 워크스페이스
├── server/
│   ├── index.js                 Express 서버 시작 + 브라우저 오픈
│   ├── config.js                config.json 읽기/쓰기 (~/. wardrobeai/)
│   ├── scheduler.js             node-cron 스케줄 등록/해제
│   ├── engine.js                추천 오케스트레이터 (reader+weather+ai+writer 조합)
│   ├── notion/
│   │   ├── reader.js            노션 페이지 blocks 파싱 → 옷 목록
│   │   └── writer.js            코디 결과 → 노션 callout blocks 작성
│   ├── weather.js               Open-Meteo fetch
│   ├── ai.js                    child_process.spawn wrapper (claude/codex)
│   ├── prompt.js                프롬프트 문자열 빌더
│   └── routes/
│       └── api.js               Express 라우터 (/api/*)
├── server/test/
│   ├── config.test.js
│   ├── weather.test.js
│   ├── prompt.test.js
│   ├── notion-reader.test.js
│   ├── notion-writer.test.js
│   ├── ai.test.js
│   └── engine.test.js
└── dashboard/
    ├── index.html
    ├── vite.config.js
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── Setup.jsx         노션 토큰·페이지 URL·도시·스타일 입력
    │   │   └── Dashboard.jsx     상태카드·지금추천받기·스케줄·로그
    │   └── components/
    │       ├── NotionGuide.jsx   API 키 발급 단계별 가이드
    │       ├── StatusCard.jsx    마지막추천/다음예정 표시
    │       ├── SchedulePicker.jsx cron 설정 UI
    │       └── LogViewer.jsx     최근 10건 로그
    └── src/test/
        ├── Setup.test.jsx
        └── Dashboard.test.jsx
```

---

## Task 1: 프로젝트 뼈대 + config 모듈

**Files:**
- Create: `package.json`
- Create: `server/config.js`
- Create: `server/test/config.test.js`

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "wardrobeai",
  "version": "0.1.0",
  "description": "Daily outfit recommender powered by your Notion wardrobe",
  "bin": { "wardrobeai": "./server/index.js" },
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "test": "node --test server/test/**/*.test.js",
    "dev:server": "node --watch server/index.js",
    "dev:dashboard": "cd dashboard && vite",
    "build:dashboard": "cd dashboard && vite build"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "express": "^4.18.2",
    "node-cron": "^3.0.3",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.2",
    "jsdom": "^24.0.0",
    "vitest": "^1.6.0"
  },
  "engines": { "node": ">=18" }
}
```

- [ ] **Step 2: 의존성 설치**

```bash
cd /home/jin/wardrobeAI && npm install
```

Expected: `node_modules/` 생성, lock 파일 생성.

- [ ] **Step 3: config 테스트 작성**

`server/test/config.test.js`:
```js
import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpDir = join(tmpdir(), 'wardrobeai-test-' + Date.now());

before(() => mkdirSync(tmpDir, { recursive: true }));
after(() => rmSync(tmpDir, { recursive: true, force: true }));

test('loadConfig returns defaults when file missing', async () => {
  const { loadConfig } = await import('../config.js');
  const cfg = loadConfig(join(tmpDir, 'nonexistent', 'config.json'));
  assert.equal(cfg.aiEngine, 'claude');
  assert.equal(cfg.schedule, '0 8 * * *');
  assert.equal(cfg.outputPageId, null);
});

test('saveConfig writes and loadConfig reads back', async () => {
  const { loadConfig, saveConfig } = await import('../config.js');
  const path = join(tmpDir, 'config.json');
  const data = {
    notionToken: 'secret_test',
    wardrobePageId: 'abc123',
    city: 'Seoul',
    preferredStyles: ['미니멀'],
    excludeItems: [],
    aiEngine: 'claude',
    schedule: '0 9 * * *',
    outputPageId: null,
  };
  saveConfig(data, path);
  const loaded = loadConfig(path);
  assert.equal(loaded.notionToken, 'secret_test');
  assert.equal(loaded.city, 'Seoul');
  assert.deepEqual(loaded.preferredStyles, ['미니멀']);
});
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
node --test server/test/config.test.js
```

Expected: `ERR_MODULE_NOT_FOUND` (config.js 없음)

- [ ] **Step 5: config.js 구현**

`server/config.js`:
```js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_CONFIG = {
  notionToken: '',
  wardrobePageId: '',
  city: '',
  preferredStyles: [],
  excludeItems: [],
  aiEngine: 'claude',
  schedule: '0 8 * * *',
  outputPageId: null,
};

export function getDefaultConfigPath() {
  const base = process.platform === 'win32'
    ? join(process.env.APPDATA || homedir(), 'wardrobeai')
    : join(homedir(), '.wardrobeai');
  return join(base, 'config.json');
}

export function loadConfig(configPath = getDefaultConfigPath()) {
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(data, configPath = getDefaultConfigPath()) {
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
}
```

- [ ] **Step 6: 테스트 재실행 — 통과 확인**

```bash
node --test server/test/config.test.js
```

Expected: `✔ loadConfig returns defaults when file missing`, `✔ saveConfig writes and loadConfig reads back`

- [ ] **Step 7: 커밋**

```bash
git add package.json server/config.js server/test/config.test.js
git commit -m "feat: 프로젝트 뼈대 + config 모듈"
```

---

## Task 2: weather 모듈

**Files:**
- Create: `server/weather.js`
- Create: `server/test/weather.test.js`

- [ ] **Step 1: 테스트 작성**

`server/test/weather.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseWeatherCode } from '../weather.js';

test('parseWeatherCode 0 returns 맑음', () => {
  assert.equal(parseWeatherCode(0), '맑음');
});

test('parseWeatherCode 61 returns 비', () => {
  assert.equal(parseWeatherCode(61), '비');
});

test('parseWeatherCode 71 returns 눈', () => {
  assert.equal(parseWeatherCode(71), '눈');
});

test('parseWeatherCode unknown returns 흐림', () => {
  assert.equal(parseWeatherCode(999), '흐림');
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
node --test server/test/weather.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: weather.js 구현**

`server/weather.js`:
```js
export function parseWeatherCode(code) {
  if (code === 0) return '맑음';
  if (code <= 3) return '구름 조금';
  if (code <= 48) return '흐림';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  return '흐림';
}

export async function fetchWeather(city) {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ko&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return null;

    const { latitude, longitude } = geoData.results[0];
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,precipitation_probability&timezone=auto`
    );
    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    return {
      temperature: Math.round(current.temperature_2m),
      condition: parseWeatherCode(current.weathercode),
      precipitationProbability: current.precipitation_probability ?? 0,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test server/test/weather.test.js
```

Expected: 4개 테스트 모두 `✔`

- [ ] **Step 5: 커밋**

```bash
git add server/weather.js server/test/weather.test.js
git commit -m "feat: weather 모듈 (Open-Meteo)"
```

---

## Task 3: prompt 빌더

**Files:**
- Create: `server/prompt.js`
- Create: `server/test/prompt.test.js`

- [ ] **Step 1: 테스트 작성**

`server/test/prompt.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPrompt } from '../prompt.js';

const sampleItems = [
  { name: '화이트 린넨 셔츠', category: '상의', tags: ['여름', '캐주얼'], imageUrl: '' },
  { name: '슬림 블랙 팬츠', category: '하의', tags: ['기본'], imageUrl: '' },
  { name: '화이트 스니커즈', category: '신발', tags: ['캐주얼'], imageUrl: '' },
];

const sampleWeather = { temperature: 22, condition: '맑음', precipitationProbability: 10 };

test('buildPrompt includes weather info', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: ['미니멀'], excludeItems: [] });
  assert.match(prompt, /22/);
  assert.match(prompt, /맑음/);
});

test('buildPrompt includes item names', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: [], excludeItems: [] });
  assert.match(prompt, /화이트 린넨 셔츠/);
  assert.match(prompt, /슬림 블랙 팬츠/);
});

test('buildPrompt excludes items in excludeItems', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: [], excludeItems: ['슬림 블랙 팬츠'] });
  assert.doesNotMatch(prompt, /슬림 블랙 팬츠/);
});

test('buildPrompt requests JSON outfits array', () => {
  const prompt = buildPrompt(sampleItems, sampleWeather, { preferredStyles: [], excludeItems: [] });
  assert.match(prompt, /outfits/);
  assert.match(prompt, /JSON/);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
node --test server/test/prompt.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: prompt.js 구현**

`server/prompt.js`:
```js
export function buildPrompt(items, weather, { preferredStyles, excludeItems }) {
  const filtered = items.filter(item => !excludeItems.includes(item.name));

  const itemList = filtered
    .map(i => `- ${i.name} (${i.category}${i.tags.length ? ', ' + i.tags.join('/') : ''})`)
    .join('\n');

  const weatherDesc = weather
    ? `현재 날씨: ${weather.condition}, 기온 ${weather.temperature}°C, 강수 확률 ${weather.precipitationProbability}%`
    : '날씨 정보 없음';

  const styleDesc = preferredStyles.length
    ? `선호 스타일: ${preferredStyles.join(', ')}`
    : '';

  return `당신은 패션 스타일리스트입니다.
아래 옷 목록과 날씨 정보를 바탕으로 오늘 하루 입기 좋은 코디 3세트를 추천해주세요.

${weatherDesc}
${styleDesc}

보유 옷 목록:
${itemList}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요:
{
  "outfits": [
    {
      "top": "상의 이름 (목록에 있는 것만)",
      "bottom": "하의 이름 (목록에 있는 것만)",
      "shoes": "신발 이름 (목록에 있는 것만, 없으면 null)",
      "comment": "이 코디를 추천하는 이유 한 줄"
    }
  ]
}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test server/test/prompt.test.js
```

Expected: 4개 모두 `✔`

- [ ] **Step 5: 커밋**

```bash
git add server/prompt.js server/test/prompt.test.js
git commit -m "feat: prompt 빌더"
```

---

## Task 4: Notion Reader

**Files:**
- Create: `server/notion/reader.js`
- Create: `server/test/notion-reader.test.js`

- [ ] **Step 1: 테스트 작성**

`server/test/notion-reader.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseBlocksToItems, extractTextFromBlock } from '../notion/reader.js';

test('extractTextFromBlock returns text from paragraph', () => {
  const block = {
    type: 'paragraph',
    paragraph: { rich_text: [{ plain_text: '화이트 셔츠 상의' }] },
  };
  assert.equal(extractTextFromBlock(block), '화이트 셔츠 상의');
});

test('extractTextFromBlock returns empty string for image block', () => {
  const block = { type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.jpg' } } };
  assert.equal(extractTextFromBlock(block), '');
});

test('parseBlocksToItems extracts item from heading + image', () => {
  const blocks = [
    {
      type: 'heading_2',
      heading_2: { rich_text: [{ plain_text: '화이트 린넨 셔츠 상의 여름 캐주얼' }] },
    },
    {
      type: 'image',
      image: { type: 'external', external: { url: 'https://example.com/shirt.jpg' } },
    },
  ];
  const items = parseBlocksToItems(blocks);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '화이트 린넨 셔츠');
  assert.equal(items[0].category, '상의');
  assert.equal(items[0].imageUrl, 'https://example.com/shirt.jpg');
});

test('parseBlocksToItems handles blocks with no image', () => {
  const blocks = [
    {
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: '슬림 블랙 팬츠 하의' }] },
    },
  ];
  const items = parseBlocksToItems(blocks);
  assert.equal(items.length, 1);
  assert.equal(items[0].imageUrl, '');
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
node --test server/test/notion-reader.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: reader.js 구현**

`server/notion/reader.js`:
```js
import { Client } from '@notionhq/client';

const CATEGORY_KEYWORDS = {
  상의: ['상의', '셔츠', '티', '티셔츠', '니트', '블라우스', '탑', '스웨터', '후드'],
  하의: ['하의', '팬츠', '바지', '스커트', '치마', '반바지', '쇼츠'],
  아우터: ['아우터', '자켓', '재킷', '코트', '패딩', '점퍼', '가디건'],
  신발: ['신발', '스니커즈', '로퍼', '부츠', '샌들', '슬리퍼', '구두'],
  액세서리: ['액세서리', '가방', '백', '모자', '스카프', '벨트'],
};

export function extractTextFromBlock(block) {
  const richTextTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'callout'];
  if (richTextTypes.includes(block.type)) {
    return (block[block.type]?.rich_text ?? []).map(t => t.plain_text).join('');
  }
  return '';
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return '기타';
}

function extractImageUrl(block) {
  if (block.type !== 'image') return null;
  const img = block.image;
  return img.type === 'external' ? img.external.url : (img.file?.url ?? '');
}

export function parseBlocksToItems(blocks) {
  const items = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const text = extractTextFromBlock(block);
    if (text.trim()) {
      const words = text.trim().split(/\s+/);
      const name = words.slice(0, 3).join(' ');
      const category = detectCategory(text);
      const tags = words.slice(3).filter(w => w.length > 0);

      let imageUrl = '';
      if (i + 1 < blocks.length && blocks[i + 1].type === 'image') {
        imageUrl = extractImageUrl(blocks[i + 1]) ?? '';
        i++;
      }
      items.push({ name, category, tags, imageUrl });
    }
    i++;
  }
  return items;
}

export async function fetchWardrobeItems(notionToken, pageId) {
  const notion = new Client({ auth: notionToken });
  const response = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  return parseBlocksToItems(response.results);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test server/test/notion-reader.test.js
```

Expected: 4개 모두 `✔`

- [ ] **Step 5: 커밋**

```bash
git add server/notion/reader.js server/test/notion-reader.test.js
git commit -m "feat: Notion Reader — 옷장 페이지 파싱"
```

---

## Task 5: Notion Writer

**Files:**
- Create: `server/notion/writer.js`
- Create: `server/test/notion-writer.test.js`

- [ ] **Step 1: 테스트 작성**

`server/test/notion-writer.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildOutfitBlocks } from '../notion/writer.js';

const sampleOutfit = {
  top: '화이트 린넨 셔츠',
  bottom: '슬림 블랙 팬츠',
  shoes: '화이트 스니커즈',
  comment: '미니멀 캐주얼 — 출근·약속 모두 OK',
};

const sampleWeather = { temperature: 22, condition: '맑음', precipitationProbability: 10 };

const sampleItems = [
  { name: '화이트 린넨 셔츠', imageUrl: 'https://example.com/shirt.jpg' },
  { name: '슬림 블랙 팬츠', imageUrl: '' },
  { name: '화이트 스니커즈', imageUrl: '' },
];

test('buildOutfitBlocks returns array of blocks', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1);
  assert.ok(Array.isArray(blocks));
  assert.ok(blocks.length > 0);
});

test('buildOutfitBlocks includes callout block with comment', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1);
  const callout = blocks.find(b => b.type === 'callout');
  assert.ok(callout);
  const text = callout.callout.rich_text.map(t => t.text.content).join('');
  assert.match(text, /미니멀 캐주얼/);
});

test('buildOutfitBlocks includes image block when imageUrl present', () => {
  const blocks = buildOutfitBlocks(sampleOutfit, sampleItems, sampleWeather, 1);
  const image = blocks.find(b => b.type === 'image');
  assert.ok(image);
  assert.equal(image.image.external.url, 'https://example.com/shirt.jpg');
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
node --test server/test/notion-writer.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: writer.js 구현**

`server/notion/writer.js`:
```js
import { Client } from '@notionhq/client';

function richText(content) {
  return [{ type: 'text', text: { content } }];
}

export function buildOutfitBlocks(outfit, allItems, weather, index) {
  const blocks = [];

  blocks.push({
    type: 'heading_3',
    heading_3: { rich_text: richText(`코디 ${index}`) },
  });

  const weatherLine = weather
    ? `🌤 ${weather.condition} ${weather.temperature}°C · 강수 ${weather.precipitationProbability}%`
    : '날씨 정보 없음';

  const itemLines = [outfit.top, outfit.bottom, outfit.shoes]
    .filter(Boolean)
    .map(name => `• ${name}`)
    .join('\n');

  blocks.push({
    type: 'callout',
    callout: {
      rich_text: richText(`${weatherLine}\n${itemLines}\n\n💬 ${outfit.comment}`),
      icon: { type: 'emoji', emoji: '👗' },
      color: 'gray_background',
    },
  });

  const imageItem = allItems.find(
    item => item.imageUrl && [outfit.top, outfit.bottom, outfit.shoes].includes(item.name)
  );
  if (imageItem) {
    blocks.push({
      type: 'image',
      image: { type: 'external', external: { url: imageItem.imageUrl } },
    });
  }

  return blocks;
}

export async function writeRecommendation({ notionToken, parentPageId, outputPageId, outfits, items, weather, date }) {
  const notion = new Client({ auth: notionToken });
  const dateStr = date ?? new Date().toISOString().slice(0, 10);

  let pageId = outputPageId;
  if (!pageId) {
    const page = await notion.pages.create({
      parent: { page_id: parentPageId },
      properties: { title: { title: richText('🌤️ wardrobeAI 추천') } },
    });
    pageId = page.id;
  }

  const divider = { type: 'divider', divider: {} };
  const dateHeading = {
    type: 'heading_2',
    heading_2: { rich_text: richText(`📅 ${dateStr}`) },
  };

  const outfitBlocks = outfits.flatMap((outfit, i) =>
    buildOutfitBlocks(outfit, items, weather, i + 1)
  );

  await notion.blocks.children.append({
    block_id: pageId,
    children: [divider, dateHeading, ...outfitBlocks],
  });

  return pageId;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test server/test/notion-writer.test.js
```

Expected: 3개 모두 `✔`

- [ ] **Step 5: 커밋**

```bash
git add server/notion/writer.js server/test/notion-writer.test.js
git commit -m "feat: Notion Writer — 추천 결과 노션 페이지 작성"
```

---

## Task 6: AI 호출 모듈

**Files:**
- Create: `server/ai.js`
- Create: `server/test/ai.test.js`

- [ ] **Step 1: 테스트 작성**

`server/test/ai.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseOutfitsFromOutput } from '../ai.js';

test('parseOutfitsFromOutput parses valid JSON', () => {
  const raw = JSON.stringify({
    outfits: [
      { top: '셔츠', bottom: '팬츠', shoes: '스니커즈', comment: '깔끔한 코디' },
    ],
  });
  const result = parseOutfitsFromOutput(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].top, '셔츠');
});

test('parseOutfitsFromOutput extracts JSON from mixed output', () => {
  const raw = '여기 추천 결과입니다:\n```json\n{"outfits":[{"top":"A","bottom":"B","shoes":"C","comment":"good"}]}\n```';
  const result = parseOutfitsFromOutput(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].top, 'A');
});

test('parseOutfitsFromOutput returns empty array on invalid JSON', () => {
  const result = parseOutfitsFromOutput('이건 JSON이 아닙니다');
  assert.deepEqual(result, []);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
node --test server/test/ai.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: ai.js 구현**

`server/ai.js`:
```js
import { spawn } from 'node:child_process';

export function parseOutfitsFromOutput(raw) {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr.trim());
    return parsed.outfits ?? [];
  } catch {
    return [];
  }
}

export function runAI(prompt, engine = 'claude', timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const args = engine === 'claude' ? ['-p', prompt] : [prompt];
    const proc = spawn(engine, args, { shell: false });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`AI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`AI process exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error(`AI engine '${engine}' not found. Install Claude Code: https://claude.ai/code or Codex: https://platform.openai.com/docs/guides/code`));
      } else {
        reject(err);
      }
    });
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test server/test/ai.test.js
```

Expected: 3개 모두 `✔`

- [ ] **Step 5: 커밋**

```bash
git add server/ai.js server/test/ai.test.js
git commit -m "feat: AI 호출 모듈 (subprocess + JSON 파싱)"
```

---

## Task 7: 추천 엔진 오케스트레이터

**Files:**
- Create: `server/engine.js`
- Create: `server/test/engine.test.js`

- [ ] **Step 1: 테스트 작성**

`server/test/engine.test.js`:
```js
import { test, mock } from 'node:test';
import { strict as assert } from 'node:assert';

test('runRecommendation calls all modules and returns outfits', async (t) => {
  const fakeItems = [
    { name: '셔츠', category: '상의', tags: [], imageUrl: '' },
    { name: '팬츠', category: '하의', tags: [], imageUrl: '' },
  ];
  const fakeWeather = { temperature: 20, condition: '맑음', precipitationProbability: 5 };
  const fakeOutfits = [{ top: '셔츠', bottom: '팬츠', shoes: null, comment: '테스트' }];

  const mockFetchWardrobe = t.mock.fn(async () => fakeItems);
  const mockFetchWeather = t.mock.fn(async () => fakeWeather);
  const mockRunAI = t.mock.fn(async () => JSON.stringify({ outfits: fakeOutfits }));
  const mockWriteRecommendation = t.mock.fn(async () => 'new-page-id');

  const { runRecommendation } = await import('../engine.js');
  const result = await runRecommendation(
    { notionToken: 't', wardrobePageId: 'p', city: 'Seoul', preferredStyles: [], excludeItems: [], aiEngine: 'claude', outputPageId: null },
    { fetchWardrobeItems: mockFetchWardrobe, fetchWeather: mockFetchWeather, runAI: mockRunAI, writeRecommendation: mockWriteRecommendation }
  );

  assert.equal(mockFetchWardrobe.mock.calls.length, 1);
  assert.equal(mockFetchWeather.mock.calls.length, 1);
  assert.equal(mockRunAI.mock.calls.length, 1);
  assert.equal(mockWriteRecommendation.mock.calls.length, 1);
  assert.equal(result.outfits.length, 1);
  assert.equal(result.newOutputPageId, 'new-page-id');
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
node --test server/test/engine.test.js
```

Expected: `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: engine.js 구현**

`server/engine.js`:
```js
import { fetchWardrobeItems } from './notion/reader.js';
import { fetchWeather } from './weather.js';
import { buildPrompt } from './prompt.js';
import { runAI, parseOutfitsFromOutput } from './ai.js';
import { writeRecommendation } from './notion/writer.js';

export async function runRecommendation(config, deps = {}) {
  const {
    fetchWardrobeItems: _fetchWardrobe = fetchWardrobeItems,
    fetchWeather: _fetchWeather = fetchWeather,
    runAI: _runAI = runAI,
    writeRecommendation: _writeRecommendation = writeRecommendation,
  } = deps;

  const [items, weather] = await Promise.all([
    _fetchWardrobe(config.notionToken, config.wardrobePageId),
    _fetchWeather(config.city),
  ]);

  const prompt = buildPrompt(items, weather, {
    preferredStyles: config.preferredStyles,
    excludeItems: config.excludeItems,
  });

  const rawOutput = await _runAI(prompt, config.aiEngine);
  const outfits = parseOutfitsFromOutput(rawOutput);

  const newOutputPageId = await _writeRecommendation({
    notionToken: config.notionToken,
    parentPageId: config.wardrobePageId,
    outputPageId: config.outputPageId,
    outfits,
    items,
    weather,
    date: new Date().toISOString().slice(0, 10),
  });

  return { outfits, weather, items, newOutputPageId };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test server/test/engine.test.js
```

Expected: `✔ runRecommendation calls all modules and returns outfits`

- [ ] **Step 5: 커밋**

```bash
git add server/engine.js server/test/engine.test.js
git commit -m "feat: 추천 엔진 오케스트레이터"
```

---

## Task 8: Express 서버 + API 라우터

**Files:**
- Create: `server/routes/api.js`
- Create: `server/scheduler.js`
- Create: `server/index.js`

- [ ] **Step 1: scheduler.js 작성**

`server/scheduler.js`:
```js
import cron from 'node-cron';

let currentTask = null;

export function startScheduler(cronExpression, onTick) {
  stopScheduler();
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
  currentTask = cron.schedule(cronExpression, onTick, { timezone: 'Asia/Seoul' });
}

export function stopScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
}

export function getNextRunTime(cronExpression) {
  if (!cron.validate(cronExpression)) return null;
  return null; // node-cron은 nextDate를 직접 제공하지 않음 — UI에서 cron 문자열 그대로 표시
}
```

- [ ] **Step 2: api.js 작성**

`server/routes/api.js`:
```js
import { Router } from 'express';
import { loadConfig, saveConfig } from '../config.js';
import { runRecommendation } from '../engine.js';
import { startScheduler } from '../scheduler.js';

const router = Router();
const state = { lastRun: null, nextSchedule: null, logs: [], running: false };

function addLog(level, message) {
  state.logs.unshift({ level, message, time: new Date().toISOString() });
  if (state.logs.length > 10) state.logs.pop();
}

async function executeRecommendation() {
  if (state.running) return;
  state.running = true;
  addLog('info', '추천 시작...');
  try {
    const config = loadConfig();
    const result = await runRecommendation(config);
    if (result.newOutputPageId && result.newOutputPageId !== config.outputPageId) {
      saveConfig({ ...config, outputPageId: result.newOutputPageId });
    }
    state.lastRun = new Date().toISOString();
    addLog('success', `추천 완료 — 코디 ${result.outfits.length}세트 노션에 작성됨`);
  } catch (err) {
    addLog('error', err.message);
  } finally {
    state.running = false;
  }
}

router.get('/status', (req, res) => {
  const config = loadConfig();
  res.json({
    configured: !!(config.notionToken && config.wardrobePageId && config.city),
    lastRun: state.lastRun,
    schedule: config.schedule,
    running: state.running,
  });
});

router.get('/logs', (req, res) => res.json(state.logs));

router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({ ...config, notionToken: config.notionToken ? '***' : '' });
});

router.post('/config', (req, res) => {
  const current = loadConfig();
  const updated = { ...current, ...req.body };
  saveConfig(updated);
  if (updated.schedule) {
    try {
      startScheduler(updated.schedule, executeRecommendation);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  res.json({ ok: true });
});

router.post('/run', async (req, res) => {
  res.json({ ok: true, message: '추천 실행 시작' });
  executeRecommendation();
});

export { router, executeRecommendation, startScheduler };
```

- [ ] **Step 3: index.js 작성**

`server/index.js`:
```js
#!/usr/bin/env node
import express from 'express';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import open from 'open';
import { router, executeRecommendation } from './routes/api.js';
import { startScheduler } from './scheduler.js';
import { loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const distPath = join(__dirname, '..', 'dashboard', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.use('/api', router);

app.get('*', (req, res) => {
  if (existsSync(join(distPath, 'index.html'))) {
    res.sendFile(join(distPath, 'index.html'));
  } else {
    res.send('<h1>wardrobeAI</h1><p>Run <code>npm run build:dashboard</code> to build the UI.</p>');
  }
});

const PORT = process.env.PORT || 3847;
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`wardrobeAI running at ${url}`);
  open(url).catch(() => console.log(`Open ${url} in your browser`));

  const config = loadConfig();
  if (config.schedule && config.notionToken) {
    try {
      startScheduler(config.schedule, executeRecommendation);
      console.log(`Scheduler active: ${config.schedule}`);
    } catch (e) {
      console.error('Scheduler error:', e.message);
    }
  }
});
```

- [ ] **Step 4: 서버 기동 확인**

```bash
node server/index.js
```

Expected: `wardrobeAI running at http://localhost:3847` 출력, 브라우저 오픈 시도.  
`Ctrl+C`로 종료.

- [ ] **Step 5: 커밋**

```bash
git add server/scheduler.js server/routes/api.js server/index.js
git commit -m "feat: Express 서버 + API 라우터 + 스케줄러"
```

---

## Task 9: React 대시보드 — Vite 설정 + App 뼈대

**Files:**
- Create: `dashboard/index.html`
- Create: `dashboard/vite.config.js`
- Create: `dashboard/src/main.jsx`
- Create: `dashboard/src/App.jsx`

- [ ] **Step 1: dashboard/index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>wardrobeAI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: dashboard/vite.config.js 작성**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'dashboard',
  build: { outDir: 'dist' },
  server: {
    proxy: {
      '/api': 'http://localhost:3847',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
});
```

- [ ] **Step 3: dashboard/src/main.jsx 작성**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: dashboard/src/App.jsx 작성**

```jsx
import { useState, useEffect } from 'react';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [configured, setConfigured] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  if (configured === null) return <div style={{ padding: 40 }}>로딩 중...</div>;
  if (!configured) return <Setup onComplete={() => setConfigured(true)} />;
  return <Dashboard />;
}
```

- [ ] **Step 5: 대시보드 dev 서버 기동 확인**

터미널 1에서:
```bash
node server/index.js
```
터미널 2에서:
```bash
npm run dev:dashboard
```

Expected: `http://localhost:5173` 에서 "로딩 중..." 또는 Setup 페이지 표시.

- [ ] **Step 6: 커밋**

```bash
git add dashboard/index.html dashboard/vite.config.js dashboard/src/main.jsx dashboard/src/App.jsx
git commit -m "feat: React 대시보드 뼈대 + Vite 설정"
```

---

## Task 10: Setup 페이지 (노션 가이드 포함)

**Files:**
- Create: `dashboard/src/pages/Setup.jsx`
- Create: `dashboard/src/components/NotionGuide.jsx`

- [ ] **Step 1: NotionGuide.jsx 작성**

`dashboard/src/components/NotionGuide.jsx`:
```jsx
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
```

- [ ] **Step 2: Setup.jsx 작성**

`dashboard/src/pages/Setup.jsx`:
```jsx
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
```

- [ ] **Step 3: 브라우저에서 Setup 페이지 확인**

`npm run dev:dashboard` 후 `http://localhost:5173` 접속.  
Expected: 폼 6개 필드, 노션 가이드 토글, 저장 버튼 표시.

- [ ] **Step 4: 커밋**

```bash
git add dashboard/src/pages/Setup.jsx dashboard/src/components/NotionGuide.jsx
git commit -m "feat: Setup 페이지 + 노션 API 키 발급 가이드"
```

---

## Task 11: Dashboard 페이지 (상태 카드 + 지금 추천받기 + 로그)

**Files:**
- Create: `dashboard/src/pages/Dashboard.jsx`
- Create: `dashboard/src/components/StatusCard.jsx`
- Create: `dashboard/src/components/SchedulePicker.jsx`
- Create: `dashboard/src/components/LogViewer.jsx`

- [ ] **Step 1: StatusCard.jsx 작성**

`dashboard/src/components/StatusCard.jsx`:
```jsx
export default function StatusCard({ lastRun, schedule, running }) {
  function formatTime(iso) {
    if (!iso) return '없음';
    return new Date(iso).toLocaleString('ko-KR');
  }
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', gap: 32, fontSize: 14 }}>
        <div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>마지막 추천</p>
          <p style={{ fontWeight: 600, margin: '4px 0 0' }}>{formatTime(lastRun)}</p>
        </div>
        <div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>스케줄</p>
          <p style={{ fontWeight: 600, margin: '4px 0 0', fontFamily: 'monospace' }}>{schedule || '미설정'}</p>
        </div>
        <div>
          <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>상태</p>
          <p style={{ fontWeight: 600, margin: '4px 0 0', color: running ? '#f59e0b' : '#10b981' }}>
            {running ? '⏳ 실행 중' : '✓ 대기'}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SchedulePicker.jsx 작성**

`dashboard/src/components/SchedulePicker.jsx`:
```jsx
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
            onClick={() => p.cron !== 'custom' && onChange(p.cron)}
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
```

- [ ] **Step 3: LogViewer.jsx 작성**

`dashboard/src/components/LogViewer.jsx`:
```jsx
const levelColor = { success: '#10b981', error: '#ef4444', info: '#6366f1' };

export default function LogViewer({ logs }) {
  if (!logs.length) return <p style={{ color: '#9ca3af', fontSize: 13 }}>로그 없음</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {logs.map((log, i) => (
        <li key={i} style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(log.time).toLocaleTimeString('ko-KR')}</span>
          <span style={{ color: levelColor[log.level] || '#374151' }}>{log.message}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Dashboard.jsx 작성**

`dashboard/src/pages/Dashboard.jsx`:
```jsx
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
    setScheduleEdit(s.schedule || '0 8 * * *');
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);

  async function handleRun() {
    setRunning(true);
    await fetch('/api/run', { method: 'POST' });
    setTimeout(() => { refresh(); setRunning(false); }, 1000);
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
```

- [ ] **Step 5: 브라우저에서 Dashboard 확인**

설정 완료 상태에서 `http://localhost:5173` 접속.  
Expected: 상태 카드, "지금 추천받기" 버튼, 스케줄 프리셋, 로그 영역 표시. 5초마다 자동 갱신.

- [ ] **Step 6: 커밋**

```bash
git add dashboard/src/pages/Dashboard.jsx dashboard/src/components/StatusCard.jsx dashboard/src/components/SchedulePicker.jsx dashboard/src/components/LogViewer.jsx
git commit -m "feat: Dashboard 페이지 — 상태카드·추천버튼·스케줄·로그"
```

---

## Task 12: 대시보드 빌드 + npx 패키징

**Files:**
- Modify: `package.json` (scripts, files 필드 추가)

- [ ] **Step 1: 대시보드 빌드**

```bash
npm run build:dashboard
```

Expected: `dashboard/dist/` 생성, `index.html` + 번들 파일 포함.

- [ ] **Step 2: package.json files 필드 추가**

`package.json`에 `"files"` 필드 추가:
```json
{
  "files": ["server/", "dashboard/dist/"]
}
```

- [ ] **Step 3: 통합 실행 테스트**

```bash
node server/index.js
```

Expected: `http://localhost:3847` 에서 React 대시보드 (빌드된 버전) 정상 표시.

- [ ] **Step 4: 전체 테스트 실행**

```bash
node --test server/test/**/*.test.js
```

Expected: 모든 테스트 `✔`

- [ ] **Step 5: 커밋**

```bash
git add package.json dashboard/dist/
git commit -m "feat: 대시보드 빌드 산출물 + npx 패키징 설정"
```

---

## Task 13: .gitignore 정리 + README 작성

**Files:**
- Modify: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: .gitignore 최종 확인**

`dashboard/dist/`는 npm 패키지 배포를 위해 추적해야 하므로 `.gitignore`에서 제외:

현재 `.gitignore`의 `dist/` 라인을 확인하고 `dashboard/dist/`가 ignore되지 않도록 수정:

```
# 빌드 산출물 — dashboard/dist는 npm 배포용으로 추적
/dist/
```

- [ ] **Step 2: README.md 작성**

```markdown
# wardrobeAI

노션 옷장 페이지를 읽어 날씨·스타일 기반 데일리 코디를 추천해주는 로컬 툴.
추천 결과는 사용자의 노션 페이지에 직접 작성됩니다.

## 요구사항

- Node.js 18+
- [Claude Code](https://claude.ai/code) 또는 [Codex CLI](https://platform.openai.com/docs/guides/code) 설치

## 설치 및 실행

\`\`\`bash
npx wardrobeai
\`\`\`

브라우저가 자동으로 열리며 설정 페이지로 이동합니다.

## 설정

1. 노션 Integration Token 발급 (앱 내 가이드 참조)
2. 옷장 노션 페이지 URL 입력
3. 도시명, 선호 스타일, 스케줄 설정
4. 저장 후 "지금 추천받기" 또는 스케줄 대기

## 크로스플랫폼

Linux / macOS / Windows 모두 지원.
```

- [ ] **Step 3: 커밋**

```bash
git add .gitignore README.md
git commit -m "docs: README + .gitignore 최종 정리"
```

---

## 전체 테스트 & 최종 확인

- [ ] `node --test server/test/**/*.test.js` — 전체 백엔드 테스트 통과
- [ ] `npm run build:dashboard` — 대시보드 빌드 성공
- [ ] `node server/index.js` → `http://localhost:3847` Setup → Dashboard 흐름 수동 확인
- [ ] Linux/macOS/Windows 경로 분기 (`getDefaultConfigPath`) 코드 리뷰
