# wardrobeAI — Design Spec

**Date:** 2026-05-21  
**Status:** Approved

---

## 1. 개요

노션 한 페이지에 마구잡이로 저장해둔 옷 정보(사진, 텍스트, 구매 기록 등)를 AI가 읽어, 날씨와 사용자 선호 스타일에 맞는 데일리 코디를 추천해주는 로컬 툴.

- 사용자는 `npx wardrobeai` 한 줄로 실행
- 로컬 대시보드(React)에서 설정만 관리
- 추천 결과는 사용자의 노션 페이지에 직접 작성
- AI API 키 불필요 — 사용자의 Claude Code 또는 Codex CLI 활용

---

## 2. 아키텍처

```
wardrobeai (npx)
├── server/          # Node.js + Express  (백엔드)
│   ├── index.js         진입점, 서버 시작 + 스케줄러 등록
│   ├── config.js        config.json 읽기/쓰기
│   ├── scheduler.js     node-cron 기반 스케줄 관리
│   ├── engine.js        추천 엔진 오케스트레이터
│   ├── notion/
│   │   ├── reader.js    노션 페이지 → 옷 목록 파싱
│   │   └── writer.js    추천 결과 → 노션 페이지 작성
│   ├── weather.js       Open-Meteo API 호출
│   ├── ai.js            child_process.spawn (claude / codex)
│   └── prompt.js        프롬프트 빌더
└── dashboard/       # Vite + React  (프론트엔드)
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── Setup.jsx        최초 설정 (노션 키, 도시, 스타일)
    │   │   ├── Dashboard.jsx    메인 대시보드 (상태, 지금 추천받기)
    │   │   └── NotionGuide.jsx  API 키 발급 가이드 (인라인)
    │   └── components/
    │       ├── StatusCard.jsx   마지막 추천 / 다음 예정 시각
    │       ├── SchedulePicker.jsx 스케줄 설정 UI
    │       └── LogViewer.jsx    실행 로그
    └── dist/            빌드 결과 → Express가 정적 서빙
```

---

## 3. 데이터 흐름

```
① npx wardrobeai
   → Express 서버 시작 (포트 자동 선택)
   → 브라우저 자동 오픈 (localhost:PORT)
   → config.json 없으면 Setup 페이지로 이동

② 대시보드 설정 (최초 1회)
   → 노션 Integration Token 입력 (발급 가이드 내장)
   → 내 옷장 노션 페이지 URL 입력
   → 도시명 입력 (날씨용)
   → 선호 스타일 / 제외 아이템 입력
   → 추천 스케줄 설정 (예: 매일 오전 8시)
   → config.json에 저장

③ 추천 실행 (스케줄 도달 or "지금 추천받기" 클릭)
   ┌─ Notion Reader: 옷장 페이지 파싱 → 옷 목록 (텍스트 + 이미지 URL)
   ├─ Weather: Open-Meteo → 현재 날씨 (온도, 상태, 강수 확률)
   └─ 병렬 실행 후 Prompt Builder에 전달

④ AI 호출
   → child_process.spawn('claude', ['-p', prompt])
     또는 spawn('codex', [prompt])  (config에서 선택)
   → stdout에서 JSON 파싱 (코디 세트 3개)

⑤ 노션에 결과 작성
   → "wardrobeAI 추천" 페이지 자동 생성 (없으면) 또는 업데이트
   → 날짜별 코디 카드: 날씨 요약 + 아이템 3개 + AI 코멘트
   → 옷 이미지 임베드 (원본 노션 이미지 URL 재사용)
   → 이전 추천 히스토리 누적 보존

⑥ 대시보드 상태 업데이트 (메모리)
   → 마지막 추천 시각
   → 다음 추천 예정 시각
   → 실행 로그 (성공/실패)
```

---

## 4. 주요 컴포넌트 상세

### 4-1. config.json (DB 없음)

```json
{
  "notionToken": "secret_xxx",
  "wardrobePageId": "page-id",
  "city": "Seoul",
  "preferredStyles": ["미니멀", "캐주얼"],
  "excludeItems": ["빨간 후드"],
  "aiEngine": "claude",
  "schedule": "0 8 * * *",
  "outputPageId": null
}
```

- 파일 위치: `~/.wardrobeai/config.json` (OS 홈 디렉토리)
- DB 없음 — 모든 런타임 상태는 메모리(서버 프로세스)에 보관
- 민감 정보(노션 토큰)는 로컬 파일에만 저장, 외부 전송 없음
- `outputPageId`: 최초 null → Notion Writer가 추천 페이지 생성 후 ID를 여기에 덮어씀. 이후 실행부터는 해당 페이지에 누적 업데이트

### 4-2. Notion Reader

- `@notionhq/client` 공식 SDK 사용
- 옷장 페이지의 blocks를 재귀적으로 읽어 텍스트·이미지 URL 추출
- fallback: 노션 export(Markdown/HTML) 파일이 있으면 파싱
- 파싱 결과 구조:
  ```json
  [
    { "name": "화이트 린넨 셔츠", "category": "상의", "tags": ["여름", "캐주얼"], "imageUrl": "..." },
    ...
  ]
  ```

### 4-3. AI 호출 (ai.js)

- `child_process.spawn`으로 CLI 실행
- claude: `claude -p "<prompt>"` 
- codex: `codex "<prompt>"`
- stdout을 버퍼링해 완료 후 JSON 파싱
- 타임아웃: 60초
- 에러 시 대시보드 로그에 표시

### 4-4. Prompt Builder

- 입력: 옷 목록 + 날씨 + 선호 스타일
- 출력: JSON 형식 강제 지정 프롬프트
- 응답 형식:
  ```json
  {
    "outfits": [
      {
        "top": "화이트 린넨 셔츠",
        "bottom": "슬림 블랙 팬츠",
        "shoes": "화이트 스니커즈",
        "comment": "미니멀 캐주얼 — 출근·약속 모두 OK"
      }
    ]
  }
  ```

### 4-5. Notion Writer

- 추천 결과를 노션 Blocks API로 작성
- 결과 페이지 이름: `🌤️ wardrobeAI 추천`
- 구조: 날짜 heading → 날씨 요약 → 코디 카드(callout block) × 3세트
- 이미지 있으면 image block 삽입
- 페이지 없으면 옷장 페이지 하위에 자동 생성

### 4-6. 대시보드 (React + Vite)

- **Setup 페이지**: 노션 토큰 입력 + 발급 가이드(단계별 스크린샷 설명) + 연결 테스트 버튼
- **Dashboard 페이지**: 
  - 상태 카드 (마지막 추천, 다음 예정)
  - "지금 추천받기" 버튼 → POST /api/run
  - 스케줄 변경 UI
  - 실행 로그 (최근 10건)
- Express가 `dashboard/dist` 정적 파일 서빙
- API: `/api/config`, `/api/run`, `/api/status`, `/api/logs`

---

## 5. 설치 및 실행

```bash
# 설치 없이 바로 실행 (Node.js 18+ 필요)
npx wardrobeai

# 전역 설치
npm install -g wardrobeai
wardrobeai
```

- 첫 실행 시 브라우저 자동 오픈 → Setup 페이지
- 설정 완료 후 백그라운드 스케줄러 동작
- 프로세스 종료 시 스케줄 중단 (재실행으로 복구)

---

## 6. 크로스플랫폼 고려사항

| OS | 브라우저 오픈 | config 경로 | Claude/Codex 경로 |
|---|---|---|---|
| macOS | `open` | `~/.wardrobeai/` | PATH 자동 탐색 |
| Linux | `xdg-open` | `~/.wardrobeai/` | PATH 자동 탐색 |
| Windows | `start` | `%APPDATA%\wardrobeai\` | PATH 자동 탐색 |

- `open` 패키지로 OS별 브라우저 오픈 통일
- `os.homedir()` + `path.join`으로 경로 통일

---

## 7. 에러 처리

- 노션 API 실패 → 대시보드 로그 표시, 재시도 없음
- AI CLI 없음 → 설치 안내 메시지 출력 (claude 또는 codex 설치 링크)
- AI 타임아웃 (60s) → 로그 기록, 다음 스케줄에 재시도
- 날씨 API 실패 → "날씨 정보 없음"으로 프롬프트 진행
- JSON 파싱 실패 → raw 응답 로그 저장, 다음 스케줄 대기

---

## 8. 범위 밖 (현재 버전)

- 모바일 앱
- 다중 사용자 / 클라우드 배포
- 옷 자동 분류 ML 모델
- 구매 이력 연동 (쇼핑몰 크롤링)
- 노션 외 다른 소스 (Google Keep, Obsidian 등)
