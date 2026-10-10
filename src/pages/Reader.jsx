import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  MessageSquare, 
  Eye, 
  Share2, 
  Sliders, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Scroll, 
  AlignLeft, 
  AlignJustify,
  Send,
  Sparkles,
  Check,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { useStore } from '../store';
import './Reader.css';

export default function Reader() {
  const activeBook = useStore((state) => state.activeBook);
  const activeChapterId = useStore((state) => state.activeChapterId);
  const setReaderChapter = useStore((state) => state.setReaderChapter);
  const setView = useStore((state) => state.setView);
  const toggleChapterLike = useStore((state) => state.toggleChapterLike);
  const addChapterComment = useStore((state) => state.addChapterComment);
  const editChapterComment = useStore((state) => state.editChapterComment);
  const deleteChapterComment = useStore((state) => state.deleteChapterComment);
  const incrementChapterViews = useStore((state) => state.incrementChapterViews);
  const showToast = useStore((state) => state.showToast);

  // 1. 독서 설정 상태 (기본 글꼴: 가독성 최상의 'dotum/고딕'으로 설정)
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('reader_font') || 'dotum');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('reader_font_size')) || 17);
  const [lineHeight, setLineHeight] = useState(() => Number(localStorage.getItem('reader_line_height')) || 180);
  const [readerTheme, setReaderTheme] = useState(() => localStorage.getItem('reader_theme') || 'white');
  const [textAlign, setTextAlign] = useState(() => localStorage.getItem('reader_align') || 'justify');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('reader_view_mode') || 'scroll'); // 'scroll' | 'page'
  const [isWide, setIsWide] = useState(() => localStorage.getItem('reader_wide') === 'true');

  // 2. UI 토글 상태
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  
  // 3. 댓글 수정 모드 상태
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // 4. 페이지 보기 모드 상태 (1페이지 = 1소목차)
  const [currentPage, setCurrentPage] = useState(0);

  // 5. 즉시 반응(Optimistic UI) 로컬 상태
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [localComments, setLocalComments] = useState([]);

  const containerRef = useRef(null);
  const tocRef = useRef(null);
  const settingsRef = useRef(null);

  // 활성 챕터 찾기 (없으면 첫 번째 챕터)
  const chapters = activeBook?.chapters || [];
  const currentChapter = chapters.find(c => c.id === activeChapterId) || chapters[0] || null;
  const currentChapterIndex = chapters.findIndex(c => c.id === currentChapter?.id);
  const sections = currentChapter?.sections || [];

  // 챕터 로드 시 실제 조회수 1회 증가 및 로컬 상태 동기화
  useEffect(() => {
    if (currentChapter) {
      setLocalIsLiked(!!currentChapter.isUserLiked);
      setLocalLikes(currentChapter.likes || 0);
      setLocalComments(currentChapter.comments || []);
      setCurrentPage(0);
      setEditingCommentId(null);

      // 실제 조회수 증가 호출
      incrementChapterViews(currentChapter.id);

      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentChapter?.id]);

  // 설정값 변경 시 localStorage 동기화
  useEffect(() => {
    localStorage.setItem('reader_font', fontFamily);
    localStorage.setItem('reader_font_size', fontSize);
    localStorage.setItem('reader_line_height', lineHeight);
    localStorage.setItem('reader_theme', readerTheme);
    localStorage.setItem('reader_align', textAlign);
    localStorage.setItem('reader_view_mode', viewMode);
    localStorage.setItem('reader_wide', isWide);
  }, [fontFamily, fontSize, lineHeight, readerTheme, textAlign, viewMode, isWide]);

  // 팝오버 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tocRef.current && !tocRef.current.contains(e.target)) {
        setIsTocOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 페이지 모드 키보드 방향키 이동 지원
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== 'page') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentPage(prev => Math.min(sections.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, sections.length]);

  if (!activeBook || !currentChapter) {
    return (
      <div className="reader-empty-wrapper">
        <div className="reader-empty-box">
          <BookOpen size={48} className="empty-icon" />
          <h2>읽을 책 또는 챕터가 없습니다</h2>
          <p>내 서재에서 읽을 책을 선택해주세요.</p>
          <button className="reader-btn-back" onClick={() => setView('library')}>
            <ArrowLeft size={16} /> 내 서재로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 다음/이전 챕터
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null;
  const prevChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;

  // 실제 조회수 및 작가의 말
  const actualViews = (currentChapter.views || 0) + 1;
  const authorNote = currentChapter.authorNote || `${activeBook.title}을(를) 읽어주셔서 진심으로 감사드립니다. 다음 편도 기대해 주세요!`;

  // 관심(좋아요) 토글 (실제 0부터 시작하는 카운트 연동)
  const handleLikeToggle = () => {
    const nextLiked = !localIsLiked;
    const nextCount = nextLiked ? localLikes + 1 : Math.max(0, localLikes - 1);
    setLocalIsLiked(nextLiked);
    setLocalLikes(nextCount);
    toggleChapterLike(currentChapter.id);
  };

  // 댓글 등록
  const handleCommentSubmit = (e) => {
    e.preventDefault();
    const trimmed = commentInput.trim();
    if (!trimmed) return;

    const newComment = {
      id: 'cmt_' + Date.now(),
      author: '익명 독자',
      text: trimmed,
      createdAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    };

    setLocalComments(prev => [newComment, ...prev]);
    addChapterComment(currentChapter.id, trimmed);
    setCommentInput('');
  };

  // 댓글 수정 시작
  const handleStartEditComment = (cmt) => {
    setEditingCommentId(cmt.id);
    setEditingCommentText(cmt.text);
  };

  // 댓글 수정 저장
  const handleSaveEditComment = (commentId) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;

    setLocalComments(prev => prev.map(c => c.id === commentId ? { ...c, text: trimmed, editedAt: ' (수정됨)' } : c));
    editChapterComment(currentChapter.id, commentId, trimmed);
    setEditingCommentId(null);
  };

  // 댓글 삭제
  const handleDeleteComment = (commentId) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;

    setLocalComments(prev => prev.filter(c => c.id !== commentId));
    deleteChapterComment(currentChapter.id, commentId);
  };

  // 링크 공유
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('도서 링크가 클립보드에 복사되었습니다! 🔗', 'success');
    } else {
      showToast('링크 공유 준비 완료', 'info');
    }
  };

  // 소목차 이동 클릭 핸들러
  const handleJumpToSection = (sIdx, secId) => {
    setIsTocOpen(false);
    if (viewMode === 'page') {
      setCurrentPage(sIdx);
    } else {
      const el = document.getElementById(`sec-${secId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // HTML 살균 헬퍼
  const sanitize = (html) => {
    if (!html) return '<p style="color: var(--reader-text-muted); font-style: italic;">작성된 본문이 없습니다.</p>';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'br', 'hr', 'code', 'pre', 'img', 'span', 'div'],
      ALLOWED_ATTR: ['src', 'alt', 'class', 'style', 'title', 'data-type']
    });
  };

  return (
    <div 
      className={`reader-container theme-${readerTheme} font-${fontFamily} ${isWide ? 'mode-wide' : 'mode-normal'}`}
      ref={containerRef}
      style={{
        '--reader-font-size': `${fontSize}px`,
        '--reader-line-height': `${lineHeight}%`,
        '--reader-text-align': textAlign
      }}
    >
      {/* 1. 네이버웹소설 스타일 간명 슬림 상단 바 */}
      <header className="reader-header">
        <div className="reader-header-left">
          <button 
            className="reader-icon-btn" 
            onClick={() => setView('library')}
            title="내 서재로 돌아가기"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="reader-book-title" title={activeBook.title}>
            {activeBook.title}
          </span>
        </div>

        {/* 중앙: 챕터 & 소목차 드롭다운 점프 네비게이션 */}
        <div className="reader-header-center">
          <div className="reader-toc-trigger-wrap" ref={tocRef}>
            <button 
              className={`reader-chapter-dropdown-btn ${isTocOpen ? 'active' : ''}`}
              onClick={() => {
                setIsTocOpen(prev => !prev);
                setIsSettingsOpen(false);
              }}
            >
              <span className="chapter-label">
                {currentChapter.title || `제 ${currentChapterIndex + 1} 장`}
              </span>
              <ChevronDown size={15} className={`chevron-icon ${isTocOpen ? 'rotate' : ''}`} />
            </button>

            {/* 목차 & 소목차 통합 드롭다운 팝오버 */}
            {isTocOpen && (
              <div className="reader-toc-popover">
                <div className="toc-popover-header">
                  <span>목차 내비게이션</span>
                  <span className="toc-subinfo">클릭 시 즉시 이동</span>
                </div>
                <div className="toc-popover-list">
                  {chapters.map((ch, cIdx) => (
                    <div key={ch.id} className="toc-chapter-group">
                      <button
                        className={`toc-item-btn chapter-btn ${ch.id === currentChapter.id ? 'current' : ''}`}
                        onClick={() => {
                          setReaderChapter(ch.id);
                          setIsTocOpen(false);
                        }}
                      >
                        <span className="toc-item-num">{cIdx + 1}장.</span>
                        <span className="toc-item-title">{ch.title || `제 ${cIdx + 1} 장`}</span>
                        {ch.id === currentChapter.id && <span className="toc-item-badge">현재 장</span>}
                      </button>

                      {/* 현재 선택된 챕터의 소목차들 */}
                      {ch.id === currentChapter.id && ch.sections && ch.sections.length > 0 && (
                        <div className="toc-subsections-list">
                          {ch.sections.map((sec, sIdx) => (
                            <button
                              key={sec.id}
                              className={`toc-subitem-btn ${viewMode === 'page' && currentPage === sIdx ? 'active-section' : ''}`}
                              onClick={() => handleJumpToSection(sIdx, sec.id)}
                            >
                              <span className="toc-sub-num">{cIdx + 1}.{sIdx + 1}</span>
                              <span className="toc-sub-title">{sec.title || `소목차 ${sIdx + 1}`}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측 도구 바 */}
        <div className="reader-header-right">
          {/* 스크롤 ↔ 페이지 보기 토글 */}
          <button 
            className={`reader-tool-pill ${viewMode === 'page' ? 'active' : ''}`}
            onClick={() => setViewMode(prev => prev === 'scroll' ? 'page' : 'scroll')}
            title={viewMode === 'scroll' ? '한 쪽씩 넘겨보는 페이지 모드로 전환' : '아래로 내려보는 연속 스크롤 모드로 전환'}
          >
            {viewMode === 'scroll' ? <Scroll size={15} /> : <BookOpen size={15} />}
            <span className="tool-pill-txt">{viewMode === 'scroll' ? '스크롤' : '페이지'}</span>
          </button>

          {/* 기본폭 ↔ 펼침폭 토글 */}
          <button 
            className={`reader-tool-btn ${isWide ? 'active' : ''}`}
            onClick={() => setIsWide(prev => !prev)}
            title={isWide ? '기본 본문폭(760px)' : '시원한 펼침화면(1080px)'}
          >
            {isWide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* 네이버 스타일 [보기설정 ▾] 버튼 & 팝오버 */}
          <div className="reader-settings-wrap" ref={settingsRef}>
            <button 
              className={`reader-settings-btn ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => {
                setIsSettingsOpen(prev => !prev);
                setIsTocOpen(false);
              }}
            >
              <span>보기설정</span>
              <ChevronDown size={14} className={`chevron-icon ${isSettingsOpen ? 'rotate' : ''}`} />
            </button>

            {/* 네이버 스타일 미니멀 설정 팝오버 */}
            {isSettingsOpen && (
              <div className="reader-settings-popover">
                {/* 1. 폰트 선택 탭 */}
                <div className="settings-row font-tabs-row">
                  <button 
                    className={`font-tab-btn ${fontFamily === 'dotum' ? 'active' : ''}`}
                    onClick={() => setFontFamily('dotum')}
                  >
                    돋움(고딕)
                  </button>
                  <button 
                    className={`font-tab-btn ${fontFamily === 'batang' ? 'active' : ''}`}
                    onClick={() => setFontFamily('batang')}
                  >
                    바탕(명조)
                  </button>
                  <button 
                    className={`font-tab-btn ${fontFamily === 'malgun' ? 'active' : ''}`}
                    onClick={() => setFontFamily('malgun')}
                  >
                    맑은고딕
                  </button>
                </div>

                {/* 2. 글자 크기 (- 가 +) */}
                <div className="settings-row font-size-row">
                  <button 
                    className="size-stepper-btn" 
                    onClick={() => setFontSize(prev => Math.max(13, prev - 1))}
                    title="글자 작게"
                  >
                    —
                  </button>
                  <span className="size-preview-char" style={{ fontSize: `${Math.min(22, Math.max(14, fontSize))}px` }}>
                    가
                  </span>
                  <button 
                    className="size-stepper-btn" 
                    onClick={() => setFontSize(prev => Math.min(26, prev + 1))}
                    title="글자 크게"
                  >
                    +
                  </button>
                  <span className="size-number-label">{fontSize}px</span>
                </div>

                {/* 3. 테마 컬러 3종 (화이트 / 세피아 / 다크) */}
                <div className="settings-row theme-palette-row">
                  <button 
                    className={`theme-circle-btn theme-btn-white ${readerTheme === 'white' ? 'active' : ''}`}
                    onClick={() => setReaderTheme('white')}
                    title="페이퍼 화이트"
                  >
                    {readerTheme === 'white' && <Check size={14} />}
                  </button>
                  <button 
                    className={`theme-circle-btn theme-btn-sepia ${readerTheme === 'sepia' ? 'active' : ''}`}
                    onClick={() => setReaderTheme('sepia')}
                    title="아이보리 세피아"
                  >
                    {readerTheme === 'sepia' && <Check size={14} />}
                  </button>
                  <button 
                    className={`theme-circle-btn theme-btn-dark ${readerTheme === 'dark' ? 'active' : ''}`}
                    onClick={() => setReaderTheme('dark')}
                    title="올레드 다크"
                  >
                    {readerTheme === 'dark' && <Check size={14} />}
                  </button>
                </div>

                {/* 4. 줄간격 및 정렬 */}
                <div className="settings-row layout-controls-row">
                  <div className="line-height-group">
                    <span className="setting-sublabel">줄간격</span>
                    <button 
                      className={`lh-chip ${lineHeight === 160 ? 'active' : ''}`}
                      onClick={() => setLineHeight(160)}
                    >
                      160%
                    </button>
                    <button 
                      className={`lh-chip ${lineHeight === 180 ? 'active' : ''}`}
                      onClick={() => setLineHeight(180)}
                    >
                      180%
                    </button>
                    <button 
                      className={`lh-chip ${lineHeight === 210 ? 'active' : ''}`}
                      onClick={() => setLineHeight(210)}
                    >
                      210%
                    </button>
                  </div>
                  <div className="align-group">
                    <button 
                      className={`align-btn ${textAlign === 'justify' ? 'active' : ''}`}
                      onClick={() => setTextAlign('justify')}
                      title="양쪽 정렬"
                    >
                      <AlignJustify size={15} />
                    </button>
                    <button 
                      className={`align-btn ${textAlign === 'left' ? 'active' : ''}`}
                      onClick={() => setTextAlign('left')}
                      title="왼쪽 정렬"
                    >
                      <AlignLeft size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. 본문 뷰포트 영역 */}
      <main className="reader-viewport">
        {/* 문피아 스타일 챕터 메타 지표 헤더 */}
        <section className="reader-chapter-hero">
          <h1 className="chapter-hero-title">
            {currentChapter.title || `제 ${currentChapterIndex + 1} 장`}
          </h1>
          <div className="chapter-meta-band">
            <span className="meta-item meta-date">
              {currentChapter.publishedAt ? new Date(currentChapter.publishedAt).toLocaleDateString('ko-KR') : '2026. 10. 10.'}
            </span>
            <span className="meta-divider">·</span>
            <span className="meta-item">
              <Eye size={13} className="meta-icon" />
              <span>{actualViews.toLocaleString()}</span>
            </span>
            <span className="meta-divider">·</span>
            <span className="meta-item">
              <Heart size={13} className={`meta-icon ${localIsLiked ? 'text-red' : ''}`} fill={localIsLiked ? 'currentColor' : 'none'} />
              <span>{localLikes.toLocaleString()}</span>
            </span>
            <span className="meta-divider">·</span>
            <span className="meta-item">
              <MessageSquare size={13} className="meta-icon" />
              <span>{localComments.length}</span>
            </span>
          </div>
        </section>

        {/* 본문 렌더링: 스크롤 모드 vs 페이지 모드 분기 */}
        {viewMode === 'scroll' ? (
          /* [스크롤 모드]: 모든 소목차가 차례대로 연속 렌더링 */
          <div className="reader-sections-scroll-flow">
            {sections.length === 0 ? (
              <article className="reader-body-content">
                <p style={{ color: 'var(--reader-text-muted)', fontStyle: 'italic' }}>아직 작성된 본문이 없습니다.</p>
              </article>
            ) : (
              sections.map((sec, sIdx) => (
                <section key={sec.id || sIdx} id={`sec-${sec.id}`} className="reader-section-block">
                  <h2 className="section-block-title">
                    <span className="section-num">{currentChapterIndex + 1}.{sIdx + 1}</span> {sec.title}
                  </h2>
                  <article 
                    className="reader-body-content"
                    dangerouslySetInnerHTML={{ __html: sanitize(sec.content) }}
                  />
                </section>
              ))
            )}
          </div>
        ) : (
          /* [페이지 모드]: 한 쪽씩(소목차 1꼭지씩) 분할 렌더링 & 이전/다음 네비게이터 */
          <div className="reader-page-viewport-wrapper">
            {sections.length === 0 ? (
              <article className="reader-body-content">
                <p style={{ color: 'var(--reader-text-muted)', fontStyle: 'italic' }}>작성된 본문이 없습니다.</p>
              </article>
            ) : (
              <div className="reader-single-page-card">
                <div className="page-header-info">
                  <span className="page-chapter-label">{currentChapter.title}</span>
                  <span className="page-counter-badge">{currentPage + 1} / {sections.length} 쪽</span>
                </div>

                <h2 className="section-block-title">
                  <span className="section-num">{currentChapterIndex + 1}.{currentPage + 1}</span> {sections[currentPage]?.title}
                </h2>

                <article 
                  className="reader-body-content"
                  dangerouslySetInnerHTML={{ __html: sanitize(sections[currentPage]?.content) }}
                />

                {/* 페이지 넘김 하단 컨트롤 바 */}
                <div className="page-navigation-bar">
                  <button 
                    className="page-nav-btn prev"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft size={16} />
                    <span>이전 쪽</span>
                  </button>
                  <span className="page-indicator-text">{currentPage + 1} / {sections.length} 쪽</span>
                  <button 
                    className="page-nav-btn next"
                    disabled={currentPage >= sections.length - 1}
                    onClick={() => setCurrentPage(prev => Math.min(sections.length - 1, prev + 1))}
                  >
                    <span>다음 쪽</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. 본문 하단 소통 및 네비게이션 섹션 */}
        <footer className="reader-bottom-section">
          {/* 네이버웹소설 스타일: ✍️ 작가의 말 카드 */}
          <div className="reader-author-note-card">
            <div className="author-note-header">
              <div className="author-note-title">
                <Sparkles size={16} className="sparkle-icon" />
                <span>작가의 말</span>
              </div>
              <span className="author-name">{activeBook.author || '연재 작가'}</span>
            </div>
            <p className="author-note-body">
              {authorNote}
            </p>
          </div>

          {/* 관심(좋아요) & 공유 액션 바 */}
          <div className="reader-action-bar">
            <button 
              className={`action-btn-like ${localIsLiked ? 'liked' : ''}`}
              onClick={handleLikeToggle}
            >
              <Heart size={18} fill={localIsLiked ? 'currentColor' : 'none'} />
              <span>관심 {localLikes}</span>
            </button>
            <button className="action-btn-share" onClick={handleShare}>
              <Share2 size={17} />
              <span>공유</span>
            </button>
          </div>

          {/* 다음 장 이어보기 퀵 카드 */}
          {nextChapter && (
            <div className="reader-next-chapter-card" onClick={() => setReaderChapter(nextChapter.id)}>
              <div className="next-card-info">
                <span className="next-card-subtitle">다음 장 이어보기</span>
                <span className="next-card-title">{nextChapter.title || `제 ${currentChapterIndex + 2} 장`}</span>
              </div>
              <div className="next-card-arrow">
                <span>읽기</span>
                <ChevronRight size={18} />
              </div>
            </div>
          )}

          {/* 독자 댓글 섹션 */}
          <section className="reader-comment-section">
            <div className="comment-header">
              <h3>
                <MessageSquare size={17} />
                <span>독자 댓글</span>
                <span className="comment-count">({localComments.length})</span>
              </h3>
            </div>

            {/* 댓글 입력 폼 */}
            <form className="comment-input-form" onSubmit={handleCommentSubmit}>
              <input 
                type="text" 
                placeholder="작품과 작가님을 향한 따뜻한 한 줄 응원을 남겨보세요."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="comment-input"
              />
              <button type="submit" className="comment-submit-btn" disabled={!commentInput.trim()}>
                <Send size={15} />
                <span>등록</span>
              </button>
            </form>

            {/* 댓글 목록 (수정 / 삭제 기능 탑재) */}
            <div className="comment-list">
              {localComments.length === 0 ? (
                <div className="comment-empty">
                  첫 번째 응원 댓글의 주인공이 되어보세요! ✨
                </div>
              ) : (
                localComments.map((cmt) => (
                  <div key={cmt.id} className="comment-item">
                    <div className="comment-item-meta">
                      <div className="comment-author-group">
                        <span className="comment-author">{cmt.author}</span>
                        <span className="comment-date">
                          {cmt.createdAt}
                          {cmt.editedAt && <span className="comment-edited-tag">{cmt.editedAt}</span>}
                        </span>
                      </div>
                      {/* 우측 연필(수정) 및 휴지통(삭제) 아이콘 액션 */}
                      <div className="comment-item-actions">
                        {editingCommentId !== cmt.id ? (
                          <>
                            <button 
                              className="comment-action-icon-btn" 
                              onClick={() => handleStartEditComment(cmt)}
                              title="댓글 수정"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              className="comment-action-icon-btn btn-del" 
                              onClick={() => handleDeleteComment(cmt.id)}
                              title="댓글 삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* 인라인 수정 폼 vs 텍스트 표시 */}
                    {editingCommentId === cmt.id ? (
                      <div className="comment-inline-edit-box">
                        <input
                          type="text"
                          className="comment-edit-input"
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          autoFocus
                        />
                        <div className="comment-edit-actions">
                          <button 
                            className="btn-edit-save"
                            onClick={() => handleSaveEditComment(cmt.id)}
                          >
                            <Check size={12} />
                            <span>완료</span>
                          </button>
                          <button 
                            className="btn-edit-cancel"
                            onClick={() => setEditingCommentId(null)}
                          >
                            <X size={12} />
                            <span>취소</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="comment-text">{cmt.text}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </footer>
      </main>
    </div>
  );
}
