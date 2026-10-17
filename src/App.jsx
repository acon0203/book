import React, { useEffect } from 'react';
import './App.css';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import CustomDialog from './components/CustomDialog';

// 주요 페이지 (Lotto 스타일 pages 구조)
import Library from './pages/Library';
import Studio from './pages/studio/Studio';
import Vault from './pages/Vault';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Reader from './pages/Reader';
import ExploreSerial from './pages/ExploreSerial';
import ExploreComplete from './pages/ExploreComplete';

export default function App() {
  const currentView = useStore((state) => state.currentView);
  const initAuth = useStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const renderPage = () => {
    switch (currentView) {
      case 'reader':
        return <Reader />;
      case 'studio':
        return <Studio />;
      case 'vault':
        return <Vault />;
      case 'stats':
        return <Stats />;
      case 'settings':
        return <Settings />;
      case 'serial-explore':
        return <ExploreSerial />;
      case 'complete-explore':
        return <ExploreComplete />;
      case 'library':
      default:
        return <Library />;
    }
  };

  // 독서 모드일 때는 사이드바를 숨기고 전체 화면 몰입형으로 전환
  if (currentView === 'reader') {
    return (
      <div className="app-layout reader-layout">
        <main className="main-content reader-full-main" style={{ padding: 0 }}>
          <Reader />
        </main>
        <Toast />
        <CustomDialog />
      </div>
    );
  }

  // 작가 공간(창작실, 집필 스튜디오)은 AI 패널이 위치하므로 우측 대칭 레일에서 제외
  const isWriterSpace = currentView === 'studio' || currentView === 'vault';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {renderPage()}
      </main>
      {!isWriterSpace && (
        <aside className="global-right-rail" aria-label="사이드 배너 광고 영역">
          <div className="right-rail-ad-slot">
            <span className="ad-slot-tag">광고</span>
            <div className="ad-slot-placeholder">
              <span className="ad-slot-title">스폰서 배너 공간</span>
              <span className="ad-slot-desc">160 × 600</span>
            </div>
          </div>
        </aside>
      )}
      <Toast />
      <CustomDialog />
    </div>
  );
}
