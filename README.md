# wardrobeAI

Notion 한 페이지에 사진·텍스트로 무작위로 저장해둔 옷들을 AI가 인식하고,
날씨와 사용자가 원하는 스타일을 입력하면 데일리 코디를 추천해주는 서비스.

## 흐름

```
Notion 페이지 (옷 사진 + 텍스트)
        ↓  Notion API
  옷장 DB 파싱 + AI 이미지 인식
        ↓  Vision AI (GPT-4o / Claude)
  아이템 카탈로그 (종류, 색상, 스타일 태그)
        ↓
  날씨 API + 사용자 스타일 입력
        ↓
  추천 엔진 → 데일리 코디 카드 출력
```

## 디렉토리 구조

```
wardrobeAI/
├── src/
│   ├── notion/       # Notion API 연동, 페이지 파싱
│   ├── ai/           # 이미지 인식, 아이템 태깅
│   ├── weather/      # 날씨 API 연동
│   └── recommender/  # 코디 추천 엔진
├── config/           # 환경변수, API 키 설정
├── docs/             # 기획, API 명세
└── tests/            # 단위·통합 테스트
```

## 핵심 기능

- **Notion 파서**: 페이지 내 이미지 URL, 텍스트 블록 자동 추출
- **AI 아이템 인식**: 옷 사진 → 종류·색상·스타일 자동 태깅
- **날씨 연동**: 오늘 날씨 기반 착용 가능 아이템 필터링
- **스타일 매칭**: 사용자 입력 스타일(캐주얼, 포멀 등) + TPO 고려 추천
- **데일리 코디 카드**: 상의 + 하의 + 아우터 + 신발 조합 출력

## 기술 스택 (예정)

| 레이어 | 기술 |
|---|---|
| Notion 연동 | Notion API v2 |
| AI 인식 | Claude claude-sonnet-4-6 (Vision) |
| 날씨 | OpenWeatherMap API |
| 백엔드 | Python (FastAPI) |
| 저장소 | SQLite → PostgreSQL |
| 프론트 | 추후 결정 |
