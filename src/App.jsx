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

export default function App() {
  const currentView = useStore((state) => state.currentView);
  const initAuth = useStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const renderPage = () => {
    switch (currentView) {
      case 'studio':
        return <Studio />;
      case 'vault':
        return <Vault />;
      case 'stats':
        return <Stats />;
      case 'settings':
        return <Settings />;
      case 'library':
      default:
        return <Library />;
    }
  };

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
