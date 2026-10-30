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
  ArrowRight, 
  BookOpen, 
  Flame, 
  Bookmark, 
  Play, 
  Edit2,
  UploadCloud,
  Lightbulb,
  FolderPlus,
  X
} from 'lucide-react';
import ManuscriptImportModal from '../components/ManuscriptImportModal';
import BookInfoModal from '../components/BookInfoModal';
import { STARTER_BOOK, STARTER_VAULT_ITEMS } from '../data/starterBookData';
import { storageService, DEFAULT_SHELF_CATEGORIES } from '../services/storageService';

export default function Library() {
  const {
    books, loadBooks, openBook, openReader, deleteBook, isBooksLoading, showToast,
    isNewBookModalOpen, setNewBookModalOpen, setView, activeBook, user, openConfirm, openPrompt,
    toggleBookCompleted
  } = useStore();

  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });
  const [libraryTab, setLibraryTab] = useState(() => localStorage.getItem('library_active_tab') || 'author'); // 'author' | 'reader' | 'shelf'
  const [readingHistory, setReadingHistory] = useState([]);
  const [shelfItems, setShelfItems] = useState([]);
  const [shelfCategories, setShelfCategories] = useState(DEFAULT_SHELF_CATEGORIES);
  const [selectedShelfCategory, setSelectedShelfCategory] = useState('all');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);

  // 탭별 정렬 상태
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'title' | 'progress'
  const [readerSortBy, setReaderSortBy] = useState('recent'); // 'recent' | 'title' | 'author'
  const [shelfSortBy, setShelfSortBy] = useState('recent'); // 'recent' | 'title' | 'author'

  const loadReadingAndShelfData = () => {
    setReadingHistory(storageService.getReadingHistory());
    setShelfItems(storageService.getShelfItems());
    setShelfCategories(storageService.getShelfCategories());
  };

  useEffect(() => {
    loadBooks();
    loadReadingAndShelfData();
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

  // 스타터 도서 및 창작실 가이드 자료 원클릭 생성
  const handleLoadStarterBook = async () => {
    try {
      await bookService.createBook(STARTER_BOOK);
      for (const item of STARTER_VAULT_ITEMS) {
        await bookService.createVaultItem(item);
      }
      await loadBooks();
      showToast('스타터 가이드북이 서재에 준비되었습니다. 클릭하여 둘러보세요!', 'success');
    } catch (err) {
      showToast(`스타터 도서 로드 실패: ${err.message}`, 'error');
    }
  };

  const authorStats = calcAuthorStats(books, baseStats);
  const readerStats = calcReaderStats(readingHistory, books);
  const quote = getDailyQuote();

  const handleGoToStats = (tab) => {
    localStorage.setItem('stats_active_tab', tab);
    setView('stats');
  };

  // 최근 집필 도서 (activeBook 또는 가장 최근 수정된 도서)
  const recentWritingBook = activeBook || (books.length > 0 ? [...books].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] : null);
  // 최근 독서 도서 (삭제되지 않고 열람 가능한 가장 최근 도서)
  const recentReadingBook = readingHistory.find(
    (h) => !h.isDeleted && (isBooksLoading || books.some((b) => b.id === h.bookId))
  ) || null;

  // 표지 색상 헬퍼 (과거 파란색/네이비 기본값은 현재 에디토리얼 양장본 테마로 자동 변환)
  const resolveCoverColor = (color, fallback = 'linear-gradient(135deg, #2b231d, #191410)') => {
    if (!color || color.includes('#2563eb') || color.includes('#1e3a8a') || color.includes('#1e40af') || color.includes('#1e293b')) {
      return fallback;
    }
    return color;
  };

  const writingCoverColor = resolveCoverColor(recentWritingBook?.coverColor, 'linear-gradient(135deg, #3d2c1e, #1f140b)');
  const matchedReadingBook = books.find(b => b.id === recentReadingBook?.bookId || b.title === recentReadingBook?.bookTitle);
  const readingCoverColor = (() => {
    if (matchedReadingBook?.coverColor) return resolveCoverColor(matchedReadingBook.coverColor, 'linear-gradient(135deg, #1b382b, #0d1e16)');
    if (recentWritingBook && (matchedReadingBook?.id === recentWritingBook?.id || recentReadingBook?.bookTitle === recentWritingBook?.title)) {
      return writingCoverColor;
    }
    return resolveCoverColor(recentReadingBook?.coverColor, 'linear-gradient(135deg, #1b382b, #0d1e16)');
  })();

  // 집필 서재용 최근 작업 챕터 추출 헬퍼
  const getLatestWritingChapter = (book) => {
    if (!book?.chapters || book.chapters.length === 0) return '새 챕터 기획 중';
    const sorted = [...book.chapters].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return sorted[0]?.title || book.chapters[0]?.title || '새 챕터 기획 중';
  };

  const handleTabChange = (tab) => {
    setLibraryTab(tab);
    localStorage.setItem('library_active_tab', tab);
    if (tab === 'reader' || tab === 'shelf') {
      loadReadingAndShelfData();
    }
  };

  const handleRemoveHistory = (e, bookId) => {
    e.stopPropagation();
    setReadingHistory(storageService.removeReadingHistoryItem(bookId));
    showToast('최근 읽은 작품 목록에서 제거되었습니다.', 'info');
  };

  const handleRemoveShelfItem = (e, bookId) => {
    e.stopPropagation();
    setShelfItems(storageService.removeShelfItem(bookId));
    showToast('담은 작품 목록에서 제거되었습니다.', 'info');
  };

  const handleChangeShelfItemCategory = (bookId, newCat) => {
    setShelfItems(storageService.updateShelfItemCategory(bookId, newCat));
    showToast(`카테고리가 '${newCat}'(으)로 변경되었습니다.`, 'success');
  };

  const handleAddShelfCategory = async () => {
    const name = await openPrompt({
      title: '새 카테고리 추가',
      message: '담은 작품을 분류할 새 카테고리 이름을 입력하세요. (예: 읽고 싶은 책, 관심 분야, 주말 독서)',
      placeholder: '카테고리 이름 입력',
      confirmText: '추가'
    });
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (shelfCategories.includes(trimmed)) {
      showToast('이미 존재하는 카테고리입니다.', 'info');
      return;
    }
    const nextCats = storageService.saveShelfCategories([...shelfCategories, trimmed]);
    setShelfCategories(nextCats);
    setSelectedShelfCategory(trimmed);
    showToast(`'${trimmed}' 카테고리가 추가되었습니다.`, 'success');
  };

  const handleDeleteShelfCategory = async (e, catName) => {
    e.stopPropagation();
    if (shelfCategories.length <= 1) {
      showToast('최소 1개의 카테고리는 유지되어야 합니다.', 'info');
      return;
    }
    const fallbackCat = shelfCategories.find(c => c !== catName) || '읽고 싶은 책';
    const ok = await openConfirm({
      title: '카테고리 삭제',
      message: `'${catName}' 카테고리를 삭제하시겠습니까?\n해당 카테고리에 담긴 작품들은 '${fallbackCat}' 카테고리로 이동됩니다.`,
      danger: true,
      confirmText: '삭제'
    });
    if (!ok) return;

    const nextCats = storageService.saveShelfCategories(shelfCategories.filter(c => c !== catName));
    setShelfCategories(nextCats);

    const nextItems = storageService.saveShelfItems(
      shelfItems.map(item =>
        (item.category || shelfCategories[0]) === catName ? { ...item, category: fallbackCat } : item
      )
    );
    setShelfItems(nextItems);

    if (selectedShelfCategory === catName) {
      setSelectedShelfCategory('all');
    }
    showToast(`'${catName}' 카테고리가 삭제되었습니다.`, 'info');
  };

  // 도서 완결/연재중 전환 확인 팝업 (openConfirm 기반 재확인)
  const handleToggleBookComplete = async (e, book) => {
    if (e) e.stopPropagation();
    if (!book.isCompleted) {
      const ok = await openConfirm({
        title: '도서 완결(완성작) 등록',
        message: `${book.title} 도서를 [완성 작품]으로 등록하시겠습니까?\n\n• 독자 공간의 '완성 서가'에 완결 도서로 전시됩니다.\n• 언제든 다시 연재중으로 되돌릴 수 있습니다.`,
        confirmText: '완결 등록'
      });
      if (!ok) return;
    } else {
      const ok = await openConfirm({
        title: '연재중으로 전환',
        message: `${book.title} 도서를 다시 [연재중] 상태로 전환하시겠습니까?\n\n• 완성 서가에서 연재 공간으로 변경됩니다.`,
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
      await deleteBook(bookId);
      loadReadingAndShelfData();
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

  const resolveDisplayAuthor = (itemAuthor, matchedBook) => {
    const cfgRaw = localStorage.getItem('bookstudio_config');
    let cfgAuthor = '';
    try { if (cfgRaw) cfgAuthor = JSON.parse(cfgRaw).defaultAuthor; } catch {}
    const fallbackAuthor = user?.displayName || cfgAuthor || '익명 작가';
    if (itemAuthor && itemAuthor !== '작가' && itemAuthor !== '김연재') return itemAuthor;
    if (matchedBook?.author && matchedBook.author !== '작가' && matchedBook.author !== '김연재') return matchedBook.author;
    return fallbackAuthor;
  };

  // 1) 집필 작품 정렬
  const sortedBooks = [...books].sort((a, b) => {
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '', 'ko');
    if (sortBy === 'progress') return calculateProgress(b) - calculateProgress(a);
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });

  // 2) 최근 읽은 작품 정렬
  const sortedReadingHistory = [...readingHistory].sort((a, b) => {
    if (readerSortBy === 'title') return (a.bookTitle || '').localeCompare(b.bookTitle || '', 'ko');
    if (readerSortBy === 'author') {
      const authA = resolveDisplayAuthor(a.author, books.find(bk => bk.id === a.bookId));
      const authB = resolveDisplayAuthor(b.author, books.find(bk => bk.id === b.bookId));
      return authA.localeCompare(authB, 'ko');
    }
    return new Date(b.readAt || 0) - new Date(a.readAt || 0);
  });

  // 3) 담은 작품 카테고리 필터링 & 정렬
  const filteredAndSortedShelf = shelfItems
    .filter((item) => {
      if (selectedShelfCategory === 'all') return true;
      const itemCat = item.category || shelfCategories[0] || '읽고 싶은 책';
      return itemCat === selectedShelfCategory;
    })
    .sort((a, b) => {
      if (shelfSortBy === 'title') return (a.bookTitle || '').localeCompare(b.bookTitle || '', 'ko');
      if (shelfSortBy === 'author') {
        const authA = resolveDisplayAuthor(a.author, books.find(bk => bk.id === a.bookId));
        const authB = resolveDisplayAuthor(b.author, books.find(bk => bk.id === b.bookId));
        return authA.localeCompare(authB, 'ko');
      }
      return new Date(b.savedAt || b.readAt || 0) - new Date(a.savedAt || a.readAt || 0);
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
            <span>새 작품 만들기</span>
          </button>
        </div>
      </header>

      <div className="library-body">
        {/* =================================================================
            1. 명언 + 레벨 통계 일체형 2행 카드
            ================================================================= */}
        <section className="integrated-overview-card">
          <div className="overview-quote-row">
            <div className="quote-inline-text">
              <Lightbulb size={16} className="quote-lightbulb-icon" />
              <span>{quote.quote}</span>
              <span className="quote-author-tag">— {quote.author}</span>
            </div>
          </div>

          <div className="overview-stats-row">
            {/* 좌측 컬럼: 집필 요약 */}
            <div className="overview-stat-col left-col">
              <div className="stat-col-left">
                <span 
                  className="stat-col-level-badge author"
                  onClick={() => handleGoToStats('writing')}
                  title="집필 통계 보기"
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
              <span className="stat-more-link" onClick={() => handleGoToStats('writing')}>
                집필 통계 <ArrowRight size={12} />
              </span>
            </div>

            {/* 우측 컬럼: 독서 요약 */}
            <div className="overview-stat-col">
              <div className="stat-col-left">
                <span 
                  className="stat-col-level-badge reader"
                  onClick={() => handleGoToStats('reading')}
                  title="독서 통계 보기"
                >
                  Lv.{readerStats.level} {readerStats.tier?.label}
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
                    <span className="stat-mini-label">완독 작품</span>
                    <span className="stat-mini-val">{readerStats.completedCount}작품</span>
                  </div>
                </div>
              </div>
              <span className="stat-more-link" onClick={() => handleGoToStats('reading')}>
                독서 통계 <ArrowRight size={12} />
              </span>
            </div>
          </div>
        </section>

        {/* =================================================================
            2. 지금 이어하기
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
                style={{ background: writingCoverColor }}
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
                style={{ background: readingCoverColor }}
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
            3. 서재 선반 (3대 전환 탭 + 탭별 정렬 드롭다운 + 3열 양장본 카드 UI)
            - 탭 1: 집필 작품
            - 탭 2: 최근 읽은 작품 (실제 읽은 도서 기록)
            - 탭 3: 담은 작품 (서재 담기로 찜한 관심 도서 + 카테고리 분류)
            ================================================================= */}
        <section className="section-block shelf-section">
          <div className="shelf-nav-bar">
            <div className="shelf-tabs">
              <button
                type="button"
                className={`shelf-tab-btn ${libraryTab === 'author' ? 'active' : ''}`}
                onClick={() => handleTabChange('author')}
              >
                <span>집필 작품</span>
                <span className="shelf-tab-count">{books.length}</span>
              </button>

              <button
                type="button"
                className={`shelf-tab-btn reading-tab ${libraryTab === 'reader' ? 'active' : ''}`}
                onClick={() => handleTabChange('reader')}
              >
                <span>최근 읽은 작품</span>
                <span className="shelf-tab-count">{readingHistory.length}</span>
              </button>

              <button
                type="button"
                className={`shelf-tab-btn shelf-bookmark-tab ${libraryTab === 'shelf' ? 'active' : ''}`}
                onClick={() => handleTabChange('shelf')}
              >
                <span>담은 작품</span>
                <span className="shelf-tab-count">{shelfItems.length}</span>
              </button>
            </div>

            <div className="shelf-nav-controls">
              {libraryTab === 'author' && (
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

              {libraryTab === 'reader' && (
                <select
                  className="shelf-sort-select"
                  value={readerSortBy}
                  onChange={(e) => setReaderSortBy(e.target.value)}
                >
                  <option value="recent">최근 읽은순</option>
                  <option value="title">제목순</option>
                  <option value="author">작가명순</option>
                </select>
              )}

              {libraryTab === 'shelf' && (
                <select
                  className="shelf-sort-select"
                  value={shelfSortBy}
                  onChange={(e) => setShelfSortBy(e.target.value)}
                >
                  <option value="recent">최근 담은순</option>
                  <option value="title">제목순</option>
                  <option value="author">작가명순</option>
                </select>
              )}
            </div>
          </div>

          {/* 탭 1: 집필 작품 3열 그리드 */}
          {libraryTab === 'author' && (
            <>
              {isBooksLoading && books.length === 0 ? (
                <div className="empty-state"><p>서재를 불러오는 중입니다...</p></div>
              ) : books.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon-wrap" style={{ marginBottom: '1rem', opacity: 0.6 }}>
                    <BookOpen size={40} strokeWidth={1.5} />
                  </div>
                  <h3>아직 작성 중인 작품이 없습니다.</h3>
                  <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                    '새 작품 만들기'를 눌러 첫 번째 원고를 시작해보세요.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleLoadStarterBook}
                      title="연재서재의 기능을 바로 체험해볼 수 있는 예시 도서를 생성합니다"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <BookOpen size={16} />
                      <span>스타터 가이드북 불러오기</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sample-book-grid-3col">
                  {sortedBooks.map((book) => {
                    const progress = calculateProgress(book);
                    return (
                      <article key={book.id} className="book-card">
                        <div
                          className="book-cover"
                          style={{ background: resolveCoverColor(book.coverColor, 'linear-gradient(135deg, #2b231d, #191410)') }}
                          onClick={() => openBook(book.id)}
                          title={`${book.title} 스튜디오 열기`}
                        >
                          <div className="book-cover-line" />
                          <span className="book-cover-genre">{book.genre || '기획'}</span>
                          <h4 className="book-cover-title">{book.title}</h4>
                        </div>

                        <div className="book-details">
                          <div>
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

                            <h3 
                              className="book-title-text"
                              onClick={() => openBook(book.id)}
                              title={`${book.title} 스튜디오 열기`}
                            >
                              {book.title}
                            </h3>

                            <p className="book-desc-text">
                              {book.subtitle || book.description || '집필 진행 중인 원고입니다.'}
                            </p>
                          </div>

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

          {/* 탭 2: 최근 읽은 작품 3열 그리드 */}
          {libraryTab === 'reader' && (
            <>
              {sortedReadingHistory.length === 0 ? (
                <div className="empty-state reader-empty-state">
                  <div className="empty-state-icon-wrap" style={{ marginBottom: '1rem', opacity: 0.6 }}>
                    <BookOpen size={40} strokeWidth={1.5} />
                  </div>
                  <h3>아직 읽은 작품 기록이 없습니다.</h3>
                  <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem', maxWidth: '440px', lineHeight: '1.6' }}>
                    독자 공간의 '연재 작품'이나 '완성 작품'에서 책을 열람하면,
                    서재에 담지 않아도 읽던 페이지와 화차가 이곳에 자동으로 기록됩니다.
                  </p>
                  <button className="btn btn-primary" onClick={() => setView('serial-explore')}>
                    <Flame size={16} />
                    <span>연재 작품 보러가기</span>
                  </button>
                </div>
              ) : (
                <div className="sample-book-grid-3col">
                  {sortedReadingHistory.map((item) => {
                    const matchedBook = books.find(b => b.id === item.bookId);
                    const isDeletedBook = Boolean(item.isDeleted || (!isBooksLoading && !matchedBook));
                    const displayAuthor = resolveDisplayAuthor(item.author, matchedBook);

                    const handleCardClick = () => {
                      if (isDeletedBook) {
                        showToast('원고가 삭제되어 열람할 수 없는 작품입니다.', 'info');
                        return;
                      }
                      openReader(item.bookId, item.chapterId);
                    };

                    return (
                      <article key={item.bookId} className={`book-card ${isDeletedBook ? 'deleted-book-card' : ''}`}>
                        <div
                          className={`book-cover ${isDeletedBook ? 'deleted-cover' : ''}`}
                          style={{ background: resolveCoverColor(matchedBook?.coverColor || item.coverColor, 'linear-gradient(135deg, #1e3328, #101c16)') }}
                          onClick={handleCardClick}
                          title={isDeletedBook ? '원고가 삭제되어 열람할 수 없습니다' : `${item.bookTitle} 뷰어 열기`}
                        >
                          <div className="book-cover-line" />
                          <span className="book-cover-genre">{item.genre || '소설'}</span>
                          <h4 className="book-cover-title">{item.bookTitle}</h4>
                        </div>

                        <div className="book-details">
                          <div>
                            <div className="card-top-header">
                              <div className="card-badges-left">
                                {isDeletedBook ? (
                                  <span className="status-pill deleted-pill">삭제된 작품</span>
                                ) : (
                                  <span className="status-pill reading-pill">독서중</span>
                                )}
                                <span className="genre-label">글 {displayAuthor}</span>
                              </div>

                              <div className="card-actions-top-right">
                                <button
                                  type="button"
                                  className="action-icon-top danger-btn"
                                  title="최근 읽은 목록에서 제외"
                                  onClick={(e) => handleRemoveHistory(e, item.bookId)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <h3
                              className={`book-title-text ${isDeletedBook ? 'deleted-title' : ''}`}
                              onClick={handleCardClick}
                              title={isDeletedBook ? '원고가 삭제되어 열람할 수 없습니다' : `${item.bookTitle} 뷰어 열기`}
                            >
                              {item.bookTitle}
                            </h3>

                            <p className="book-desc-text">
                              최근 읽던 화: {item.chapterTitle || '1화'}
                              {item.readAt && ` · ${new Date(item.readAt).toLocaleDateString()}`}
                            </p>
                          </div>

                          <div
                            className="book-card-footer"
                            onClick={handleCardClick}
                          >
                            <span>{isDeletedBook ? '독서 기록 보존됨' : '독서 기록'}</span>
                            {isDeletedBook ? (
                              <span className="footer-action-deleted">열람 불가</span>
                            ) : (
                              <div className="footer-action-read">
                                <Play size={12} fill="currentColor" />
                                <span>이어서 읽기</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* 탭 3: 담은 작품 (서재 담기 북마크 & 사용자 정의 카테고리 분류) */}
          {libraryTab === 'shelf' && (
            <>
              {/* 카테고리 필터 & 관리 바 */}
              <div className="shelf-category-bar">
                <div className="shelf-category-chips">
                  <button
                    type="button"
                    className={`shelf-cat-chip ${selectedShelfCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedShelfCategory('all')}
                  >
                    <span>전체</span>
                    <span className="shelf-cat-count">{shelfItems.length}</span>
                  </button>

                  {shelfCategories.map((cat) => {
                    const count = shelfItems.filter(
                      (item) => (item.category || shelfCategories[0] || '읽고 싶은 책') === cat
                    ).length;
                    const isActive = selectedShelfCategory === cat;
                    return (
                      <div
                        key={cat}
                        className={`shelf-cat-chip ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedShelfCategory(cat)}
                      >
                        <span>{cat}</span>
                        <span className="shelf-cat-count">{count}</span>
                        {shelfCategories.length > 1 && (
                          <button
                            type="button"
                            className="shelf-cat-del-btn"
                            title={`'${cat}' 카테고리 삭제`}
                            onClick={(e) => handleDeleteShelfCategory(e, cat)}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn-add-shelf-category"
                  onClick={handleAddShelfCategory}
                >
                  <FolderPlus size={13} />
                  <span>카테고리 추가</span>
                </button>
              </div>

              {filteredAndSortedShelf.length === 0 ? (
                <div className="empty-state reader-empty-state">
                  <div className="empty-state-icon-wrap" style={{ marginBottom: '1rem', opacity: 0.6 }}>
                    <Bookmark size={40} strokeWidth={1.5} />
                  </div>
                  <h3>
                    {selectedShelfCategory === 'all'
                      ? '아직 서재에 담은 작품이 없습니다.'
                      : `'${selectedShelfCategory}' 카테고리에 담긴 작품이 없습니다.`}
                  </h3>
                  <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem', maxWidth: '460px', lineHeight: '1.6' }}>
                    '연재 작품'이나 '완성 작품'에서 읽어보고 싶은 책의 [+ 서재 담기] 버튼을 누르면,
                    원하는 카테고리로 분류하여 나만의 관심 도서 목록을 만들 수 있습니다.
                  </p>
                  <button className="btn btn-primary" onClick={() => setView('serial-explore')}>
                    <Bookmark size={16} />
                    <span>작품 둘러보기</span>
                  </button>
                </div>
              ) : (
                <div className="sample-book-grid-3col">
                  {filteredAndSortedShelf.map((item) => {
                    const matchedBook = books.find(b => b.id === item.bookId);
                    const isDeletedBook = Boolean(item.isDeleted || (!isBooksLoading && !matchedBook));
                    const displayAuthor = resolveDisplayAuthor(item.author, matchedBook);
                    const currentCat = shelfCategories.includes(item.category)
                      ? item.category
                      : (shelfCategories[0] || '읽고 싶은 책');

                    const handleCardClick = () => {
                      if (isDeletedBook) {
                        showToast('원고가 삭제되어 열람할 수 없는 작품입니다.', 'info');
                        return;
                      }
                      openReader(item.bookId, item.chapterId);
                    };

                    return (
                      <article key={item.bookId} className={`book-card ${isDeletedBook ? 'deleted-book-card' : ''}`}>
                        <div
                          className={`book-cover ${isDeletedBook ? 'deleted-cover' : ''}`}
                          style={{ background: resolveCoverColor(matchedBook?.coverColor || item.coverColor, 'linear-gradient(135deg, #2b231d, #191410)') }}
                          onClick={handleCardClick}
                          title={isDeletedBook ? '원고가 삭제되어 열람할 수 없습니다' : `${item.bookTitle} 뷰어 열기`}
                        >
                          <div className="book-cover-line" />
                          <span className="book-cover-genre">{item.genre || '소설'}</span>
                          <h4 className="book-cover-title">{item.bookTitle}</h4>
                        </div>

                        <div className="book-details">
                          <div>
                            <div className="card-top-header">
                              <div className="card-badges-left">
                                {isDeletedBook ? (
                                  <span className="status-pill deleted-pill">삭제된 작품</span>
                                ) : (
                                  <select
                                    className="shelf-card-cat-select"
                                    value={currentCat}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleChangeShelfItemCategory(item.bookId, e.target.value)}
                                    title="카테고리 변경"
                                  >
                                    {shelfCategories.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <span className="genre-label">글 {displayAuthor}</span>
                              </div>

                              <div className="card-actions-top-right">
                                <button
                                  type="button"
                                  className="action-icon-top danger-btn"
                                  title="담은 작품에서 제외"
                                  onClick={(e) => handleRemoveShelfItem(e, item.bookId)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <h3
                              className={`book-title-text ${isDeletedBook ? 'deleted-title' : ''}`}
                              onClick={handleCardClick}
                              title={isDeletedBook ? '원고가 삭제되어 열람할 수 없습니다' : `${item.bookTitle} 뷰어 열기`}
                            >
                              {item.bookTitle}
                            </h3>

                            <p className="book-desc-text">
                              {matchedBook?.subtitle || item.subtitle || `${item.genre || '도서'} · ${item.chapterTitle || '1화'}`}
                            </p>
                          </div>

                          <div
                            className="book-card-footer"
                            onClick={handleCardClick}
                          >
                            <span>
                              {(item.savedAt || item.readAt)
                                ? `${new Date(item.savedAt || item.readAt).toLocaleDateString()} 담음`
                                : '서재에 담김'}
                            </span>
                            {isDeletedBook ? (
                              <span className="footer-action-deleted">열람 불가</span>
                            ) : (
                              <div className="footer-action-read">
                                <Play size={12} fill="currentColor" />
                                <span>읽기 시작</span>
                              </div>
                            )}
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
