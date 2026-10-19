import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  BookOpen, 
  Scroll, 
  AlignLeft, 
  AlignJustify,
  Send,
  Check,
  Edit2,
  Trash2,
  Columns2,
  Square
} from 'lucide-react';
import { useStore } from '../store';
import './Reader.css';

export default function Reader() {
  const activeBook = useStore((state) => state.activeBook);
  const activeChapterId = useStore((state) => state.activeChapterId);
  const setReaderChapter = useStore((state) => state.setReaderChapter);
  const setView = useStore((state) => state.setView);
  const closeReader = useStore((state) => state.closeReader);
  const toggleChapterLike = useStore((state) => state.toggleChapterLike);
  const addChapterComment = useStore((state) => state.addChapterComment);
  const editChapterComment = useStore((state) => state.editChapterComment);
  const deleteChapterComment = useStore((state) => state.deleteChapterComment);
  const incrementChapterViews = useStore((state) => state.incrementChapterViews);
  const showToast = useStore((state) => state.showToast);
  const openConfirm = useStore((state) => state.openConfirm);

  // 1. 독서 환경 설정 상태
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('reader_font') || 'dotum');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('reader_font_size')) || 17);
  const [lineHeight, setLineHeight] = useState(() => Number(localStorage.getItem('reader_line_height')) || 180);
  const [readerTheme, setReaderTheme] = useState(() => localStorage.getItem('reader_theme') || 'white');
  const [textAlign, setTextAlign] = useState(() => localStorage.getItem('reader_align') || 'justify');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('reader_view_mode') || 'page'); // 'page' | 'scroll'
  const [pageSpread, setPageSpread] = useState(() => localStorage.getItem('reader_page_spread') || 'single'); // 'single' (한쪽) | 'double' (두쪽)
  const [isWide, setIsWide] = useState(() => localStorage.getItem('reader_wide') === 'true');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('reader_accent_color') || 'default');

  // 2. UI 토글 팝오버 상태
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  
  // 3. 댓글 수정 모드 상태
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // 4. 진짜 책 판형 기준 페이지뷰 상태
  const [currentPage, setCurrentPage] = useState(0); // 0-based column index
  const [totalPages, setTotalPages] = useState(1);
  const [stageWidth, setStageWidth] = useState(720);

  // 5. 반응형 로컬 상태
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [localComments, setLocalComments] = useState([]);

  const containerRef = useRef(null);
  const tocRef = useRef(null);
  const settingsRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);

  // 활성 챕터 찾기 (없으면 첫 번째 챕터)
  const chapters = activeBook?.chapters || [];
  const currentChapter = chapters.find(c => c.id === activeChapterId) || chapters[0] || null;
  const currentChapterIndex = chapters.findIndex(c => c.id === currentChapter?.id);
  const sections = currentChapter?.sections || [];

  // 다음/이전 챕터
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null;
  const prevChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;

  // 챕터 로드 시 실제 조회수 증가 및 초기화
  useEffect(() => {
    if (currentChapter) {
      setLocalIsLiked(!!currentChapter.isUserLiked);
      setLocalLikes(currentChapter.likes || 0);
      setLocalComments(currentChapter.comments || []);
      setCurrentPage(0);
      setEditingCommentId(null);

      incrementChapterViews(currentChapter.id);

      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentChapter?.id]);

  // 설정값 localStorage 동기화
  useEffect(() => {
    localStorage.setItem('reader_font', fontFamily);
    localStorage.setItem('reader_font_size', fontSize);
    localStorage.setItem('reader_line_height', lineHeight);
    localStorage.setItem('reader_theme', readerTheme);
    localStorage.setItem('reader_align', textAlign);
    localStorage.setItem('reader_view_mode', viewMode);
    localStorage.setItem('reader_page_spread', pageSpread);
    localStorage.setItem('reader_wide', isWide);
    localStorage.setItem('reader_accent_color', accentColor);
  }, [fontFamily, fontSize, lineHeight, readerTheme, textAlign, viewMode, pageSpread, isWide, accentColor]);

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

  // 📖 다단 계산에 필요한 간격 및 너비 산출
  const colGap = pageSpread === 'double' ? 56 : 0;
  const colWidth = pageSpread === 'double' 
    ? Math.floor((stageWidth - colGap) / 2)
    : stageWidth;
  const stepDistance = pageSpread === 'double' ? (stageWidth + colGap) : (colWidth + 48);
  const stepPageCount = pageSpread === 'double' ? 2 : 1;

  // 📖 [핵심 엔진]: 실제 화면/판형 기준 정밀 페이지 계산
  const calculatePages = useCallback(() => {
    if (viewMode !== 'page' || !stageRef.current || !trackRef.current) return;
    
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!stage || !track) return;
      
      const width = stage.clientWidth;
      if (width <= 0) return;
      setStageWidth(width);

      const currentGap = pageSpread === 'double' ? 56 : 0;
      const currentColW = pageSpread === 'double' 
        ? Math.floor((width - currentGap) / 2) 
        : width;

      const scrollW = track.scrollWidth;
      // 전체 단(컬럼) 수 계산
      const calculatedCols = Math.max(1, Math.round((scrollW + (currentGap > 0 ? currentGap / 2 : 0)) / (currentColW + (currentGap > 0 ? currentGap : 0))));
      setTotalPages(calculatedCols);

      setCurrentPage((prev) => {
        const maxPage = pageSpread === 'double' 
          ? Math.max(0, (Math.ceil(calculatedCols / 2) - 1) * 2) 
          : calculatedCols - 1;
        return Math.min(prev, maxPage);
      });
    });
  }, [viewMode, pageSpread]);

  // 판형 크기, 글자 크기, 줄간격, 폰트, 챕터, 보기 모드 변경 시 재계산
  useEffect(() => {
    if (viewMode !== 'page') return;

    const timer = setTimeout(() => {
      calculatePages();
    }, 60);

    return () => clearTimeout(timer);
  }, [viewMode, pageSpread, currentChapter?.id, sections, fontSize, lineHeight, fontFamily, isWide, calculatePages]);

  // 뷰포트 크기 변화 감지 (ResizeObserver)
  useEffect(() => {
    if (viewMode !== 'page' || !stageRef.current) return;

    const ro = new ResizeObserver(() => {
      calculatePages();
    });
    ro.observe(stageRef.current);

    return () => ro.disconnect();
  }, [viewMode, calculatePages]);

  // 페이지 이동 핸들러 (이전 쪽)
  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((prev) => Math.max(0, prev - stepPageCount));
    } else if (prevChapter) {
      setReaderChapter(prevChapter.id);
      showToast(`이전 챕터 '${prevChapter.title || '이전 장'}'으로 이동했습니다.`, 'info', 1800);
    }
  }, [currentPage, stepPageCount, prevChapter, setReaderChapter, showToast]);

  // 페이지 이동 핸들러 (다음 쪽)
  const handleNextPage = useCallback(() => {
    const isAtEnd = pageSpread === 'double' 
      ? currentPage + 2 >= totalPages 
      : currentPage >= totalPages - 1;

    if (!isAtEnd) {
      setCurrentPage((prev) => prev + stepPageCount);
    } else if (nextChapter) {
      setReaderChapter(nextChapter.id);
      showToast(`다음 챕터 '${nextChapter.title || '다음 장'}'으로 이동했습니다.`, 'info', 1800);
    }
  }, [currentPage, totalPages, stepPageCount, pageSpread, nextChapter, setReaderChapter, showToast]);

  // 페이지 모드 키보드 방향키 및 스페이스바 이동
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== 'page') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, handleNextPage, handlePrevPage]);

  // ESC 키 화면 닫기 및 뒤로가기
  const handleBack = () => {
    if (window.history.state?.view === 'reader') {
      window.history.back();
    } else {
      closeReader();
    }
  };

  useEffect(() => {
    window.history.pushState({ view: 'reader' }, '');
    const handlePopState = () => closeReader();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isTocOpen) setIsTocOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else handleBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeReader, isTocOpen, isSettingsOpen]);

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

  const actualViews = (currentChapter.views || 0) + 1;
  const authorNote = currentChapter.authorNote || `${activeBook.title}을(를) 읽어주셔서 진심으로 감사드립니다.`;

  // 관심(좋아요) 토글
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
      author: '독자',
      text: trimmed,
      createdAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    };

    setLocalComments(prev => [newComment, ...prev]);
    addChapterComment(currentChapter.id, trimmed);
    setCommentInput('');
  };

  // 댓글 수정
  const handleSaveEditComment = (commentId) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    setLocalComments(prev => prev.map(c => c.id === commentId ? { ...c, text: trimmed, editedAt: ' (수정됨)' } : c));
    editChapterComment(currentChapter.id, commentId, trimmed);
    setEditingCommentId(null);
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId) => {
    const ok = await openConfirm({
      title: '댓글 삭제',
      message: '이 댓글을 삭제하시겠습니까?',
      danger: true,
      confirmText: '삭제'
    });
    if (!ok) return;
    setLocalComments(prev => prev.filter(c => c.id !== commentId));
    deleteChapterComment(currentChapter.id, commentId);
  };

  // 링크 공유
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('도서 링크가 클립보드에 복사되었습니다.', 'success');
    } else {
      showToast('링크 공유 준비 완료', 'info');
    }
  };

  // 소목차 이동
  const handleJumpToSection = (secId) => {
    setIsTocOpen(false);
    if (viewMode === 'scroll') {
      const el = document.getElementById(`sec-${secId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const targetEl = document.getElementById(`page-sec-${secId}`);
      if (targetEl && stageRef.current) {
        const offsetLeft = targetEl.offsetLeft;
        const pageCol = Math.floor(offsetLeft / (colWidth + colGap));
        const targetPage = pageSpread === 'double' ? Math.floor(pageCol / 2) * 2 : pageCol;
        setCurrentPage(Math.min(totalPages - 1, Math.max(0, targetPage)));
      }
    }
  };

  // HTML 살균 헬퍼
  const sanitize = (html) => {
    if (!html) return '<p class="reader-empty-p">작성된 본문이 없습니다.</p>';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'br', 'hr', 'code', 'pre', 'img', 'span', 'div'],
      ALLOWED_ATTR: ['src', 'alt', 'class', 'style', 'title', 'data-type']
    });
  };

  // 페이지 표시 라벨 계산 (예: 한쪽: '3 / 24 쪽', 두쪽: '3-4 / 24 쪽')
  const renderPageIndicator = () => {
    if (pageSpread === 'single') {
      return (
        <>
          <strong>{currentPage + 1}</strong> / {totalPages} 쪽
          <span className="page-pct-sub">({Math.round(((currentPage + 1) / totalPages) * 100)}%)</span>
        </>
      );
    }
    const endP = Math.min(totalPages, currentPage + 2);
    const startP = currentPage + 1;
    const label = startP === endP ? `${startP}` : `${startP}–${endP}`;
    return (
      <>
        <strong>{label}</strong> / {totalPages} 쪽
        <span className="page-pct-sub">({Math.round((endP / totalPages) * 100)}%)</span>
      </>
    );
  };

  // 슬라이드 이동 픽셀 계산
  const slideOffset = pageSpread === 'double'
    ? Math.floor(currentPage / 2) * stepDistance
    : currentPage * (colWidth + colGap);

  return (
    <div 
      className={`reader-container theme-${readerTheme} font-${fontFamily} ${isWide ? 'mode-wide' : 'mode-normal'}`}
      ref={containerRef}
      style={{
        '--reader-font-size': `${fontSize}px`,
        '--reader-line-height': (lineHeight / 100).toFixed(2), // 순수 배수 단위 (1.6, 1.8, 2.1)로 겹침 버그 완벽 차단!
        '--reader-text-align': textAlign,
        ...(accentColor !== 'default' ? { '--reader-accent-custom': accentColor } : {})
      }}
    >
      {/* 1. 표준 미니멀 상단 네비게이션 헤더 (52px 고정) */}
      <header className="reader-header">
        <div className="reader-header-left">
          <button 
            className="reader-icon-btn" 
            onClick={handleBack}
            title="이전 화면으로 돌아가기 (ESC)"
          >
            <ArrowLeft size={17} />
          </button>
          <span className="reader-book-title" title={activeBook.title}>
            {activeBook.title}
          </span>
        </div>

        {/* 중앙: 챕터 & 목차 드롭다운 점프 */}
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
              <ChevronDown size={14} className={`chevron-icon ${isTocOpen ? 'rotate' : ''}`} />
            </button>

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
                        <span className="ch-num">제 {cIdx + 1} 장</span>
                        <span className="ch-title">{ch.title}</span>
                      </button>

                      {ch.id === currentChapter.id && Array.isArray(ch.sections) && ch.sections.length > 0 && (
                        <div className="toc-sections-sublist">
                          {ch.sections.map((sec, sIdx) => (
                            <button
                              key={sec.id || sIdx}
                              className="toc-item-btn section-btn"
                              onClick={() => handleJumpToSection(sec.id)}
                            >
                              <span className="sec-dot" />
                              <span className="sec-num">{cIdx + 1}.{sIdx + 1}</span>
                              <span className="sec-title">{sec.title}</span>
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

        {/* 우측: 읽기 모드 전환 & 두쪽/한쪽 보기 & 보기 설정 */}
        <div className="reader-header-right">
          {/* 스크롤 모드 ↔ 쪽 모드 전환 */}
          <div className="reader-view-mode-toggle" title="읽기 방식 전환">
            <button 
              className={`mode-toggle-chip ${viewMode === 'scroll' ? 'active' : ''}`}
              onClick={() => setViewMode('scroll')}
              title="연속 스크롤 방식"
            >
              <Scroll size={13} />
              <span>스크롤</span>
            </button>
            <button 
              className={`mode-toggle-chip ${viewMode === 'page' ? 'active' : ''}`}
              onClick={() => setViewMode('page')}
              title="실제 책장 넘김 방식"
            >
              <BookOpen size={13} />
              <span>책장 넘김</span>
            </button>
          </div>

          {/* 📖 책장 넘김 모드일 때: [한쪽 보기] ↔ [두쪽 보기] 즉시 토글 */}
          {viewMode === 'page' && (
            <div className="reader-spread-toggle" title="책장 보기 방식 (한쪽 / 두쪽)">
              <button 
                className={`spread-toggle-btn ${pageSpread === 'single' ? 'active' : ''}`}
                onClick={() => setPageSpread('single')}
                title="한쪽 보기 (1페이지)"
              >
                <Square size={12} />
                <span>한쪽</span>
              </button>
              <button 
                className={`spread-toggle-btn ${pageSpread === 'double' ? 'active' : ''}`}
                onClick={() => setPageSpread('double')}
                title="두쪽 보기 (양면 펼침)"
              >
                <Columns2 size={13} />
                <span>두쪽</span>
              </button>
            </div>
          )}

          {/* 보기 설정 팝오버 버튼 */}
          <div className="reader-settings-wrap" ref={settingsRef}>
            <button 
              className={`reader-settings-btn ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => {
                setIsSettingsOpen(prev => !prev);
                setIsTocOpen(false);
              }}
              title="글꼴, 크기 및 테마 설정"
            >
              <Sliders size={14} />
              <span>보기설정</span>
              <ChevronDown size={13} className={`chevron-icon ${isSettingsOpen ? 'rotate' : ''}`} />
            </button>

            {isSettingsOpen && (
              <div className="reader-settings-popover">
                {/* 1. 폰트 선택 탭 */}
                <div className="settings-row font-tabs-row">
                  <span className="setting-sublabel">글꼴</span>
                  <div className="font-btn-group">
                    <button 
                      className={`font-tab-btn ${fontFamily === 'dotum' ? 'active' : ''}`}
                      onClick={() => setFontFamily('dotum')}
                    >
                      고딕
                    </button>
                    <button 
                      className={`font-tab-btn ${fontFamily === 'batang' ? 'active' : ''}`}
                      onClick={() => setFontFamily('batang')}
                    >
                      명조(바탕)
                    </button>
                    <button 
                      className={`font-tab-btn ${fontFamily === 'malgun' ? 'active' : ''}`}
                      onClick={() => setFontFamily('malgun')}
                    >
                      맑은고딕
                    </button>
                  </div>
                </div>

                {/* 2. 글자 크기 */}
                <div className="settings-row font-size-row">
                  <span className="setting-sublabel">크기</span>
                  <div className="size-stepper-wrap">
                    <button 
                      className="size-stepper-btn" 
                      onClick={() => setFontSize(prev => Math.max(13, prev - 1))}
                      title="글자 작게"
                    >
                      —
                    </button>
                    <span className="size-number-label">{fontSize}px</span>
                    <button 
                      className="size-stepper-btn" 
                      onClick={() => setFontSize(prev => Math.min(26, prev + 1))}
                      title="글자 크게"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. 테마 컬러 3종 */}
                <div className="settings-row theme-palette-row">
                  <span className="setting-sublabel">테마</span>
                  <div className="theme-circles-wrap">
                    <button 
                      className={`theme-circle-btn theme-btn-white ${readerTheme === 'white' ? 'active' : ''}`}
                      onClick={() => setReaderTheme('white')}
                      title="종이책 화이트"
                    >
                      {readerTheme === 'white' && <Check size={13} />}
                    </button>
                    <button 
                      className={`theme-circle-btn theme-btn-sepia ${readerTheme === 'sepia' ? 'active' : ''}`}
                      onClick={() => setReaderTheme('sepia')}
                      title="클래식 세피아"
                    >
                      {readerTheme === 'sepia' && <Check size={13} />}
                    </button>
                    <button 
                      className={`theme-circle-btn theme-btn-dark ${readerTheme === 'dark' ? 'active' : ''}`}
                      onClick={() => setReaderTheme('dark')}
                      title="심야 다크"
                    >
                      {readerTheme === 'dark' && <Check size={13} />}
                    </button>
                  </div>
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
                      <AlignJustify size={14} />
                    </button>
                    <button 
                      className={`align-btn ${textAlign === 'left' ? 'active' : ''}`}
                      onClick={() => setTextAlign('left')}
                      title="왼쪽 정렬"
                    >
                      <AlignLeft size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. 본문 뷰포트 영역 */}
      <main className={`reader-viewport ${viewMode === 'page' ? 'page-mode-active' : 'scroll-mode-active'}`}>
        {viewMode === 'scroll' ? (
          /* [스크롤 모드]: 전통적인 웹툰/웹소설식 연속 스크롤 렌더링 */
          <div className="reader-scroll-container">
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

            <div className="reader-sections-scroll-flow">
              {sections.length === 0 ? (
                <article className="reader-body-content">
                  <p className="reader-empty-p">작성된 본문이 없습니다.</p>
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

            {/* 하단 챕터 이동 버튼 */}
            <div className="reader-scroll-chapter-nav">
              <button 
                className="scroll-nav-btn prev"
                disabled={!prevChapter}
                onClick={() => prevChapter && setReaderChapter(prevChapter.id)}
              >
                <ChevronLeft size={16} />
                <span>이전 장 ({prevChapter?.title || '없음'})</span>
              </button>
              <button 
                className="scroll-nav-btn next"
                disabled={!nextChapter}
                onClick={() => nextChapter && setReaderChapter(nextChapter.id)}
              >
                <span>다음 장 ({nextChapter?.title || '없음'})</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* 📖 [페이지 모드]: 실제 책 판형 기준 Multi-Column 엔진 (한쪽 / 두쪽 보기 완벽 지원) */
          <div className="reader-book-stage-wrapper">
            {/* 좌우 클릭 넘김 감지 터치존 */}
            <div 
              className="reader-page-click-zone left"
              onClick={handlePrevPage}
              title="이전 쪽 (← / PageUp)"
            >
              <span className="zone-indicator">
                <ChevronLeft size={24} />
              </span>
            </div>
            <div 
              className="reader-page-click-zone right"
              onClick={handleNextPage}
              title="다음 쪽 (→ / Space / PageDown)"
            >
              <span className="zone-indicator">
                <ChevronRight size={24} />
              </span>
            </div>

            {/* 실제 책 판형 무대 (한쪽: 720px / 두쪽: 1160px) */}
            <div 
              className={`reader-book-stage spread-${pageSpread}`} 
              ref={stageRef}
            >
              <div 
                className={`reader-book-track spread-${pageSpread}`}
                ref={trackRef}
                style={{
                  columnWidth: `${colWidth}px`,
                  columnGap: `${colGap}px`,
                  transform: `translateX(-${slideOffset}px)`
                }}
              >
                {/* 챕터 시작 머리글 (1페이지 상단에 정갈하게 안착) */}
                <section className="reader-chapter-hero page-hero">
                  <div className="page-chapter-badge">제 {currentChapterIndex + 1} 장</div>
                  <h1 className="chapter-hero-title">
                    {currentChapter.title || `제 ${currentChapterIndex + 1} 장`}
                  </h1>
                </section>

                {/* 소목차 연속 스트림 (다단 컬럼이 책 크기에 맞춰 자연스럽게 자동 분할) */}
                {sections.length === 0 ? (
                  <article className="reader-body-content">
                    <p className="reader-empty-p">작성된 본문이 없습니다.</p>
                  </article>
                ) : (
                  sections.map((sec, sIdx) => (
                    <section key={sec.id || sIdx} id={`page-sec-${sec.id}`} className="reader-section-block page-section">
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
            </div>

            {/* 실제 책 느낌의 하단 고정 페이지 내비게이션 바 (52px 고정) */}
            <div className="reader-page-footer">
              <button 
                className="page-nav-action-btn prev"
                disabled={currentPage === 0 && !prevChapter}
                onClick={handlePrevPage}
                title="이전 쪽"
              >
                <ChevronLeft size={16} />
                <span>이전 쪽</span>
              </button>

              <div className="page-footer-center">
                <div className="page-progress-track">
                  <div 
                    className="page-progress-fill" 
                    style={{ width: `${Math.min(100, Math.round(((currentPage + (pageSpread === 'double' ? 2 : 1)) / totalPages) * 100))}%` }}
                  />
                </div>
                <span className="page-counter-label">
                  {renderPageIndicator()}
                </span>
              </div>

              <button 
                className="page-nav-action-btn next"
                disabled={(pageSpread === 'double' ? currentPage + 2 >= totalPages : currentPage >= totalPages - 1) && !nextChapter}
                onClick={handleNextPage}
                title="다음 쪽"
              >
                <span>다음 쪽</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* 3. 본문 하단 소통 & 댓글 섹션 (스크롤 모드 전용) */}
        {viewMode === 'scroll' && (
          <footer className="reader-bottom-section">
            <div className="reader-author-note-card">
              <div className="author-note-header">
                <span className="author-note-tag">작가의 말</span>
                <span className="author-name">{activeBook.author || '연재 작가'}</span>
              </div>
              <p className="author-note-body">{authorNote}</p>
            </div>

            <div className="reader-action-bar">
              <button 
                className={`action-btn-like ${localIsLiked ? 'liked' : ''}`}
                onClick={handleLikeToggle}
              >
                <Heart size={16} fill={localIsLiked ? 'currentColor' : 'none'} />
                <span>관심 {localLikes}</span>
              </button>
              <button className="action-btn-share" onClick={handleShare}>
                <Share2 size={16} />
                <span>도서 링크 공유</span>
              </button>
            </div>

            <div className="reader-comments-section">
              <div className="comments-header">
                <h3>독자 소통 <span className="comment-count">({localComments.length})</span></h3>
              </div>

              <form className="comment-input-form" onSubmit={handleCommentSubmit}>
                <input 
                  type="text" 
                  className="comment-input-field" 
                  placeholder="작가님에게 따뜻한 응원의 한마디를 남겨주세요..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                />
                <button type="submit" className="comment-submit-btn" disabled={!commentInput.trim()}>
                  <Send size={14} />
                  <span>등록</span>
                </button>
              </form>

              <div className="comments-list">
                {localComments.length === 0 ? (
                  <p className="empty-comments-text">첫 번째 응원의 댓글을 남겨보세요.</p>
                ) : (
                  localComments.map((cmt) => (
                    <div key={cmt.id} className="comment-card">
                      <div className="comment-meta">
                        <span className="comment-author">{cmt.author}</span>
                        <div className="comment-meta-right">
                          <span className="comment-date">{cmt.createdAt}{cmt.editedAt}</span>
                          <button 
                            className="comment-action-btn edit" 
                            onClick={() => {
                              setEditingCommentId(cmt.id);
                              setEditingCommentText(cmt.text);
                            }}
                            title="댓글 수정"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            className="comment-action-btn delete" 
                            onClick={() => handleDeleteComment(cmt.id)}
                            title="댓글 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {editingCommentId === cmt.id ? (
                        <div className="comment-edit-wrap">
                          <input 
                            type="text" 
                            className="comment-edit-input" 
                            value={editingCommentText} 
                            onChange={(e) => setEditingCommentText(e.target.value)} 
                          />
                          <div className="comment-edit-btns">
                            <button className="edit-btn save" onClick={() => handleSaveEditComment(cmt.id)}>저장</button>
                            <button className="edit-btn cancel" onClick={() => setEditingCommentId(null)}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <p className="comment-text">{cmt.text}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
