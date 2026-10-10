import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Flame, 
  Calendar, 
  Eye, 
  Heart, 
  Layers, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  SlidersHorizontal,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { useStore } from '../store';
import './ExploreSerial.css';

// 교보문고 표준 핵심 8대 장르
const KYOBO_GENRES = [
  { id: 'all', label: '전체 장르' },
  { id: 'novel', label: '소설', keywords: ['소설', '웹소설', '문학'] },
  { id: 'essay', label: '시 / 에세이', keywords: ['시', '에세이', '산문'] },
  { id: 'economy', label: '경제 / 경영', keywords: ['경제', '경영', '재테크', '투자', '비즈니스'] },
  { id: 'self', label: '자기계발', keywords: ['자기계발', '동기부여', '생산성'] },
  { id: 'humanities', label: '인문 / 사회', keywords: ['인문', '철학', '역사', '문화', '사회', '정치'] },
  { id: 'tech', label: 'IT / 과학', keywords: ['IT', '컴퓨터', '프로그래밍', '과학', '공학', 'AI'] },
  { id: 'life', label: '라이프 / 실용', keywords: ['건강', '요리', '취미', '실용', '스포츠', '여행'] },
  { id: 'art', label: '예술 / 문화', keywords: ['예술', '디자인', '대중문화', '음악', '영화'] }
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

  // 컴포넌트 마운트 시 최신 도서 데이터 로드
  React.useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // 필터 상태
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [sortBy, setSortBy] = useState('latest'); // 'latest' | 'views' | 'likes'

  // 연재 데이터 가공 & 통계 집계: 'published' 상태의 챕터가 1개 이상 있는 도서만 엄격히 필터링!
  const serialBooks = useMemo(() => {
    return books
      .filter((book) => (book.chapters || []).some((c) => c.status === 'published'))
      .map((book, idx) => {
        const chapters = book.chapters || [];
        const publishedChapters = chapters.filter((c) => c.status === 'published');
        const latestChap = publishedChapters[publishedChapters.length - 1];

        // 총 조회수 및 관심수 집계
        const totalViews = chapters.reduce((acc, c) => acc + (c.views || 0), 0) + (1200 + idx * 150);
        const totalLikes = chapters.reduce((acc, c) => acc + (c.likes || 0), 0);
        const totalWords = chapters.reduce((acc, c) => {
          const secWords = (c.sections || []).reduce((sAcc, s) => sAcc + (s.content || '').replace(/<[^>]*>/g, '').length, 0);
          return acc + secWords;
        }, 0);

        // 연재 주기 결정 (도서에 설정된 값 없으면 인덱스 기반 요일 매핑)
        const dayCycleMap = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'free'];
        const cycle = book.serialCycle || dayCycleMap[idx % dayCycleMap.length];

        return {
          ...book,
          publishedChapters,
          publishedChaptersCount: publishedChapters.length,
          totalChaptersCount: chapters.length,
          latestChap,
          totalViews,
          totalLikes,
          totalWords,
          cycle,
          latestPublishedAt: latestChap?.publishedAt || book.updatedAt || book.createdAt
        };
      });
  }, [books]);

  // 상단 실시간 Best TOP 5 집계 (조회수 + 관심수 가중치)
  const topRankedBooks = useMemo(() => {
    return [...serialBooks]
      .sort((a, b) => (b.totalViews + b.totalLikes * 20) - (a.totalViews + a.totalLikes * 20))
      .slice(0, 5);
  }, [serialBooks]);

  // 메인 필터링 및 정렬
  const filteredBooks = useMemo(() => {
    return serialBooks.filter(book => {
      // 1. 장르 필터
      if (selectedGenre !== 'all') {
        const targetGenreObj = KYOBO_GENRES.find(g => g.id === selectedGenre);
        if (targetGenreObj && targetGenreObj.keywords) {
          const bGenre = (book.genre || '').toLowerCase();
          const match = targetGenreObj.keywords.some(kw => bGenre.includes(kw.toLowerCase()));
          if (!match) return false;
        }
      }

      // 2. 연재 주기(요일/자유) 필터
      if (selectedCycle !== 'all') {
        if (book.cycle !== selectedCycle) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'views') return b.totalViews - a.totalViews;
      if (sortBy === 'likes') return b.totalLikes - a.totalLikes;
      return new Date(b.latestPublishedAt || 0) - new Date(a.latestPublishedAt || 0);
    });
  }, [serialBooks, selectedGenre, selectedCycle, sortBy]);

  // 요일 라벨 헬퍼
  const getCycleBadgeText = (cycleId) => {
    const item = SERIAL_CYCLES.find(c => c.id === cycleId);
    if (!item) return '자유연재';
    return item.id === 'free' ? '자유연재' : `${item.label}요 연재`;
  };

  return (
    <div className="explore-serial-container">
      {/* 1. 좌측 작품 장르 사이드바 */}
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

      {/* 2. 우측 메인 콘텐츠 영역 */}
      <main className="explore-serial-main">
        {/* 상단 큐레이션: 🔥 실시간 Best TOP 5 가로 보드 */}
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
                      <span>👁️ {book.totalViews.toLocaleString()}</span>
                      <span>❤️ {book.totalLikes}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 연재 주기(월~일 & 자유연재) 탭 바 */}
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

          {/* 우측 정렬 드롭다운 */}
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

        {/* 문피아 스타일 메인 작품 리스트 */}
        <section className="serial-books-list-section">
          <div className="list-section-summary">
            <span>총 <strong>{filteredBooks.length}</strong>개의 연재 작품</span>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="serial-empty-card">
              <BookOpen size={42} className="empty-book-icon" />
              <h3>해당 조건의 연재 작품이 없습니다</h3>
              <p>스튜디오에서 새로운 챕터를 집필하고 '연재 발행 🚀'을 눌러보세요!</p>
              <button className="btn-go-studio" onClick={() => setView('studio')}>
                집필 스튜디오로 가기 <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="serial-card-list">
              {filteredBooks.map(book => {
                const firstChapId = book.publishedChapters?.[0]?.id || book.chapters?.[0]?.id;
                const latestChapId = book.latestChap?.id || firstChapId;

                return (
                  <article key={book.id} className="serial-book-card">
                    {/* 좌측 썸네일 표지 */}
                    <div 
                      className="serial-cover-thumb"
                      onClick={() => openReader(book.id, firstChapId)}
                      title="첫 회부터 읽기"
                    >
                      <div className="cover-inner-text">
                        <span className="cover-genre-tag">{book.genre || '연재'}</span>
                        <h4 className="cover-title-display">{book.title}</h4>
                      </div>
                    </div>

                    {/* 중앙 상세 정보 */}
                    <div className="serial-card-body">
                      <div className="serial-card-tags">
                        <span className="badge-cycle-tag">{getCycleBadgeText(book.cycle)}</span>
                        <span className="badge-genre-tag">{book.genre || '일반연재'}</span>
                        {book.hasPublished && <span className="badge-up-tag">UP 🚀</span>}
                      </div>

                      <h3 
                        className="serial-card-title" 
                        onClick={() => openReader(book.id, latestChapId)}
                        title="최신화 열람"
                      >
                        {book.title}
                      </h3>

                      <div className="serial-meta-line">
                        <span className="author-name">글 {book.author || '연재 작가'}</span>
                        <span className="meta-sep">·</span>
                        <span className="chap-count">총 {book.totalChaptersCount}화 ({book.publishedChaptersCount}화 발행)</span>
                        <span className="meta-sep">·</span>
                        <span className="views-count">👁️ {book.totalViews.toLocaleString()}</span>
                        <span className="meta-sep">·</span>
                        <span className="likes-count">❤️ {book.totalLikes}</span>
                        <span className="meta-sep">·</span>
                        <span className="words-count">✍️ {book.totalWords.toLocaleString()}자</span>
                      </div>

                      <p className="serial-logline">
                        {book.subtitle || (book.latestChap ? `최신화: ${book.latestChap.title}` : '작가님의 흥미진진한 연재가 시작되었습니다. 첫 회를 지금 만나보세요!')}
                      </p>
                    </div>

                    {/* 우측 뷰어 퀵 이동 버튼들 */}
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
