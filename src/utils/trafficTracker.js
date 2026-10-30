/**
 * trafficTracker.js
 * 사용자 방문 세션 및 플랫폼 트래픽 통계 추적 유틸리티
 */

const TRAFFIC_KEY = 'bookstudio_traffic_metrics';

export const trafficTracker = {
  /**
   * 사용자 방문 기록 (세션당 1회 누적)
   */
  recordVisit: () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const sessionLogged = sessionStorage.getItem('bookstudio_session_logged');

      let metrics = trafficTracker.getRawMetrics();

      if (!sessionLogged) {
        sessionStorage.setItem('bookstudio_session_logged', 'true');
        metrics.totalVisits = (metrics.totalVisits || 0) + 1;
        metrics.dailyVisits[todayStr] = (metrics.dailyVisits[todayStr] || 0) + 1;
        localStorage.setItem(TRAFFIC_KEY, JSON.stringify(metrics));
      }
    } catch (e) {
      console.warn('[TrafficTracker] recordVisit error:', e);
    }
  },

  /**
   * 독서 뷰어 열람 세션 누적
   */
  recordReaderView: () => {
    try {
      let metrics = trafficTracker.getRawMetrics();
      metrics.readerViews = (metrics.readerViews || 0) + 1;
      localStorage.setItem(TRAFFIC_KEY, JSON.stringify(metrics));
    } catch (e) {
      console.warn('[TrafficTracker] recordReaderView error:', e);
    }
  },

  /**
   * 내부 원본 통계 조회 (레거시 하드코딩 오프셋 142/86 자동 정화 포함)
   */
  getRawMetrics: () => {
    try {
      const raw = localStorage.getItem(TRAFFIC_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.v2Clean) {
          const daily = parsed.dailyVisits || {};
          const realTotalVisits = Object.values(daily).reduce((acc, v) => acc + (Number(v) || 0), 0);
          let realReaderViews = 0;
          try {
            const hist = JSON.parse(localStorage.getItem('reader_history') || '[]');
            if (Array.isArray(hist)) realReaderViews = hist.length;
          } catch {}
          const cleaned = {
            totalVisits: realTotalVisits,
            readerViews: parsed.readerViews === 86 ? realReaderViews : Math.max(0, (parsed.readerViews || 0) - 86),
            dailyVisits: daily,
            createdAt: parsed.createdAt || new Date().toISOString(),
            v2Clean: true
          };
          localStorage.setItem(TRAFFIC_KEY, JSON.stringify(cleaned));
          return cleaned;
        }
        return parsed;
      }
    } catch {}

    // 초기값 기본 생성 (100% 실제 카운트만 집계)
    const defaultData = {
      totalVisits: 0,
      readerViews: 0,
      dailyVisits: {},
      createdAt: new Date().toISOString(),
      v2Clean: true
    };
    return defaultData;
  },

  /**
   * 대시보드 표시용 집계 통계 산출 (가짜 보정치 없는 100% 실측 데이터)
   */
  getSummary: () => {
    const raw = trafficTracker.getRawMetrics();
    const todayStr = new Date().toISOString().slice(0, 10);

    const totalVisitors = raw.totalVisits || 0;
    const todayVisitors = raw.dailyVisits?.[todayStr] || 0;

    // 최근 7일 실제 방문자 합산
    let weeklyCount = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weeklyCount += raw.dailyVisits?.[key] || 0;
    }

    return {
      totalVisitors,
      todayVisitors,
      weeklyVisitors: weeklyCount,
      readerSessions: raw.readerViews || 0
    };
  }
};
