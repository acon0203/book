# Book Studio Development Rules

## 1. Zero-Lag & High Performance
- 에디터 본문 타이핑 시 전체 리렌더링 차단 (로컬 상태 + 300ms 디바운스 적용).
- 무거운 외부 라이브러리 추가 금지. 경량 네이티브 코드 유지.

## 2. Lotto Flat Architecture
- 1:1 일반 CSS 매칭 (`ComponentName.jsx` + `ComponentName.css`).
- 불필요한 다단계 디렉토리 중첩 금지.
- 화면 밀접 모달은 `pages/` 컴포넌트 내부에 응집.

## 3. Unified Store & Service
- 전역 상태는 `src/store/index.js`에 일원화.
- API 통신은 `src/services/bookService.js`에 일원화.

## 4. README.md Synchronization
- 파일 구조가 변경될 때마다 `README.md`도 즉시 함께 최신화.

## 5. Korean Language
- 모든 응답과 설명은 한국어로 제공.
