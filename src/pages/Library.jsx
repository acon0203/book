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
  UploadCloud,
  Sparkles,
  BookMarked,
  Lightbulb
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
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'title' | 'progress'

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

    if (diffDays === 0) return { text: '오늘 마감 D-Day', status: 'urgent', chapterTitle: nearest.title };
    if (diffDays > 0) return { text: `D-${diffDays}`, status: diffDays <= 3 ? 'urgent' : 'normal', chapterTitle: nearest.title };
    return { text: `D+${Math.abs(diffDays)} 초과`, status: 'urgent', chapterTitle: nearest.title };
  };

  // 도서 완결/연재중 전환 확인 팝업 (openConfirm 기반 재확인)
  const handleToggleBookComplete = async (e, book) => {
    if (e) e.stopPropagation();
    if (!book.isCompleted) {
      const ok = await openConfirm({
        title: '도서 완결(완성작) 등록',
        message: `《${book.title}》 도서를 [완성 작품]으로 등록하시겠습니까?\n\n• 독자 공간의 '완성 서가'에 완결 도서로 전시됩니다.\n• 언제든 다시 연재중으로 되돌릴 수 있습니다.`,
        confirmText: '완결 등록'
      });
      if (!ok) return;
    } else {
      const ok = await openConfirm({
        title: '연재중으로 전환',
        message: `《${book.title}》 도서를 다시 [연재중] 상태로 전환하시겠습니까?\n\n• 완성 서가에서 연재 공간으로 변경됩니다.`,
        confirmText: '연재중 전환'
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

  const sortedBooks = [...books].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title, 'ko');
    if (sortBy === 'progress') return calculateProgress(b) - calculateProgress(a);
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });

  return (
    <div className="library-page">
      {/* 1. 헤더: 제목 옆 인라인 설명문 */}
      <header className="library-header">
        <div className="library-header-title-row">
          <h1>내 서재</h1>
          <span className="library-header-subtitle-inline">생각을 기록하고 깊이 읽는 나만의 서재 공간</span>
        </div>
        <div className="library-header-actions" style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)} title="외부 원고 파일(.txt, .md, .docx) 불러오기">
            <UploadCloud size={16} />
            <span>원고 가져오기</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingBook(null); setNewBookModalOpen(true); }}>
            <Plus size={18} />
            <span>새 책 만들기</span>
          </button>
        </div>
      </header>

      <div className="library-body">
        {/* =================================================================
            1. 🌟 명언 + 레벨 통계 일체형 2행 카드
            - 1행 (상단 음영): [전구 아이콘] + 따옴표 없는 담백한 명언
            - 2행 (하단 흰색): 좌측 [Lv.4 예비 작가] / 우측 [Lv.2 성실한 애독가] (독서루틴 / 누적감상 / 완독도서 순서)
            ================================================================= */}
        <section className="integrated-overview-card">
          {/* 1행: 상단 음영 명언 바 (전구 아이콘, 따옴표 없음) */}
          <div className="overview-quote-row">
            <div className="quote-inline-text">
              <Lightbulb size={16} className="quote-lightbulb-icon" />
              <span>{quote.quote}</span>
              <span className="quote-author-tag">— {quote.author}</span>
            </div>
          </div>

          {/* 2행: 하단 통계 50:50 분할 (좌: 집필 / 우: 독서) */}
          <div className="overview-stats-row">
            {/* 좌측 컬럼: 집필 요약 (Lv.4 예비 작가) */}
            <div className="overview-stat-col left-col">
              <div className="stat-col-left">
                <span 
                  className="stat-col-level-badge author"
                  onClick={() => setView('stats')}
                  title="집필 성장 상세 보기"
                >
                  Lv.{authorStats.level} {authorStats.tier.label}
                </span>
                <div className="stat-items-group">
                  <div className="stat-mini-item">
                    <span className="stat-mini-label">집필 루틴</span>
                    <span className="stat-mini-val highlight-author">{authorStats.streak}일 연속</span>
                  </div>
                  <div className="stat-divider-line" />
                  <div className="stat-mini-item">
                    <span className="stat-mini-label">이번 주</span>
                    <span className="stat-mini-val">{authorStats.weeklyWords.toLocaleString()}자</span>
                  </div>
                  <div className="stat-divider-line" />
                  <div className="stat-mini-item">
                    <span className="stat-mini-label">완주율</span>
                    <span className="stat-mini-val">{authorStats.overallRate}%</span>
                  </div>
                </div>
              </div>
              <span className="stat-more-link" onClick={() => setView('stats')}>
                통계 상세 <ArrowRight size={12} />
              </span>
            </div>

            {/* 우측 컬럼: 독서 요약 (Lv.2 성실한 애독가) - 요청 순서: 독서루틴 / 누적 감상 / 완독 도서 */}
            <div className="overview-stat-col">
              <div className="stat-col-left">
                <span 
                  className="stat-col-level-badge reader"
                  onClick={() => setView('stats')}
                  title="독서 통계 상세 보기"
                >
                  Lv.{readerStats.level} {readerStats.levelLabel}
                </span>
                <div className="stat-items-group">
                  <div className="stat-mini-item">
                    <span className="stat-mini-label">독서 루틴</span>
                    <span className="stat-mini-val highlight-reader">{readerStats.streak}일 연속</span>
                  </div>
                  <div className="stat-divider-line" />
                  <div className="stat-mini-item">
                    <span className="stat-mini-label">누적 감상</span>
                    <span className="stat-mini-val">{readerStats.totalReadCount}작품</span>
                  </div>
                  <div className="stat-divider-line" />
                  <div className="stat-mini-item">
                    <span className="stat-mini-label">완독 도서</span>
                    <span className="stat-mini-val">{readerStats.completedCount}권</span>
                  </div>
                </div>
              </div>
              <span className="stat-more-link" onClick={() => setView('stats')}>
                독서 통계 <ArrowRight size={12} />
              </span>
            </div>
          </div>
        </section>

        {/* =================================================================
            2. ⚡ 지금 이어하기 (소제목 아래 그냥 은은한 구분선만, 도서제목에 《》 괄호 제거)
            ================================================================= */}
        <section className="section-block continue-section">
          <div className="section-divider-header">
            <h2 className="section-clean-title">지금 이어하기</h2>
          </div>

          <div className="quick-continue-grid">
            {/* 1) 최근 집필 퀵 카드 */}
            <div 
              className={`continue-card writing ${recentWritingBook ? 'clickable' : ''}`}
              onClick={() => recentWritingBook && openBook(recentWritingBook.id)}
            >
              <div 
                className="book-spine-thumb"
                style={{ background: recentWritingBook?.coverColor || 'linear-gradient(135deg, #3d2c1e, #1f140b)' }}
              >
                <div className="book-spine-line" />
                <span className="spine-genre">{recentWritingBook?.genre || '집필'}</span>
                <span className="spine-title">{recentWritingBook?.title || '원고'}</span>
              </div>

              <div className="continue-content">
                <div className="continue-badge-row">
                  <span className="continue-tag writing">이어쓰기</span>
                  {recentWritingBook && (
                    <span className="continue-timestamp">
                      {recentWritingBook.updatedAt ? new Date(recentWritingBook.updatedAt).toLocaleDateString() : '최근 작업'}
                    </span>
                  )}
                </div>
                {recentWritingBook ? (
                  <>
                    <h3 className="continue-book-name">{recentWritingBook.title}</h3>
                    <p className="continue-chapter-txt">
                      최근: {getLatestWritingChapter(recentWritingBook)}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="continue-book-name empty-text">작업 중인 도서가 없습니다</h3>
                    <p className="continue-chapter-txt">새 책 만들기로 첫 원고를 시작해보세요.</p>
                  </>
                )}
              </div>

              <div className="continue-action-btn">
                <ArrowRight size={15} />
              </div>
            </div>

            {/* 2) 최근 독서 퀵 카드 */}
            <div 
              className={`continue-card reading ${recentReadingBook ? 'clickable' : ''}`}
              onClick={() => recentReadingBook && openReader(recentReadingBook.bookId, recentReadingBook.chapterId)}
            >
              <div 
                className="book-spine-thumb"
                style={{ 
                  background: (books.find(b => b.id === recentReadingBook?.bookId)?.coverColor) 
                    || recentReadingBook?.coverColor 
                    || 'linear-gradient(135deg, #1b382b, #0d1e16)' 
                }}
              >
                <div className="book-spine-line" />
                <span className="spine-genre">{recentReadingBook?.genre || '독서'}</span>
                <span className="spine-title">{recentReadingBook?.bookTitle || '도서'}</span>
              </div>

              <div className="continue-content">
                <div className="continue-badge-row">
                  <span className="continue-tag reading">이어읽기</span>
                  {recentReadingBook?.readAt && (
                    <span className="continue-timestamp">
                      {new Date(recentReadingBook.readAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {recentReadingBook ? (
                  <>
                    <h3 className="continue-book-name">{recentReadingBook.bookTitle}</h3>
                    <p className="continue-chapter-txt">
                      최근: {recentReadingBook.chapterTitle || '1화'} 읽던 중
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="continue-book-name empty-text">최근 읽은 도서가 없습니다</h3>
                    <p className="continue-chapter-txt">연재 작품 탐색에서 흥미로운 책을 찾아보세요.</p>
                  </>
                )}
              </div>

              <div className="continue-action-btn">
                <ArrowRight size={15} />
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            3. 📚 서재 선반 (2대 전환 탭 + 정렬 드롭다운 + 3열 양장본 카드 UI)
            - 탭: [집필 중인 도서 (N)] / [최근 읽은 책 (M)]
            - 우측: 정렬 드롭다운 (최신 작업순 / 제목순 / 진행률순)
            - 카드: 양장본 커버 + 우측 상단 ✏️(수정)/🗑️(삭제) + 상태('집필중'/'완결' 2개)
            ================================================================= */}
        <section className="section-block shelf-section">
          <div className="shelf-nav-bar">
            <div className="shelf-tabs">
              <button
                type="button"
                className={`shelf-tab-btn ${libraryTab === 'author' ? 'active' : ''}`}
                onClick={() => handleTabChange('author')}
              >
                <span>집필 중인 도서</span>
                <span className="shelf-tab-count">{books.length}</span>
              </button>

              <button
                type="button"
                className={`shelf-tab-btn reading-tab ${libraryTab === 'reader' ? 'active' : ''}`}
                onClick={() => handleTabChange('reader')}
              >
                <span>최근 읽은 책</span>
                <span className="shelf-tab-count">{readingHistory.length}</span>
              </button>
            </div>

            {libraryTab === 'author' && books.length > 0 && (
              <select
                className="shelf-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">최신 작업순</option>
                <option value="title">제목순</option>
                <option value="progress">진행률순</option>
              </select>
            )}
          </div>

          {/* 탭 1: 집필 중인 도서 3열 그리드 */}
          {libraryTab === 'author' && (
            <>
              {isBooksLoading && books.length === 0 ? (
                <div className="empty-state"><p>서재를 불러오는 중입니다...</p></div>
              ) : books.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon-wrap" style={{ marginBottom: '1rem', opacity: 0.6 }}>
                    <BookOpen size={40} strokeWidth={1.5} />
                  </div>
                  <h3>아직 작성 중인 도서 프로젝트가 없습니다.</h3>
                  <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                    '새 책 만들기'를 눌러 첫 번째 원고를 시작해보세요.
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
                <div className="sample-book-grid-3col">
                  {sortedBooks.map((book) => {
                    const progress = calculateProgress(book);
                    return (
                      <article key={book.id} className="book-card">
                        {/* 좌측: 양장본 북 커버 */}
                        <div
                          className="book-cover"
                          style={{ background: book.coverColor || 'linear-gradient(135deg, #2b231d, #191410)' }}
                          onClick={() => openBook(book.id)}
                          title={`${book.title} 스튜디오 열기`}
                        >
                          <div className="book-cover-line" />
                          <span className="book-cover-genre">{book.genre || '기획'}</span>
                          <h4 className="book-cover-title">{book.title}</h4>
                        </div>

                        {/* 우측: 상세 정보 */}
                        <div className="book-details">
                          <div>
                            {/* 1행: 상태 뱃지 ('집필중' / '완결') + 우측 상단 [연필] & [휴지통] */}
                            <div className="card-top-header">
                              <div className="card-badges-left">
                                <button
                                  type="button"
                                  className={`status-pill ${book.isCompleted ? 'completed' : ''}`}
                                  onClick={(e) => handleToggleBookComplete(e, book)}
                                  title={book.isCompleted ? '클릭 시 집필중으로 전환' : '클릭 시 완결로 등록'}
                                >
                                  {book.isCompleted ? '완결' : '집필중'}
                                </button>
                                <span className="genre-label">{book.genre || '소설'}</span>
                              </div>

                              <div className="card-actions-top-right">
                                <button
                                  type="button"
                                  className="action-icon-top edit-btn"
                                  title="도서 정보 수정"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBook(book);
                                  }}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-top danger-btn"
                                  title="프로젝트 삭제"
                                  onClick={(e) => handleDelete(e, book.id, book.title)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* 2행: 제목 */}
                            <h3 
                              className="book-title-text"
                              onClick={() => openBook(book.id)}
                              title={`${book.title} 스튜디오 열기`}
                            >
                              {book.title}
                            </h3>

                            {/* 3행: 로그라인 / 서브타이틀 */}
                            <p className="book-desc-text">
                              {book.subtitle || book.description || '집필 진행 중인 원고입니다.'}
                            </p>
                          </div>

                          {/* 4행: 푸터 (챕터 수 + 진행률) */}
                          <div
                            className="book-card-footer"
                            onClick={() => openBook(book.id)}
                          >
                            <span>총 {book.chapters?.length || 0}개 챕터</span>
                            <div className="footer-progress-group">
                              <div className="progress-bar-thin">
                                <div
                                  className={`progress-bar-fill ${book.isCompleted ? 'completed-fill' : ''}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className={`progress-rate-txt ${book.isCompleted ? 'completed-txt' : ''}`}>
                                {progress}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* 탭 2: 최근 읽은 책 3열 그리드 */}
          {libraryTab === 'reader' && (
            <>
              {readingHistory.length === 0 ? (
                <div className="empty-state reader-empty-state">
                  <div className="empty-state-icon-wrap" style={{ marginBottom: '1rem', opacity: 0.6 }}>
                    <Bookmark size={40} strokeWidth={1.5} />
                  </div>
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
                <div className="sample-book-grid-3col">
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
                      <article key={item.bookId} className="book-card">
                        {/* 좌측: 양장본 북 커버 */}
                        <div
                          className="book-cover"
                          style={{ background: item.coverColor || 'linear-gradient(135deg, #1e3328, #101c16)' }}
                          onClick={() => openReader(item.bookId, item.chapterId)}
                          title={`${item.bookTitle} 뷰어 열기`}
                        >
                          <div className="book-cover-line" />
                          <span className="book-cover-genre">{item.genre || '소설'}</span>
                          <h4 className="book-cover-title">{item.bookTitle}</h4>
                        </div>

                        {/* 우측: 상세 정보 */}
                        <div className="book-details">
                          <div>
                            {/* 1행: 상태 뱃지 + 우측 상단 [휴지통] */}
                            <div className="card-top-header">
                              <div className="card-badges-left">
                                <span className="status-pill reading-pill">독서중</span>
                                <span className="genre-label">글 {displayAuthor}</span>
                              </div>

                              <div className="card-actions-top-right">
                                <button
                                  type="button"
                                  className="action-icon-top danger-btn"
                                  title="독서 서재에서 제외"
                                  onClick={(e) => handleRemoveHistory(e, item.bookId)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* 2행: 도서명 */}
                            <h3
                              className="book-title-text"
                              onClick={() => openReader(item.bookId, item.chapterId)}
                              title={`${item.bookTitle} 뷰어 열기`}
                            >
                              {item.bookTitle}
                            </h3>

                            {/* 3행: 최근 읽은 챕터 */}
                            <p className="book-desc-text">
                              최근 읽던 화: {item.chapterTitle || '1화'}
                              {item.readAt && ` · ${new Date(item.readAt).toLocaleDateString()}`}
                            </p>
                          </div>

                          {/* 4행: 푸터 */}
                          <div
                            className="book-card-footer"
                            onClick={() => openReader(item.bookId, item.chapterId)}
                          >
                            <span>독서 기록</span>
                            <div className="footer-action-read">
                              <Play size={12} fill="currentColor" />
                              <span>이어서 읽기</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
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
