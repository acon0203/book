# 📚 연재서재 (Book Creator) - AI 전자책 자동화 제작 스튜디오

AI(Google Gemini, Claude, OpenAI, Ollama)를 활용하여 전자책 기획, 목차 설계, 본문 집필 및 문장 교정을 원스톱으로 지원하는 고성능·초경량 스튜디오 웹 애플리케이션입니다.

---

## 🏗️ 프로젝트 아키텍처 및 디렉토리 구조

프로젝트는 직관성과 높은 생산성을 위해 **Lotto 프로젝트의 플랫(Flat) 1:1 컴포넌트 아키텍처**를 채택하고 있습니다.

```text
├── .cursorrules                 # AI 개발 정책 및 아키텍처 규칙
├── AGENTS.md                    # Antigravity/Agent 표준 개발 규칙
├── TODO.md                      # 프로젝트 작업 현황 및 단계별 로드맵 (실시간 추적)
├── index.html                   # Vite 진입점 HTML
├── vite.config.js               # Vite 8 설정 (React 플러그인, 5173 단독)
├── package.json                 # 스크립트 및 의존성 패키지 관리
│
└── src/                         # [프론트엔드 - React 19 + Vite]
    ├── main.jsx                 # React 마운트 진입점
    ├── App.jsx                  # 최상위 뷰 스위처 및 레이아웃
    ├── App.css                  # 최상위 레이아웃 스타일
    │
    ├── styles/
    │   └── theme.css            # 글로벌 디자인 토큰 (다크/라이트 테마 변수, 리셋, 공통 버튼/모달)
    │
    ├── pages/                   # 주요 화면 단위 (JSX + 1:1 일반 CSS 매칭)
    │   ├── Library.jsx / .css   # 내 서재 (2줄 슬림 작가 통계 & 명언 바 + 새 책 만들기 모달)
    │   ├── Studio.jsx / .css    # 집필 스튜디오 (목차 트리 + 에디터 + AI 교정 + 3대 모달 내장)
    │   ├── Vault.jsx / .css     # 자료 금고 (+ 새 자료 등록 모달 내장)
    │   ├── Stats.jsx / .css     # 집필 통계 & 작가 성장 (Mission 스타일 레벨/티어/스트릭/업적)
    │   └── Settings.jsx / .css  # AI 환경 설정 (API 키 및 제공자 관리)
    │
    ├── components/              # 재사용 공통 UI 컴포넌트
    │   ├── Sidebar.jsx / .css   # 글로벌 사이드바 네비게이션
    │   └── Toast.jsx / .css     # 알림 토스트 컴포넌트
    │
    ├── utils/                   # 공통 순수 유틸리티
    │   └── authorStats.js       # 작가 레벨 공식(Mission XP) 및 서재 통합 통계 계산
    │
    ├── config/                  # 글로벌 인프라 설정
    │   └── firebase.js          # Firebase 초기화 (Google Auth, Cloud Firestore)
    │
    ├── services/                # [Mission 스타일 비즈니스 서비스]
    │   ├── storageService.js    # 브라우저 로컬 저장소 (Zero-Latency, 100% 오프라인 지원)
    │   ├── authService.js       # Firebase Google 로그인/로그아웃 및 세션 구독 서비스
    │   ├── cloudSyncService.js  # Cloud Firestore 원고/서재 양방향 백업 및 복원 서비스
    │   ├── aiService.js         # 브라우저 직접 AI 연동 모듈 (Gemini / OpenAI)
    │   └── bookService.js       # 도서/원고/자료 일원화 서비스
    │
    └── store/                   # [전역 상태 관리]
        └── index.js             # 단일 Zustand 스토어 (도서, 원고, 인증/동기화, 자료금고, UI, 설정)
```

---

## 📑 주요 파일별 역할 상세

| 파일 경로 | 설명 |
| :--- | :--- |
| **`TODO.md`** | 완료된 작업 현황(`[x]`)과 향후 단계별 개발 로드맵(`[ ]`)을 실시간 추적하는 진행 관리표 |
| **`src/styles/theme.css`** | 다크/라이트 글래스모피즘 테마 변수, 폰트(Inter/Noto Sans KR), 공통 버튼(`.btn`), 모달(`.modal-overlay`) 정의 |
| **`src/config/firebase.js`** | Google Firebase 앱, Google Auth Provider, Cloud Firestore DB 초기화 설정 |
| **`src/pages/Library.jsx`** | 2줄 슬림 성장/통계 바, 도서 카드 그리드, 진행률(%), D-Day 배지, 도서 삭제 및 새 책 만들기 모달 |
| **`src/pages/Studio.jsx`** | 3열 집필 환경 + 주간 마감 D-Day 관리 + 챕터 연재 발행(Publish) + AI Copilot(키워드/명령어 기반 초고 집필 에이전트 & 문장 교정) + 3대 모달 내장 |
| **`src/pages/Vault.jsx`** | 아이디어 메모, 웹 스크랩 보관 및 태그 필터링, AI 집필 프롬프트 주입용 레퍼런스 관리 |
| **`src/pages/Stats.jsx`** | `mission` 게이미피케이션 차용: 작가 레벨/티어/칭호, 분야별 집필 전문성(장르 랭크), 활동 기록 타임라인, 주간 루틴, 업적 배지(Trophies) |
| **`src/pages/Settings.jsx`** | AI 제공자 선택 및 Cloud Firestore 즉시 백업/데이터 복원 관리 환경 설정 |
| **`src/utils/authorStats.js`** | 레벨 공식(Math.sqrt), 티어(브론즈~다이아몬드), 분야별 칭호/전문성, 활동 기록, 다권 완주율 및 마감 D-Day 계산 순수 함수 |
| **`src/services/storageService.js`** | 브라우저 로컬 저장소 기반 0초 즉시 저장 및 100% 오프라인 지원 모듈 |
| **`src/services/authService.js`** | Google 계정 1초 팝업 로그인, 로그아웃, 인증 상태 실시간 리스너 |
| **`src/services/cloudSyncService.js`** | Firestore `users/{uid}/studio_data/current` 원고 및 서재 데이터 백업/복원 엔진 |
| **`src/services/aiService.js`** | 브라우저 직접 AI 연동 (Google AI Studio Gemini, OpenAI) |
| **`src/services/bookService.js`** | 도서/원고/자료 CRUD 및 AI 기능을 일원화한 프론트엔드 단일 서비스 |
| **`src/store/index.js`** | 도서 목록, 활성 도서/섹션, Google 로그인 상태, 클라우드 동기화 상태, 디바운스 본문 동기화를 관리하는 단일 상태 저장소 |

---

## ☁️ 데이터 동기화 및 Firestore 저장 아키텍처

본 애플리케이션은 사용자의 집필 경험을 최우선으로 하여 **로컬 우선(Local-First) 스냅샷 동기화 아키텍처**를 채택하고 있습니다.

### 1. 동기화 흐름 (Local-First 전략)
1. **집필 중 본문 저장**: 브라우저 로컬 저장소(`localStorage`)에 **0ms 지연 없이 즉각 기록**되어 네트워크 상태와 무관하게 버벅임이 전혀 없습니다.
2. **백그라운드 동기화**: Google 로그인 사용자인 경우, 로컬 저장이 완료된 직후 비동기로 Firestore 클라우드에 백업 스냅샷을 갱신합니다.
3. **기기 간 복원**: 새 컴퓨터나 다른 브라우저에서 로그인 후 `[클라우드에서 데이터 복원]`을 실행하면 단 0.2초 만에 로컬 저장소로 무손실 동기화됩니다.

### 2. Firestore 저장 경로 및 JSON 스냅샷 구조
* **도큐먼트 경로**: `users/{uid}/studio_data/current`
* **저장 방식**: 로컬 저장소의 4대 핵심 데이터를 **단일 통합 문서(Single Document Snapshot)**로 1:1 보존합니다.

```json
{
  "updatedAt": "Firestore ServerTimestamp (서버 최종 동기화 시각)",
  "clientTimestamp": "2026-10-05T15:15:00.000Z",
  "appVersion": "1.0.0",

  // [1] 도서 프로젝트 및 목차/본문 트리 (로컬 원형 그대로 보존)
  "books": [
    {
      "id": "book_174112345_abc",
      "title": "나의 사모펀드 생존기",
      "subtitle": "글로벌 금융 시장에서 살아남은 10년의 기록",
      "genre": "경제/경영",
      "targetAudience": "금융권 취업 준비생 및 주니어 애널리스트",
      "createdAt": "2026-10-01T...",
      "updatedAt": "2026-10-05T...",
      "chapters": [
        {
          "id": "chap_1",
          "title": "프롤로그: 금융 정글에 들어서며",
          "status": "published",
          "deadline": "2026-10-10",
          "publishedAt": "2026-10-05T...",
          "sections": [
            {
              "id": "sec_1",
              "title": "첫 출근의 공기",
              "content": "<p>Tiptap 리치 에디터로 작성된 HTML 본문...</p>",
              "wordCount": 1450,
              "status": "completed"
            }
          ]
        }
      ]
    }
  ],

  // [2] 자료 금고 (아이디어 메모, 스크랩, 태그)
  "vault": [
    {
      "id": "vault_1",
      "title": "PEF 밸류에이션 모델 참고자료",
      "content": "DCF 및 LBO 모델 핵심 요약...",
      "tags": ["사모펀드", "재무"]
    }
  ],

  // [3] AI 환경 설정 (API 키 및 선택 모델)
  "config": {
    "selectedProvider": "gemini",
    "geminiApiKey": "AIzaSy..."
  },

  // [4] 누적 집필 통계
  "stats": {
    "totalWordsGenerated": 28400,
    "totalChaptersCompleted": 7,
    "aiGenerationsCount": 12
  }
}
```

### 3. 단일 스냅샷 구조 채택의 3대 이점
* 🚀 **Zero-Lag & 네트워크 트래픽 최소화**: 챕터별로 수십 번의 네트워크 API를 호출하지 않고, 1회 통신으로 서재 전체를 안전하게 원자적(Atomic)으로 백업합니다.
* 💰 **Firestore 무료 쿼터 극대화 (비용 0원)**: Firestore 과금 기준인 '문서 쓰기 횟수'를 회당 1회로 한정하여, 하루 20,000회 무료 쓰기 쿼터 내에서 영구 무료로 안전하게 운영됩니다.
* 🛡️ **무손실 단일 트랜잭션 복원**: 기기 변경 시 한 번의 읽기로 서재 전체가 완전하게 복구되므로 데이터 파편화나 챕터 유실 위험이 없습니다.

---

## 🚀 실행 및 빌드 명령어

```bash
# 개발 모드 실행 (Vite 5173 단독 실행, server.js 불필요!)
npm run dev

# 프로덕션 번들 빌드
npm run build
```

---

> [!NOTE]
> 본 프로젝트의 파일 구조가 변경될 때마다 본 `README.md` 문서는 지속적으로 최신 상태로 업데이트됩니다.
