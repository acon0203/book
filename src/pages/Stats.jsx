import React, { useEffect, useState } from 'react';
import './Stats.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { storageService } from '../services/storageService';
import { achievementService } from '../services/achievementService';
import { calcAuthorStats, calcReaderStats } from '../utils/authorStats';
import { 
  Award, Flame, BookOpen, Clock, PenTool, CheckCircle, 
  ArrowRight, Sparkles, Bookmark, Play, Compass,
  Target, TrendingUp, Feather, Code, Trophy, Layers,
  Lock, Star, X, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Stats() {
  const { books, setView, openBook, openReader, user } = useStore();
  const [baseStats, setBaseStats] = useState({ totalWordsGenerated: 0, totalChaptersCompleted: 0, aiGenerationsCount: 0 });
  const [readingHistory, setReadingHistory] = useState([]);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('stats_active_tab') || 'writing'); // 'writing' | 'reading'
  const [selectedModalChain, setSelectedModalChain] = useState(null); // 모달로 열람할 체인 객체
  const [achievementsVersion, setAchievementsVersion] = useState(0);

  // 캘린더 모달 상태
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  useEffect(() => {
    bookService.getStats().then(setBaseStats).catch(console.error);
    try {
      const parsed = storageService.getReadingHistory();
      setReadingHistory(parsed);
      // storageService.getReadingHistory() 일원화 완료
    } catch {
      setReadingHistory([]);
    }
  }, [books]);

  // Firestore 영구 업적 데이터 1회 로드 (오프라인 캐시 자동 지원)
  useEffect(() => {
    if (user?.uid) {
      achievementService.loadUserAchievements(user.uid)
        .then(() => setAchievementsVersion(v => v + 1))
        .catch(console.error);
    }
  }, [user?.uid]);

  const writingStats = calcAuthorStats(books, baseStats, user?.uid);
  const readerStats = calcReaderStats(readingHistory, books);

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

  // 캘린더 네비게이션 핸들러
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear(y => y - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarYear(y => y + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setSelectedCalendarDate(`${y}-${m}-${d}`);
  };

  // 캘린더 일자 그리드 생성 (일~토 7열)
  const calendarDays = (() => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0(일) ~ 6(토)
    const daysCount = new Date(calendarYear, calendarMonth + 1, 0).getDate(); // 당월 말일
    const prevMonthDaysCount = new Date(calendarYear, calendarMonth, 0).getDate();

    const cells = [];
    // 이전 달 잔여 일자
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDaysCount - i;
      const prevM = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const prevY = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      cells.push({
        dayNumber: dNum,
        dateStr,
        isCurrentMonth: false,
        isPastMonth: true
      });
    }

    // 당월 일자
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // 다음 달 앞부분 일자 (그리드 완성 35 or 42칸 맞춤)
    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const nextY = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isNextMonth: true
      });
    }

    return cells;
  })();

  const currentStats = activeTab === 'writing' ? writingStats : readerStats;
  const activeDatesSet = new Set(currentStats.allActiveDates || []);
  const selectedDateActivities = (currentStats.allActivities || []).filter(act => act.dateStr === selectedCalendarDate);
  const isSelectedDateActive = activeDatesSet.has(selectedCalendarDate);

  // 금주 날짜 집합 및 금주 활동 필터링
  const weeklyDatesSet = new Set((currentStats.weeklyRoutine?.days || []).map(d => d.date));
  const thisWeekActivities = (currentStats.allActivities || []).filter(act => weeklyDatesSet.has(act.dateStr));

  // 당월 활동 일수 계산
  const currentMonthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
  const currentMonthActiveCount = Array.from(activeDatesSet).filter(d => typeof d === 'string' && d.startsWith(currentMonthPrefix)).length;

  const formatSelectedDateHeader = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch {
      return dateStr;
    }
  };

  // 장르별 단정 Lucide 픽토그램 매핑
  const renderGenreIcon = (genre, color) => {
    const g = genre || '';
    if (g.includes('자기계발')) return <Target size={18} style={{ color }} />;
    if (g.includes('경제') || g.includes('경영')) return <TrendingUp size={18} style={{ color }} />;
    if (g.includes('에세이') || g.includes('인문')) return <Feather size={18} style={{ color }} />;
    if (g.includes('IT') || g.includes('개발')) return <Code size={18} style={{ color }} />;
    if (g.includes('소설') || g.includes('스토리')) return <BookOpen size={18} style={{ color }} />;
    return <PenTool size={18} style={{ color }} />;
  };

  // 최근 활동 유형별 픽토그램 매핑
  const renderActivityIcon = (type) => {
    switch (type) {
      case 'publish': return <CheckCircle size={14} />;
      case 'deadline': return <Clock size={14} />;
      case 'read': return <BookOpen size={14} />;
      case 'edit':
      default: return <PenTool size={14} />;
    }
  };

  // 마일스톤 체인별 픽토그램 매핑 (집필: 불꽃, 완결: 트로피, 분량: 펜, 기획: 레이어, 연재: 스파클, 히든: 나침반)
  const renderChainIcon = (chainId) => {
    switch (chainId) {
      case 'routine':
      case 'chain_routine':
        return <Flame size={18} className="chain-icon-flame" />;
      case 'completion':
      case 'chain_complete':
        return <Trophy size={18} className="chain-icon-trophy" />;
      case 'words':
      case 'chain_words':
        return <PenTool size={18} className="chain-icon-pen" />;
      case 'planning':
      case 'chain_planning':
        return <Layers size={18} className="chain-icon-layers" />;
      case 'publishing':
      case 'chain_serial':
        return <Sparkles size={18} className="chain-icon-sparkles" />;
      case 'collection':
        return <Bookmark size={18} style={{ color: '#10b981' }} />;
      case 'genre':
        return <Compass size={18} style={{ color: '#3498db' }} />;
      case 'sessions':
        return <BookOpen size={18} style={{ color: '#8b5cf6' }} />;
      case 'hidden':
      case 'hidden_collection':
        return <Compass size={18} className="chain-icon-compass" />;
      default:
        return <Award size={18} />;
    }
  };

  // 트로피 픽토그램 매핑
  const renderTrophyIcon = (id) => {
    switch (id) {
      case 'read_first':
      case 'first_step': return <Bookmark size={18} />;
      case 'read_three':
      case 'pages_200': return <BookOpen size={18} />;
      case 'read_multi_genre': return <Compass size={18} />;
      case 'read_streak': return <Flame size={18} />;
      case 'read_five':
      case 'multi_book': return <Sparkles size={18} />;
      case 'read_complete':
      case 'first_chap':
      default: return <Award size={18} />;
    }
  };

  return (
    <div className="stats-page">
      {/* 헤더 */}
      <header className="stats-header">
        <div>
          <div className="header-title-row">
            <h1>통합 통계</h1>
          </div>
          <p>집필 및 독서 활동 기록을 한눈에 확인합니다.</p>
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
            <PenTool size={15} className="stats-tab-icon" />
            <span className="stats-tab-label">집필 통계</span>
            <span className="stats-tab-count-badge">{books.length}작품</span>
          </div>
        </button>

        <button
          type="button"
          className={`stats-tab-item ${activeTab === 'reading' ? 'active' : ''}`}
          onClick={() => handleTabChange('reading')}
        >
          <div className="stats-tab-content">
            <BookOpen size={15} className="stats-tab-icon" />
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
                  <div className="author-tier-icon" style={{ borderColor: writingStats.tier.color }}>
                    <Award size={22} style={{ color: writingStats.tier.color }} />
                  </div>
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
                  <span>원고 집필 및 챕터 탈고 활동에 따라 경험치가 누적됩니다.</span>
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
                  <span className="stat-card-title">연속 집필일</span>
                  <Flame size={18} className="stat-icon icon-flame" />
                </div>
                <div className="stat-card-value">{writingStats.streak} <span className="stat-unit">일 연속</span></div>
                <div className="stat-card-sub">이번 주 작성: 약 {writingStats.weeklyWords.toLocaleString()}자</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">서재 전체 완주율</span>
                  <BookOpen size={18} className="stat-icon icon-book" />
                </div>
                <div className="stat-card-value">{writingStats.overallRate} <span className="stat-unit">%</span></div>
                <div className="stat-card-sub">총 {writingStats.totalBooks}작품 중 {writingStats.completedChapters}/{writingStats.totalChapters} 챕터 탈고</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">집필 프로젝트 규모</span>
                  <Layers size={18} className="stat-icon icon-layers" />
                </div>
                <div className="stat-card-value">{writingStats.totalBooks} <span className="stat-unit">작품</span></div>
                <div className="stat-card-sub">총 {writingStats.totalChapters}개 챕터 구성 중 ({writingStats.completedChapters}개 탈고)</div>
              </div>
            </section>

            {/* 1-3. 이번 주 집필 루틴 (방향 3: 최근 활동 피드 통합 + 전체 캘린더 모달 연동) */}
            <section className="weekly-streak-section">
              <div className="routine-header-row">
                <div className="routine-header-left">
                  <h3><Sparkles size={16} /> 이번 주 집필 루틴</h3>
                  <span className="routine-sub-info">요일별 실제 집필 기록 현황</span>
                </div>
                <button
                  type="button"
                  className="btn-routine-more"
                  onClick={() => {
                    handleGoToday();
                    setShowCalendarModal(true);
                  }}
                  title="집필 루틴 전체 캘린더 열기"
                >
                  <Calendar size={13} />
                  <span>전체 기록</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* 요일별 스트릭 바 */}
              <div className="days-row">
                {(writingStats.weeklyRoutine?.days || []).map((item) => (
                  <div key={item.day} className={`day-pill ${item.status} ${item.isToday ? 'today' : ''}`}>
                    <span className="day-name">{item.day}</span>
                    <span className="day-stamp">
                      {item.status === 'completed' ? <CheckCircle size={13} /> : item.stamp}
                    </span>
                    <span className="day-status-txt">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* 방향 3: 하단 미니멀 금주 집필 활동 인라인 피드 */}
              <div className="routine-recent-feed">
                <div className="feed-header-row">
                  <span className="feed-title">
                    <Clock size={13} /> 금주 집필 활동
                  </span>
                  <span className="feed-count-badge">
                    {thisWeekActivities.length > 0 ? `금주 ${thisWeekActivities.length}건` : '0건'}
                  </span>
                </div>
                {thisWeekActivities.length === 0 ? (
                  <div className="feed-empty-box">이번 주에 기록된 집필 활동이 아직 없습니다.</div>
                ) : (
                  <div className="feed-items-list">
                    {thisWeekActivities.map((act) => (
                      <div key={act.id} className="feed-item-row">
                        <span className="feed-item-icon">{renderActivityIcon(act.type)}</span>
                        <span className="feed-item-text">{act.text}</span>
                        <span className="feed-item-date">
                          {act.date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                      <div className="genre-emoji-box" style={{ background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {renderGenreIcon(item.genre, item.color)}
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
                          width: `${Math.round((item.progressRatio || 0) * 100)}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <div className="genre-next-hint">
                      {item.isMax
                        ? '최고 랭크 달성 (12만 자 돌파)'
                        : `다음 랭크까지 ${(item.remainingWords || 0).toLocaleString()}자 남음`}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 1-5. 작가 업적 (분야별 집필 전문성 바로 아래로 재배치) */}
            <section className="trophies-section">
              <div className="section-header-row">
                <h3><Award size={18} /> 작가 업적</h3>
              </div>

              {/* 6개 슬롯 카드 그리드 */}
              <div className="trophies-grid">
                {/* 5대 핵심 체인 카드 */}
                {(writingStats.achievementChains || []).map((chain) => {
                  const currentTitle = chain.currentStep ? chain.currentStep.title : '';
                  const isStarted = chain.completedStepsCount > 0;
                  // 대표 칭호명 깔끔하게 정돈
                  let mainTitle = chain.subtitle || chain.name;
                  if (mainTitle.includes('&')) mainTitle = mainTitle.split('&')[0].trim();

                  return (
                    <div 
                      key={chain.id} 
                      className={`trophy-card ${isStarted ? 'unlocked' : 'locked'}`}
                      onClick={() => setSelectedModalChain(chain)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="trophy-icon-box">
                        {renderChainIcon(chain.id)}
                      </div>
                      <div className="trophy-content">
                        <div className="trophy-title">
                          <span>{mainTitle}</span>
                          {chain.isAllCompleted && <CheckCircle size={13} className="trophy-check" />}
                          {chain.prestigeCount > 0 && (
                            <span className="trophy-star-badge">★×{chain.prestigeCount}</span>
                          )}
                        </div>
                        <div className="trophy-desc">
                          {chain.isAllCompleted 
                            ? '최종 마일스톤 완주' 
                            : (isStarted ? currentTitle : '도전 전')}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 6번째 히든 업적 카드 */}
                {(() => {
                  const hiddenList = writingStats.hiddenAchievements || [];
                  const unlockedCount = hiddenList.filter(h => h.isUnlocked).length;
                  const isAnyUnlocked = unlockedCount > 0;

                  return (
                    <div 
                      className={`trophy-card ${isAnyUnlocked ? 'unlocked' : 'locked'}`}
                      onClick={() => setSelectedModalChain({ isHidden: true, name: '히든 업적', list: hiddenList })}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="trophy-icon-box hidden-trophy-box">
                        {renderChainIcon('hidden')}
                      </div>
                      <div className="trophy-content">
                        <div className="trophy-title">
                          <span>히든 업적</span>
                          {unlockedCount === hiddenList.length && unlockedCount > 0 && (
                            <CheckCircle size={13} className="trophy-check" />
                          )}
                        </div>
                        <div className="trophy-desc">
                          {unlockedCount > 0 ? `${unlockedCount}개 비밀 업적 해금` : '도전 전'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>





          </>
        )}

        {/* =================================================================
            2. 📖 독서 통계 탭 본문 (집필 통계 표준 준용 고도화)
            ================================================================= */}
        {activeTab === 'reading' && (
          <>
            {/* 2-1. 독서가 프로필 & 레벨 배너 (집필 통계와 1:1 완벽 대칭) */}
            <section className="level-hero-card reader-hero-card">
              <div className="hero-top">
                <div className="author-badge-group">
                  <div className="author-tier-icon reader-tier-icon" style={{ borderColor: readerStats.tier.color }}>
                    <BookOpen size={22} style={{ color: readerStats.tier.color }} />
                  </div>
                  <div>
                    <div className="author-tier-meta">
                      <span className="author-tier-badge" style={{ borderColor: readerStats.tier.color, color: readerStats.tier.color }}>
                        {readerStats.tier.name} 티어
                      </span>
                      <span className="author-level-num">Lv.{readerStats.level}</span>
                    </div>
                    <h2 className="author-title-text">{readerStats.title}</h2>
                  </div>
                </div>
                <div className="xp-summary-box">
                  <span className="xp-summary-label">누적 독서 경험치 (Page XP)</span>
                  <span className="xp-summary-value">{readerStats.pageXP.toLocaleString()} XP</span>
                </div>
              </div>

              {/* Page XP 프로그레스 바 */}
              <div className="hero-progress-section">
                <div className="progress-labels">
                  <span>다음 레벨 (Lv.{readerStats.level + 1})까지</span>
                  <span className="xp-remaining-text">
                    {readerStats.nextXP > 0 ? `${readerStats.nextXP.toLocaleString()} XP 남음` : '최고 레벨 도달'}
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.round(readerStats.progress * 100)}%`,
                      background: `linear-gradient(90deg, #10b981, ${readerStats.tier.color})`
                    }}
                  />
                </div>
                <div className="progress-sub-text">
                  <span>작품 감상 및 완독 활동에 따라 경험치가 누적됩니다.</span>
                  <span className="progress-pct">{Math.round(readerStats.progress * 100)}%</span>
                </div>
              </div>
            </section>

            {/* 2-2. 핵심 4대 독서 대시보드 카드 (집필 통계와 1:1 완벽 대칭) */}
            <section className="stats-grid-4">
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">누적 독서량</span>
                  <BookOpen size={18} className="stat-icon icon-book" style={{ color: '#10b981' }} />
                </div>
                <div className="stat-card-value">{readerStats.totalWords.toLocaleString()} <span className="stat-unit">자</span></div>
                <div className="stat-card-sub">200자 원고지 약 {readerStats.manuscriptPages.toLocaleString()}매 분량</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">연속 독서일</span>
                  <Flame size={18} className="stat-icon icon-flame" />
                </div>
                <div className="stat-card-value">{readerStats.streak} <span className="stat-unit">일 연속</span></div>
                <div className="stat-card-sub">이번 주 감상: 약 {readerStats.weeklyWords.toLocaleString()}자</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">독서 완독률</span>
                  <CheckCircle size={18} className="stat-icon" style={{ color: '#3b82f6' }} />
                </div>
                <div className="stat-card-value">{readerStats.completionRate} <span className="stat-unit">%</span></div>
                <div className="stat-card-sub">총 {readerStats.totalReadCount}작품 중 {readerStats.completedCount}작품 완독 완료</div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">누적 감상 서재</span>
                  <Bookmark size={18} className="stat-icon" style={{ color: '#8b5cf6' }} />
                </div>
                <div className="stat-card-value">{readerStats.totalReadCount} <span className="stat-unit">작품</span></div>
                <div className="stat-card-sub">총 {readerStats.totalSessions}개 챕터 탐독 중 ({readerStats.completedCount}개 완독)</div>
              </div>
            </section>

            {/* 2-3. 이번 주 독서 루틴 (방향 3 적용) */}
            <section className="weekly-streak-section">
              <div className="routine-header-row">
                <div className="routine-header-left">
                  <h3><Sparkles size={16} /> 이번 주 독서 루틴</h3>
                  <span className="routine-sub-info">요일별 실제 독서 감상 현황</span>
                </div>
                <button
                  type="button"
                  className="btn-routine-more"
                  onClick={() => {
                    handleGoToday();
                    setShowCalendarModal(true);
                  }}
                  title="독서 루틴 전체 캘린더 열기"
                >
                  <Calendar size={13} />
                  <span>전체 기록</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* 요일별 스트릭 바 */}
              <div className="days-row">
                {(readerStats.weeklyRoutine?.days || []).map((item) => (
                  <div key={item.day} className={`day-pill ${item.status} ${item.isToday ? 'today' : ''}`}>
                    <span className="day-name">{item.day}</span>
                    <span className="day-stamp">
                      {item.status === 'completed' ? <CheckCircle size={13} /> : item.stamp}
                    </span>
                    <span className="day-status-txt">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* 방향 3: 하단 미니멀 금주 독서 활동 인라인 피드 */}
              <div className="routine-recent-feed">
                <div className="feed-header-row">
                  <span className="feed-title">
                    <Clock size={13} /> 금주 독서 활동
                  </span>
                  <span className="feed-count-badge">
                    {thisWeekActivities.length > 0 ? `금주 ${thisWeekActivities.length}건` : '0건'}
                  </span>
                </div>
                {thisWeekActivities.length === 0 ? (
                  <div className="feed-empty-box">이번 주에 기록된 독서 활동이 아직 없습니다.</div>
                ) : (
                  <div className="feed-items-list">
                    {thisWeekActivities.map((act) => (
                      <div key={act.id} className="feed-item-row">
                        <span className="feed-item-icon">{renderActivityIcon(act.type)}</span>
                        <span className="feed-item-text">{act.text}</span>
                        <span className="feed-item-date">
                          {act.date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 2-4. 독서 취향 & 장르 분석 */}
            <section className="expertise-section">
              <div className="section-header-row">
                <h3><Compass size={17} /> 나의 독서 취향 (장르별 분석)</h3>
                <span className="expertise-help-txt">선호하는 장르와 감상 비중을 분석합니다</span>
              </div>

              {readerStats.genreStats.length === 0 ? (
                <div className="empty-activities-box">
                  <p>아직 감상한 도서가 없습니다.</p>
                </div>
              ) : (
                <div className="expertise-grid">
                  {readerStats.genreStats.map((item) => (
                    <div key={item.genre} className="genre-rank-card">
                      <div className="genre-card-top">
                        <div className="genre-emoji-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                          <BookOpen size={16} />
                        </div>
                        <div className="genre-info">
                          <span className="genre-name">{item.genre}</span>
                          <h4 className="genre-rank-title" style={{ color: '#10b981' }}>
                            {item.pct}% 비중
                          </h4>
                        </div>
                        <div className="genre-word-count">
                          <span className="word-num">{item.count}</span>
                          <span className="word-unit">작품</span>
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
                        전체 독서 중 {item.pct}% 차지 ({item.count}작품 감상)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2-5. 독서 업적 (분야별 분석 바로 아래 배치 & 모달 연동) */}
            <section className="trophies-section">
              <div className="section-header-row">
                <h3><Award size={18} /> 독서 업적</h3>
              </div>

              {/* 6개 슬롯 카드 그리드 */}
              <div className="trophies-grid">
                {(readerStats.achievementChains || []).map((chain) => {
                  const currentTitle = chain.currentStep ? chain.currentStep.title : '';
                  const isStarted = chain.completedStepsCount > 0;
                  let mainTitle = chain.subtitle || chain.name;

                  return (
                    <div 
                      key={chain.id} 
                      className={`trophy-card ${isStarted ? 'unlocked' : 'locked'}`}
                      onClick={() => setSelectedModalChain(chain)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="trophy-icon-box">
                        {renderChainIcon(chain.id)}
                      </div>
                      <div className="trophy-content">
                        <div className="trophy-title">
                          <span>{mainTitle}</span>
                          {chain.isAllCompleted && <CheckCircle size={13} className="trophy-check" />}
                        </div>
                        <div className="trophy-desc">
                          {chain.isAllCompleted 
                            ? '최종 마일스톤 완주' 
                            : (isStarted ? currentTitle : '도전 전')}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 6번째 독서 히든 업적 카드 */}
                {(() => {
                  const hiddenList = readerStats.hiddenAchievements || [];
                  const unlockedCount = hiddenList.filter(h => h.isUnlocked).length;
                  const isAnyUnlocked = unlockedCount > 0;

                  return (
                    <div 
                      className={`trophy-card ${isAnyUnlocked ? 'unlocked' : 'locked'}`}
                      onClick={() => setSelectedModalChain({ isHidden: true, name: '독서 히든 업적', list: hiddenList })}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="trophy-icon-box hidden-trophy-box">
                        {renderChainIcon('hidden')}
                      </div>
                      <div className="trophy-content">
                        <div className="trophy-title">
                          <span>히든 업적</span>
                          {unlockedCount === hiddenList.length && unlockedCount > 0 && (
                            <CheckCircle size={13} className="trophy-check" />
                          )}
                        </div>
                        <div className="trophy-desc">
                          {unlockedCount > 0 ? `${unlockedCount}개 비밀 업적 해금` : '도전 전'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          </>
        )}
      </div>

      {/* =================================================================
          3. 공통 업적 상세 모달 (집필/독서 체인 및 히든 업적 카드 클릭 시 팝업)
          ================================================================= */}
      {selectedModalChain && (
        <div className="modal-overlay" onClick={() => setSelectedModalChain(null)}>
          <div className="achievement-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="achievement-modal-header">
              <div className="modal-header-left">
                <div className="modal-chain-icon">
                  {renderChainIcon(selectedModalChain.isHidden ? 'hidden' : selectedModalChain.id)}
                </div>
                <div>
                  <h3 className="modal-chain-title">
                    {selectedModalChain.isHidden 
                      ? (activeTab === 'writing' ? '히든 업적' : '독서 히든 업적') 
                      : ((selectedModalChain.subtitle || selectedModalChain.name).split('&')[0].trim())}
                  </h3>
                  <span className="modal-chain-sub">
                    {selectedModalChain.isHidden 
                      ? (activeTab === 'writing' ? '특별한 창작 조건을 만족하면 해금되는 비밀 마일스톤' : '특별한 독서 순간에 해금되는 비밀 마일스톤') 
                      : `${selectedModalChain.completedStepsCount || 0}개 마일스톤 달성`}
                  </span>
                </div>
              </div>
              <button 
                className="achievement-modal-close" 
                onClick={() => setSelectedModalChain(null)}
                title="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="achievement-modal-body">
              <div className="achievement-modal-steps">
                {selectedModalChain.isHidden ? (
                  // 히든 업적: 달성된 것은 내용 공개, 미달성된 것은 힌트만
                  selectedModalChain.list.map((h, idx) => (
                    <div key={h.id} className={`modal-step-row ${h.isUnlocked ? 'unlocked' : 'locked'}`}>
                      <div className="step-row-icon">
                        {h.isUnlocked ? (
                          <CheckCircle size={16} className="icon-done" />
                        ) : (
                          <Target size={16} className="icon-current" />
                        )}
                      </div>
                      <div className="step-row-main">
                        <div className="step-row-top">
                          <span className="step-num-badge">비밀 #{idx + 1}</span>
                          <strong className="step-row-title">
                            {h.isUnlocked ? h.title : '미지의 마일스톤'}
                          </strong>
                          {h.unlockedAt ? (
                            <span className="step-date-badge">{h.unlockedAt.slice(0, 10)} 달성</span>
                          ) : (
                            <span className="step-current-badge">도전 중</span>
                          )}
                        </div>
                        <div className="step-row-desc">
                          {h.isUnlocked ? h.description : (h.hint || '특별한 조건을 만족하면 정체가 밝혀집니다.')}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // 5대 체인: 이미 획득한 단계들과 [현재 도전 중 1개]만 딱 노출
                  selectedModalChain.steps
                    .filter((step) => step.isUnlocked || selectedModalChain.nextStep?.id === step.id)
                    .map((step) => {
                      const isCurrent = !step.isUnlocked && selectedModalChain.nextStep?.id === step.id;
                      const rowStatus = step.isUnlocked ? 'unlocked' : 'current';
                      const stepNumber = step.step || step.stepNumber || 1;

                      return (
                        <div key={step.id} className={`modal-step-row ${rowStatus}`}>
                          <div className="step-row-icon">
                            {step.isUnlocked ? (
                              <CheckCircle size={16} className="icon-done" />
                            ) : (
                              <Target size={16} className="icon-current" />
                            )}
                          </div>
                          <div className="step-row-main">
                            <div className="step-row-top">
                              <span className="step-num-badge">Step {stepNumber}</span>
                              <strong className="step-row-title">{step.title}</strong>
                              {step.unlockedAt && (
                                <span className="step-date-badge">{step.unlockedAt.slice(0, 10)} 달성</span>
                              )}
                              {isCurrent && (
                                <span className="step-current-badge">도전 중</span>
                              )}
                            </div>
                            <div className="step-row-desc">{step.desc || step.description}</div>
                          </div>
                          <div className="step-row-target">
                            {step.threshold.toLocaleString()}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="achievement-modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedModalChain(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          4. 공통 캘린더 모달 (집필/독서 탭 지능형 자동 연동)
          ================================================================= */}
      {showCalendarModal && (
        <div className="modal-overlay" onClick={() => setShowCalendarModal(false)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="calendar-modal-header">
              <div className="calendar-modal-title">
                {activeTab === 'writing' ? <Calendar size={18} /> : <BookOpen size={18} />}
                <h3>{activeTab === 'writing' ? '집필 루틴 캘린더' : '독서 루틴 캘린더'}</h3>
              </div>
              {/* 월 이동 컨트롤러 */}
              <div className="calendar-nav-controls">
                <button type="button" className="cal-nav-btn" onClick={handlePrevMonth} title="이전 달">
                  <ChevronLeft size={16} />
                </button>
                <span className="cal-current-label">
                  {calendarYear}년 {calendarMonth + 1}월
                </span>
                <button type="button" className="cal-nav-btn" onClick={handleNextMonth} title="다음 달">
                  <ChevronRight size={16} />
                </button>
                <button type="button" className="cal-today-shortcut" onClick={handleGoToday}>
                  오늘
                </button>
              </div>
              <button 
                type="button" 
                className="achievement-modal-close" 
                onClick={() => setShowCalendarModal(false)}
                title="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* 월간 요약 바 */}
            <div className="calendar-summary-strip">
              <div className="strip-item">
                <span className="strip-label">{calendarMonth + 1}월 {activeTab === 'writing' ? '집필일수' : '독서일수'}</span>
                <strong className="strip-val">{currentMonthActiveCount}일</strong>
              </div>
              <div className="strip-divider" />
              <div className="strip-item">
                <span className="strip-label">연속 {activeTab === 'writing' ? '집필일' : '독서일'}</span>
                <strong className="strip-val">{currentStats.streak}일 연속</strong>
              </div>
              <div className="strip-divider" />
              <div className="strip-item">
                <span className="strip-label">{activeTab === 'writing' ? '누적 원고량' : '누적 감상 작품'}</span>
                <strong className="strip-val">
                  {activeTab === 'writing' ? `${writingStats.totalWords.toLocaleString()}자` : `${readerStats.totalReadCount}작품`}
                </strong>
              </div>
            </div>

            {/* 캘린더 바디 (그리드 + 선택일 상세 패널) */}
            <div className="calendar-modal-body">
              {/* 좌측: 월별 캘린더 그리드 */}
              <div className="calendar-grid-card">
                <div className="calendar-week-header">
                  {['일', '월', '화', '수', '목', '금', '토'].map((w, idx) => (
                    <div key={w} className={`cal-weekday-cell ${idx === 0 ? 'sun' : idx === 6 ? 'sat' : ''}`}>
                      {w}
                    </div>
                  ))}
                </div>

                <div className="calendar-days-grid">
                  {calendarDays.map((cell, idx) => {
                    const isActive = activeDatesSet.has(cell.dateStr);
                    const isSelected = cell.dateStr === selectedCalendarDate;

                    return (
                      <button
                        key={`${cell.dateStr}-${idx}`}
                        type="button"
                        className={`cal-day-cell ${cell.isCurrentMonth ? 'in-month' : 'out-month'} ${cell.isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isActive ? 'has-routine' : ''}`}
                        onClick={() => setSelectedCalendarDate(cell.dateStr)}
                      >
                        <span className="cal-day-num">{cell.dayNumber}</span>
                        {isActive && (
                          <span className="cal-routine-badge" title={activeTab === 'writing' ? '집필 루틴 완료' : '독서 루틴 완료'}>
                            {activeTab === 'writing' ? <Flame size={11} /> : <BookOpen size={11} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 우측: 선택한 일자 상세 루틴 내역 */}
              <div className="calendar-detail-card">
                <div className="detail-date-head">
                  <div className="detail-date-title">
                    <h4>{formatSelectedDateHeader(selectedCalendarDate)}</h4>
                    <span className={`detail-status-pill ${isSelectedDateActive ? 'completed' : 'none'}`}>
                      {isSelectedDateActive 
                        ? (activeTab === 'writing' ? '집필 루틴 완료' : '독서 루틴 완료') 
                        : (activeTab === 'writing' ? '집필 기록 없음' : '독서 기록 없음')}
                    </span>
                  </div>
                </div>

                <div className="detail-activities-list">
                  {isSelectedDateActive ? (
                    <>
                      {/* 일일 루틴 달성 정규 활동 카드 */}
                      <div className="detail-act-row">
                        <div className="detail-act-icon">
                          {activeTab === 'writing' ? (
                            <Flame size={15} style={{ color: '#ff7675' }} />
                          ) : (
                            <BookOpen size={15} style={{ color: '#10b981' }} />
                          )}
                        </div>
                        <div className="detail-act-body">
                          <div className="detail-act-text">
                            일일 {activeTab === 'writing' ? '원고 집필 및 보존' : '독서 감상'} 루틴 완료
                          </div>
                          <div className="detail-act-time">
                            연속 {activeTab === 'writing' ? '집필' : '독서'} 달성일
                          </div>
                        </div>
                      </div>

                      {/* 세부 이벤트 내역 (존재 시 병기) */}
                      {selectedDateActivities.map((act) => (
                        <div key={act.id} className="detail-act-row">
                          <div className="detail-act-icon">
                            {renderActivityIcon(act.type)}
                          </div>
                          <div className="detail-act-body">
                            <div className="detail-act-text">{act.text}</div>
                            <div className="detail-act-time">
                              {act.date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="detail-empty-guide">
                      <Clock size={22} className="empty-clock-icon" />
                      <p>이 날짜에는 등록된 {activeTab === 'writing' ? '집필' : '독서'} 활동 기록이 없습니다.</p>
                      <span>
                        {activeTab === 'writing'
                          ? '꾸준한 집필 루틴으로 캘린더에 불꽃을 밝혀보세요.'
                          : '꾸준한 독서 루틴으로 캘린더에 지혜의 발자취를 남겨보세요.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="calendar-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCalendarModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
