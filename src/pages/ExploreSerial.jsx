import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
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
import './ExploreSerial.css';

// 공식 출판 10대 표준 장르
const KYOBO_GENRES = [
  { id: 'all', label: '전체 장르' },
  ...OFFICIAL_GENRES
];

// 연재 주기 탭 (월~일 + 자유연재)
const SERIAL_CYCLES = [
  { id: 'all', label: '전체' },
  { id: 'mon', label: '월' },
  { id: 'tue', label: '화' },
  { id: 'wed', label: '수' },
  { id: 'thu', label: '목' },
  { id: 'fri', label: '금' },
  { id: 'sat', label: '토' },
  { id: 'sun', label: '일' },
  { id: 'free', label: '자유연재' }
];

export default function ExploreSerial() {
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
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [sortBy, setSortBy] = useState('latest'); // 'latest' | 'views' | 'likes'

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

  // 연재 데이터 가공 & 통계 집계: 100% 실제 데이터 기반 집계
  const serialBooks = useMemo(() => {
    return books
      .filter((book) => (book.chapters || []).some((c) => c.status === 'published'))
      .map((book) => {
        const chapters = book.chapters || [];
        const publishedChapters = chapters.filter((c) => c.status === 'published');
        const latestChap = publishedChapters[publishedChapters.length - 1];

        const totalViews = chapters.reduce((acc, c) => acc + (c.views || 0), 0);
        const totalLikes = chapters.reduce((acc, c) => acc + (c.likes || 0), 0);
        const commentCount = chapters.reduce((acc, c) => acc + (c.comments?.length || 0), 0);

        const totalWords = chapters.reduce((acc, c) => {
          const secWords = (c.sections || []).reduce((sAcc, s) => sAcc + (s.content || '').replace(/<[^>]*>/g, '').length, 0);
          return acc + secWords;
        }, 0);

        const latestChapWords = latestChap
          ? (latestChap.sections || []).reduce((acc, s) => acc + (s.content || '').replace(/<[^>]*>/g, '').length, 0)
          : 0;

        const latestChapPages = Math.max(1, Math.ceil(latestChapWords / 500));
        const totalPages = Math.max(1, Math.ceil(totalWords / 500));
        const cycle = book.serialCycle || 'free';

        return {
          ...book,
          publishedChapters,
          publishedChaptersCount: publishedChapters.length,
          totalChaptersCount: chapters.length,
          latestChap,
          latestChapPages,
          totalPages,
          commentCount,
          totalViews,
          totalLikes,
          cycle,
          displayAuthor: getDisplayAuthor(book),
          latestPublishedAt: latestChap?.publishedAt || book.updatedAt || book.createdAt
        };
      });
  }, [books, user]);

  // 상단 실시간 Best TOP 5 집계
  const topRankedBooks = useMemo(() => {
    return [...serialBooks]
      .sort((a, b) => (b.totalViews + b.totalLikes * 20) - (a.totalViews + a.totalLikes * 20))
      .slice(0, 5);
  }, [serialBooks]);

  // 메인 필터링 및 정렬
  const filteredBooks = useMemo(() => {
    return serialBooks.filter(book => {
      if (selectedGenre !== 'all') {
        const targetGenreObj = KYOBO_GENRES.find(g => g.id === selectedGenre);
        if (targetGenreObj && targetGenreObj.keywords) {
          const bGenre = (book.genre || '').toLowerCase();
          const match = targetGenreObj.keywords.some(kw => bGenre.includes(kw.toLowerCase()));
          if (!match) return false;
        }
      }
      if (selectedCycle !== 'all' && book.cycle !== selectedCycle) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'views') return b.totalViews - a.totalViews;
      if (sortBy === 'likes') return b.totalLikes - a.totalLikes;
      return new Date(b.latestPublishedAt || 0) - new Date(a.latestPublishedAt || 0);
    });
  }, [serialBooks, selectedGenre, selectedCycle, sortBy]);

  const getCycleBadgeText = (cycleId) => {
    const item = SERIAL_CYCLES.find(c => c.id === cycleId);
    if (!item) return '자유연재';
    return item.id === 'free' ? '자유연재' : `${item.label}요 연재`;
  };

  return (
    <div className="explore-serial-container">
      <aside className="explore-genre-sidebar">
        <div className="genre-sidebar-header">
          <h3>작품 장르</h3>
          <span className="genre-count-total">{serialBooks.length}작품</span>
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

      <main className="explore-serial-main">
        <section className="explore-ranking-section">
          <div className="ranking-section-header">
            <div className="ranking-title-group">
              <TrendingUp size={18} className="ranking-icon" />
              <h2>실시간 Best TOP 5</h2>
            </div>
            <span className="ranking-subinfo">실시간 독자 반응 집계</span>
          </div>

          <div className="ranking-cards-grid">
            {topRankedBooks.length === 0 ? (
              <div className="ranking-empty">등록된 작품이 없습니다.</div>
            ) : (
              topRankedBooks.map((book, idx) => (
                <div
                  key={book.id}
                  className="ranking-mini-card"
                  onClick={() => openReader(book.id, book.publishedChapters?.[0]?.id || book.chapters?.[0]?.id)}
                  title={`${book.title} 읽기`}
                >
                  <div className={`rank-number-badge rank-${idx + 1}`}>
                    {idx + 1}
                  </div>
                  <div className="rank-card-info">
                    <span className="rank-book-genre">{book.genre || '웹소설'}</span>
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

        <section className="cycle-tabs-bar">
          <div className="cycle-tabs-left">
            <Calendar size={16} className="cycle-icon" />
            <span className="cycle-title-label">연재 주기:</span>
            <div className="cycle-pills-group">
              {SERIAL_CYCLES.map(cycle => (
                <button
                  key={cycle.id}
                  className={`cycle-pill-btn ${selectedCycle === cycle.id ? 'active' : ''}`}
                  onClick={() => setSelectedCycle(cycle.id)}
                >
                  {cycle.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cycle-sort-group">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="serial-sort-select"
            >
              <option value="latest">최신 연재순</option>
              <option value="views">조회수순</option>
              <option value="likes">독자 관심순</option>
            </select>
          </div>
        </section>

        <section className="serial-books-list-section">
          <div className="list-section-summary">
            <span>총 <strong>{filteredBooks.length}</strong>개의 연재 작품</span>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="serial-empty-card">
              <BookOpen size={42} className="empty-book-icon" />
              <h3>해당 조건의 연재 작품이 없습니다</h3>
              <p>스튜디오에서 새로운 챕터를 집필하고 '연재 발행'을 진행해 보세요.</p>
              <button className="btn-go-studio" onClick={() => setView('studio')}>
                집필 스튜디오로 가기 <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="serial-card-list">
              {filteredBooks.map(book => {
                const firstChapId = book.publishedChapters?.[0]?.id || book.chapters?.[0]?.id;
                const latestChapId = book.latestChap?.id || firstChapId;
                const isSaved = savedBookIds.has(book.id);

                return (
                  <article key={book.id} className="serial-book-card">
                    <div
                      className="serial-cover-thumb"
                      style={{
                        background:
                          book.coverColor && !book.coverColor.includes('#1e293b') && !book.coverColor.includes('#2563eb')
                            ? book.coverColor
                            : 'linear-gradient(135deg, #2b231d, #191410)'
                      }}
                      onClick={() => openReader(book.id, firstChapId)}
                      title="첫 회부터 읽기"
                    >
                      <div className="serial-cover-line" />
                      <span className="serial-cover-genre">{book.genre || '연재'}</span>
                      <h4 className="serial-cover-title-clean">{book.title}</h4>
                    </div>

                    <div className="serial-card-body">
                      <div className="serial-card-tags">
                        <span className="badge-cycle-tag">{getCycleBadgeText(book.cycle)}</span>
                        <span className="badge-genre-tag">{book.genre || '일반연재'}</span>
                        {book.hasPublished && <span className="badge-up-tag">UP</span>}
                      </div>

                      <h3
                        className="serial-card-title"
                        onClick={() => openReader(book.id, latestChapId)}
                        title="최신화 열람"
                      >
                        {book.title}
                      </h3>

                      <div className="serial-meta-line">
                        <span className="author-name">글 {book.displayAuthor}</span>
                        <span className="meta-sep">·</span>
                        <span className="chap-count">총 {book.totalChaptersCount}화 ({book.publishedChaptersCount}화 발행)</span>
                        <span className="meta-sep">·</span>
                        <span className="page-count-badge">최신화 {book.latestChapPages}쪽 (누적 {book.totalPages}쪽)</span>
                        <span className="meta-sep">·</span>
                        <span className="comment-badge"><MessageSquare size={12} className="meta-comment-icon" /> {book.commentCount}</span>
                        <span className="meta-sep">·</span>
                        <span className="views-count" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> {book.totalViews.toLocaleString()}</span>
                        <span className="meta-sep">·</span>
                        <span className="likes-count" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={12} /> {book.totalLikes}</span>
                      </div>

                      <p className="serial-logline">
                        {book.subtitle || (book.latestChap ? `최신화: ${book.latestChap.title}` : '연재가 시작된 작품입니다.')}
                      </p>
                    </div>

                    <div className="serial-card-actions">
                      <button
                        className="btn-read-first"
                        onClick={() => openReader(book.id, firstChapId)}
                        title="1화부터 정주행"
                      >
                        1화 보기
                      </button>
                      <button
                        className="btn-read-latest"
                        onClick={() => openReader(book.id, latestChapId)}
                        title="최신 연재화 바로 읽기"
                      >
                        최신화 <ChevronRight size={14} />
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
