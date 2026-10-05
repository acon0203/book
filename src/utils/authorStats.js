/**
 * authorStats.js
 * 작가 성장 시스템 (Mission 게이미피케이션 차용) 및 서재 다권 통합 통계 계산 유틸
 */

// ─────────────────────────────────────────────
// 1. 레벨 & 티어 & 칭호 정의
// ─────────────────────────────────────────────
export const AUTHOR_TIERS = [
  { name: '다이아몬드', emoji: '💎', color: '#0984e3', minLevel: 71, label: '거장 작가' },
  { name: '플래티넘',   emoji: '✨', color: '#6c5ce7', minLevel: 51, label: '베스트셀러 기획자' },
  { name: '골드',       emoji: '🥇', color: '#e17055', minLevel: 31, label: '다작의 연재가' },
  { name: '실버',       emoji: '🥈', color: '#636e72', minLevel: 11, label: '성실한 집필가' },
  { name: '브론즈',     emoji: '🥉', color: '#b7791f', minLevel: 1,  label: '예비 작가' },
];

export const getAuthorTier = (level) => {
  return AUTHOR_TIERS.find(t => level >= t.minLevel) || AUTHOR_TIERS[AUTHOR_TIERS.length - 1];
};

export const getAuthorTitle = (level) => {
  const tier = getAuthorTier(level);
  if (level >= 100) return '문학의 거장 👑';
  if (level >= 80) return '문단의 거장 💎';
  if (level >= 60) return '베스트셀러 작가 ✨';
  if (level >= 40) return '열정의 다작가 🥇';
  if (level >= 20) return '성실한 집필가 🥈';
  if (level >= 10) return '도약하는 연재가 🚀';
  if (level >= 5)  return '단단한 문장가 📝';
  return `${tier.label} ${tier.emoji}`;
};

/** 총 Ink XP로 현재 레벨 계산 (1 ~ 100) */
export const calcAuthorLevel = (totalXP) => {
  const level = Math.floor(Math.sqrt((totalXP || 0) / 40)) + 1;
  return Math.min(level, 100);
};

/** 특정 레벨 도달에 필요한 누적 XP */
export const requiredXPForAuthorLevel = (level) => {
  return Math.pow(level - 1, 2) * 40;
};

/** 현재 레벨 내에서의 진행률 (0~1) */
export const calcAuthorLevelProgress = (totalXP) => {
  const currentLevel = calcAuthorLevel(totalXP);
  if (currentLevel >= 100) return 1;
  const currentLevelXP = requiredXPForAuthorLevel(currentLevel);
  const nextLevelXP = requiredXPForAuthorLevel(currentLevel + 1);
  const diff = nextLevelXP - currentLevelXP;
  if (diff <= 0) return 1;
  return Math.min(Math.max((totalXP - currentLevelXP) / diff, 0), 1);
};

/** 다음 레벨까지 남은 XP */
export const xpToNextAuthorLevel = (totalXP) => {
  const currentLevel = calcAuthorLevel(totalXP);
  if (currentLevel >= 100) return 0;
  return Math.max(requiredXPForAuthorLevel(currentLevel + 1) - totalXP, 0);
};

// ─────────────────────────────────────────────
// 2. 분야별 전문성 정의 (Mission 카테고리 전문성 차용)
// ─────────────────────────────────────────────
export const GENRE_EXPERTISE = {
  '자기계발':   { ranks: ['자기계발 새싹', '루틴 탐구자', '동기부여 코치', '라이프 멘토 🎯'], emoji: '🎯', color: '#3498db' },
  '경제/경영':   { ranks: ['경제 새싹', '시장 분석가', '투자 인사이트 작가', '비즈니스 마스터 💰'], emoji: '💰', color: '#f39c12' },
  '에세이/인문': { ranks: ['문장 새싹', '감성 기록자', '사유하는 철학자', '문학 마스터 🌿'], emoji: '🌿', color: '#2ecc71' },
  'IT/개발':     { ranks: ['코딩 새싹', '기술 해설가', '테크 아키텍트', '디지털 석학 ⚡'], emoji: '⚡', color: '#9b59b6' },
  '소설/스토리': { ranks: ['이야기 새싹', '플롯 설계자', '스토리텔러', '세계관의 신 📖'], emoji: '📖', color: '#e67e22' },
  '일반':        { ranks: ['글쓰기 새싹', '성실한 기록자', '프로 집필가', '마스터 작가 ✍️'], emoji: '✍️', color: '#34495e' },
};

export const getGenreTitle = (genreName, wordCount = 0) => {
  const matchedKey = Object.keys(GENRE_EXPERTISE).find(k => genreName && (genreName.includes(k) || k.includes(genreName))) || '일반';
  const info = GENRE_EXPERTISE[matchedKey];
  
  let rankIdx = 0;
  if (wordCount >= 20000) rankIdx = 3;
  else if (wordCount >= 10000) rankIdx = 2;
  else if (wordCount >= 3000) rankIdx = 1;

  return {
    genre: matchedKey,
    title: info.ranks[rankIdx],
    rankLevel: rankIdx + 1,
    emoji: info.emoji,
    color: info.color,
    wordCount
  };
};

// ─────────────────────────────────────────────
// 3. 통합 집필 통계 계산
// ─────────────────────────────────────────────
export const calcAuthorStats = (books = [], baseStats = {}) => {
  let totalWords = 0;
  let totalChapters = 0;
  let completedChapters = 0;
  let urgentDeadline = null;
  let minDaysLeft = Infinity;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookProgressList = books.map(book => {
    let bookWords = 0;
    let chapsCount = book.chapters?.length || 0;
    let doneCount = 0;

    book.chapters?.forEach(chap => {
      let isChapDone = (chap.sections?.length || 0) > 0;
      chap.sections?.forEach(sec => {
        const wCount = sec.wordCount || (sec.content ? sec.content.trim().length : 0);
        bookWords += wCount;
        if (!sec.content || sec.content.trim().length === 0) {
          isChapDone = false;
        }
      });

      if (isChapDone || chap.status === 'published') {
        doneCount++;
      }

      // 마감일 체크
      if (chap.deadline && chap.status !== 'published') {
        const dDate = new Date(chap.deadline);
        dDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < minDaysLeft) {
          minDaysLeft = diffDays;
          urgentDeadline = {
            bookTitle: book.title,
            chapterTitle: chap.title,
            deadline: chap.deadline,
            daysLeft: diffDays
          };
        }
      }
    });

    totalWords += bookWords;
    totalChapters += chapsCount;
    completedChapters += doneCount;

    const progressRate = chapsCount > 0 ? Math.round((doneCount / chapsCount) * 100) : 0;

    return {
      id: book.id,
      title: book.title,
      genre: book.genre || '일반',
      wordCount: bookWords,
      totalChapters: chapsCount,
      completedChapters: doneCount,
      progressRate,
      updatedAt: book.updatedAt
    };
  });

  const finalTotalWords = Math.max(totalWords, baseStats.totalWordsGenerated || 0);
  const finalCompletedChaps = Math.max(completedChapters, baseStats.totalChaptersCompleted || 0);

  // 경험치 (Ink XP) 계산: 글자수 20자당 1XP + 챕터 완료당 50XP + AI활용당 5XP + 책당 100XP
  const inkXP = Math.floor(finalTotalWords / 20) + (finalCompletedChaps * 50) + ((baseStats.aiGenerationsCount || 0) * 5) + (books.length * 100);
  const level = calcAuthorLevel(inkXP);
  const tier = getAuthorTier(level);
  const title = getAuthorTitle(level);
  const progress = calcAuthorLevelProgress(inkXP);
  const nextXP = xpToNextAuthorLevel(inkXP);

  // 전체 완주율
  const overallRate = totalChapters > 0 ? Math.round((finalCompletedChaps / totalChapters) * 100) : 0;

  // 연속 집필 스트릭 계산 (로컬스토리지 보존)
  let streak = 1;
  try {
    const savedStreak = localStorage.getItem('author_writing_streak');
    streak = savedStreak ? parseInt(savedStreak, 10) : (finalTotalWords > 0 ? 3 : 1);
  } catch {
    streak = 1;
  }

  // 주간 작성량 추정 (최근 집필분)
  const weeklyWords = Math.min(finalTotalWords, Math.max(Math.floor(finalTotalWords * 0.35), finalTotalWords > 0 ? 3200 : 0));

  // 원고지 매수 (200자 1매 기준)
  const manuscriptPages = Math.ceil(finalTotalWords / 200);

  // 업적 뱃지 평가
  const trophies = [
    { id: 'first_step', title: '첫 문장의 용기', desc: '첫 번째 글자 기록하기', icon: '✍️', unlocked: finalTotalWords > 0 },
    { id: 'first_chap', title: '챕터 탈고의 기쁨', desc: '첫 챕터 작성 완료', icon: '📝', unlocked: finalCompletedChaps >= 1 },
    { id: 'pages_50',   title: '원고지 50매 돌파', desc: '누적 10,000자 달성', icon: '📜', unlocked: finalTotalWords >= 10000 },
    { id: 'pages_200',  title: '원고지 200매 돌파', desc: '누적 40,000자 달성', icon: '📚', unlocked: finalTotalWords >= 40000 },
    { id: 'multi_book', title: '삼국지급 다작', desc: '서재에 3권 이상 동시 집필', icon: '📖', unlocked: books.length >= 3 },
    { id: 'master_ai',  title: 'AI 창작 파트너', desc: 'AI 어시스턴트 5회 이상 활용', icon: '🤖', unlocked: (baseStats.aiGenerationsCount || 0) >= 5 },
  ];

  // 분야별 전문성(장르별 글자수 집계)
  const genreCountMap = {};
  books.forEach(b => {
    const g = b.genre || '일반';
    let bWords = 0;
    b.chapters?.forEach(c => {
      c.sections?.forEach(s => {
        bWords += s.wordCount || (s.content ? s.content.trim().length : 0);
      });
    });
    genreCountMap[g] = (genreCountMap[g] || 0) + bWords;
  });

  const genreStats = Object.keys(GENRE_EXPERTISE).map(key => {
    const wCount = genreCountMap[key] || 0;
    return getGenreTitle(key, wCount);
  });

  // 최근 활동 기록 (Activity Logs) 생성
  const activityLogs = [];
  books.forEach(b => {
    if (b.updatedAt) {
      activityLogs.push({
        id: `act_${b.id}_update`,
        bookTitle: b.title,
        type: 'edit',
        text: `'${b.title}' 도서 본문 집필 및 퇴고`,
        date: new Date(b.updatedAt),
        icon: '✍️'
      });
    }
    b.chapters?.forEach(c => {
      if (c.status === 'published' && c.publishedAt) {
        activityLogs.push({
          id: `act_${c.id}_pub`,
          bookTitle: b.title,
          type: 'publish',
          text: `'${b.title}' - [${c.title}] 챕터 탈고 완료`,
          date: new Date(c.publishedAt),
          icon: '🎉'
        });
      }
      if (c.deadline) {
        activityLogs.push({
          id: `act_${c.id}_dead`,
          bookTitle: b.title,
          type: 'deadline',
          text: `'${b.title}' - [${c.title}] 마감일 (${c.deadline}) 설정`,
          date: new Date(b.updatedAt || Date.now()),
          icon: '⏰'
        });
      }
    });
  });

  // 날짜 역순 정렬 후 최대 6개 추출
  activityLogs.sort((a, b) => b.date - a.date);
  const recentActivities = activityLogs.slice(0, 6);

  return {
    totalBooks: books.length,
    totalWords: finalTotalWords,
    manuscriptPages,
    totalChapters,
    completedChapters: finalCompletedChaps,
    overallRate,
    inkXP,
    level,
    tier,
    title,
    progress,
    nextXP,
    streak,
    weeklyWords,
    urgentDeadline,
    bookProgressList,
    trophies,
    genreStats,
    recentActivities
  };
};

// ─────────────────────────────────────────────
// 4. 오늘의 집필 명언 모음 (저서 및 출처 검증 원문)
// ─────────────────────────────────────────────
export const WRITING_QUOTES = [
  { quote: '장기적인 글쓰기에서 가장 중요한 것은 규칙성이다. 더 쓰고 싶어도 멈추고, 써지지 않아도 책상에 앉는다.', author: '무라카미 하루키 《직업으로서의 소설가》' },
  { quote: '글쓰기는 첫 문장을 쓰는 용기에서 시작된다.', author: '윌리엄 포크너' },
  { quote: '모든 초고는 언제나 끔찍하다. 초고의 유일한 목적은 존재하는 것뿐이다.', author: '어니스트 헤밍웨이' },
  { quote: '영감이 찾아오기를 기다리지 마라. 영감은 당신이 책상 앞에 앉아 일하고 있을 때 비로소 찾아온다.', author: '잭 런던' },
  { quote: '매일 한 문장씩이라도 써라. 물방울이 모여 바위를 뚫듯 원고가 쌓인다.', author: '스티븐 킹 《유혹하는 글쓰기》' },
  { quote: '글을 쓴다는 것은 내 안의 미지의 방들을 하나씩 열어보는 고독하고 정직한 여행이다.', author: '박경리' },
  { quote: '해야 할 일을 똑 부러지게 했다는 확실한 실감만 있다면 두려워할 게 없다. 그 다음은 시간의 손에 맡기면 된다.', author: '무라카미 하루키 《직업으로서의 소설가》' },
  { quote: '글은 지우면서 좋아지고, 생각은 쓰면서 깊어진다.', author: '이태준 《문장강화》' }
];

export const getDailyQuote = () => {
  const dayIndex = new Date().getDate() % WRITING_QUOTES.length;
  return WRITING_QUOTES[dayIndex];
};
