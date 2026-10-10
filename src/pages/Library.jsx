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
  X, 
  Sparkles, 
  Calendar, 
  ArrowRight, 
  BookOpen, 
  Flame, 
  Bookmark, 
  Clock, 
  Play, 
  Compass,
  Zap,
  Edit3
} from 'lucide-react';

export default function Library() {
  const {
    books, loadBooks, openBook, openReader, deleteBook, isBooksLoading, showToast,
    isNewBookModalOpen, setNewBookModalOpen, setView, activeBook, user
  } = useStore();

  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });
  const [libraryTab, setLibraryTab] = useState(() => localStorage.getItem('library_active_tab') || 'author'); // 'author' | 'reader'
  const [readingHistory, setReadingHistory] = useState([]);

  // 모달 폼 상태
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [genre, setGenre] = useState('자기계발');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateBook = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('도서 제목을 입력해주세요.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const cfgRaw = localStorage.getItem('bookstudio_config');
      let defaultAuthor = user?.displayName || '김연재';
      try {
        if (cfgRaw) {
          const cfg = JSON.parse(cfgRaw);
          if (cfg.defaultAuthor) defaultAuthor = cfg.defaultAuthor;
        }
      } catch {}

      const newBook = await bookService.createBook({
        title: title.trim(),
        subtitle: subtitle.trim(),
        targetAudience: targetAudience.trim(),
        genre,
        author: defaultAuthor
      });
      await loadBooks();
      showToast('새 도서 프로젝트가 생성되었습니다!', 'success');
      setNewBookModalOpen(false);
      setTitle('');
      setSubtitle('');
      setTargetAudience('');
      openBook(newBook.id);
    } catch (err) {
      showToast(`도서 생성 실패: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (e, bookId, bookTitle) => {
    e.stopPropagation();
    if (window.confirm(`'${bookTitle}' 프로젝트를 정말 삭제하시겠습니까?`)) {
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
        <button className="btn btn-primary" onClick={() => setNewBookModalOpen(true)}>
          <Plus size={18} />
          <span>새 책 만들기</span>
        </button>
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
                  onClick={() => setNewBookModalOpen(true)}
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
                    <button className="btn btn-primary" onClick={() => setNewBookModalOpen(true)}>
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
                        <div key={book.id} className="horizontal-book-card" onClick={() => openBook(book.id)}>
                          {/* 좌측: 책 표지 영역 */}
                          <div 
                            className="h-card-cover"
                            style={{ background: book.coverColor || 'linear-gradient(135deg, #1e293b, #0f172a)' }}
                          >
                            <h3 className="h-cover-title">{book.title}</h3>
                          </div>

                          {/* 우측: 세부 내용 박스 */}
                          <div className="h-card-body">
                            {/* 1행: 장르, 마감일, 우측 휴지통 */}
                            <div className="h-card-top-row">
                              <div className="h-badge-group">
                                <span className="h-genre-badge">{book.genre || '기획'}</span>
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
                              <button
                                type="button"
                                className="btn-icon-danger"
                                title="프로젝트 삭제"
                                onClick={(e) => handleDelete(e, book.id, book.title)}
                              >
                                <Trash2 size={15} />
                              </button>
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

                            {/* 4행: 푸터 (챕터 수, 뷰어 버튼) */}
                            <div className="h-card-footer">
                              <span className="h-meta-text">챕터 {book.chapters?.length || 0}개</span>
                              <button
                                className="btn btn-secondary btn-sm"
                                title="독자 뷰어로 열람"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReader(book.id);
                                }}
                              >
                                <BookOpen size={13} />
                                <span>뷰어</span>
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
                          onClick={() => openReader(item.bookId, item.chapterId)}
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

      {/* 새 책 만들기 기획 모달 */}
      {isNewBookModalOpen && (
        <div className="modal-overlay" onClick={() => setNewBookModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                <h3>새 전자책 프로젝트 기획</h3>
              </div>
              <button className="btn-icon" onClick={() => setNewBookModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBook}>
              <div className="modal-body">
                <div className="form-group">
                  <label>도서 제목 (필수)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 생성형 AI로 시작하는 1인 비즈니스"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>부제 / 한 줄 슬로건</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 기획부터 출간까지 3주 만에 끝내는 실전 로드맵"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>도서 장르 (출판 표준 8대 장르)</label>
                  <select
                    className="form-control"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                  >
                    <optgroup label="경제 / 경영 / 자기계발">
                      <option value="자기계발">자기계발</option>
                      <option value="경제/경영">경제 / 경영</option>
                      <option value="재테크/투자/부동산">재테크 / 투자 / 부동산</option>
                    </optgroup>

                    <optgroup label="문학 / 에세이">
                      <option value="소설">소설</option>
                      <option value="시/에세이">시 / 에세이</option>
                      <option value="웹소설/장르문학">웹소설 / 장르문학</option>
                    </optgroup>

                    <optgroup label="인문 / 사회 / 과학">
                      <option value="인문/철학">인문 / 철학</option>
                      <option value="역사/문화">역사 / 문화</option>
                      <option value="사회/정치">사회 / 정치</option>
                      <option value="자연과학/공학">자연과학 / 공학</option>
                    </optgroup>

                    <optgroup label="IT / 테크">
                      <option value="IT/프로그래밍/AI">IT / 프로그래밍 / AI</option>
                      <option value="데이터/컴퓨터공학">데이터 / 컴퓨터공학</option>
                    </optgroup>

                    <optgroup label="라이프스타일 / 실용">
                      <option value="건강/요리/다이어트">건강 / 요리 / 다이어트</option>
                      <option value="취미/실용/스포츠">취미 / 실용 / 스포츠</option>
                      <option value="여행/레저">여행 / 레저</option>
                    </optgroup>

                    <optgroup label="예술 / 대중문화">
                      <option value="예술/디자인">예술 / 디자인</option>
                      <option value="음악/영화/대중문화">음악 / 영화 / 대중문화</option>
                    </optgroup>

                    <optgroup label="교육 / 어학">
                      <option value="외국어/어학">외국어 / 어학</option>
                      <option value="청소년/아동">청소년 / 아동</option>
                    </optgroup>
                  </select>
                </div>

                <div className="form-group">
                  <label>목표 독자층</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: AI 툴을 업무에 바로 써먹고 싶은 직장인"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setNewBookModalOpen(false)} disabled={isSubmitting}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Sparkles size={16} />
                  <span>{isSubmitting ? '생성 중...' : '프로젝트 시작'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
