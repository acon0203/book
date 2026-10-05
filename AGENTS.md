# Book Studio (연재서재) Development Rules

## 1. Zero-Lag & High Performance (가볍고 빠른 어플리케이션 원칙)
- **원칙**: 앱은 항상 버벅임 없이 즉각 반응해야 하며, 가장 가볍고 효율적인 코드를 작성해야 한다.
- **실천**:
  - 에디터 본문 타이핑 시 전체 컴포넌트 트리가 리렌더링되지 않도록 로컬 상태와 디바운스(300ms)를 적용한다.
  - 무겁고 불필요한 대형 외부 라이브러리(Material UI, Tailwind, Axios 등)를 도입하지 않고, 경량 네이티브 표준(React, Native Fetch, Pure CSS, Zustand)을 유지한다.

## 2. Lotto Flat Architecture Compliance (직관적인 1:1 파일 구조)
- **원칙**: 대규모 엔터프라이즈식 과도한 폴더 파편화(3~4단계 중첩, 컴포넌트당 파일 3~4개 생성)를 절대 지양한다.
- **실천**:
  - `pages/` 폴더에 화면 단위 컴포넌트(`Library`, `Studio`, `Vault`, `Settings`)를 배치한다.
  - 각 컴포넌트는 복잡한 CSS Module 대신 **1:1 일반 CSS (`ComponentName.jsx` + `ComponentName.css`)**로 나란히 매칭한다.
  - 화면과 밀접하게 연결된 모달이나 서브 뷰는 별도 파일로 찢지 않고, 해당 페이지 컴포넌트 내부에 직관적으로 응집한다.
  - 전역 테마 및 공통 버튼/모달 스타일은 `src/styles/theme.css`에서 통합 관리한다.

## 3. Unified Store & Service (단일 스토어 & 단일 서비스)
- **상태 관리**: 상태를 여러 파일로 파편화하지 않고, `src/store/index.js` 단일 Zustand 스토어에서 중앙 관리한다.
- **API 서비스**: 백엔드 통신은 `src/services/bookService.js`에서 Native Fetch로 일원화한다.

## 4. README.md Synchronization Requirement (구조 변경 시 자동 최신화)
- **원칙**: 프로젝트 내 페이지/컴포넌트가 추가·삭제되거나 디렉토리 구조에 변화가 생기면, **반드시 `README.md`의 구조도와 파일 역할 표를 즉시 함께 업데이트**해야 한다.

## 5. Language & Communication (한국어 기본)
- 모든 설명, 커뮤니케이션, UI 텍스트 및 핵심 코드 주석은 명확한 한국어로 작성한다.

## 6. No Browser Subagent / Visual Verification Prohibition (에이전트 브라우저 직접 검증 절대 금지)
- **원칙**: AI 에이전트가 자체적으로 브라우저(browser subagent 등)를 띄워 화면을 조작하거나 시각적 검증을 시도하는 행위를 엄격히 금지한다.
- **실천**:
  - 화면 검증 및 UI 시각 평가는 사용자가 직접 로컬 브라우저에서 수행한다.
  - 에이전트는 코드 무결성 검증(컴파일, `npm run build`, 터미널 명령어, 로직 및 파일 구조 일관성)으로 품질을 검증하고, 브라우저를 임의로 구동하지 않는다.

## 7. Local-First Cloud Sync Principle (로컬 우선 스냅샷 동기화 원칙)
- **원칙**: 원고 및 도서 데이터 저장은 반드시 브라우저 로컬 저장소(`localStorage`)를 1차 기준으로 삼아 0ms 즉각 저장을 보장하며, 클라우드 저장은 비동기 백그라운드로 처리한다.
- **실천**:
  - Cloud Firestore에는 `users/{uid}/studio_data/current` 단일 문서 스냅샷 형태로 일괄 보존하여 불필요한 과도한 쓰기 트랜잭션과 과금을 방지한다.
  - 네트워크 단절이나 오프라인 상태에서도 집필과 저장이 100% 정상 작동하도록 유지한다.


