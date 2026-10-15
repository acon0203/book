import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, 
  BookCheck,
  Eye, 
  Heart, 
  ArrowRight, 
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  Star,
  MessageSquare,
  Sparkles,
  Award
} from 'lucide-react';
import { useStore } from '../store';
import './ExploreComplete.css';

// 표준 핵심 8대 장르 (자서전, 회고록, 평전 포함)
const KYOBO_GENRES = [
  { id: 'all', label: '전체 장르' },
  { id: 'novel', label: '소설', keywords: ['소설', '웹소설', '문학'] },
  { id: 'essay', label: '시 / 에세이', keywords: ['시', '에세이', '산문', '자서전', '회고록', '일대기'] },
  { id: 'economy', label: '경제 / 경영', keywords: ['경제', '경영', '재테크', '투자', '비즈니스'] },
  { id: 'self', label: '자기계발', keywords: ['자기계발', '동기부여', '생산성'] },
  { id: 'humanities', label: '인문 / 사회', keywords: ['인문', '철학', '역사', '문화', '사회', '정치', '평전', '자서전', '인물'] },
  { id: 'tech', label: 'IT / 과학', keywords: ['IT', '컴퓨터', '프로그래밍', '과학', '공학', 'AI'] },
  { id: 'life', label: '라이프 / 실용', keywords: ['건강', '요리', '취미', '실용', '스포츠', '여행'] },
  { id: 'art', label: '예술 / 문화', keywords: ['예술', '디자인', '대중문화', '음악', '영화'] }
];

// 단행본 분량 및 큐레이션 필터 탭
const COMPLETE_CATEGORIES = [
  { id: 'all', label: '전체 완결작' },
  { id: 'short', label: '단편선 (100쪽 이하)' },
  { id: 'medium', label: '중편 (100~250쪽)' },
  { id: 'full', label: '장편 단행본 (250쪽+)' },
  { id: 'recommended', label: '완독 추천작' }
];

export default function ExploreComplete() {
  const books = useStore((state) => state.books);
  const loadBooks = useStore((state) => state.loadBooks);
  const openReader = useStore((state) => state.openReader);
  const setView = useStore((state) => state.setView);
  const user = useStore((state) => state.user);
  const showToast = useStore((state) => state.showToast);

  // 독서 서재(reader_history) 담김 상태 추적
  const [savedBookIds, setSavedBookIds] = useState(() => new Set());

  // 최신 독서 서재 담김 목록 동기화
  const syncSavedBooks = () => {
    try {
      const raw = localStorage.getItem('reader_history') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedBookIds(new Set(parsed.map(item => item.bookId)));
      }
    } catch {
      setSavedBookIds(new Set());
    }
  };

  useEffect(() => {
    loadBooks();
    syncSavedBooks();
  }, [loadBooks]);

  // 필터 상태
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('views'); // 'views' | 'likes' | 'latest'

  // 작가 필명 헬퍼 (Library / ExploreSerial과 1:1 일체화)
  const getDisplayAuthor = (book) => {
    if (book?.author && book.author !== '작가' && book.author.trim().length > 0) {
      return book.author;
    }
    const cfgRaw = localStorage.getItem('bookstudio_config');
    let cfgAuthor = '';
    try { if (cfgRaw) cfgAuthor = JSON.parse(cfgRaw).defaultAuthor; } catch {}
    const userAuthor = user?.displayName || cfgAuthor;
    return userAuthor || '작가 미상';
  };

  // 독서 서재 담기 / 빼기 토글 액션
  const handleToggleShelf = (e, book) => {
    e.stopPropagation();
    try {
      const historyRaw = localStorage.getItem('reader_history') || '[]';
      const history = JSON.parse(historyRaw);
      const isAlreadySaved = history.some(h => h.bookId === book.id);
      let updatedHistory;

      if (isAlreadySaved) {
        updatedHistory = history.filter(h => h.bookId !== book.id);
        localStorage.setItem('reader_history', JSON.stringify(updatedHistory));
        setSavedBookIds(new Set(updatedHistory.map(h => h.bookId)));
        showToast(`'${book.title}' 도서가 독서 서재에서 제거되었습니다.`, 'info');
      } else {
        const firstChap = book.chapters?.[0];
        const newEntry = {
          bookId: book.id,
          bookTitle: book.title,
          subtitle: book.subtitle || '',
          author: getDisplayAuthor(book),
          genre: book.genre || '소설',
          chapterId: firstChap?.id,
          chapterTitle: firstChap?.title || '1장',
          coverColor: book.coverColor || '#1e3a8a',
          readAt: new Date().toISOString()
        };
        updatedHistory = [newEntry, ...history.filter(h => h.bookId !== book.id)].slice(0, 30);
        localStorage.setItem('reader_history', JSON.stringify(updatedHistory));
        setSavedBookIds(new Set(updatedHistory.map(h => h.bookId)));
        showToast(`'${book.title}' 도서가 독서 서재에 담겼습니다! 📚`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle complete shelf bookmark:', err);
    }
  };

  // 완성 도서 가공 및 100% 실제 데이터 산출 (완결작 isCompleted만 필터링)
  const completeBooks = useMemo(() => {
    return books
      .filter((book) => !!book.isCompleted)
      .map((book) => {
      const chapters = book.chapters || [];
      const totalWords = chapters.reduce((acc, c) => {
        const secWords = (c.sections || []).reduce((sAcc, s) => sAcc + (s.content || '').replace(/<[^>]*>/g, '').length, 0);
        return acc + secWords;
      }, 0);

      // 실제 글자수 기반 쪽수 계산 (500자 = 1쪽)
      const calculatedPages = Math.max(1, Math.ceil(totalWords / 500));
      
      // 실제 조회수, 관심수, 댓글수 (더미값 완전 제거)
      const totalViews = chapters.reduce((acc, c) => acc + (c.views || 0), 0);
      const totalLikes = chapters.reduce((acc, c) => acc + (c.likes || 0), 0);
      const commentCount = chapters.reduce((acc, c) => acc + (c.comments?.length || 0), 0);

      // 분량 카테고리 판별
      let volumeCategory = 'medium';
      if (calculatedPages <= 100) volumeCategory = 'short';
      else if (calculatedPages >= 250) volumeCategory = 'full';

      return {
        ...book,
        totalPages: calculatedPages,
        volumeCategory,
        commentCount,
        totalViews,
        totalLikes,
        displayAuthor: getDisplayAuthor(book),
        completedAt: book.updatedAt || book.createdAt
      };
    });
  }, [books, user]);

  // 상단 실시간 Best TOP 5 집계 (실제 조회수 + 관심수 가중치)
  const topRankedBooks = useMemo(() => {
    return [...completeBooks]
      .sort((a, b) => (b.totalViews + b.totalLikes * 20) - (a.totalViews + a.totalLikes * 20))
      .slice(0, 5);
  }, [completeBooks]);

  // 필터링 및 정렬
  const filteredBooks = useMemo(() => {
    return completeBooks.filter(book => {
      // 1. 장르 필터
      if (selectedGenre !== 'all') {
        const targetGenreObj = KYOBO_GENRES.find(g => g.id === selectedGenre);
        if (targetGenreObj && targetGenreObj.keywords) {
          const bGenre = (book.genre || '').toLowerCase();
          const match = targetGenreObj.keywords.some(kw => bGenre.includes(kw.toLowerCase()));
          if (!match) return false;
        }
      }

      // 2. 단행본 분량 / 큐레이션 필터
      if (selectedCategory === 'short' && book.volumeCategory !== 'short') return false;
      if (selectedCategory === 'medium' && book.volumeCategory !== 'medium') return false;
      if (selectedCategory === 'full' && book.volumeCategory !== 'full') return false;
      if (selectedCategory === 'recommended' && book.totalLikes === 0 && book.totalViews === 0) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'likes') return b.totalLikes - a.totalLikes;
      if (sortBy === 'latest') return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
      return b.totalViews - a.totalViews;
    });
  }, [completeBooks, selectedGenre, selectedCategory, sortBy]);

  return (
    <div className="explore-complete-container">
      {/* 1. 좌측 작품 장르 사이드바 */}
      <aside className="explore-genre-sidebar">
        <div className="genre-sidebar-header">
          <h3>작품 장르</h3>
          <span className="genre-count-total">{completeBooks.length}작품</span>
        </div>
        <nav className="genre-nav-list">
          {KYOBO_GENRES.map(g => (
            <button
              key={g.id}
              className={`genre-nav-item ${selectedGenre === g.id ? 'active' : ''}`}
              onClick={() => setSelectedGenre(g.id)}
            >
              <span className="genre-label">{g.label}</span>
              {selectedGenre === g.id && <span className="genre-active-dot" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* 2. 우측 메인 콘텐츠 영역 */}
      <main className="explore-complete-main">
        {/* 상단 큐레이션: 🔥 실시간 Best TOP 5 가로 보드 */}
        <section className="explore-ranking-section">
          <div className="ranking-section-header">
            <div className="ranking-title-group">
              <TrendingUp size={18} className="ranking-icon" />
              <h2>실시간 Best TOP 5</h2>
            </div>
            <span className="ranking-subinfo">실시간 독자 반응 종합 집계</span>
          </div>

          <div className="ranking-cards-grid">
            {topRankedBooks.length === 0 ? (
              <div className="ranking-empty">등록된 작품이 없습니다.</div>
            ) : (
              topRankedBooks.map((book, idx) => (
                <div 
                  key={book.id} 
                  className="ranking-mini-card"
                  onClick={() => openReader(book.id, book.chapters?.[0]?.id)}
                  title={`${book.title} 읽기`}
                >
                  <div className={`rank-number-badge rank-${idx + 1}`}>
                    {idx + 1}
                  </div>
                  <div className="rank-card-info">
                    <span className="rank-book-genre">{book.genre || '단행본'}</span>
                    <strong className="rank-book-title">{book.title}</strong>
                    <div className="rank-meta-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Eye size={12} /> {book.totalViews.toLocaleString()}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Heart size={12} /> {book.totalLikes}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 단행본 큐레이션 / 분량 탭 바 */}
        <section className="complete-tabs-bar">
          <div className="complete-tabs-left">
            <BookCheck size={16} className="complete-tab-icon" />
            <span className="complete-title-label">단행본 서가:</span>
            <div className="complete-pills-group">
              {COMPLETE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`complete-pill-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 우측 정렬 드롭다운 */}
          <div className="complete-sort-group">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="complete-sort-select"
            >
              <option value="views">인기 조회순</option>
              <option value="likes">독자 관심순</option>
              <option value="latest">최신 완결순</option>
            </select>
          </div>
        </section>

        {/* 메인 완성 도서 리스트 */}
        <section className="complete-books-list-section">
          <div className="list-section-summary">
            <span>총 <strong>{filteredBooks.length}</strong>권의 완결 단행본</span>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="complete-empty-card">
              <BookOpen size={42} className="empty-book-icon" />
              <h3>해당 조건의 완결 도서가 없습니다</h3>
              <p>집필을 완료한 도서가 여기에 표시됩니다.</p>
              <button className="btn-go-studio" onClick={() => setView('studio')}>
                집필 스튜디오로 가기 <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="complete-card-list">
              {filteredBooks.map(book => {
                const firstChapId = book.chapters?.[0]?.id;
                const isSaved = savedBookIds.has(book.id);

                return (
                  <article key={book.id} className="complete-book-card">
                    {/* 좌측 썸네일 표지 (Library / ExploreSerial과 1:1 일체화) */}
                    <div 
                      className="complete-cover-thumb"
                      style={{ background: book.coverColor || 'linear-gradient(135deg, #1e3a8a, #0f172a)' }}
                      onClick={() => openReader(book.id, firstChapId)}
                      title="1장부터 정주행 시작"
                    >
                      <h3 className="complete-cover-title-clean">{book.title}</h3>
                    </div>

                    {/* 중앙 상세 정보 */}
                    <div className="complete-card-body">
                      <div className="complete-card-tags">
                        <span className="badge-complete-tag">완결 完</span>
                        <span className="badge-genre-tag">{book.genre || '단행본'}</span>
                        <span className="badge-volume-tag">
                          {book.volumeCategory === 'short' ? '단편선' : book.volumeCategory === 'full' ? '장편 단행본' : '중편'}
                        </span>
                      </div>

                      <h3 
                        className="complete-card-title" 
                        onClick={() => openReader(book.id, firstChapId)}
                        title="단행본 열람"
                      >
                        {book.title}
                      </h3>

                      {/* 일체화된 실측 메타 라인: 작가명 · 총 쪽수 · 댓글 · 조회 · 하트 */}
                      <div className="complete-meta-line">
                        <span className="author-name">글 {book.displayAuthor}</span>
                        <span className="meta-sep">·</span>
                        <span className="page-count-badge">총 {book.totalPages}쪽 (완결)</span>
                        <span className="meta-sep">·</span>
                        <span className="comment-badge"><MessageSquare size={12} className="meta-comment-icon" /> {book.commentCount}</span>
                        <span className="meta-sep">·</span>
                        <span className="views-count" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> {book.totalViews.toLocaleString()}</span>
                        <span className="meta-sep">·</span>
                        <span className="likes-count" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={12} /> {book.totalLikes}</span>
                      </div>

                      <p className="complete-logline">
                        {book.subtitle || '완결된 단행본 작품입니다.'}
                      </p>
                    </div>

                    {/* 우측 액션 버튼들 (정주행 시작 + 서재 담기 토글) */}
                    <div className="complete-card-actions">
                      <button 
                        className="btn-read-start"
                        onClick={() => openReader(book.id, firstChapId)}
                        title="1장부터 정주행 시작"
                      >
                        정주행 시작 <ChevronRight size={14} />
                      </button>
                      <button 
                        className={`btn-save-shelf ${isSaved ? 'saved' : ''}`}
                        onClick={(e) => handleToggleShelf(e, book)}
                        title={isSaved ? '독서 서재에서 제거' : '내 독서 서재에 보관'}
                      >
                        {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                        <span>{isSaved ? '서재에 담김' : '+ 서재 담기'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
