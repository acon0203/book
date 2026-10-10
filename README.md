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
├── TODO.md                      # 전체 로드맵 및 단계별 작업 추적표
├── HISTORY.md                   # 일자별 개발 세션 핵심 작업 및 변경 히스토리 기록
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
    │   ├── Studio.jsx / .css    # 집필 스튜디오 (목차 트리 + 에디터 + 버전 관리 모달 + AI 교정)
    │   ├── Vault.jsx / .css     # 창작실 (좌측 작품 서가 바인더 + 상단 가로 5대 파이프라인: 아이디어 노트 ➔ 출간 기획서 ➔ 글감 취재 ➔ 인물/뼈대 ➔ 목차 조립대)
    │   ├── Reader.jsx / .css    # [Step 3 신설] 표준 통합 웹 뷰어 (문피아 지표/화면폭 + 네이버웹소설 간명 헤더/보기설정/작가의말/댓글 + DOMPurify XSS 방어)
    │   ├── ExploreSerial.jsx / .css # [Step 5 신설] 연재 작품 탐색 (교보문고 8대 장르 사이드바 + 실시간 TOP 5 랭킹 보드 + 요일/자유연재 탭 + 문피아식 연재작 카드)
    │   ├── Stats.jsx / .css     # 통합 통계 (슬림 분류 탭: 집필 통계 ↔ 독서 통계, 레벨/루틴/전문성/타임라인/업적)
    │   └── Settings.jsx / .css  # 서재 관리 (계정&프로필, 데이터 백업·동기화 센터, AI 집필 엔진, 서비스 안내 4대 영역)
    │
    ├── components/              # 재사용 공통 UI 컴포넌트
    │   ├── Sidebar.jsx / .css   # 글로벌 사이드바 네비게이션
    │   ├── Toast.jsx / .css     # 알림 토스트 컴포넌트
    │   ├── TiptapEditor.jsx / .css # [독립 분리] 공통 리치 텍스트 에디터 엔진 (Zero-Lag 본문 작성 & 툴바)
    │   └── ModelQuotasModal.jsx / .css # [신설] 안티그래비티 스타일 실시간 AI 모델 Quotas 잔여 현황 팝오버
    │
    ├── data/                    # [출판 레퍼런스 및 영감 정적 DB]
    │   ├── bestseller-db.json   # 베스트셀러 25권 표본 분석 & 장르별 표준 규격(페이지수, 꼭지당 글자수, 표본 도서) DB
    │   ├── ai-models-db.json    # 무료 텍스트/Gemma 모델 목록(0/0 제외) 및 스마트 자동 전환 우선순위 DB
    │   ├── quotes-db.json       # 작가 집필 영감 및 글쓰기 명언 정적 DB
    │   └── vaultConstants.js    # 8대 장르 출판 표준 플롯 규격 템플릿 & 창작 파이프라인 정적 상수
    │
    ├── utils/                   # 공통 순수 유틸리티
    │   ├── paragraphParser.js   # 본문 HTML ↔ 문단 모듈 카드 블록 무손실 변환 유틸리티
    │   ├── authorStats.js       # 작가 레벨 공식(Mission XP) 및 서재 통합 통계 계산
    │   └── quotaManager.js      # [신설] Gemini 및 AI 모델별 실시간 일일 쿼터 추적 & PST/KST 리셋 카운트다운
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
| **`src/data/vaultConstants.js`** | 8대 장르 출판 표준 플롯 규격 템플릿(`PLOT_TEMPLATES`), 5대 창작 파이프라인 단계 및 자료 카테고리 프리셋 상수 |
| **`TODO.md`** | 완료된 작업 현황(`[x]`)과 향후 단계별 개발 로드맵(`[ ]`)을 실시간 추적하는 진행 관리표 |
| **`HISTORY.md`** | 일자별 개발 세션의 구체적인 문제 해결 과정, 기능 변경 내역, 세부 스펙을 누적 기록하는 개발 일지 |
| **`src/styles/theme.css`** | 다크/라이트 글래스모피즘 테마 변수, 폰트(Inter/Noto Sans KR), 공통 버튼(`.btn`), 모달(`.modal-overlay`) 정의 |
| **`src/config/firebase.js`** | Google Firebase 앱, Google Auth Provider, Cloud Firestore DB 초기화 설정 |
| **`src/components/Sidebar.jsx`** | 황금 비율 3단 사이드바 (나의 공간: 서재·통계 / 독자 공간: 연재·완성본 / 작가 공간: 창작실·집필 스튜디오) 네비게이션 |
| **`src/components/TiptapEditor.jsx`** | 범용 리치 텍스트 에디터 독립 컴포넌트: H1~H3 서식 툴바, 종이 시트 본문 뷰포트, 드래그 문장 AI 자동 전송 및 Zero-Lag 즉시 렌더링 |
| **`src/components/ModelQuotasModal.jsx`** | [신설] 서비스 테마 동기화 AI 모델별 일일 잔여 한도(Quota) 및 리셋 카운트다운 모달 |
| **`src/pages/Library.jsx`** | [내 서재 전면 개편] 1. 상단 ⚡ 지금 이어하기 Quick Band(최근 집필 ➔ 스튜디오 / 최근 독서 ➔ 뷰어 2분할 퀵 직통) + 2. 좌우 분류 시트 탭(✍️ 집필 서재 vs 📖 독서 서재) + 3. 시트 연동 스마트 2줄 요약 밴드 & 도서/독서 카드 그리드 |
| **`src/pages/Studio.jsx`** | 3열 집필 환경 + 듀얼 에디터(본문/문단) + **도서 버전 관리(디스켓 저장 드롭다운 & 책 제목 옆 버전 관리 시계 모달)** + **AI 총괄 편집장(Editor-in-Chief)** 우측 패널(베스트셀러 성공 요건 비교 등 6대 추천 액션) + 목차 기획/내보내기 모달 |
| **`src/pages/Vault.jsx`** | 아이디어 메모, 웹 스크랩 보관 및 태그 필터링, AI 집필 프롬프트 주입용 레퍼런스 관리 |
| **`src/pages/Reader.jsx`** | [Step 3 신설] 표준 통합 웹 뷰어: 네이버웹소설 스타일 간명 슬림 바(목차 드롭다운·보기설정 팝오버) + 문피아식 챕터 메타 지표(조회수·관심·댓글) & 기본/펼침 화면폭 토글 + 하단 작가의 말 카드 & 독자 댓글 소통 공간 + DOMPurify 안전 렌더링 |
| **`src/pages/ExploreSerial.jsx`** | [Step 5 신설] 연재 작품 탐색: 교보문고 8대 장르 좌측 사이드바 + 실시간 Best TOP 5 가로 랭킹 보드 + 요일(월~일) 및 자유연재 통합 탭 + 문피아식 연재작 카드(1화부터/최신화 읽기 ➔ 뷰어 직통 연결) |
| **`src/pages/Stats.jsx`** | `mission` 게이미피케이션 차용: 작가 레벨/티어/칭호, 분야별 집필 전문성(장르 랭크), 활동 기록 타임라인, 주간 루틴, 업적 배지(Trophies) |
| **`src/pages/Settings.jsx`** | [서재 관리로 전면 개편] 1. 계정 & 작가 프로필(구글 로그인·기본 필명·에디터 자동저장 주기) + 2. 데이터 저장 & 동기화 센터(로컬 0ms vs 클라우드 자동백업, Firestore 동기화, 전체 서재 JSON 백업 다운로드/파일 복원) + 3. AI 집필 엔진 설정(Google AI 무료 키·스마트 전환, 고급 접힘 메뉴: OpenAI/Claude/Ollama) + 4. 서비스 안내(공지사항, 이용약관/데이터 안심 정책, 단축키 가이드, 고객센터 FAQ 인라인 화면 서브 뷰) |
| **`src/utils/paragraphParser.js`** | DOMParser 기반 HTML ↔ 문단(Paragraph) 블록 배열 무손실 양방향 변환 및 블록 ID 생성 유틸리티 |
| **`src/utils/authorStats.js`** | 레벨 공식(Math.sqrt), 티어(브론즈~다이아몬드), 분야별 칭호/전문성, 활동 기록, 다권 완주율 및 마감 D-Day 계산 순수 함수 |
| **`src/utils/quotaManager.js`** | Gemini 및 AI 모델별 일일 한도(Quota) 추적, PST/KST 리셋 카운트다운 및 429 감지 유틸리티 |
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
3. **기기 간 복원 (무손실 버전 보존)**: 새 컴퓨터나 다른 브라우저에서 `[클라우드에서 데이터 복원]`을 실행하면, 현재 로컬에 작성 중이던 원고가 `[클라우드 복원 전 로컬 백업]` 버전으로 자동 보관된 후 최신 클라우드 데이터가 반영되어 이전 원고가 절대 유실되지 않습니다. 언제든 버전 관리에서 되돌릴 수 있습니다.

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
