# wardrobeAI

노션 옷장 페이지를 읽어 **날씨·스타일 기반 데일리 코디**를 추천해주는 로컬 툴.
추천 결과는 사용자의 노션 페이지에 직접 작성됩니다.

- 🌤 도시별 실시간 날씨 반영 (기온이 낮으면 아우터 자동 추가)
- 👕 이미지 분석으로 옷 이름·카테고리·스타일·소재·색상 자동 인식
- 🗂 한 번 분석한 이미지는 캐시되어 다음 실행은 빠르게
- ✍️ 노션 캡션에 직접 적은 텍스트는 AI보다 우선 사용
- ⏰ cron 스케줄로 매일 자동 추천 가능

---

## 요구사항

- **Node.js 18+**
- 다음 중 **하나** 설치:
  - [Claude Code CLI](https://claude.ai/code) — 권장
  - [Codex CLI](https://platform.openai.com/docs/guides/code)
- Notion 계정과 옷장으로 쓸 노션 페이지

---

## 빠른 시작

```bash
npx wardrobeai
```

명령을 실행하면 로컬 서버가 뜨고 브라우저가 자동으로 열립니다 (기본 포트 `3847`).
설정이 비어 있으면 Setup 화면이, 이미 설정되어 있으면 Dashboard가 보입니다.

서버를 종료하려면 터미널에서 `Ctrl+C`.

---

## 1. Notion 준비

### 1-1. Integration Token 발급

1. <https://www.notion.so> → 우측 상단 **Settings & members**
2. 좌측 **Connections** → **Develop or manage integrations**
3. **+ New integration** → 이름 입력(예: `wardrobeAI`) → **Submit**
4. **Internal Integration Secret** 값을 복사 (이후 `notionToken` 으로 사용)

### 1-2. 옷장 페이지 만들고 연결하기

1. 노션에 옷장으로 사용할 빈 페이지 하나 생성 (예: `내 옷장`)
2. 페이지 우측 상단 `⋯` → **Connections → wardrobeAI 추가**
3. 페이지에 옷 이미지를 업로드:
   - 사진을 드래그&드롭하면 자동으로 image 블록이 됩니다
   - **컬럼으로 정렬해도 OK** (column_list/column 안의 이미지도 인식)
4. 페이지 URL을 복사. 예시:
   ```
   https://www.notion.so/내-옷장-abcd1234abcd1234abcd1234abcd1234
   ```
   → 끝의 32자 hex가 `wardrobePageId` 입니다.

### 1-3. (선택) 캡션 직접 적기

이미지 아래 캡션을 적으면 **AI 분석을 건너뛰고 그 텍스트를 그대로 사용**합니다.
형식은 자유 — 다음 모두 인식됩니다:

| 캡션 예시 | 인식 결과 |
|---|---|
| `화이트 오버핏 셔츠 · 상의 · 미니멀` | 새 형식(권장). 이름·카테고리·스타일을 정확히 분리 |
| `디자이너 워시드 데님 하의 와이드핏 빈티지` | "하의" 키워드로 카테고리 인식, 나머지는 태그 |
| `블랙 슬림 청바지` | 키워드 "청바지"로 카테고리 자동 추정 |

캡션이 없는 이미지는 AI가 자동 분석해서 캡션을 채워줍니다.

---

## 2. AI CLI 로그인

추천에는 Claude Code 또는 Codex CLI가 필요합니다. 둘 중 하나만 있으면 됩니다.

### Claude Code (권장)
```bash
npm install -g @anthropic-ai/claude-code
claude   # 첫 실행 시 브라우저로 로그인
```

### Codex CLI
```bash
npm install -g @openai/codex
codex    # 첫 실행 시 OpenAI 계정 로그인
```

대시보드의 **AI 엔진 체크** 버튼으로 설치/로그인 여부를 점검할 수 있습니다.

---

## 3. 대시보드에서 설정

`npx wardrobeai` 실행 후 브라우저 Setup 화면에서 다음을 입력:

| 항목 | 설명 |
|---|---|
| **Notion Integration Token** | 1-1에서 복사한 secret |
| **옷장 페이지 URL/ID** | 1-2에서 복사한 URL (전체 붙여넣어도 ID만 추출) |
| **도시** | 날씨 조회용. 영문/한글 도시명 (예: `Seoul`, `서울`) |
| **선호 스타일** | 쉼표 구분 (예: `미니멀, 캐주얼, 스트릿`) |
| **제외 아이템** | 추천에서 빼고 싶은 옷 이름 (예: `흰 셔츠`) |
| **AI 엔진** | `claude` 또는 `codex` |
| **스케줄** | cron 표현식. 기본 `0 8 * * *` = 매일 오전 8시 |

**저장**을 누르면 `~/.wardrobeai/config.json`(Windows는 `%APPDATA%\wardrobeai\config.json`)에 기록됩니다.

설정 파일을 직접 편집하고 싶다면 [`config.example.json`](./config.example.json)을 복사해서 위 경로에 두세요.

---

## 4. 추천 받기

대시보드에서 **지금 추천받기** 버튼 클릭.
실시간 진행 상황이 표시됩니다:

```
[wardrobe] 옷장 불러오는 중...
[analyze]  이미지 분석 중 (3/10)
[weather]  날씨 확인 완료 — 구름 조금 17°C
[prompt]   옷 10개 분석 완료, AI 추천 생성 중...
[writing]  추천 3세트 노션에 작성 중...
[done]     완료 — 코디 3세트
```

완료되면 **노션 옷장 페이지 하위에 새 child page**가 생성됩니다:
- 페이지 제목: `2026-05-22_1_3세트`
- 각 코디별 callout(날씨·아이템·이유) + 아이템 이미지 첨부

스케줄을 설정해두면 wardrobeAI가 백그라운드에 떠 있을 때 자동으로 같은 작업을 돌립니다.

---

## 5. 저장되는 데이터

모두 **로컬에만** 저장됩니다. 서버 전송 없음.

| 경로 | 내용 |
|---|---|
| `~/.wardrobeai/config.json` | 토큰·설정 |
| `~/.wardrobeai/items-cache.json` | 이미지 URL → AI 분석 메타데이터 (이름·태그·소재·색상 등) |
| `<repo>/.tmp/images/` | 분석용 임시 이미지 (1시간 후 자동 삭제) |

캐시를 비우고 싶다면 `items-cache.json`을 지우면 됩니다.
노션의 잘못 달린 캡션을 모두 초기화하려면:
```bash
node scripts/reset-captions.mjs
```

---

## 6. 캡션과 캐시 우선순위

reader는 옷장 이미지를 처리할 때 다음 순서로 정보를 가져옵니다:

1. **새 형식 캡션** (`이름 · 카테고리 · 스타일`) — 가장 우선
2. **사용자가 직접 적은 자유 텍스트 캡션** — AI 호출 안 함
3. **캐시 hit** (이전에 분석한 이미지) — 캡션이 비었으면 새 형식으로 자동 채움
4. **AI 분석** — 결과를 캐시 + 노션 캡션에 모두 저장
5. 위 모두 실패 시 `아이템 N` 임시 이름

→ 노션에 캡션만 잘 적어두면 AI 호출 0회로 거의 즉시 추천이 나옵니다.

---

## 트러블슈팅

| 증상 | 원인·해결 |
|---|---|
| `AI exit 1: Usage credits required for 1M context` | Claude의 1M context 모델 크레딧 부족. 코드에서 `--model sonnet`을 사용하므로 표준 컨텍스트로 동작해야 함. 그래도 실패하면 `claude` 로그인 상태 확인 |
| 추천 결과가 항상 비슷 | 옷장에 카테고리별 아이템 수가 불균형(예: 하의 1개)일 가능성. 다양한 옷을 추가하거나 `excludeItems`로 자주 나오는 옷 제외 |
| 노션 캡션이 자동으로 바뀜 | 캐시 hit + 캡션 비어있음일 때 자동 복원 동작. 막고 싶다면 캡션을 직접 다른 텍스트로 채워두면 사용자 캡션이 우선됨 |
| 이미지 분석이 너무 느림 | 첫 실행은 N장 × 약 9초. 두 번째부터는 캐시로 즉시 끝남 |
| 노션 페이지에 아무것도 안 써짐 | Integration이 페이지에 연결되어 있는지 다시 확인 (`⋯ → Connections`) |

---

## 개발

```bash
git clone https://github.com/binaryarc/wardrobeAI.git
cd wardrobeAI
npm install
npm run dev:server     # 서버 (자동 재시작)
npm run dev:dashboard  # 대시보드 (Vite hot reload)
npm test               # node:test 단위 테스트
```

대시보드 빌드 산출물(`dashboard/dist/`)은 커밋되어 있어 `npx` 진입 시 별도 빌드 없이 바로 동작합니다.

---

## 크로스플랫폼

Linux / macOS / Windows 모두 지원.
