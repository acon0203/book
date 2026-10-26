import React, { useEffect, useRef } from 'react';
import './AdNative.css';

/**
 * AdNative - Zero-Lag 정적 네이티브 광고 컴포넌트
 * 
 * @param {string} slotId - 애드센스 광고 단위 슬롯 ID (data-ad-slot)
 * @param {string} variant - 'feed' (도서 목록 피드 카드형) | 'in-article' (본문 하단 가로 배너형) | 'compact'
 * @param {string} format - 'fluid' | 'auto' | 'rectangle'
 * @param {string} layoutKey - 인피드 네이티브 전용 layout-key (선택)
 * @param {string} className - 추가 클래스
 */
export default function AdNative({
  slotId = '4938563458',
  variant = 'sidebar',
  format = 'fluid',
  layoutKey = '',
  className = '',
}) {
  const adRef = useRef(null);
  const pushedRef = useRef(false);

  // 로컬 개발 환경 또는 배포 전 테스트 모드 판별
  const isDev = Boolean(
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
       window.location.hostname === '127.0.0.1'))
  );

  useEffect(() => {
    // 슬롯 ID가 없거나 로컬 개발 환경일 때는 실제 애드센스 호출 스킵
    if (!slotId || isDev || pushedRef.current) return;

    try {
      if (typeof window !== 'undefined') {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        pushedRef.current = true;
      }
    } catch (err) {
      // SPA 라우트 전환 등으로 인한 중복 호출 무해 에러 무시
      console.warn('[AdNative] Adsense push notice:', err?.message || err);
    }
  }, [slotId, isDev]);

  return (
    <div
      className={`ad-native-container ad-variant-${variant} ${className}`}
      data-testid="ad-native"
    >
      <div className="ad-native-header">
        <span className="ad-native-badge">SPONSORED</span>
      </div>

      <div className="ad-native-body" ref={adRef}>
        {!isDev && slotId ? (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client="ca-pub-6539127129126734"
            data-ad-slot={slotId}
            data-ad-format={format}
            {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : {})}
            {...(format === 'fluid' ? {} : { 'data-full-width-responsive': 'true' })}
          />
        ) : (
          <div className="ad-native-placeholder">
            <div className="ad-placeholder-graphic">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div className="ad-placeholder-info">
              <div className="ad-placeholder-title">네이티브 추천 광고</div>
              <div className="ad-placeholder-desc">
                {slotId
                  ? '도메인 승인 완료 후 테마에 최적화된 정적 광고가 노출됩니다.'
                  : '광고 단위 슬롯 ID 등록 후 서비스 화면에 자연스럽게 노출됩니다.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
