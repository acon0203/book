import React, { useEffect, useState } from 'react';
import './Stats.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { calcAuthorStats } from '../utils/authorStats';
import { Award, Flame, BookOpen, Clock, PenTool, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function Stats() {
  const { books, setView, openBook } = useStore();
  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });

  useEffect(() => {
    bookService.getStats().then(setBaseStats).catch(console.error);
  }, [books]);

  const stats = calcAuthorStats(books, baseStats);

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
            <h1>집필 통계 & 성장</h1>
            <span className="stats-version-badge">Mission 게이미피케이션</span>
          </div>
          <p>나의 서재 집필 기록과 레벨, 업적을 한눈에 살펴보고 지속적인 동기부여를 얻습니다.</p>
        </div>
      </header>

      <div className="stats-body">
        {/* 1. 작가 프로필 & 레벨 배너 (Mission 스타일) */}
        <section className="level-hero-card">
          <div className="hero-top">
            <div className="author-badge-group">
              <div className="author-tier-icon">{stats.tier.emoji}</div>
              <div>
                <div className="author-tier-meta">
                  <span className="author-tier-badge" style={{ borderColor: stats.tier.color, color: stats.tier.color }}>
                    {stats.tier.name} 티어
                  </span>
                  <span className="author-level-num">Lv.{stats.level}</span>
                </div>
                <h2 className="author-title-text">{stats.title}</h2>
              </div>
            </div>
            <div className="xp-summary-box">
              <span className="xp-summary-label">누적 집필 경험치 (Ink XP)</span>
              <span className="xp-summary-value">{stats.inkXP.toLocaleString()} XP</span>
            </div>
          </div>

          {/* XP 프로그레스 바 */}
          <div className="hero-progress-section">
            <div className="progress-labels">
              <span>다음 레벨 (Lv.{stats.level + 1})까지</span>
              <span className="xp-remaining-text">
                {stats.nextXP > 0 ? `${stats.nextXP.toLocaleString()} XP 남음` : '최고 레벨 도달'}
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.round(stats.progress * 100)}%`,
                  background: `linear-gradient(90deg, #18191f, ${stats.tier.color})`
                }}
              />
            </div>
            <div className="progress-sub-text">
              <span>글자 작성(+10XP), 챕터 탈고(+50XP), 마감 준수(+100XP)로 작가 레벨을 올려보세요!</span>
              <span className="progress-pct">{Math.round(stats.progress * 100)}%</span>
            </div>
          </div>
        </section>

        {/* 2. 핵심 4대 대시보드 카드 */}
        <section className="stats-grid-4">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">누적 집필량</span>
              <PenTool size={18} className="stat-icon icon-pen" />
            </div>
            <div className="stat-card-value">{stats.totalWords.toLocaleString()} <span className="stat-unit">자</span></div>
            <div className="stat-card-sub">200자 원고지 약 {stats.manuscriptPages.toLocaleString()}매 분량</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">연속 집필 스트릭</span>
              <Flame size={18} className="stat-icon icon-flame" />
            </div>
            <div className="stat-card-value">{stats.streak} <span className="stat-unit">일 연속 🔥</span></div>
            <div className="stat-card-sub">이번 주 작성: 약 {stats.weeklyWords.toLocaleString()}자</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">서재 전체 완주율</span>
              <BookOpen size={18} className="stat-icon icon-book" />
            </div>
            <div className="stat-card-value">{stats.overallRate} <span className="stat-unit">%</span></div>
            <div className="stat-card-sub">총 {stats.totalBooks}권 중 {stats.completedChapters}/{stats.totalChapters} 챕터 탈고</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">마감 일정 현황</span>
              <Clock size={18} className="stat-icon icon-clock" />
            </div>
            <div className="stat-card-value">
              {stats.urgentDeadline ? (
                <span className={stats.urgentDeadline.daysLeft <= 0 ? 'text-urgent' : ''}>
                  {stats.urgentDeadline.daysLeft === 0 ? 'D-Day 🔥' : stats.urgentDeadline.daysLeft > 0 ? `D-${stats.urgentDeadline.daysLeft}` : `D+${Math.abs(stats.urgentDeadline.daysLeft)}`}
                </span>
              ) : (
                <span className="text-normal">여유로움</span>
              )}
            </div>
            <div className="stat-card-sub">
              {stats.urgentDeadline ? stats.urgentDeadline.bookTitle : '설정된 마감일 없음'}
            </div>
          </div>
        </section>

        {/* 3. 주간 집필 스트릭 (Mission 스타일) */}
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

        {/* 4. 분야별 전문성 (Mission 카테고리 전문성 차용) */}
        <section className="expertise-section">
          <div className="section-header-row">
            <h3><Award size={17} /> 분야별 집필 전문성</h3>
            <span className="expertise-help-txt">장르별 원고 집필량이 쌓일수록 전문 작가 칭호를 획득합니다</span>
          </div>

          <div className="expertise-grid">
            {stats.genreStats.map((item) => (
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

        {/* 5. 활동 기록 타임라인 (Mission 활동 기록 차용) */}
        <section className="activity-timeline-section">
          <div className="section-header-row">
            <h3><Clock size={16} /> 최근 집필 활동 기록</h3>
            <span className="activity-count-badge">최근 {stats.recentActivities.length}개 내역</span>
          </div>

          {stats.recentActivities.length === 0 ? (
            <div className="empty-activities-box">
              <p>아직 집필 활동 기록이 없습니다. 스튜디오에서 첫 문장을 작성해보세요!</p>
            </div>
          ) : (
            <div className="timeline-list">
              {stats.recentActivities.map((act) => (
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

        {/* 6. 도서별 진행률 (다권 현황 일람) */}
        <section className="books-progress-section">
          <div className="section-header-row">
            <h3>📚 서재 도서별 집필 현황 ({stats.bookProgressList.length}권)</h3>
          </div>

          {stats.bookProgressList.length === 0 ? (
            <div className="empty-books-box">
              <p>서재에 등록된 도서가 없습니다. 새 책을 시작해보세요!</p>
              <button className="btn btn-outline" onClick={() => setView('library')}>
                내 서재로 이동
              </button>
            </div>
          ) : (
            <div className="book-progress-list">
              {stats.bookProgressList.map((item) => (
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

        {/* 7. 작가 업적 배지 (Trophies) */}
        <section className="trophies-section">
          <div className="section-header-row">
            <h3><Award size={18} /> 작가 업적 및 트로피</h3>
            <span className="trophy-count-badge">
              {stats.trophies.filter(t => t.unlocked).length} / {stats.trophies.length} 달성
            </span>
          </div>
          <div className="trophies-grid">
            {stats.trophies.map((trophy) => (
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
      </div>
    </div>
  );
}
