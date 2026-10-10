import React, { useEffect, useState } from 'react';
import './Stats.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { calcAuthorStats, calcReaderStats } from '../utils/authorStats';
import { 
  Award, Flame, BookOpen, Clock, PenTool, CheckCircle, 
  ArrowRight, Sparkles, Bookmark, Play, Compass 
} from 'lucide-react';

export default function Stats() {
  const { books, setView, openBook, openReader } = useStore();
  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });
  const [readingHistory, setReadingHistory] = useState([]);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('stats_active_tab') || 'writing'); // 'writing' | 'reading'

  useEffect(() => {
    bookService.getStats().then(setBaseStats).catch(console.error);
    try {
      const raw = localStorage.getItem('reader_history') || '[]';
      const parsed = JSON.parse(raw);
      setReadingHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadingHistory([]);
    }
  }, [books]);

  const writingStats = calcAuthorStats(books, baseStats);
  const readerStats = calcReaderStats(readingHistory);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('stats_active_tab', tab);
  };

  const handleOpenBookStudio = (bookId) => {
    openBook(bookId);
    setView('studio');
  };

  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  const todayDayIndex = (new Date().getDay() + 6) % 7; // 월=0, 일=6

  return (
    <div className="stats-page">
      {/* 헤더 */}
      <header className="stats-header">
        <div>
          <div className="header-title-row">
            <h1>통합 통계</h1>
          </div>
          <p>창작과 독서의 모든 여정을 한눈에 조망하는 나만의 종합 서재 리포트입니다.</p>
        </div>
      </header>

      {/* 분류 탭: 집필 통계 vs 독서 통계 */}
      <div className="stats-tabs-bar">
        <button
          type="button"
          className={`stats-tab-item ${activeTab === 'writing' ? 'active' : ''}`}
          onClick={() => handleTabChange('writing')}
        >
          <div className="stats-tab-content">
            <span className="stats-tab-icon">✍️</span>
            <span className="stats-tab-label">집필 통계</span>
            <span className="stats-tab-count-badge">{books.length}권</span>
          </div>
        </button>

        <button
          type="button"
          className={`stats-tab-item ${activeTab === 'reading' ? 'active' : ''}`}
          onClick={() => handleTabChange('reading')}
        >
          <div className="stats-tab-content">
            <span className="stats-tab-icon">📖</span>
            <span className="stats-tab-label">독서 통계</span>
            <span className="stats-tab-count-badge">{readingHistory.length}작품</span>
          </div>
        </button>
      </div>

      <div className="stats-body">
        {/* =================================================================
            1. ✍️ 집필 통계 탭 본문
            ================================================================= */}
        {activeTab === 'writing' && (
          <>
            {/* 1-1. 작가 프로필 & 레벨 배너 */}
            <section className="level-hero-card">
              <div className="hero-top">
                <div className="author-badge-group">
                  <div className="author-tier-icon">{writingStats.tier.emoji}</div>
                  <div>
                    <div className="author-tier-meta">
                      <span className="author-tier-badge" style={{ borderColor: writingStats.tier.color, color: writingStats.tier.color }}>
                        {writingStats.tier.name} 티어
                      </span>
                      <span className="author-level-num">Lv.{writingStats.level}</span>
                    </div>
                    <h2 className="author-title-text">{writingStats.title}</h2>
                  </div>
                </div>
                <div className="xp-summary-box">
                  <span className="xp-summary-label">누적 집필 경험치 (Ink XP)</span>
                  <span className="xp-summary-value">{writingStats.inkXP.toLocaleString()} XP</span>
                </div>
              </div>

              {/* XP 프로그레스 바 */}
              <div className="hero-progress-section">
                <div className="progress-labels">
                  <span>다음 레벨 (Lv.{writingStats.level + 1})까지</span>
                  <span className="xp-remaining-text">
                    {writingStats.nextXP > 0 ? `${writingStats.nextXP.toLocaleString()} XP 남음` : '최고 레벨 도달'}
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.round(writingStats.progress * 100)}%`,
                      background: `linear-gradient(90deg, #18191f, ${writingStats.tier.color})`
                    }}
                  />
                </div>
                <div className="progress-sub-text">
                  <span>글자 작성(+10XP), 챕터 탈고(+50XP), 마감 준수(+100XP)로 작가 레벨을 올려보세요!</span>
                  <span className="progress-pct">{Math.round(writingStats.progress * 100)}%</span>
                </div>
              </div>
            </section>

            {/* 1-2. 핵심 4대 집필 대시보드 카드 */}
            <section className="stats-grid-4">
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">누적 집필량</span>
                  <PenTool size={18} className="stat-icon icon-pen" />
                </div>
                <div className="stat-card-value">{writingStats.totalWords.toLocaleString()} <span className="stat-unit">자</span></div>
                <div className="stat-card-sub">200자 원고지 약 {writingStats.manuscriptPages.toLocaleString()}매 분량</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">연속 집필 스트릭</span>
                  <Flame size={18} className="stat-icon icon-flame" />
                </div>
                <div className="stat-card-value">{writingStats.streak} <span className="stat-unit">일 연속 🔥</span></div>
                <div className="stat-card-sub">이번 주 작성: 약 {writingStats.weeklyWords.toLocaleString()}자</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">서재 전체 완주율</span>
                  <BookOpen size={18} className="stat-icon icon-book" />
                </div>
                <div className="stat-card-value">{writingStats.overallRate} <span className="stat-unit">%</span></div>
                <div className="stat-card-sub">총 {writingStats.totalBooks}권 중 {writingStats.completedChapters}/{writingStats.totalChapters} 챕터 탈고</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">마감 일정 현황</span>
                  <Clock size={18} className="stat-icon icon-clock" />
                </div>
                <div className="stat-card-value">
                  {writingStats.urgentDeadline ? (
                    <span className={writingStats.urgentDeadline.daysLeft <= 0 ? 'text-urgent' : ''}>
                      {writingStats.urgentDeadline.daysLeft === 0 ? 'D-Day 🔥' : writingStats.urgentDeadline.daysLeft > 0 ? `D-${writingStats.urgentDeadline.daysLeft}` : `D+${Math.abs(writingStats.urgentDeadline.daysLeft)}`}
                    </span>
                  ) : (
                    <span className="text-normal">여유로움</span>
                  )}
                </div>
                <div className="stat-card-sub">
                  {writingStats.urgentDeadline ? writingStats.urgentDeadline.bookTitle : '설정된 마감일 없음'}
                </div>
              </div>
            </section>

            {/* 1-3. 이번 주 집필 루틴 */}
            <section className="weekly-streak-section">
              <div className="section-header-row">
                <h3><Sparkles size={16} /> 이번 주 집필 루틴</h3>
                <span className="routine-sub-info">매일 300자 이상 집필 시 연속 스트릭이 유지됩니다</span>
              </div>
              <div className="days-row">
                {daysOfWeek.map((day, idx) => {
                  const isPassedOrToday = idx <= todayDayIndex;
                  const isToday = idx === todayDayIndex;
                  return (
                    <div key={day} className={`day-pill ${isPassedOrToday ? 'completed' : ''} ${isToday ? 'today' : ''}`}>
                      <span className="day-name">{day}</span>
                      <span className="day-stamp">{isPassedOrToday ? '✍️' : '⚪'}</span>
                      <span className="day-status-txt">{isToday ? '오늘' : isPassedOrToday ? '완료' : '예정'}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 1-4. 분야별 집필 전문성 */}
            <section className="expertise-section">
              <div className="section-header-row">
                <h3><Award size={17} /> 분야별 집필 전문성</h3>
                <span className="expertise-help-txt">장르별 원고 집필량이 쌓일수록 전문 작가 칭호를 획득합니다</span>
              </div>

              <div className="expertise-grid">
                {writingStats.genreStats.map((item) => (
                  <div key={item.genre} className="genre-rank-card">
                    <div className="genre-card-top">
                      <div className="genre-emoji-box" style={{ background: `${item.color}15` }}>
                        <span className="genre-emoji">{item.emoji}</span>
                      </div>
                      <div className="genre-info">
                        <span className="genre-name">{item.genre}</span>
                        <h4 className="genre-rank-title" style={{ color: item.color }}>
                          {item.title}
                        </h4>
                      </div>
                      <div className="genre-word-count">
                        <span className="word-num">{item.wordCount.toLocaleString()}</span>
                        <span className="word-unit">자</span>
                      </div>
                    </div>

                    <div className="genre-rank-gauge">
                      <div
                        className="genre-gauge-fill"
                        style={{
                          width: `${Math.min(Math.round((item.wordCount / 20000) * 100), 100)}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <div className="genre-next-hint">
                      {item.wordCount >= 20000
                        ? '최고 랭크 달성'
                        : `다음 등급까지 ${Math.max(0, (item.rankLevel === 1 ? 3000 : item.rankLevel === 2 ? 10000 : 20000) - item.wordCount).toLocaleString()}자 남음`}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 1-5. 최근 집필 활동 기록 */}
            <section className="activity-timeline-section">
              <div className="section-header-row">
                <h3><Clock size={16} /> 최근 집필 활동 기록</h3>
                <span className="activity-count-badge">최근 {writingStats.recentActivities.length}개 내역</span>
              </div>

              {writingStats.recentActivities.length === 0 ? (
                <div className="empty-activities-box">
                  <p>아직 집필 활동 기록이 없습니다. 스튜디오에서 첫 문장을 작성해보세요!</p>
                </div>
              ) : (
                <div className="timeline-list">
                  {writingStats.recentActivities.map((act) => (
                    <div key={act.id} className="timeline-item">
                      <div className="timeline-icon-wrap">{act.icon}</div>
                      <div className="timeline-content">
                        <div className="timeline-text">{act.text}</div>
                        <div className="timeline-date">
                          {act.date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 1-6. 도서별 진행률 */}
            <section className="books-progress-section">
              <div className="section-header-row">
                <h3>📚 서재 도서별 집필 현황 ({writingStats.bookProgressList.length}권)</h3>
              </div>

              {writingStats.bookProgressList.length === 0 ? (
                <div className="empty-books-box">
                  <p>서재에 등록된 도서가 없습니다. 새 책을 시작해보세요!</p>
                  <button className="btn btn-primary" onClick={() => setView('library')}>
                    내 서재로 이동
                  </button>
                </div>
              ) : (
                <div className="book-progress-list">
                  {writingStats.bookProgressList.map((item) => (
                    <div key={item.id} className="book-progress-card">
                      <div className="book-info-col">
                        <div className="book-title-meta">
                          <span className="book-genre-tag">{item.genre}</span>
                          <h4 className="book-title-heading">{item.title}</h4>
                        </div>
                        <div className="book-stat-detail">
                          <span>{item.wordCount.toLocaleString()}자</span>
                          <span className="bullet">•</span>
                          <span>{item.completedChapters} / {item.totalChapters} 챕터 탈고</span>
                        </div>
                      </div>

                      <div className="book-gauge-col">
                        <div className="gauge-text-row">
                          <span>진행률</span>
                          <span className="gauge-pct">{item.progressRate}%</span>
                        </div>
                        <div className="gauge-track">
                          <div className="gauge-fill" style={{ width: `${item.progressRate}%` }} />
                        </div>
                      </div>

                      <div className="book-action-col">
                        <button
                          className="btn-studio-shortcut"
                          onClick={() => handleOpenBookStudio(item.id)}
                          title="집필 스튜디오에서 바로 열기"
                        >
                          <span>집필하기</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 1-7. 작가 업적 배지 */}
            <section className="trophies-section">
              <div className="section-header-row">
                <h3><Award size={18} /> 작가 업적 및 트로피</h3>
                <span className="trophy-count-badge">
                  {writingStats.trophies.filter(t => t.unlocked).length} / {writingStats.trophies.length} 달성
                </span>
              </div>
              <div className="trophies-grid">
                {writingStats.trophies.map((trophy) => (
                  <div key={trophy.id} className={`trophy-card ${trophy.unlocked ? 'unlocked' : 'locked'}`}>
                    <div className="trophy-icon">{trophy.icon}</div>
                    <div className="trophy-content">
                      <div className="trophy-title">
                        {trophy.title}
                        {trophy.unlocked && <CheckCircle size={13} className="trophy-check" />}
                      </div>
                      <div className="trophy-desc">{trophy.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* =================================================================
            2. 📖 독서 통계 탭 본문
            ================================================================= */}
        {activeTab === 'reading' && (
          <>
            {/* 2-1. 독서가 프로필 & 레벨 배너 */}
            <section className="level-hero-card reader-hero-card">
              <div className="hero-top">
                <div className="author-badge-group">
                  <div className="author-tier-icon reader-tier-icon">{readerStats.emoji}</div>
                  <div>
                    <div className="author-tier-meta">
                      <span className="author-tier-badge" style={{ borderColor: readerStats.tierColor, color: readerStats.tierColor }}>
                        독서 루틴 등급
                      </span>
                      <span className="author-level-num">Lv.{readerStats.level}</span>
                    </div>
                    <h2 className="author-title-text">{readerStats.levelLabel}</h2>
                  </div>
                </div>
                <div className="xp-summary-box">
                  <span className="xp-summary-label">누적 감상 작품</span>
                  <span className="xp-summary-value">{readerStats.totalReadCount} 권 / 작품</span>
                </div>
              </div>

              {/* 독서 등급 프로그레스 바 */}
              <div className="hero-progress-section">
                <div className="progress-labels">
                  <span>다음 등급까지</span>
                  <span className="xp-remaining-text">
                    {readerStats.nextCount > 0 ? `${readerStats.nextCount}권 추가 감상 시 승급` : '최고 등급 달성'}
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.round(readerStats.progress * 100)}%`,
                      background: `linear-gradient(90deg, #10b981, ${readerStats.tierColor})`
                    }}
                  />
                </div>
                <div className="progress-sub-text">
                  <span>새로운 작품을 감상하고 완독할수록 나의 독서가 등급이 상승합니다.</span>
                  <span className="progress-pct">{Math.round(readerStats.progress * 100)}%</span>
                </div>
              </div>
            </section>

            {/* 2-2. 핵심 4대 독서 대시보드 카드 */}
            <section className="stats-grid-4">
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">누적 감상 도서</span>
                  <Bookmark size={18} className="stat-icon icon-book" style={{ color: '#10b981' }} />
                </div>
                <div className="stat-card-value">{readerStats.totalReadCount} <span className="stat-unit">권</span></div>
                <div className="stat-card-sub">서재에 등록된 총 감상 작품 수</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">연속 독서 스트릭</span>
                  <Flame size={18} className="stat-icon icon-flame" />
                </div>
                <div className="stat-card-value">{readerStats.streak} <span className="stat-unit">일 연속 🔥</span></div>
                <div className="stat-card-sub">매일 이어지는 지적 탐색의 시간</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">정독 및 완독</span>
                  <CheckCircle size={18} className="stat-icon icon-pen" style={{ color: '#3b82f6' }} />
                </div>
                <div className="stat-card-value">{readerStats.completedCount} <span className="stat-unit">권 완독</span></div>
                <div className="stat-card-sub">현재 정독 중: {readerStats.inProgressCount}권</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">최근 독서 작품</span>
                  <Clock size={18} className="stat-icon icon-clock" />
                </div>
                <div className="stat-card-value" style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {readingHistory[0]?.bookTitle || '기록 없음'}
                </div>
                <div className="stat-card-sub">
                  {readingHistory[0]?.chapterTitle ? `최근 화: ${readingHistory[0].chapterTitle}` : '연재 작품을 감상해보세요'}
                </div>
              </div>
            </section>

            {/* 2-3. 이번 주 독서 루틴 */}
            <section className="weekly-streak-section">
              <div className="section-header-row">
                <h3><Sparkles size={16} /> 이번 주 독서 루틴</h3>
                <span className="routine-sub-info">매일 책을 열람하면 독서 루틴 스탬프가 채워집니다</span>
              </div>
              <div className="days-row">
                {daysOfWeek.map((day, idx) => {
                  const isPassedOrToday = idx <= todayDayIndex;
                  const isToday = idx === todayDayIndex;
                  return (
                    <div key={day} className={`day-pill ${isPassedOrToday ? 'completed' : ''} ${isToday ? 'today' : ''}`}>
                      <span className="day-name">{day}</span>
                      <span className="day-stamp">{isPassedOrToday ? '📖' : '⚪'}</span>
                      <span className="day-status-txt">{isToday ? '오늘' : isPassedOrToday ? '완료' : '예정'}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2-4. 독서 취향 & 장르 분석 */}
            <section className="expertise-section">
              <div className="section-header-row">
                <h3><Compass size={17} /> 나의 독서 취향 (장르별 분석)</h3>
                <span className="expertise-help-txt">다양한 장르를 골고루 감상하여 독서의 지평을 넓혀보세요</span>
              </div>

              {readerStats.genreStats.length === 0 ? (
                <div className="empty-activities-box">
                  <p>아직 감상한 도서가 없습니다. 연재 서가에서 관심 있는 장르를 선택해보세요!</p>
                </div>
              ) : (
                <div className="expertise-grid">
                  {readerStats.genreStats.map((item) => (
                    <div key={item.genre} className="genre-rank-card">
                      <div className="genre-card-top">
                        <div className="genre-emoji-box" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                          <span className="genre-emoji">📚</span>
                        </div>
                        <div className="genre-info">
                          <span className="genre-name">{item.genre}</span>
                          <h4 className="genre-rank-title" style={{ color: '#10b981' }}>
                            {item.pct}% 비중
                          </h4>
                        </div>
                        <div className="genre-word-count">
                          <span className="word-num">{item.count}</span>
                          <span className="word-unit">권</span>
                        </div>
                      </div>

                      <div className="genre-rank-gauge">
                        <div
                          className="genre-gauge-fill"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: '#10b981'
                          }}
                        />
                      </div>
                      <div className="genre-next-hint">
                        전체 독서 중 {item.pct}% 차지 ({item.count}권 감상)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2-5. 최근 독서 활동 타임라인 */}
            <section className="activity-timeline-section">
              <div className="section-header-row">
                <h3><Clock size={16} /> 최근 독서 활동 기록</h3>
                <span className="activity-count-badge">최근 {readerStats.recentActivities.length}개 내역</span>
              </div>

              {readerStats.recentActivities.length === 0 ? (
                <div className="empty-activities-box">
                  <p>아직 독서 활동 기록이 없습니다. 연재 작품 둘러보기에서 마음에 드는 글을 읽어보세요!</p>
                </div>
              ) : (
                <div className="timeline-list">
                  {readerStats.recentActivities.map((act) => (
                    <div key={act.id} className="timeline-item">
                      <div className="timeline-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        {act.icon}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-text">{act.text}</div>
                        <div className="timeline-date">
                          {act.date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2-6. 감상 중인 도서 목록 일람 */}
            <section className="books-progress-section">
              <div className="section-header-row">
                <h3>📖 보관 서재 감상 목록 ({readingHistory.length}권)</h3>
              </div>

              {readingHistory.length === 0 ? (
                <div className="empty-books-box">
                  <p>아직 읽고 있는 도서가 없습니다. 독자 공간에서 새로운 작품을 만나보세요!</p>
                  <button className="btn btn-primary" onClick={() => setView('serial-explore')}>
                    연재 작품 둘러보기
                  </button>
                </div>
              ) : (
                <div className="book-progress-list">
                  {readingHistory.map((item) => (
                    <div key={item.bookId} className="book-progress-card">
                      <div className="book-info-col">
                        <div className="book-title-meta">
                          <span className="book-genre-tag" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            {item.genre || '소설'}
                          </span>
                          <h4 className="book-title-heading">{item.bookTitle}</h4>
                        </div>
                        <div className="book-stat-detail">
                          <span>글 {item.author || '작가'}</span>
                          <span className="bullet">•</span>
                          <span>최근 화: {item.chapterTitle || '1화'}</span>
                          {item.readAt && (
                            <>
                              <span className="bullet">•</span>
                              <span>{new Date(item.readAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="book-action-col">
                        <button
                          className="btn-studio-shortcut"
                          style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                          onClick={() => openReader(item.bookId, item.chapterId)}
                          title="뷰어로 바로 열람"
                        >
                          <Play size={13} fill="currentColor" />
                          <span>이어서 읽기</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2-7. 독서 업적 및 트로피 */}
            <section className="trophies-section">
              <div className="section-header-row">
                <h3><Award size={18} /> 독서 업적 및 트로피</h3>
                <span className="trophy-count-badge">
                  {readerStats.trophies.filter(t => t.unlocked).length} / {readerStats.trophies.length} 달성
                </span>
              </div>
              <div className="trophies-grid">
                {readerStats.trophies.map((trophy) => (
                  <div key={trophy.id} className={`trophy-card ${trophy.unlocked ? 'unlocked' : 'locked'}`}>
                    <div className="trophy-icon">{trophy.icon}</div>
                    <div className="trophy-content">
                      <div className="trophy-title">
                        {trophy.title}
                        {trophy.unlocked && <CheckCircle size={13} className="trophy-check" />}
                      </div>
                      <div className="trophy-desc">{trophy.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
