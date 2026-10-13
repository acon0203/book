import React from 'react';
import './Sidebar.css';
import { useStore } from '../store';
import { 
  BookOpen, Edit3, Award, Settings, Sun, Moon, 
  Cloud, RefreshCw, LogIn, LogOut, CheckCircle, Check,
  Flame, BookCheck, Palette, BookMarked
} from 'lucide-react';

export default function Sidebar() {
  const {
    currentView, setView, theme, toggleTheme,
    activeBook, books, openBook, showToast, showActionToast, setNewBookModalOpen,
    user, loginWithGoogle, logout, syncStatus, syncToCloud
  } = useStore();

  // 작가 표시명 (1순위: [서재 관리]의 기본 필명/작가명, 2순위: 구글 로그인명, 3순위: '연재 작가')
  const authorDisplayName = (() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('bookstudio_config') || '{}');
      if (cfg.defaultAuthor && cfg.defaultAuthor.trim()) {
        const name = cfg.defaultAuthor.trim();
        return name.endsWith('작가') ? name : `${name} 작가`;
      }
    } catch {}
    if (user?.displayName) {
      const name = user.displayName.trim();
      return name.endsWith('작가') ? name : `${name} 작가`;
    }
    return '연재 작가';
  })();
  const avatarInitial = (authorDisplayName || '작').replace(/작가$/, '').trim()[0] || '작';

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
        <div className="brand-icon">
          <BookMarked size={18} />
        </div>
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
        {/* 작가 프로필 & 우측 상단 유틸리티 아이콘(동기화, 로그아웃) */}
        <div className="side-user-box">
          <div className="side-user-left">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={authorDisplayName} className="side-user-avatar-img" />
            ) : (
              <div className="side-user-avatar">
                {avatarInitial}
              </div>
            )}
            <div className="side-user-info">
              <span className="side-user-name">{authorDisplayName}</span>
              <span className="side-user-role">Personal Atelier</span>
            </div>
          </div>

          {/* 프로필 우측상단 액션 아이콘들 (동기화 & 로그아웃) */}
          <div className="side-user-actions">
            <button
              type="button"
              className={`side-action-btn sync-btn ${syncStatus}`}
              onClick={(e) => {
                e.stopPropagation();
                syncToCloud(true);
              }}
              disabled={syncStatus === 'syncing'}
              title={
                syncStatus === 'syncing' 
                  ? '클라우드 동기화 진행 중...' 
                  : syncStatus === 'synced' 
                    ? '클라우드 동기화 완료 (클릭하여 다시 동기화)' 
                    : '클라우드에 동기화'
              }
            >
              {syncStatus === 'syncing' ? (
                <RefreshCw size={13} className="spin-icon" />
              ) : syncStatus === 'synced' ? (
                <Check size={14} className="text-green synced-check-icon" strokeWidth={2.5} />
              ) : (
                <Cloud size={13} />
              )}
            </button>

            {user ? (
              <button
                type="button"
                className="side-action-btn logout-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                }}
                title={`로그아웃 (${user.displayName || user.email})`}
              >
                <LogOut size={13} />
              </button>
            ) : (
              <button
                type="button"
                className="side-action-btn login-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  loginWithGoogle();
                }}
                title="Google 계정 로그인"
              >
                <LogIn size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
