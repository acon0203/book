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
    ├── data/                    # [출판 레퍼런스 및 영감 정적 DB]
    │   ├── bestseller-db.json   # 베스트셀러 25권 표본 분석 & 장르별 표준 규격(페이지수, 꼭지당 글자수, 표본 도서) DB
    │   ├── ai-models-db.json    # 무료 텍스트/Gemma 모델 목록(0/0 제외) 및 스마트 자동 전환 우선순위 DB
    │   └── quotes-db.json       # 작가 집필 영감 및 글쓰기 명언 정적 DB
    │
    ├── utils/                   # 공통 순수 유틸리티
    │   ├── paragraphParser.js   # 본문 HTML ↔ 문단 모듈 카드 블록 무손실 변환 유틸리티
    │   └── authorStats.js       # 작가 레벨 공식(Mission XP) 및 서재 통합 통계 계산
    │
    ├── config/                  # 글로벌 인프라 설정
    │   └── firebase.js          # Firebase 초기화 (Google Auth, Cloud Firestore)
    │
    ├── services/                # [Mission 스타일 비즈니스 서비스]
    │   ├── storageService.js    # 브라우저 로컬 저장소 (Zero-Latency, 100% 오프라인 지원)
    │   ├── authService.js       # Firebase Google 로그인/로그아웃 및 세션 구독 서비스
    │   ├── cloudSyncService.js  # Cloud Firestore 원고/서재 양방향 백업 및 복원 서비스
    │   ├── aiService.js         # 실시간 429 감지 & 스마트 자동 전환(Cascade) 브라우저 직접 AI 엔진
    │   └── bookService.js       # 도서/원고/자료 일원화 서비스
    │
    └── store/                   # [전역 상태 관리]
        └── index.js             # 단일 Zustand 스토어 (도서, 원고, 인증/동기화, 자료금고, UI, 설정)
```

---

## 📑 주요 파일별 역할 상세

| 파일 경로 | 설명 |
| :--- | :--- |
| **`src/data/ai-models-db.json`** | 구글 AI 스튜디오 무료 텍스트/Gemma 10대 모델 한도 스펙 및 스마트 자동 전환(최신 3.8 Flash ➔ 3.5 Lite ➔ 3.1 Lite ➔ Gemma) 정적 DB |
| **`src/data/bestseller-db.json`** | 분야별 베스트셀러 25권 실측 표본 기반 장르별 목차 표준 규격(총 페이지수, 꼭지당 평균 글자수, 표본 도서, AI 팁) 정적 DB |
| **`src/data/quotes-db.json`** | 국내외 거장 작가들의 집필 자극 명언 및 글쓰기 영감 텍스트 정적 DB |
| **`TODO.md`** | 완료된 작업 현황(`[x]`)과 향후 단계별 개발 로드맵(`[ ]`)을 실시간 추적하는 진행 관리표 |
| **`src/styles/theme.css`** | 다크/라이트 글래스모피즘 테마 변수, 폰트(Inter/Noto Sans KR), 공통 버튼(`.btn`), 모달(`.modal-overlay`) 정의 |
| **`src/config/firebase.js`** | Google Firebase 앱, Google Auth Provider, Cloud Firestore DB 초기화 설정 |
| **`src/pages/Library.jsx`** | 2줄 슬림 성장/통계 바, 도서 카드 그리드, 진행률(%), D-Day 배지, 도서 삭제 및 새 책 만들기 모달 |
| **`src/pages/Studio.jsx`** | 3열 집필 환경 + 듀얼 에디터(본문/문단) + **AI 총괄 편집장(Editor-in-Chief)** 우측 패널 덮어쓰기(본문 수정 병행 가능, 베스트셀러 성공 요건 비교 등 6대 핵심 추천 액션) + 목차 기획/내보내기 모달 |
| **`src/pages/Vault.jsx`** | 아이디어 메모, 웹 스크랩 보관 및 태그 필터링, AI 집필 프롬프트 주입용 레퍼런스 관리 |
| **`src/pages/Stats.jsx`** | `mission` 게이미피케이션 차용: 작가 레벨/티어/칭호, 분야별 집필 전문성(장르 랭크), 활동 기록 타임라인, 주간 루틴, 업적 배지(Trophies) |
| **`src/pages/Settings.jsx`** | AI 제공자 선택, 원고 저장 방식 선택(방안 A 로컬 전용 vs 방안 B 자동 클라우드 백업) 및 Cloud Firestore 즉시 백업/데이터 복원 환경 설정 |
| **`src/utils/paragraphParser.js`** | DOMParser 기반 HTML ↔ 문단(Paragraph) 블록 배열 무손실 양방향 변환 및 블록 ID 생성 유틸리티 |
| **`src/utils/authorStats.js`** | 레벨 공식(Math.sqrt), 티어(브론즈~다이아몬드), 분야별 칭호/전문성, 활동 기록, 다권 완주율 및 마감 D-Day 계산 순수 함수 |
| **`src/services/storageService.js`** | 브라우저 로컬 저장소 기반 0초 즉시 저장 및 100% 오프라인 지원 모듈 |
| **`src/services/authService.js`** | Google 계정 1초 팝업 로그인, 로그아웃, 인증 상태 실시간 리스너 |
| **`src/services/cloudSyncService.js`** | Firestore `users/{email}` 이메일 기반 멀티 컬렉션(`books`, `vault`, `stats`, `config`) 직관적 동기화/복원 엔진 |
| **`src/services/aiService.js`** | 브라우저 직접 AI 연동 (스마트 캐스케이드, 목차 번호 정제 `cleanOutlineTitle`, AI 총괄 편집장 `consultEditorChief`) |
| **`src/services/bookService.js`** | 도서/원고/자료 CRUD, 목차 재구성 반영(`applyRestructuredOutline`) 및 AI 기능을 일원화한 프론트엔드 단일 서비스 |
| **`src/store/index.js`** | 도서 목록, 활성 도서/섹션, Google 로그인 상태, 클라우드 동기화 상태, 디바운스 본문 동기화를 관리하는 단일 상태 저장소 |

---

## ☁️ 데이터 동기화 및 Firestore 저장 아키텍처

본 애플리케이션은 사용자의 집필 경험을 최우선으로 하여 **로컬 우선(Local-First) 스냅샷 동기화 아키텍처**를 채택하고 있습니다.

### 1. 동기화 흐름 (Local-First 전략)
1. **집필 중 본문 저장**: 브라우저 로컬 저장소(`localStorage`)에 **0ms 지연 없이 즉각 기록**되어 네트워크 상태와 무관하게 버벅임이 전혀 없습니다.
2. **백그라운드 동기화**: Google 로그인 사용자인 경우, 로컬 저장이 완료된 직후 비동기로 Firestore 클라우드에 백업 스냅샷을 갱신합니다.
3. **기기 간 복원**: 새 컴퓨터나 다른 브라우저에서 로그인 후 `[클라우드에서 데이터 복원]`을 실행하면 단 0.2초 만에 로컬 저장소로 무손실 동기화됩니다.

### 2. Firestore 저장 경로 및 컬렉션 분리 구조
* **사용자 식별 경로**: `users/{email}` (Firebase 콘솔 목록에서 구글 로그인 메일 주소가 즉시 표시됨)
* **컬렉션 분리 체계**:
  * `users/{email}`: 사용자 프로필, 이메일, UID, 총 도서 수, 최종 동기화 시각 메타데이터
  * `users/{email}/books/{bookId}`: 도서 프로젝트별 독립 문서 (목차, 챕터, 본문 트리 원형 보존)
  * `users/{email}/vault/{vaultId}`: 자료 금고 아이템별 독립 문서 (제목, 내용, 태그 등)
  * `users/{email}/stats/summary`: 집필 통계, 레벨, 스트릭, 경험치 단일 문서
  * `users/{email}/config/current`: UI 및 AI 모델 설정 단일 문서 (※ 보안 원칙: 개인 API 키는 클라우드로 전송하지 않고 브라우저 로컬스토리지에만 100% 격리 보존)

```
users (컬렉션)
  └── user@gmail.com (문서: 사용자 프로필 메타데이터)
        ├── books (하위 컬렉션)
        │     └── book_174112345_abc (문서: 목차, 챕터, 본문)
        ├── vault (하위 컬렉션)
        │     └── vault_1 (문서: 아이디어 메모, 스크랩)
        ├── stats (하위 컬렉션)
        │     └── summary (문서: 레벨, 스트릭, 통계)
        └── config (하위 컬렉션)
              └── current (문서: 모델 및 UI 설정 - API 키 제외)
```

### 3. 분리 컬렉션 아키텍처의 핵심 이점
* 📂 **직관적인 콘솔 데이터 관리**: Firebase 콘솔에서 `users` ➔ `내 구글 메일주소`를 선택하면, `books`, `vault`, `stats`, `config`가 폴더처럼 깔끔하게 분리되어 개별 도서와 자료를 쉽게 열람하고 관리할 수 있습니다.
* ⚡ **원자적 일괄 동기화 (Firestore WriteBatch)**: 여러 컬렉션으로 분리되어 있어도 `writeBatch` 기술을 적용하여 한 번의 배치 트랜잭션으로 원자적(Atomic) 동기화가 안전하게 완료됩니다.
* 🛡️ **이중 폴백 복원 보장**: 신규 기기 복원 시 이메일 기반 컬렉션을 우선 조회하며, 레거시 단일 스냅샷 경로 데이터도 자동 fallback 탐색하여 데이터 유실을 100% 방지합니다.

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
