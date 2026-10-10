import React, { useEffect } from 'react';
import './App.css';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';

// 주요 페이지 (Lotto 스타일 pages 구조)
import Library from './pages/Library';
import Studio from './pages/Studio';
import Vault from './pages/Vault';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Reader from './pages/Reader';
import ExploreSerial from './pages/ExploreSerial';

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
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '1rem' }}>📖</div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.3rem' }}>완성 작품 단행본 서가</h2>
            <p style={{ maxWidth: '440px', lineHeight: '1.6', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
              완결된 전자책 및 외부 기성 EPUB 도서를 열람하는 서가입니다.<br />
              Step 5에서 단행본 큐레이션 서가와 함께 가동됩니다.
            </p>
          </div>
        );
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
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {renderPage()}
      </main>
      <Toast />
    </div>
  );
}
