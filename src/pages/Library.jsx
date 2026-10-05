import React, { useEffect, useState } from 'react';
import './Library.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { calcAuthorStats, getDailyQuote } from '../utils/authorStats';
import { Plus, Trash2, X, Sparkles, Calendar, ArrowRight } from 'lucide-react';

export default function Library() {
  const {
    books, loadBooks, openBook, deleteBook, isBooksLoading, showToast,
    isNewBookModalOpen, setNewBookModalOpen, setView
  } = useStore();

  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });

  // 모달 폼 상태
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [genre, setGenre] = useState('자기계발');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadBooks();
    bookService.getStats().then(setBaseStats).catch(console.error);
  }, [loadBooks]);

  const authorStats = calcAuthorStats(books, baseStats);
  const quote = getDailyQuote();

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
      const newBook = await bookService.createBook({
        title: title.trim(),
        subtitle: subtitle.trim(),
        targetAudience: targetAudience.trim(),
        genre
      });
      await loadBooks();
      showToast('새 도서 프로젝트가 생성되었습니다!', 'success');
      setNewBookModalOpen(false);
      setTitle('');
      setSubtitle('');
      setTargetAudience('');
      // 생성 후 바로 스튜디오 오픈
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
          <p>작업 중인 전자책 프로젝트를 관리하고 새로운 책을 기획하세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewBookModalOpen(true)}>
          <Plus size={18} />
          <span>새 책 만들기</span>
        </button>
      </header>

      <div className="library-body">
        {/* 상단 2줄 작가 성장 & 통합 통계 바 */}
        <div className="author-summary-band">
          {/* 1행: 핵심 통합 통계 */}
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
              <span>상세 통계</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* 2행: 오늘의 집필 영감 & 명언 */}
          <div className="band-row band-quote-row">
            <span className="quote-lightbulb">💡</span>
            <span className="quote-text">"{quote.quote}"</span>
            <span className="quote-author">— {quote.author}</span>
          </div>
        </div>

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
          <div className="book-grid">
            {books.map((book) => {
              const progress = calculateProgress(book);
              const deadlineInfo = getBookDeadlineInfo(book);
              return (
                <div key={book.id} className="book-card" onClick={() => openBook(book.id)}>
                  <div className="book-card-cover">
                    <div className="book-cover-top">
                      <span className="book-genre-badge">{book.genre || '전자책'}</span>
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
                    <h3 className="book-cover-title">{book.title}</h3>
                  </div>

                  <div className="book-card-body">
                    <p className="book-subtitle">{book.subtitle || '부제 및 기획 의도가 없습니다.'}</p>

                    <div className="progress-container">
                      <div className="progress-info">
                        <span>진행률</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="book-card-footer">
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        챕터 {book.chapters?.length || 0}개
                      </span>
                      <button
                        className="btn-icon-danger"
                        onClick={(e) => handleDelete(e, book.id, book.title)}
                        title="도서 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 새 책 만들기 모달 */}
      {isNewBookModalOpen && (
        <div className="modal-overlay" onClick={() => setNewBookModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>새 책 만들기</h2>
              <button className="modal-close-btn" onClick={() => setNewBookModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBook}>
              <div className="modal-body">
                <div className="form-group">
                  <label>도서 메인 제목 *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 30일 완성 AI 실전 가이드"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>부제목 / 기획 의도</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 비전공자도 하루 만에 시작하는 실전 인공지능"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>장르 / 카테고리</label>
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
