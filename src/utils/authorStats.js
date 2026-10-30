import { ACHIEVEMENT_CHAINS, HIDDEN_ACHIEVEMENTS } from '../data/achievementsDb';
import { achievementService } from '../services/achievementService';

// ─────────────────────────────────────────────
// 1. 레벨 & 티어 & 칭호 정의
// ─────────────────────────────────────────────
export const AUTHOR_TIERS = [
  { name: '다이아몬드', color: '#0984e3', minLevel: 71, label: '거장 작가' },
  { name: '플래티넘',   color: '#6c5ce7', minLevel: 51, label: '베스트셀러 기획자' },
  { name: '골드',       color: '#e17055', minLevel: 31, label: '다작의 연재가' },
  { name: '실버',       color: '#636e72', minLevel: 11, label: '성실한 집필가' },
  { name: '브론즈',     color: '#b7791f', minLevel: 1,  label: '예비 작가' },
];

export const getAuthorTier = (level) => {
  return AUTHOR_TIERS.find(t => level >= t.minLevel) || AUTHOR_TIERS[AUTHOR_TIERS.length - 1];
};

export const getAuthorTitle = (level) => {
  const tier = getAuthorTier(level);
  if (level >= 100) return '문학의 거장';
  if (level >= 80) return '문단의 거장';
  if (level >= 60) return '베스트셀러 작가';
  if (level >= 40) return '열정의 다작가';
  if (level >= 20) return '성실한 집필가';
  if (level >= 10) return '도약하는 연재가';
  if (level >= 5)  return '단단한 문장가';
  return tier.label;
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
// 1-1. 독서 레벨 & 티어 & 칭호 정의 (집필 체계와 1:1 대칭)
// ─────────────────────────────────────────────
export const READER_TIERS = [
  { name: '다이아몬드', color: '#0984e3', minLevel: 71, label: '박학다식 서재지기' },
  { name: '플래티넘',   color: '#6c5ce7', minLevel: 51, label: '지혜로운 석학' },
  { name: '골드',       color: '#e17055', minLevel: 31, label: '통섭의 탐독가' },
  { name: '실버',       color: '#636e72', minLevel: 11, label: '성실한 애독가' },
  { name: '브론즈',     color: '#10b981', minLevel: 1,  label: '새싹 독서가' },
];

export const getReaderTier = (level) => {
  return READER_TIERS.find(t => level >= t.minLevel) || READER_TIERS[READER_TIERS.length - 1];
};

export const getReaderTitle = (level) => {
  const tier = getReaderTier(level);
  if (level >= 100) return '지혜의 거장';
  if (level >= 80) return '박학다식 서재지기';
  if (level >= 60) return '통섭의 탐독가';
  if (level >= 40) return '열정의 다독가';
  if (level >= 20) return '성실한 애독가';
  if (level >= 10) return '눈부신 탐구자';
  if (level >= 5)  return '단단한 독서가';
  return tier.label;
};

export const calcReaderLevel = (totalXP) => {
  const level = Math.floor(Math.sqrt((totalXP || 0) / 40)) + 1;
  return Math.min(level, 100);
};

export const requiredXPForReaderLevel = (level) => {
  return Math.pow(level - 1, 2) * 40;
};

export const calcReaderLevelProgress = (totalXP) => {
  const currentLevel = calcReaderLevel(totalXP);
  if (currentLevel >= 100) return 1;
  const currentLevelXP = requiredXPForReaderLevel(currentLevel);
  const nextLevelXP = requiredXPForReaderLevel(currentLevel + 1);
  const diff = nextLevelXP - currentLevelXP;
  if (diff <= 0) return 1;
  return Math.min(Math.max((totalXP - currentLevelXP) / diff, 0), 1);
};

export const xpToNextReaderLevel = (totalXP) => {
  const currentLevel = calcReaderLevel(totalXP);
  if (currentLevel >= 100) return 0;
  return Math.max(requiredXPForReaderLevel(currentLevel + 1) - totalXP, 0);
};

// ─────────────────────────────────────────────
// 2. 분야별 전문성 정의 (Mission 카테고리 전문성 차용)
// ─────────────────────────────────────────────
export const GENRE_EXPERTISE = {
  '자기계발':   { ranks: ['자기계발 새싹', '루틴 탐구자', '동기부여 코치', '라이프 멘토'], color: '#3498db' },
  '경제/경영':   { ranks: ['경제 새싹', '시장 분석가', '투자 인사이트 작가', '비즈니스 마스터'], color: '#f39c12' },
  '에세이/인문': { ranks: ['문장 새싹', '감성 기록자', '사유하는 철학자', '문학 마스터'], color: '#2ecc71' },
  'IT/개발':     { ranks: ['코딩 새싹', '기술 해설가', '테크 아키텍트', '디지털 석학'], color: '#9b59b6' },
  '소설/스토리': { ranks: ['이야기 새싹', '플롯 설계자', '스토리텔러', '세계관의 신'], color: '#e67e22' },
  '일반':        { ranks: ['글쓰기 새싹', '성실한 기록자', '프로 집필가', '마스터 작가'], color: '#34495e' },
};

export const getGenreTitle = (genreName, wordCount = 0) => {
  const matchedKey = Object.keys(GENRE_EXPERTISE).find(k => genreName && (genreName.includes(k) || k.includes(genreName))) || '일반';
  const info = GENRE_EXPERTISE[matchedKey];
  
  let rankIdx = 0;
  let nextThreshold = 10000;
  let prevThreshold = 0;

  if (wordCount >= 120000) {
    rankIdx = 3;      // 4단계 마스터: 정규 단행본 1권(12만 자 / 원고지 600매)
    nextThreshold = 120000;
    prevThreshold = 50000;
  } else if (wordCount >= 50000) {
    rankIdx = 2;      // 3단계 전문 작가: 중편 / 소책자 1권(5만 자)
    nextThreshold = 120000;
    prevThreshold = 50000;
  } else if (wordCount >= 10000) {
    rankIdx = 1;      // 2단계 탐구자: 단편 칼럼(1만 자 / 원고지 50매)
    nextThreshold = 50000;
    prevThreshold = 10000;
  } else {
    rankIdx = 0;      // 1단계 새싹: 입문
    nextThreshold = 10000;
    prevThreshold = 0;
  }

  const isMax = rankIdx === 3;
  const range = nextThreshold - prevThreshold;
  const progressRatio = isMax ? 1 : Math.min(1, Math.max(0, (wordCount - prevThreshold) / range));
  const remainingWords = isMax ? 0 : Math.max(0, nextThreshold - wordCount);

  return {
    genre: matchedKey,
    title: info.ranks[rankIdx],
    rankLevel: rankIdx + 1,
    color: info.color,
    wordCount,
    isMax,
    nextThreshold,
    progressRatio,
    remainingWords
  };
};

// ─────────────────────────────────────────────
// 2-1. 이번 주 집필 루틴 & 실제 연속 스트릭 정밀 계산
// ─────────────────────────────────────────────
export const calcWeeklyRoutine = (books = []) => {
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7; // 월=0, 일=6

  // 실제 집필/수정 활동 일자 집합 (YYYY-MM-DD)
  const activeDatesSet = new Set();

  // 1. 로컬스토리지 명시적 집필 로그
  try {
    const raw = localStorage.getItem('daily_writing_logs') || '[]';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach(d => {
        if (typeof d === 'string') activeDatesSet.add(d.slice(0, 10));
      });
    }
  } catch {}

  // 2. 도서 및 챕터/섹션의 실제 updatedAt 파싱
  books.forEach(b => {
    if (b.updatedAt) activeDatesSet.add(b.updatedAt.slice(0, 10));
    b.chapters?.forEach(c => {
      if (c.updatedAt) activeDatesSet.add(c.updatedAt.slice(0, 10));
      if (c.publishedAt) activeDatesSet.add(c.publishedAt.slice(0, 10));
      c.sections?.forEach(s => {
        if (s.updatedAt) activeDatesSet.add(s.updatedAt.slice(0, 10));
        if (s.publishedAt) activeDatesSet.add(s.publishedAt.slice(0, 10));
      });
    });
  });

  // 로컬 기준 YYYY-MM-DD 문자열 생성 헬퍼 (UTC 시차 오류 원천 방지)
  const toLocalDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 이번 주 월요일 계산 (로컬 기준 00:00:00)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayIndex, 0, 0, 0, 0);

  const days = daysOfWeek.map((dayName, idx) => {
    const targetDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const dateStr = toLocalDateStr(targetDate);
    const hasWritten = activeDatesSet.has(dateStr);
    const isToday = idx === currentDayIndex;
    const isPast = idx < currentDayIndex;
    const isFuture = idx > currentDayIndex;

    let status = 'upcoming'; // 'completed' | 'missed' | 'today' | 'upcoming'
    let stamp = '·';
    let label = '예정';

    if (isFuture) {
      // 🌟 미래 요일은 어떤 경우에도 무조건 '예정'
      status = 'upcoming';
      stamp = '·';
      label = '예정';
    } else if (hasWritten) {
      // 오늘 또는 과거 요일 중 실제 집필 기록이 있는 날
      status = 'completed';
      stamp = 'check';
      label = '완료';
    } else if (isToday) {
      // 오늘인데 아직 작성 전인 경우
      status = 'today';
      stamp = '·';
      label = '오늘';
    } else {
      // 과거 요일 중 집필하지 않은 날
      status = 'missed';
      stamp = '-';
      label = '미작성';
    }

    return {
      day: dayName,
      date: dateStr,
      status,
      stamp,
      label,
      isToday
    };
  });

  // 실제 연속 집필 스트릭 계산
  let streak = 0;
  const todayStr = toLocalDateStr(now);
  const wroteToday = activeDatesSet.has(todayStr);

  let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (wroteToday) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // 오늘 아직 안 썼으면 어제부터 연속성 역산
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (activeDatesSet.has(toLocalDateStr(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { days, todayDayIndex: currentDayIndex, streak, activeDates: Array.from(activeDatesSet) };
};

// ─────────────────────────────────────────────
// 3. 통합 집필 통계 계산
// ─────────────────────────────────────────────
export const calcAuthorStats = (books = [], baseStats = {}, currentUid = null) => {
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

  // 실제 일자별 집필 데이터 기반 이번 주 루틴 및 연속 스트릭 계산
  const weeklyRoutine = calcWeeklyRoutine(books);
  const streak = weeklyRoutine.streak;

  // 이번 주 실제 작성된 섹션 글자수 합산 (가짜 비율/최소값 보정 완전 제거)
  const weeklyDatesSet = new Set((weeklyRoutine?.days || []).map(d => d.date));
  let weeklyWords = 0;
  books.forEach(b => {
    const bookDate = (b.updatedAt || b.createdAt || '').slice(0, 10);
    (b.chapters || []).forEach(c => {
      const chapDate = (c.updatedAt || c.publishedAt || bookDate).slice(0, 10);
      (c.sections || []).forEach(s => {
        const secDate = (s.updatedAt || s.publishedAt || chapDate).slice(0, 10);
        if (secDate && weeklyDatesSet.has(secDate)) {
          const wCount = s.wordCount || (s.content ? s.content.replace(/<[^>]+>/g, '').trim().length : 0);
          weeklyWords += wCount;
        }
      });
    });
  });

  // 원고지 매수 (200자 1매 기준)
  const manuscriptPages = Math.ceil(finalTotalWords / 200);

  // 🌟 [작가 업적 2.0] 5대 롱테일 마일스톤 체인 및 히든 업적 평가 (Firestore 영구 연동)
  const unlockedMap = achievementService.getUnlockedMap();

  // 1) 체인별 수치 집계
  const completedBooksCount = books.filter(b => b.isCompleted).length;
  
  let planningMilestoneCount = 0;
  books.forEach(b => {
    if (b.planning) planningMilestoneCount++;
    if (b.plotStages && b.plotStages.length > 0) planningMilestoneCount++;
    if (b.characters && b.characters.length >= 3) planningMilestoneCount++;
    if (b.characters && b.characters.length >= 5) planningMilestoneCount++;
  });

  let totalPublishedSections = 0;
  books.forEach(b => {
    b.chapters?.forEach(c => {
      c.sections?.forEach(s => {
        if (s.status === 'published') totalPublishedSections++;
      });
    });
  });

  // 2) 5대 롱테일 체인 평가
  const achievementChains = ACHIEVEMENT_CHAINS.map(chain => {
    let currentValue = 0;
    if (chain.reqType === 'streak_days') currentValue = streak;
    else if (chain.reqType === 'completed_books') currentValue = completedBooksCount;
    else if (chain.reqType === 'total_words') currentValue = finalTotalWords;
    else if (chain.reqType === 'planning_milestone') currentValue = planningMilestoneCount;
    else if (chain.reqType === 'published_sections') currentValue = totalPublishedSections;

    const steps = chain.steps.map(step => {
      const isPermanentlyUnlocked = unlockedMap.has(step.id);
      const isCurrentlyMet = currentValue >= step.threshold;
      const isUnlocked = isPermanentlyUnlocked || isCurrentlyMet;

      // 신규 달성 시 Firestore 즉시 단건 저장 (덮어쓰지 않음, 오프라인 자동 큐잉)
      if (isCurrentlyMet && !isPermanentlyUnlocked && currentUid) {
        achievementService.unlockAchievement(currentUid, step.id).catch(console.error);
      }

      return {
        ...step,
        isUnlocked,
        unlockedAt: unlockedMap.get(step.id)?.unlockedAt || null
      };
    });

    const completedStepsCount = steps.filter(s => s.isUnlocked).length;
    const isAllCompleted = completedStepsCount === steps.length;
    const nextStep = steps.find(s => !s.isUnlocked) || null;
    const currentStep = steps.filter(s => s.isUnlocked).pop() || null;

    // 단계별 진행률 계산
    let progressRatio = 0;
    if (isAllCompleted) {
      progressRatio = 1;
    } else if (nextStep) {
      const prevThreshold = currentStep ? currentStep.threshold : 0;
      const targetThreshold = nextStep.threshold;
      const range = targetThreshold - prevThreshold;
      if (range > 0) {
        progressRatio = Math.min(1, Math.max(0, (currentValue - prevThreshold) / range));
      }
    }

    // 최종 단계 돌파 시 무한 프레스티지(★) 계산
    let prestigeCount = 0;
    if (isAllCompleted && chain.reqType === 'completed_books') {
      const maxThreshold = chain.steps[chain.steps.length - 1].threshold;
      if (currentValue > maxThreshold) {
        prestigeCount = currentValue - maxThreshold;
      }
    }

    return {
      id: chain.id,
      name: chain.name,
      subtitle: chain.subtitle,
      reqType: chain.reqType,
      currentValue,
      currentStep,
      nextStep,
      steps,
      completedStepsCount,
      totalStepsCount: steps.length,
      progressRatio,
      isAllCompleted,
      prestigeCount
    };
  });

  // 3) 히든 업적 컬렉션 평가
  const hiddenAchievements = HIDDEN_ACHIEVEMENTS.map(h => {
    const isPermanentlyUnlocked = unlockedMap.has(h.id);
    let isCurrentlyMet = false;

    if (h.conditionType === 'daily_words') {
      isCurrentlyMet = weeklyWords >= h.threshold;
    } else if (h.conditionType === 'ai_consultations') {
      isCurrentlyMet = (baseStats.aiGenerationsCount || 0) >= h.threshold;
    }

    const isUnlocked = isPermanentlyUnlocked || isCurrentlyMet;
    if (isCurrentlyMet && !isPermanentlyUnlocked && currentUid) {
      achievementService.unlockAchievement(currentUid, h.id).catch(console.error);
    }

    return {
      ...h,
      isUnlocked,
      unlockedAt: unlockedMap.get(h.id)?.unlockedAt || null
    };
  });

  // 하위 호환용 flat 리스트
  const trophies = [
    { id: 'first_step', title: '첫 문장의 용기', desc: '첫 번째 글자 기록하기', icon: '✍️', unlocked: finalTotalWords > 0 },
    { id: 'first_chap', title: '챕터 탈고의 기쁨', desc: '첫 챕터 작성 완료', icon: '📝', unlocked: finalCompletedChaps >= 1 },
    { id: 'pages_50',   title: '원고지 50매 돌파', desc: '누적 10,000자 달성', icon: '📜', unlocked: finalTotalWords >= 10000 },
    { id: 'pages_200',  title: '원고지 200매 돌파', desc: '누적 40,000자 달성', icon: '📚', unlocked: finalTotalWords >= 40000 },
    { id: 'multi_book', title: '삼국지급 다작', desc: '서재에 3작품 이상 동시 집필', icon: '📖', unlocked: books.length >= 3 },
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
  const toDateStr = (d) => {
    try {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  books.forEach(b => {
    if (b.updatedAt) {
      const d = new Date(b.updatedAt);
      activityLogs.push({
        id: `act_${b.id}_update`,
        bookTitle: b.title,
        type: 'edit',
        text: `'${b.title}' 도서 본문 집필 및 퇴고`,
        date: d,
        dateStr: toDateStr(d)
      });
    }
    b.chapters?.forEach(c => {
      if (c.status === 'published' && c.publishedAt) {
        const d = new Date(c.publishedAt);
        activityLogs.push({
          id: `act_${c.id}_pub`,
          bookTitle: b.title,
          type: 'publish',
          text: `'${b.title}' - [${c.title}] 챕터 탈고 완료`,
          date: d,
          dateStr: toDateStr(d)
        });
      }
      if (c.deadline) {
        const d = new Date(b.updatedAt || Date.now());
        activityLogs.push({
          id: `act_${c.id}_dead`,
          bookTitle: b.title,
          type: 'deadline',
          text: `'${b.title}' - [${c.title}] 마감일 (${c.deadline}) 설정`,
          date: d,
          dateStr: toDateStr(d)
        });
      }
    });
  });

  // 날짜 역순 정렬 후 최근 6개 추출
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
    weeklyRoutine,
    allActiveDates: weeklyRoutine.activeDates || [],
    allActivities: activityLogs,
    urgentDeadline,
    bookProgressList,
    achievementChains,
    hiddenAchievements,
    trophies,
    genreStats,
    recentActivities
  };
};

import quotesData from '../data/quotes-db.json';

// ─────────────────────────────────────────────
// 4. 오늘의 집필/독서 명언 모음
// ─────────────────────────────────────────────
export const WRITING_QUOTES = quotesData;

export const getDailyQuote = () => {
  if (!WRITING_QUOTES || WRITING_QUOTES.length === 0) {
    return { quote: '매일 한 문장씩이라도 써라.', author: '스티븐 킹' };
  }
  const dayIndex = new Date().getDate() % WRITING_QUOTES.length;
  return WRITING_QUOTES[dayIndex];
};

export const READING_QUOTES = [
  { quote: '독서는 앉아서 하는 가장 멀고 아름다운 여행이다.', author: '샤를 단치 《책 읽는 법》' },
  { quote: '좋은 책을 읽는 것은 과거의 가장 훌륭한 사람들과 대화를 나누는 것과 같다.', author: '르네 데카르트' },
  { quote: '책 없는 방은 영혼 없는 육체와 같다.', author: '마르쿠스 툴리우스 키케로' },
  { quote: '오늘의 나를 있게 한 것은 우리 마을의 작은 도서관이었다.', author: '빌 게이츠' },
  { quote: '남의 책을 읽는 데 시간을 보내라. 남이 고생한 것으로 쉽게 자기를 개선할 수 있다.', author: '소크라테스' },
  { quote: '한 사람의 인생은 그가 읽은 책의 총합이다.', author: '랄프 왈도 에머슨' },
  { quote: '책은 한 권 한 권이 모두 하나의 세계다.', author: '윌리엄 워즈워스' },
  { quote: '책을 읽는다는 것은 다른 사람의 뇌로 생각하는 것과 같다.', author: '아서 쇼펜하우어' }
];

export const getDailyReadingQuote = () => {
  const dayIndex = (new Date().getDate() + 3) % READING_QUOTES.length;
  return READING_QUOTES[dayIndex];
};

// ─────────────────────────────────────────────
// 5. 독서 전용 5대 마일스톤 체인 정의 (게이미피케이션 2.0 고도화)
// ─────────────────────────────────────────────
export const READER_ACHIEVEMENT_CHAINS = [
  {
    id: 'routine',
    name: '독서 루틴 체인',
    subtitle: '새벽을 밝히는 등불',
    reqType: 'streak_days',
    steps: [
      { id: 'r_streak_1', step: 1, title: '첫 장의 숨결', threshold: 1, desc: '하루 1회 이상 독서 감상 시작' },
      { id: 'r_streak_3', step: 2, title: '3일간의 탐독', threshold: 3, desc: '3일 연속 독서 기록 유지' },
      { id: 'r_streak_7', step: 3, title: '일주일의 독서 리듬', threshold: 7, desc: '일주일 연속 독서 달성' },
      { id: 'r_streak_14', step: 4, title: '2주의 독서 습관', threshold: 14, desc: '14일 연속 독서 마일스톤' },
      { id: 'r_streak_30', step: 5, title: '한 달의 지혜', threshold: 30, desc: '30일 연속 독서 완주' },
      { id: 'r_streak_60', step: 6, title: '두 달의 사유', threshold: 60, desc: '60일 연속 독서 완주' },
      { id: 'r_streak_100', step: 7, title: '백일의 서재 동행', threshold: 100, desc: '100일 연속 독서 달성' },
      { id: 'r_streak_365', step: 8, title: '365일 지혜의 등대', threshold: 365, desc: '1년(365일) 무휴 연속 독서 달성' }
    ]
  },
  {
    id: 'completion',
    name: '완독 마스터 체인',
    subtitle: '마지막 장의 전율',
    reqType: 'completed_books',
    steps: [
      { id: 'r_comp_1', step: 1, title: '첫 완독의 희열', threshold: 1, desc: '첫 번째 작품 완독 완료' },
      { id: 'r_comp_2', step: 2, title: '서재의 개척자', threshold: 2, desc: '2작품 완독 달성' },
      { id: 'r_comp_3', step: 3, title: '지식의 숲을 거닐다', threshold: 3, desc: '3작품 완독 달성' },
      { id: 'r_comp_5', step: 4, title: '다섯 권의 사유', threshold: 5, desc: '5작품 완독 달성' },
      { id: 'r_comp_7', step: 5, title: '일곱 번의 감동', threshold: 7, desc: '7작품 완독 달성' },
      { id: 'r_comp_10', step: 6, title: '열 권의 금자탑', threshold: 10, desc: '10작품 완독 달성' },
      { id: 'r_comp_15', step: 7, title: '불멸의 탐독가', threshold: 15, desc: '15작품 완독 달성' },
      { id: 'r_comp_20', step: 8, title: '살아 숨쉬는 지혜의 보고', threshold: 20, desc: '20작품 완독 달성' }
    ]
  },
  {
    id: 'sessions',
    name: '독서 분량 체인',
    subtitle: '종이 위에 새긴 시간',
    reqType: 'total_sessions',
    steps: [
      { id: 'r_ses_1', step: 1, title: '첫 문장의 여운', threshold: 1, desc: '첫 1회차 독서 완료' },
      { id: 'r_ses_5', step: 2, title: '깊어지는 몰입', threshold: 5, desc: '누적 5개 회차 감상' },
      { id: 'r_ses_15', step: 3, title: '칠야의 책장', threshold: 15, desc: '누적 15개 회차 감상' },
      { id: 'r_ses_30', step: 4, title: '백독의 시간', threshold: 30, desc: '누적 30개 회차 감상' },
      { id: 'r_ses_50', step: 5, title: '지성의 심연', threshold: 50, desc: '누적 50개 회차 감상' },
      { id: 'r_ses_100', step: 6, title: '백 권의 무게', threshold: 100, desc: '누적 100개 회차 감상' },
      { id: 'r_ses_150', step: 7, title: '천 권의 사유', threshold: 150, desc: '누적 150개 회차 감상' },
      { id: 'r_ses_200', step: 8, title: '문학의 영원한 벗', threshold: 200, desc: '누적 200개 회차 감상' }
    ]
  },
  {
    id: 'collection',
    name: '장서 컬렉션 체인',
    subtitle: '황금빛 장서의 방',
    reqType: 'total_books',
    steps: [
      { id: 'r_col_1', step: 1, title: '첫 권을 꽂으며', threshold: 1, desc: '서재에 첫 감상 작품 등록' },
      { id: 'r_col_3', step: 2, title: '열려있는 서재', threshold: 3, desc: '누적 3작품 감상' },
      { id: 'r_col_5', step: 3, title: '풍성한 책장', threshold: 5, desc: '누적 5작품 감상' },
      { id: 'r_col_10', step: 4, title: '방대한 장서가', threshold: 10, desc: '누적 10작품 감상' },
      { id: 'r_col_15', step: 5, title: '알렉산드리아의 후예', threshold: 15, desc: '누적 15개 작품 감상' },
      { id: 'r_col_25', step: 6, title: '거대한 도서관의 주인', threshold: 25, desc: '누적 25개 작품 감상' }
    ]
  },
  {
    id: 'genre',
    name: '지적 통섭 체인',
    subtitle: '지평선을 넘는 시선',
    reqType: 'unique_genres',
    steps: [
      { id: 'r_gen_1', step: 1, title: '호기심의 나침반', threshold: 1, desc: '1개 장르 독서 감상' },
      { id: 'r_gen_2', step: 2, title: '경계를 허무는 시선', threshold: 2, desc: '서로 다른 2개 장르 감상' },
      { id: 'r_gen_3', step: 3, title: '다채로운 지적 안목', threshold: 3, desc: '서로 다른 3개 장르 감상' },
      { id: 'r_gen_4', step: 4, title: '통섭의 르네상스인', threshold: 4, desc: '서로 다른 4개 장르 감상' },
      { id: 'r_gen_5', step: 5, title: '전방위 지식의 대가', threshold: 5, desc: '5개 이상 장르 섭렵' }
    ]
  }
];

// ─────────────────────────────────────────────
// 5-1. 이번 주 독서 루틴 & 실제 연속 독서 스트릭 계산
// ─────────────────────────────────────────────
export const calcWeeklyReadingRoutine = (historyList = []) => {
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7; // 월=0, 일=6

  const activeDatesSet = new Set();
  const toLocalDateStr = (d) => {
    try {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  historyList.forEach(h => {
    if (h.readAt) {
      try {
        const d = new Date(h.readAt);
        const str = toLocalDateStr(d);
        if (str) activeDatesSet.add(str);
      } catch {}
    }
  });

  // 이번 주 월요일 계산
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayIndex, 0, 0, 0, 0);

  const days = daysOfWeek.map((dayName, idx) => {
    const targetDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const dateStr = toLocalDateStr(targetDate);
    const hasRead = activeDatesSet.has(dateStr);
    const isToday = idx === currentDayIndex;
    const isFuture = idx > currentDayIndex;

    let status = 'upcoming';
    let stamp = '·';
    let label = '예정';

    if (isFuture) {
      status = 'upcoming';
      stamp = '·';
      label = '예정';
    } else if (hasRead) {
      status = 'completed';
      stamp = 'check';
      label = '완료';
    } else if (isToday) {
      status = 'today';
      stamp = '·';
      label = '오늘';
    } else {
      status = 'missed';
      stamp = '-';
      label = '미감상';
    }

    return {
      day: dayName,
      date: dateStr,
      status,
      stamp,
      label,
      isToday
    };
  });

  // 실제 연속 독서 스트릭 역산
  let streak = 0;
  const todayStr = toLocalDateStr(now);
  const readToday = activeDatesSet.has(todayStr);

  let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (readToday) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (activeDatesSet.has(toLocalDateStr(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { days, todayDayIndex: currentDayIndex, streak, activeDates: Array.from(activeDatesSet) };
};

/** 독서 서재 통계 계산 (게이미피케이션 2.0 고도화) */
export const calcReaderStats = (historyList = [], books = []) => {
  const totalReadCount = historyList.length;
  const completedCount = historyList.filter(h => h.isCompleted).length;
  const inProgressCount = totalReadCount - completedCount;
  const completionRate = totalReadCount > 0 ? Math.round((completedCount / totalReadCount) * 100) : 0;
  const totalSessions = historyList.length; // 누적 감상 회차

  // 실제 독서 루틴 & 스트릭 계산
  const weeklyRoutine = calcWeeklyReadingRoutine(historyList);
  const streak = weeklyRoutine.streak;

  // 이번 주 독서 감상 횟수 및 일자
  const weeklyDatesSet = new Set((weeklyRoutine?.days || []).map(d => d.date));
  const weeklyReadingCount = historyList.filter(h => {
    if (!h.readAt) return false;
    return weeklyDatesSet.has(h.readAt.slice(0, 10));
  }).length;

  // 책 ID -> Book 매핑 (실제 챕터 글자수 정밀 집계용)
  const bookMap = new Map();
  books.forEach(b => {
    if (b?.id) bookMap.set(b.id, b);
  });

  // 누적 독서 글자수 및 이번 주 독서 글자수 계산
  let totalWords = 0;
  let weeklyWords = 0;

  historyList.forEach(h => {
    let entryWords = 0;
    if (typeof h.wordsCount === 'number' && h.wordsCount > 0) {
      entryWords = h.wordsCount;
    } else {
      const matchedBook = bookMap.get(h.bookId);
      if (matchedBook) {
        if (h.chapterId) {
          const matchedChap = matchedBook.chapters?.find(c => c.id === h.chapterId);
          if (matchedChap?.sections) {
            matchedChap.sections.forEach(s => {
              const text = (s.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
              entryWords += text.length;
            });
          }
        }
        if (entryWords === 0 && matchedBook.chapters?.length > 0) {
          let bookAllWords = 0;
          matchedBook.chapters.forEach(c => {
            c.sections?.forEach(s => {
              const text = (s.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
              bookAllWords += text.length;
            });
          });
          entryWords = bookAllWords > 0 ? Math.round(bookAllWords / matchedBook.chapters.length) : 0;
        }
      }
    }

    totalWords += entryWords;

    if (h.readAt && weeklyDatesSet.has(h.readAt.slice(0, 10))) {
      weeklyWords += entryWords;
    }
  });

  const manuscriptPages = Math.ceil(totalWords / 200);

  // 독서 경험치 (Page XP): 독서 글자수 기반(10자당 1 XP) + 완독 보너스 400 XP + 스트릭 60 XP
  const pageXP = Math.round(totalWords / 10) + (completedCount * 400) + (streak * 60);

  // 독서 레벨 & 티어 시스템 (집필과 1:1 완벽 대칭)
  const level = calcReaderLevel(pageXP);
  const tier = getReaderTier(level);
  const title = getReaderTitle(level);
  const progress = calcReaderLevelProgress(pageXP);
  const nextXP = xpToNextReaderLevel(pageXP);

  // 독서 장르별 분포
  const genreCountMap = {};
  historyList.forEach(h => {
    const g = h.genre || '일반';
    genreCountMap[g] = (genreCountMap[g] || 0) + 1;
  });

  const genreStats = Object.entries(genreCountMap).map(([genre, count]) => {
    const pct = totalReadCount > 0 ? Math.round((count / totalReadCount) * 100) : 0;
    return { genre, count, pct };
  }).sort((a, b) => b.count - a.count);

  const uniqueGenreCount = Object.keys(genreCountMap).length;

  // 독서 활동 전체 로그 (날짜 역순 정렬)
  const toLocalDateStr = (d) => {
    try {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const activityLogs = historyList
    .map(h => {
      const d = h.readAt ? new Date(h.readAt) : new Date();
      return {
        id: `read_act_${h.bookId}_${h.chapterId || 'root'}`,
        bookTitle: h.bookTitle,
        type: 'read',
        text: `'${h.bookTitle}' - [${h.chapterTitle || '1화'}] 감상`,
        date: d,
        dateStr: toLocalDateStr(d)
      };
    })
    .sort((a, b) => b.date - a.date);

  // 5대 독서 마일스톤 체인 평가
  const achievementChains = READER_ACHIEVEMENT_CHAINS.map(chain => {
    let currentValue = 0;
    if (chain.reqType === 'streak_days') currentValue = streak;
    else if (chain.reqType === 'completed_books') currentValue = completedCount;
    else if (chain.reqType === 'total_books') currentValue = totalReadCount;
    else if (chain.reqType === 'unique_genres') currentValue = uniqueGenreCount;
    else if (chain.reqType === 'total_sessions') currentValue = totalReadCount;

    const steps = chain.steps.map(step => {
      const isUnlocked = currentValue >= step.threshold;
      return {
        ...step,
        isUnlocked
      };
    });

    const completedStepsCount = steps.filter(s => s.isUnlocked).length;
    const isAllCompleted = completedStepsCount === steps.length;
    const nextStep = steps.find(s => !s.isUnlocked) || null;
    const currentStep = steps.filter(s => s.isUnlocked).pop() || null;

    let progressRatio = 0;
    if (isAllCompleted) {
      progressRatio = 1;
    } else if (nextStep) {
      const prevThreshold = currentStep ? currentStep.threshold : 0;
      const targetThreshold = nextStep.threshold;
      const range = targetThreshold - prevThreshold;
      if (range > 0) {
        progressRatio = Math.min(1, Math.max(0, (currentValue - prevThreshold) / range));
      }
    }

    return {
      id: chain.id,
      name: chain.name,
      subtitle: chain.subtitle,
      reqType: chain.reqType,
      currentValue,
      currentStep,
      nextStep,
      steps,
      completedStepsCount,
      totalStepsCount: steps.length,
      progressRatio,
      isAllCompleted
    };
  });

  // 독서 히든 업적 컬렉션 (문학적 감성 강화)
  const hiddenAchievements = [
    {
      id: 'r_hidden_night',
      title: '새벽의 등불',
      description: '깊은 밤 고요 속에 촛불을 켜고 책장을 넘겼습니다.',
      hint: '모두가 잠든 밤, 고요히 촛불을 켜고 책을 펼쳐보세요.',
      isUnlocked: historyList.some(h => {
        if (!h.readAt) return false;
        const hour = new Date(h.readAt).getHours();
        return hour >= 0 && hour < 5;
      })
    },
    {
      id: 'r_hidden_weekend',
      title: '주말의 지적 피서',
      description: '바쁜 일상을 내려놓고 주말 온전히 문장의 숲에 머물렀습니다.',
      hint: '주말의 평화로운 휴식 시간, 서재에서 지적 여유를 만끽해보세요.',
      isUnlocked: historyList.some(h => {
        if (!h.readAt) return false;
        const day = new Date(h.readAt).getDay();
        return day === 0 || day === 6;
      })
    }
  ];

  // 하위 호환용 트로피
  const trophies = [
    { id: 'read_first', title: '첫 장의 설렘', desc: '첫 번째 작품 감상 시작', unlocked: totalReadCount >= 1 },
    { id: 'read_three', title: '삼매경의 독서가', desc: '누적 3작품 이상 독서 감상', unlocked: totalReadCount >= 3 },
    { id: 'read_multi_genre', title: '장르의 모험가', desc: '2가지 이상의 서로 다른 장르 감상', unlocked: uniqueGenreCount >= 2 },
    { id: 'read_streak', title: '독서 루틴 완성', desc: '3일 이상 연속 독서 루틴 유지', unlocked: streak >= 3 },
    { id: 'read_five', title: '서재의 수집가', desc: '누적 5작품 이상 독서 감상', unlocked: totalReadCount >= 5 },
    { id: 'read_complete', title: '완독의 희열', desc: '1작품 이상 완독 달성', unlocked: completedCount >= 1 }
  ];

  return {
    totalWords,
    manuscriptPages,
    weeklyWords,
    totalReadCount,
    completedCount,
    inProgressCount,
    completionRate,
    totalSessions,
    weeklyReadingCount,
    pageXP,
    level,
    tier,
    title,
    progress,
    nextXP,
    streak,
    weeklyRoutine,
    allActiveDates: weeklyRoutine.activeDates,
    allActivities: activityLogs,
    recentActivities: activityLogs.slice(0, 6),
    genreStats,
    achievementChains,
    hiddenAchievements,
    trophies
  };
};
