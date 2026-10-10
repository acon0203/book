import React, { useEffect, useState, useRef } from 'react';
import './ModelQuotasModal.css';
import { getModelQuotasSummary } from '../utils/quotaManager';
import { X, RefreshCw, Zap, Clock, ShieldCheck } from 'lucide-react';

export default function ModelQuotasModal({ isOpen, onClose }) {
  const [quotas, setQuotas] = useState([]);
  const modalRef = useRef(null);

  const loadQuotas = () => {
    let activeModel = 'gemini-3.5-flash-lite';
    try {
      const cfgRaw = localStorage.getItem('bookstudio_config');
      if (cfgRaw) {
        const cfg = JSON.parse(cfgRaw);
        activeModel = cfg.geminiModel || 'smart_cascade';
      }
    } catch {}

    const list = getModelQuotasSummary(activeModel);
    setQuotas(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadQuotas();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      loadQuotas();
    };
    window.addEventListener('ai_quota_updated', handleUpdate);
    return () => window.removeEventListener('ai_quota_updated', handleUpdate);
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isOpen && modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay quotas-modal-overlay">
      <div className="modal-box quotas-modal-box" ref={modalRef}>
        {/* 모달 헤더: 서비스 표준 디자인 테마 ('Model Quotas' 영문 완전 배제) */}
        <div className="modal-header quotas-modal-header">
          <div className="quotas-header-info">
            <div className="quotas-header-title-row">
              <Zap size={18} className="quotas-title-icon" />
              <h2>AI 모델 일일 잔여 한도</h2>
            </div>
            <p className="quotas-header-desc">
              구글 Gemini 및 온디바이스 AI의 일일 할당량(Quota) 실시간 현황
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        {/* 모달 바디: 모델별 잔여량 리스트 */}
        <div className="modal-body quotas-modal-body">
          <div className="quotas-model-list">
            {quotas.map((item) => {
              const isUrgent = Number(item.remainingPct) <= 20;
              return (
                <div
                  key={item.id}
                  className={`quota-item-card ${item.isActive ? 'active-model' : ''}`}
                >
                  <div className="quota-item-main">
                    <div className="quota-item-left">
                      <div className="quota-model-badge-row">
                        <span className={`quota-status-dot ${item.isActive ? 'active' : ''}`} />
                        <span className="quota-model-title">{item.name}</span>
                        {item.isActive && (
                          <span className="quota-active-tag">현재 사용 중</span>
                        )}
                      </div>
                      <div className="quota-meta-row">
                        <span className="quota-tier-tag">{item.tier}</span>
                        <span className="quota-count-text">
                          {item.dailyLimit >= 999999 ? '무제한 사용' : `일일 ${item.dailyLimit}회 한도`}
                        </span>
                      </div>
                    </div>

                    <div className="quota-item-right">
                      <div className="quota-gauge-container">
                        <div className="quota-gauge-bar">
                          <div
                            className={`quota-gauge-fill ${isUrgent ? 'urgent' : ''}`}
                            style={{ width: `${item.remainingPct}%` }}
                          />
                        </div>
                        <span className={`quota-pct-number ${isUrgent ? 'urgent' : ''}`}>
                          {item.isExhausted ? '소진됨 (0%)' : `${Math.round(Number(item.remainingPct))}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="quota-item-sub">
                    <span className="quota-reset-countdown">
                      <Clock size={12} />
                      리셋 예정: {item.resetText}
                    </span>
                    {item.isExhausted && (
                      <span className="quota-exhausted-warn">
                        일일 쿼터 초과 (429) · 리셋 후 재개
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="quotas-info-callout">
            <ShieldCheck size={16} />
            <span>
              스마트 자동 전환 설정 시 특정 모델이 소진되면 즉시 차선책 모델로 부드럽게 이어집니다.
            </span>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="modal-footer quotas-modal-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadQuotas}
            title="잔여량 새로고침"
          >
            <RefreshCw size={13} />
            <span>새로고침</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
