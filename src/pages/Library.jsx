import React, { useEffect, useState } from 'react';
import './Library.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { 
  calcAuthorStats, 
  getDailyQuote, 
  getDailyReadingQuote, 
  calcReaderStats 
} from '../utils/authorStats';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  ArrowRight, 
  BookOpen, 
  Flame, 
  Bookmark, 
  Clock, 
  Play, 
  Compass,
  Zap,
  Edit2,
  Edit3,
  UploadCloud
} from 'lucide-react';
import ManuscriptImportModal from '../components/ManuscriptImportModal';
import BookInfoModal from '../components/BookInfoModal';

export default function Library() {
  const {
    books, loadBooks, openBook, openReader, deleteBook, isBooksLoading, showToast,
    isNewBookModalOpen, setNewBookModalOpen, setView, activeBook, user, openConfirm,
    toggleBookCompleted
  } = useStore();

  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });
  const [libraryTab, setLibraryTab] = useState(() => localStorage.getItem('library_active_tab') || 'author'); // 'author' | 'reader'
  const [readingHistory, setReadingHistory] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);

  const loadReadingHistory = () => {
    try {
      const raw = localStorage.getItem('reader_history') || '[]';
      const parsed = JSON.parse(raw);
      setReadingHistory(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setReadingHistory([]);
    }
  };

  useEffect(() => {
    loadBooks();
    loadReadingHistory();
    bookService.getStats().then(setBaseStats).catch(console.error);
  }, [loadBooks]);

  // ESC 키로 새 책 만들기 모달 닫기
  useEffect(() => {
    if (!isNewBookModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setNewBookModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewBookModalOpen, setNewBookModalOpen]);

  const authorStats = calcAuthorStats(books, baseStats);
  const readerStats = calcReaderStats(readingHistory);
  const quote = getDailyQuote();
  const readingQuote = getDailyReadingQuote();

  // 최근 집필 도서 (activeBook 또는 가장 최근 수정된 도서)
  const recentWritingBook = activeBook || (books.length > 0 ? [...books].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] : null);
  // 최근 독서 도서 (readingHistory 최상단 항목)
  const recentReadingBook = readingHistory.length > 0 ? readingHistory[0] : null;

  // 집필 서재용 최근 작업 챕터 추출 헬퍼
  const getLatestWritingChapter = (book) => {
    if (!book?.chapters || book.chapters.length === 0) return '새 챕터 기획 중';
    const sorted = [...book.chapters].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return sorted[0]?.title || book.chapters[0]?.title || '새 챕터 기획 중';
  };

  const handleTabChange = (tab) => {
    setLibraryTab(tab);
    localStorage.setItem('library_active_tab', tab);
    if (tab === 'reader') {
      loadReadingHistory();
    }
  };

  const handleRemoveHistory = (e, bookId) => {
    e.stopPropagation();
    const next = readingHistory.filter(h => h.bookId !== bookId);
    setReadingHistory(next);
    localStorage.setItem('reader_history', JSON.stringify(next));
    showToast('독서 기록에서 제거되었습니다.', 'info');
  };

  // 도서별 챕터 D-Day 마감 계산
  const getBookDeadlineInfo = (book) => {
    const unpublished = book.chapters?.filter(c => c.status !== 'published' && c.deadline) || [];
    if (unpublished.length === 0) return null;
    unpublished.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const nearest = unpublished[0];
    const target = new Date(nearest.deadline);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: '오늘 마감 D-Day 🔥', status: 'urgent', chapterTitle: nearest.title };
    if (diffDays > 0) return { text: `D-${diffDays}`, status: diffDays <= 3 ? 'urgent' : 'normal', chapterTitle: nearest.title };
    return { text: `D+${Math.abs(diffDays)} 초과 ⚠️`, status: 'urgent', chapterTitle: nearest.title };
  };

  // 도서 완결/연재중 전환 확인 팝업 (openConfirm 기반 재확인)
  const handleToggleBookComplete = async (e, book) => {
    if (e) e.stopPropagation();
    if (!book.isCompleted) {
      const ok = await openConfirm({
        title: '도서 완결(완성작) 등록',
        message: `《${book.title}》 도서를 [완성 작품]으로 등록하시겠습니까?\n\n• 독자 공간의 '완성 서가'에 완결 도서로 전시됩니다.\n• 언제든 다시 연재중으로 되돌릴 수 있습니다.`,
        confirmText: '완결 등록 🏆'
      });
      if (!ok) return;
    } else {
      const ok = await openConfirm({
        title: '연재중으로 전환',
        message: `《${book.title}》 도서를 다시 [연재중] 상태로 전환하시겠습니까?\n\n• 완성 서가에서 연재 공간으로 변경됩니다.`,
        confirmText: '연재중 전환 ✍️'
      });
      if (!ok) return;
    }
    toggleBookCompleted(book.id);
  };

  const handleDelete = async (e, bookId, bookTitle) => {
    e.stopPropagation();
    const ok = await openConfirm({
      title: '도서 프로젝트 삭제',
      message: `'${bookTitle}' 프로젝트를 정말 삭제하시겠습니까?\n작성된 모든 챕터와 원고가 영구 삭제됩니다.`,
      danger: true,
      confirmText: '삭제'
    });
    if (ok) {
      deleteBook(bookId);
    }
  };

  const calculateProgress = (book) => {
    let total = 0;
    let completed = 0;
    book.chapters?.forEach(chap => {
      chap.sections?.forEach(sec => {
        total++;
        if (sec.content && sec.content.trim().length > 0) completed++;
      });
    });
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  };

  return (
    <div className="library-page">
      <header className="library-header">
        <div>
          <h1>내 서재</h1>
          <p>창작과 독서가 공존하는 나만의 공간입니다. 멈췄던 작업을 0초 만에 이어가세요.</p>
        </div>
        <div className="library-header-actions" style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)} title="외부 원고 파일(.txt, .md, .docx) 불러오기">
            <UploadCloud size={16} />
            <span>원고 가져오기</span>
          </button>
          <button className="btn btn-primary" onClick={() => setNewBookModalOpen(true)}>
            <Plus size={18} />
            <span>새 책 만들기</span>
          </button>
        </div>
      </header>

      <div className="library-body">
        {/* =================================================================
            1. ⚡ 지금 이어하기 Quick Band (2분할 직통 대시보드)
            ================================================================= */}
        <section className="quick-continue-band">
          <div className="quick-band-header">
            <div className="quick-band-title">
              <Zap size={16} className="text-amber" />
              <span>지금 이어하기</span>
            </div>
            <span className="quick-band-desc">최근 작업 중이던 원고와 읽던 책으로 즉시 복귀합니다.</span>
          </div>

          <div className="quick-band-grid">
            {/* 1) ✍️ 최근 집필 퀵 카드 */}
            <div 
              className={`quick-card writing-quick-card ${recentWritingBook ? 'clickable' : ''}`}
              onClick={() => recentWritingBook && openBook(recentWritingBook.id)}
            >
              <div className="quick-card-left">
                <div className="quick-badge-pill writing-pill">
                  <Edit3 size={12} />
                  <span>최근 집필</span>
                </div>
                {recentWritingBook ? (
                  <div className="quick-text-box">
                    <h3 className="quick-title">{recentWritingBook.title}</h3>
                    <p className="quick-sub">
                      {recentWritingBook.chapters?.[0]?.title ? `최근 챕터: ${recentWritingBook.chapters[0].title}` : (recentWritingBook.subtitle || '집필 진행 중')}
                    </p>
                  </div>
                ) : (
                  <div className="quick-text-box">
                    <h3 className="quick-title empty-text">작업 중인 도서가 없습니다</h3>
                    <p className="quick-sub">새 책 만들기로 첫 원고를 시작해보세요.</p>
                  </div>
                )}
              </div>

              {recentWritingBook ? (
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm quick-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBook(recentWritingBook.id);
                  }}
                >
                  <span>스튜디오 이동</span>
                  <ArrowRight size={13} />
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    setEditingBook(null);
                    setNewBookModalOpen(true);
                  }}
                >
                  <Plus size={13} />
                  <span>새 책 기획</span>
                </button>
              )}
            </div>

            {/* 2) 📖 최근 독서 퀵 카드 */}
            <div 
              className={`quick-card reading-quick-card ${recentReadingBook ? 'clickable' : ''}`}
              onClick={() => recentReadingBook && openReader(recentReadingBook.bookId, recentReadingBook.chapterId)}
            >
              <div className="quick-card-left">
                <div className="quick-badge-pill reading-pill">
                  <BookOpen size={12} />
                  <span>최근 독서</span>
                </div>
                {recentReadingBook ? (
                  <div className="quick-text-box">
                    <h3 className="quick-title">{recentReadingBook.bookTitle}</h3>
                    <p className="quick-sub">
                      {recentReadingBook.chapterTitle || '1화'} 읽던 중 ({new Date(recentReadingBook.readAt).toLocaleDateString()})
                    </p>
                  </div>
                ) : (
                  <div className="quick-text-box">
                    <h3 className="quick-title empty-text">최근 읽은 도서가 없습니다</h3>
                    <p className="quick-sub">연재 작품 탐색에서 흥미로운 책을 찾아보세요.</p>
                  </div>
                )}
              </div>

              {recentReadingBook ? (
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm quick-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReader(recentReadingBook.bookId, recentReadingBook.chapterId);
                  }}
                >
                  <Play size={12} fill="currentColor" />
                  <span>이어서 읽기</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setView('serial-explore')}
                >
                  <Compass size={13} />
                  <span>작품 둘러보기</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* =================================================================
            2. 좌우 분류 시트 탭 (Folder / Binder Tabs)
            ================================================================= */}
        <div className="sheet-tabs-container">
          <div className="sheet-tabs-bar">
            {/* 좌측: 집필 서재 시트 탭 */}
            <button
              type="button"
              className={`sheet-tab-item ${libraryTab === 'author' ? 'active' : ''}`}
              onClick={() => handleTabChange('author')}
            >
              <div className="sheet-tab-header">
                <span className="sheet-tab-icon">✍️</span>
                <span className="sheet-tab-label">집필 서재</span>
                <span className="sheet-tab-count-badge">{books.length}</span>
              </div>
            </button>

            {/* 우측: 독서 서재 시트 탭 */}
            <button
              type="button"
              className={`sheet-tab-item ${libraryTab === 'reader' ? 'active' : ''}`}
              onClick={() => handleTabChange('reader')}
            >
              <div className="sheet-tab-header">
                <span className="sheet-tab-icon">📖</span>
                <span className="sheet-tab-label">독서 서재</span>
                <span className="sheet-tab-count-badge">{readingHistory.length}</span>
              </div>
            </button>
          </div>

          {/* =================================================================
              3. 분류 시트 본문 창 (선택된 탭에 연결되는 일체형 컨테이너)
              ================================================================= */}
          <div className="sheet-body-panel">
            {/* 시트 상단 2줄 약식 통계 & 명언 밴드 */}
            <div className="author-summary-band in-sheet-band">
              {libraryTab === 'author' ? (
                <div className="band-row band-stats-row">
                  <div className="band-stat-group">
                    <div
                      className="band-level-badge"
                      onClick={() => setView('stats')}
                      title="집필 통계 & 성장 상세 화면으로 이동"
                    >
                      <span className="badge-tier-icon">{authorStats.tier.emoji}</span>
                      <span className="badge-level-txt">Lv.{authorStats.level} {authorStats.tier.label}</span>
                    </div>
                    <div className="band-divider" />
                    <div className="band-stat-item">
                      <span className="stat-label">스트릭</span>
                      <span className="stat-val highlight-flame">🔥 {authorStats.streak}일 연속</span>
                    </div>
                    <div className="band-divider" />
                    <div className="band-stat-item">
                      <span className="stat-label">이번 주</span>
                      <span className="stat-val">✍️ {authorStats.weeklyWords.toLocaleString()}자</span>
                    </div>
                    <div className="band-divider" />
                    <div className="band-stat-item">
                      <span className="stat-label">서재 완주율</span>
                      <span className="stat-val">📚 {authorStats.overallRate}% ({authorStats.completedChapters}/{authorStats.totalChapters} 챕터)</span>
                    </div>
                    {authorStats.urgentDeadline && (
                      <>
                        <div className="band-divider" />
                        <div className="band-stat-item">
                          <span className="stat-label">마감 임박</span>
                          <span className="stat-val highlight-urgent">
                            ⏰ {authorStats.urgentDeadline.daysLeft === 0 ? 'D-Day 🔥' : authorStats.urgentDeadline.daysLeft > 0 ? `D-${authorStats.urgentDeadline.daysLeft}` : `D+${Math.abs(authorStats.urgentDeadline.daysLeft)}`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <button className="band-detail-btn" onClick={() => setView('stats')}>
                    <span>작가 통계</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              ) : (
                <div className="band-row band-stats-row">
                  <div className="band-stat-group">
                    <div
                      className="band-level-badge reader-tier-badge"
                      onClick={() => setView('stats')}
                      title="독서 통계 상세 화면으로 이동"
                    >
                      <span className="badge-tier-icon">{readerStats.emoji}</span>
                      <span className="badge-level-txt">Lv.{readerStats.level} {readerStats.levelLabel}</span>
                    </div>
                    <div className="band-divider" />
                    <div className="band-stat-item">
                      <span className="stat-label">독서 루틴</span>
                      <span className="stat-val highlight-flame">🔥 {readerStats.streak}일 연속 독서</span>
                    </div>
                    <div className="band-divider" />
                    <div className="band-stat-item">
                      <span className="stat-label">보관 서재</span>
                      <span className="stat-val">📖 읽는 중 {readerStats.inProgressCount}권 · 완독 {readerStats.completedCount}권</span>
                    </div>
                    <div className="band-divider" />
                    <div className="band-stat-item">
                      <span className="stat-label">총 독서 이력</span>
                      <span className="stat-val">🔖 누적 {readerStats.totalReadCount}작품 감상</span>
                    </div>
                  </div>

                  <button className="band-detail-btn" onClick={() => setView('stats')}>
                    <span>독서 통계</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* 2행: 오늘의 영감 명언 */}
              <div className="band-row band-quote-row">
                <span className="quote-lightbulb">{libraryTab === 'author' ? '💡' : '☕'}</span>
                <span className="quote-text">"{libraryTab === 'author' ? quote.quote : readingQuote.quote}"</span>
                <span className="quote-author">— {libraryTab === 'author' ? quote.author : readingQuote.author}</span>
              </div>
            </div>

            {/* 창 내부 본문: 집필 서재 그리드 */}
            {libraryTab === 'author' && (
              <>
                {isBooksLoading && books.length === 0 ? (
                  <div className="empty-state"><p>서재를 불러오는 중입니다...</p></div>
                ) : books.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📖</div>
                    <h3>아직 작성 중인 도서 프로젝트가 없습니다.</h3>
                    <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                      '새 책 만들기'를 눌러 AI와 함께 첫 번째 전자책을 시작해보세요!
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingBook(null);
                        setNewBookModalOpen(true);
                      }}
                    >
                      <Plus size={18} />
                      <span>새 책 만들기</span>
                    </button>
                  </div>
                ) : (
                  <div className="library-cards-grid">
                    {books.map((book) => {
                      const progress = calculateProgress(book);
                      const deadlineInfo = getBookDeadlineInfo(book);
                      return (
                        <div key={book.id} className="horizontal-book-card">
                          {/* 좌측: 책 표지 영역 */}
                          <div 
                            className="h-card-cover"
                            style={{ background: book.coverColor || 'linear-gradient(135deg, #1e293b, #0f172a)' }}
                          >
                            <h3 
                              className="h-cover-title"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBook(book);
                              }}
                              title="클릭하여 도서 정보 수정"
                              style={{ cursor: 'pointer' }}
                            >
                              {book.title}
                            </h3>
                          </div>

                          {/* 우측: 세부 내용 박스 */}
                          <div className="h-card-body">
                            {/* 1행: 장르, 완결/연재 토글 뱃지, 마감일, 우측 수정/휴지통 */}
                            <div className="h-card-top-row">
                              <div className="h-badge-group">
                                <span className="h-genre-badge">{book.genre || '기획'}</span>
                                <button
                                  type="button"
                                  className={`h-status-badge-btn ${book.isCompleted ? 'completed' : 'ongoing'}`}
                                  onClick={(e) => handleToggleBookComplete(e, book)}
                                  title={book.isCompleted ? '클릭 시 연재중으로 전환' : '클릭 시 완결(완성작)로 등록'}
                                >
                                  {book.isCompleted ? '🏆 완결' : '✍️ 연재중'}
                                </button>
                                {deadlineInfo && (
                                  <span
                                    className={`book-dday-badge ${deadlineInfo.status}`}
                                    title={`${deadlineInfo.chapterTitle} 챕터 마감: ${deadlineInfo.text}`}
                                  >
                                    <Calendar size={11} />
                                    <span>{deadlineInfo.text}</span>
                                  </span>
                                )}
                              </div>
                              <div className="h-card-action-group">
                                <button
                                  type="button"
                                  className="btn-icon-subtle"
                                  title="도서 정보 수정 (제목, 필명, 장르, 표지 등)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBook(book);
                                  }}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon-danger"
                                  title="프로젝트 삭제"
                                  onClick={(e) => handleDelete(e, book.id, book.title)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* 2행: 태그 바로 아래 - 최근 집필 챕터 및 최종 수정일 */}
                            <div className="h-status-row">
                              <span className="h-status-tag writing-status">
                                <Edit3 size={11} />
                                <span className="h-status-text">최근: {getLatestWritingChapter(book)}</span>
                              </span>
                              {(book.updatedAt || book.createdAt) && (
                                <span className="h-status-date">
                                  <Clock size={11} />
                                  <span>{new Date(book.updatedAt || book.createdAt).toLocaleDateString()}</span>
                                </span>
                              )}
                            </div>

                            {/* 3행: 진행률 바 */}
                            <div className="h-progress-wrap">
                              <div className="progress-info">
                                <span>진행률</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                              </div>
                            </div>

                            {/* 4행: 푸터 (챕터 수, 집필하기 버튼 - 이 버튼 클릭 시에만 스튜디오 진입) */}
                            <div className="h-card-footer">
                              <span className="h-meta-text">챕터 {book.chapters?.length || 0}개</span>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm btn-continue-write"
                                title="집필 스튜디오로 이동"
                                onClick={() => openBook(book.id)}
                              >
                                <Edit3 size={13} />
                                <span>집필하기</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* 창 내부 본문: 독서 서재 그리드 */}
            {libraryTab === 'reader' && (
              <>
                {readingHistory.length === 0 ? (
                  <div className="empty-state reader-empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☕</div>
                    <h3>아직 읽고 있는 도서가 없습니다.</h3>
                    <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem', maxWidth: '440px', lineHeight: '1.6' }}>
                      독자 공간의 '연재 작품'이나 '완성 서가'에서 관심 있는 책을 감상해보세요.
                      읽다 만 페이지와 챕터가 이 서재에 자동으로 안전하게 기록됩니다.
                    </p>
                    <button className="btn btn-primary" onClick={() => setView('serial-explore')}>
                      <Flame size={16} />
                      <span>인기 연재 작품 보러가기</span>
                    </button>
                  </div>
                ) : (
                  <div className="library-cards-grid">
                    {readingHistory.map((item) => {
                      const matchedBook = books.find(b => b.id === item.bookId);
                      const cfgRaw = localStorage.getItem('bookstudio_config');
                      let cfgAuthor = '';
                      try { if (cfgRaw) cfgAuthor = JSON.parse(cfgRaw).defaultAuthor; } catch {}
                      const fallbackAuthor = user?.displayName || cfgAuthor || '김연재';
                      const displayAuthor = (item.author && item.author !== '작가')
                        ? item.author
                        : (matchedBook?.author && matchedBook.author !== '작가' ? matchedBook.author : fallbackAuthor);

                      return (
                        <div 
                          key={item.bookId} 
                          className="horizontal-book-card"
                        >
                          {/* 좌측: 책 표지 영역 */}
                          <div 
                            className="h-card-cover" 
                            style={{ background: item.coverColor || 'linear-gradient(135deg, #1e293b, #0f172a)' }}
                          >
                            <h3 className="h-cover-title">{item.bookTitle}</h3>
                          </div>

                          {/* 우측: 세부 내용 박스 */}
                          <div className="h-card-body">
                            {/* 1행: 장르, 글 작가명, 우측 휴지통 */}
                            <div className="h-card-top-row">
                              <div className="h-badge-group">
                                <span className="h-genre-badge">{item.genre || '소설'}</span>
                                <span className="h-author-tag">글 {displayAuthor}</span>
                              </div>
                              <button
                                type="button"
                                className="btn-icon-danger"
                                title="서재에서 제외"
                                onClick={(e) => handleRemoveHistory(e, item.bookId)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            {/* 2행: 태그 바로 아래 - 최근 읽던 화 및 최종 읽은 일자 (넓은 1행으로 줄바꿈 없음) */}
                            <div className="h-status-row">
                              <span className="h-status-tag reading-status">
                                <Bookmark size={11} />
                                <span className="h-status-text">최근: {item.chapterTitle || '1화'}</span>
                              </span>
                              {item.readAt && (
                                <span className="h-status-date">
                                  <Clock size={11} />
                                  <span>{new Date(item.readAt).toLocaleDateString()}</span>
                                </span>
                              )}
                            </div>

                            {/* 3행 & 4행: 푸터 (이어서 읽기 버튼) */}
                            <div className="h-card-footer" style={{ justifyContent: 'flex-end', marginTop: 'auto' }}>
                              <button 
                                type="button" 
                                className="btn btn-primary btn-sm btn-continue-read"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReader(item.bookId, item.chapterId);
                                }}
                              >
                                <Play size={12} fill="currentColor" />
                                <span>이어서 읽기</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 새 책 기획 및 도서 기본 정보 수정 통합 모달 */}
      <BookInfoModal
        isOpen={isNewBookModalOpen || !!editingBook}
        onClose={() => {
          setNewBookModalOpen(false);
          setEditingBook(null);
        }}
        mode={editingBook ? 'edit' : 'create'}
        book={editingBook}
      />

      {/* 원고 가져오기 마법사 모달 */}
      <ManuscriptImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />
    </div>
  );
}
