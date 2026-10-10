import React from 'react';
import './Sidebar.css';
import { useStore } from '../store';
import { 
  BookOpen, Edit3, Award, Settings, Sun, Moon, 
  Cloud, RefreshCw, LogIn, LogOut, CheckCircle,
  Flame, BookCheck, Palette
} from 'lucide-react';

export default function Sidebar() {
  const {
    currentView, setView, theme, toggleTheme,
    activeBook, books, openBook, showToast, showActionToast, setNewBookModalOpen,
    user, loginWithGoogle, logout, syncStatus, syncToCloud
  } = useStore();

  const handleNavClick = (id) => {
    if (id === 'studio') {
      if (activeBook) {
        setView('studio');
      } else if (books.length > 0) {
        openBook(books[0].id);
      } else {
        showActionToast(
          '작업 중인 도서가 없습니다. 새 책을 만드시겠습니까?',
          () => {
            setView('library');
            setNewBookModalOpen(true);
          },
          () => {
            setView('library');
          },
          { yesText: 'Yes', noText: 'No' }
        );
      }
      return;
    }
    setView(id);
  };

  // 황금 비율 3단 섹션 네비게이션 정의
  const navSections = [
    {
      id: 'my-space',
      label: null, // 최상단 나의 공간 (헤더 없이 깔끔하게 배치)
      items: [
        { id: 'library', label: '내 서재', icon: BookOpen },
        { id: 'stats', label: '통합 통계', icon: Award }
      ]
    },
    {
      id: 'reader-space',
      label: '독자 공간',
      items: [
        { id: 'serial-explore', label: '연재 작품', icon: Flame },
        { id: 'complete-explore', label: '완성 작품', icon: BookCheck }
      ]
    },
    {
      id: 'creator-space',
      label: '작가 공간',
      items: [
        { id: 'vault', label: '창작실', icon: Palette },
        {
          id: 'studio',
          label: '집필 스튜디오',
          icon: Edit3,
          sublabel: activeBook ? activeBook.title : (books.length > 0 ? '이어 쓰기' : null)
        }
      ]
    },
    {
      id: 'system-space',
      label: null,
      items: [
        { id: 'settings', label: '서재 관리', icon: Settings }
      ]
    }
  ];

  return (
    <aside className="global-sidebar">
      <div className="brand-header">
        <div className="brand-icon">📚</div>
        <div className="brand-title">연재서재</div>
      </div>

      <nav className="nav-menu">
        {navSections.map((sec, secIdx) => (
          <div key={sec.id} className="nav-section-group">
            {secIdx > 0 && <div className="nav-divider" />}
            {sec.label && (
              <div className="nav-section-header">
                <span className="nav-section-title">{sec.label}</span>
              </div>
            )}
            <div className="nav-section-items">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <Icon size={17} />
                    <div className="nav-item-content">
                      <span>{item.label}</span>
                      {item.sublabel && (
                        <span className="nav-sublabel" title={item.sublabel}>
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {/* 클라우드 동기화 & 사용자 프로필 카드 */}
        <div className="auth-profile-card">
          {user ? (
            <div className="logged-in-box">
              <div className="user-info-row">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="user-avatar-img" />
                ) : (
                  <div className="user-avatar-fallback">{user.displayName ? user.displayName[0] : 'U'}</div>
                )}
                <div className="user-details">
                  <span className="user-name" title={user.displayName}>{user.displayName}</span>
                  <span className="user-email" title={user.email}>{user.email}</span>
                </div>
                <button className="btn-logout" onClick={logout} title="로그아웃">
                  <LogOut size={14} />
                </button>
              </div>

              {/* 동기화 버튼 */}
              <button 
                className={`btn-sync-trigger ${syncStatus}`} 
                onClick={() => syncToCloud(true)}
                disabled={syncStatus === 'syncing'}
                title="클릭하여 지금 클라우드 동기화"
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <RefreshCw size={13} className="spin-icon" />
                    <span>동기화 진행 중...</span>
                  </>
                ) : syncStatus === 'synced' ? (
                  <>
                    <CheckCircle size={13} className="synced-icon" />
                    <span>클라우드 동기화됨</span>
                  </>
                ) : (
                  <>
                    <Cloud size={13} />
                    <span>클라우드에 동기화</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button className="btn-google-login" onClick={loginWithGoogle}>
              <LogIn size={15} />
              <span>Google 로그인</span>
            </button>
          )}
        </div>

        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
      </div>
    </aside>
  );
}
