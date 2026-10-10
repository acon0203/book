// QuotaManager: Gemini 및 AI 모델별 일일 할당량(Quota) 추적 및 리셋 계산 유틸리티

export const MODEL_LIMITS = {
  'gemini-3.5-flash-lite': { name: 'Gemini 3.5 Flash Lite', dailyLimit: 500, tier: 'Lite (대용량)' },
  'gemini-3.6-flash': { name: 'Gemini 3.6 Flash', dailyLimit: 20, tier: 'High (플래그십)' },
  'gemini-3.8-flash': { name: 'Gemini 3.8 Flash', dailyLimit: 20, tier: 'High (플래그십)' },
  'gemini-3.1-flash-lite': { name: 'Gemini 3.1 Flash Lite', dailyLimit: 500, tier: 'Lite (대용량)' },
  'gemma2:9b': { name: 'Gemma 2:9b (Ollama)', dailyLimit: 999999, tier: 'Local (무제한)' }
};

const STORAGE_KEY = 'bookstudio_model_quotas_v1';

// 구글 Gemini Quota 리셋 시간 계산 (태평양 표준시 자정 = 한국 시간 오후 5:00 리셋)
export const getNextResetInfo = () => {
  const now = new Date();
  
  // 한국 시간 오후 17:00(PST 자정)을 기준 리셋 시점으로 잡음
  const resetToday = new Date(now);
  resetToday.setHours(17, 0, 0, 0);

  let nextReset = new Date(resetToday);
  if (now >= resetToday) {
    nextReset.setDate(nextReset.getDate() + 1);
  }

  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  // 포맷: '10/11/2026 17:00'
  const month = String(nextReset.getMonth() + 1).padStart(2, '0');
  const day = String(nextReset.getDate()).padStart(2, '0');
  const year = nextReset.getFullYear();
  const resetDateStr = `${month}/${day}/${year} 17:00`;

  return {
    remainingHours: hours,
    remainingMinutes: minutes,
    resetTimeFormatted: `${hours}h ${minutes}m (${resetDateStr})`,
    nextResetTimestamp: nextReset.getTime()
  };
};

// 저장된 쿼터 데이터 조회 (리셋 시점 지났으면 자동 초기화)
export const getQuotaData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const now = Date.now();

    // 마지막 리셋 타임스탬프 검사
    if (!data.lastResetTime || now >= data.nextResetTime) {
      const resetInfo = getNextResetInfo();
      const freshData = {
        lastResetTime: now,
        nextResetTime: resetInfo.nextResetTimestamp,
        usage: {}
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
      return freshData;
    }

    return data;
  } catch {
    return { usage: {} };
  }
};

// 모델 사용 횟수 기록 (AI 요청 성공 시 호출)
export const recordModelUsage = (modelId) => {
  try {
    const data = getQuotaData();
    if (!data.usage) data.usage = {};
    
    const curCount = data.usage[modelId]?.count || 0;
    data.usage[modelId] = {
      count: curCount + 1,
      isExhausted: false,
      lastUsedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('ai_quota_updated'));
  } catch (e) {
    console.error('Failed to record model usage:', e);
  }
};

// 429 에러 발생 시 해당 모델 소진 처리
export const markModelExhausted = (modelId) => {
  try {
    const data = getQuotaData();
    if (!data.usage) data.usage = {};

    const limit = MODEL_LIMITS[modelId]?.dailyLimit || 20;
    data.usage[modelId] = {
      count: limit,
      isExhausted: true,
      lastUsedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('ai_quota_updated'));
  } catch (e) {
    console.error('Failed to mark model exhausted:', e);
  }
};

// 전 모델별 잔여 Quota 현황 산출
export const getModelQuotasSummary = (activeModelId = 'gemini-3.5-flash-lite') => {
  const data = getQuotaData();
  const resetInfo = getNextResetInfo();

  return Object.entries(MODEL_LIMITS).map(([id, info]) => {
    const usageObj = data.usage?.[id] || { count: 0, isExhausted: false };
    const usedCount = usageObj.count || 0;
    const isExhausted = usageObj.isExhausted || usedCount >= info.dailyLimit;

    // 잔여 퍼센트 계산
    let remainingPct = 100;
    if (info.dailyLimit === 999999) {
      remainingPct = 100;
    } else if (isExhausted) {
      remainingPct = 0;
    } else {
      remainingPct = Math.max(0, Math.min(100, Math.round(((info.dailyLimit - usedCount) / info.dailyLimit) * 100)));
    }

    return {
      id,
      name: info.name,
      tier: info.tier,
      dailyLimit: info.dailyLimit,
      usedCount,
      remainingPct: remainingPct.toFixed(1),
      isExhausted,
      isActive: activeModelId === id || (activeModelId === 'smart_cascade' && id === 'gemini-3.5-flash-lite'),
      resetText: resetInfo.resetTimeFormatted
    };
  });
};

// 현재 활성 모델의 단일 Quota 요약 헬퍼
export const getActiveModelQuota = () => {
  let activeModelId = 'gemini-3.5-flash-lite';
  try {
    const cfgRaw = localStorage.getItem('bookstudio_config');
    if (cfgRaw) {
      const cfg = JSON.parse(cfgRaw);
      if (cfg.geminiModel && cfg.geminiModel !== 'smart_cascade') {
        activeModelId = cfg.geminiModel;
      }
    }
  } catch {}

  const summary = getModelQuotasSummary(activeModelId);
  return summary.find(s => s.id === activeModelId) || summary[0];
};
