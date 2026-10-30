import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  BookCheck,
  Eye,
  Heart,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  MessageSquare
} from 'lucide-react';
import { useStore } from '../store';
import { OFFICIAL_GENRES } from '../data/genreConstants';
import { storageService } from '../services/storageService';
import './ExploreComplete.css';

// 공식 출판 10대 표준 장르
const KYOBO_GENRES = [
  { id: 'all', label: '전체 장르' },
  ...OFFICIAL_GENRES
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

  // 담은 작품(reader_shelf) 담김 상태 추적
  const [savedBookIds, setSavedBookIds] = useState(() => new Set());

  const syncSavedBooks = () => {
    const items = storageService.getShelfItems();
    setSavedBookIds(new Set(items.map(item => item.bookId)));
  };

  useEffect(() => {
    loadBooks();
    syncSavedBooks();
  }, [loadBooks]);

  // 필터 상태
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('views'); // 'views' | 'likes' | 'latest'

  // 작가 필명 헬퍼
  const getDisplayAuthor = (book) => {
    if (book?.author && book.author !== '작가' && book.author.trim().length > 0) {
      return book.author;
    }
    const cfgAuthor = storageService.getConfig()?.defaultAuthor;
    return user?.displayName || cfgAuthor || '작가 미상';
  };

  // 담은 작품 담기 / 빼기 토글 액션 (storageService 일원화)
  const handleToggleShelf = (e, book) => {
    e.stopPropagation();
    const { added, list } = storageService.toggleShelfItem({
      ...book,
      author: getDisplayAuthor(book)
    });
    setSavedBookIds(new Set(list.map(h => h.bookId)));
    if (added) {
      showToast(`'${book.title}' 도서가 담은 작품에 추가되었습니다.`, 'success');
    } else {
      showToast(`'${book.title}' 도서가 담은 작품에서 제거되었습니다.`, 'info');
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

        const calculatedPages = Math.max(1, Math.ceil(totalWords / 500));
        const totalViews = chapters.reduce((acc, c) => acc + (c.views || 0), 0);
        const totalLikes = chapters.reduce((acc, c) => acc + (c.likes || 0), 0);
        const commentCount = chapters.reduce((acc, c) => acc + (c.comments?.length || 0), 0);

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

  // 상단 실시간 Best TOP 5 집계
  const topRankedBooks = useMemo(() => {
    return [...completeBooks]
      .sort((a, b) => (b.totalViews + b.totalLikes * 20) - (a.totalViews + a.totalLikes * 20))
      .slice(0, 5);
  }, [completeBooks]);

  // 필터링 및 정렬
  const filteredBooks = useMemo(() => {
    return completeBooks.filter(book => {
      if (selectedGenre !== 'all') {
        const targetGenreObj = KYOBO_GENRES.find(g => g.id === selectedGenre);
        if (targetGenreObj && targetGenreObj.keywords) {
          const bGenre = (book.genre || '').toLowerCase();
          const match = targetGenreObj.keywords.some(kw => bGenre.includes(kw.toLowerCase()));
          if (!match) return false;
        }
      }
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

      <main className="explore-complete-main">
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
                    <div
                      className="complete-cover-thumb"
                      style={{
                        background:
                          book.coverColor && !book.coverColor.includes('#1e293b') && !book.coverColor.includes('#1e3a8a') && !book.coverColor.includes('#2563eb')
                            ? book.coverColor
                            : 'linear-gradient(135deg, #2b231d, #191410)'
                      }}
                      onClick={() => openReader(book.id, firstChapId)}
                      title="1장부터 정주행 시작"
                    >
                      <div className="complete-cover-line" />
                      <span className="complete-cover-genre">{book.genre || '단행본'}</span>
                      <h4 className="complete-cover-title-clean">{book.title}</h4>
                    </div>

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
                        title={isSaved ? '담은 작품에서 제거' : '담은 작품에 보관'}
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
