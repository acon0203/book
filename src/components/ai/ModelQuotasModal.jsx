import React, { useEffect, useState, useRef } from 'react';
import './ModelQuotasModal.css';
import { getModelQuotasSummary } from '../../utils/quotaManager';
import { storageService } from '../../services/storageService';
import { X, RefreshCw, Zap, Clock, ExternalLink, Info, CheckCircle2, Sparkles } from 'lucide-react';

export default function ModelQuotasModal({ isOpen, onClose }) {
  const [quotas, setQuotas] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('smart_cascade');
  const modalRef = useRef(null);

  const loadQuotas = () => {
    let currentModel = 'smart_cascade';
    try {
      const cfg = storageService.getConfig();
      currentModel = cfg.geminiModel || 'smart_cascade';
    } catch {}

    setSelectedModelId(currentModel);
    const list = getModelQuotasSummary(currentModel);
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

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 확인 클릭 시 선택한 모델 즉시 저장 및 적용
  const handleConfirm = () => {
    try {
      storageService.saveConfig({ geminiModel: selectedModelId });
      window.dispatchEvent(new CustomEvent('ai_quota_updated'));
      window.dispatchEvent(new CustomEvent('ai_config_updated', { detail: { geminiModel: selectedModelId } }));
    } catch (e) {
      console.error('Failed to save selected AI model:', e);
    }
    onClose();
  };

  if (!isOpen) return null;

  // 그룹별 모델 분류
  const flagshipModels = quotas.filter((q) => q.group === 'flagship');
  const liteModels = quotas.filter((q) => q.group === 'lite');
  const gemmaModels = quotas.filter((q) => q.group === 'gemma');

  const renderModelCard = (item) => {
    const isUrgent = Number(item.remainingPct) <= 20;
    const remainingCount = item.dailyLimit >= 999999 ? '∞' : Math.max(0, item.dailyLimit - item.usedCount);
    const isSelected = selectedModelId === item.id;

    return (
      <div
        key={item.id}
        className={`quota-item-card ${isSelected ? 'selected-model' : ''}`}
        onClick={() => setSelectedModelId(item.id)}
        title={`${item.name} 선택`}
      >
        <div className="quota-item-main">
          <div className="quota-item-left">
            <div className="quota-model-badge-row">
              <span className={`quota-status-dot ${isSelected ? 'active' : ''}`} />
              <span className="quota-model-title">{item.name}</span>
              {isSelected && (
                <span className="quota-active-tag">적용 대상</span>
              )}
            </div>
            <div className="quota-meta-row">
              <span className="quota-count-text">
                오늘 호출: <strong>{item.usedCount}회</strong> / Google 한도: {item.dailyLimit >= 1000 ? `${(item.dailyLimit / 1000).toFixed(1)}K` : item.dailyLimit}회 
                <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                  (잔여 {item.dailyLimit >= 1000 ? `${(remainingCount / 1000).toFixed(1)}K` : remainingCount}회)
                </span>
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
                {item.isExhausted ? '소진됨 (0%)' : `잔여 ${Math.round(Number(item.remainingPct))}%`}
              </span>
            </div>
            <div className="quota-select-radio">
              {isSelected ? (
                <CheckCircle2 size={18} className="quota-check-icon active" />
              ) : (
                <span className="quota-radio-circle" />
              )}
            </div>
          </div>
        </div>

        <div className="quota-item-sub">
          <span className="quota-reset-countdown">
            <Clock size={12} />
            구글 쿼터 리셋: 매일 17:00 ({item.resetText})
          </span>
          {item.isExhausted && (
            <span className="quota-exhausted-warn">
              일일 쿼터 초과 (429) · 리셋 후 재개
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay quotas-modal-overlay">
      <div className="modal-box quotas-modal-box" ref={modalRef}>
        {/* 모달 헤더: 정직한 호출 현황 및 모델 선택 */}
        <div className="modal-header quotas-modal-header">
          <div className="quotas-header-info">
            <div className="quotas-header-title-row">
              <Zap size={18} className="quotas-title-icon" />
              <h2>AI 모델 일일 호출 현황 & 모델 변경</h2>
            </div>
            <p className="quotas-header-desc">
              원하는 모델을 클릭하여 선택 후 [확인]을 누르면 즉시 변경됩니다.
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        {/* 모달 바디: 그룹별 모델 리스트 & 선택 */}
        <div className="modal-body quotas-modal-body">
          {/* 1. 스마트 자동 전환 (추천) 카드 */}
          <div
            className={`quota-item-card smart-cascade-card ${selectedModelId === 'smart_cascade' ? 'selected-model' : ''}`}
            onClick={() => setSelectedModelId('smart_cascade')}
            title="스마트 자동 전환 선택"
          >
            <div className="quota-item-main">
              <div className="quota-item-left">
                <div className="quota-model-badge-row">
                  <Sparkles size={16} style={{ color: '#f59e0b' }} />
                  <span className="quota-model-title">⭐ 스마트 자동 전환 (강력 추천)</span>
                  {selectedModelId === 'smart_cascade' && (
                    <span className="quota-active-tag">적용 대상</span>
                  )}
                </div>
                <div className="quota-meta-row">
                  <span className="quota-count-text">
                    3.8 Flash 우선 ➔ 한도 초과 시 3.5 Lite(500회) ➔ 3.1 Lite 순차 자동 전환
                  </span>
                </div>
              </div>
              <div className="quota-select-radio">
                {selectedModelId === 'smart_cascade' ? (
                  <CheckCircle2 size={18} className="quota-check-icon active" />
                ) : (
                  <span className="quota-radio-circle" />
                )}
              </div>
            </div>
          </div>

          {/* 2. 그룹 1: 플래그십 모델 (성능 높은 순) */}
          <div className="quotas-group-section">
            <div className="quotas-group-title">
              <span>👑 플래그십 모델 (성능 최고순 · 일 20회)</span>
            </div>
            <div className="quotas-model-list">
              {flagshipModels.map(renderModelCard)}
            </div>
          </div>

          {/* 3. 그룹 2: Lite 대용량 모델 (최신순) */}
          <div className="quotas-group-section">
            <div className="quotas-group-title">
              <span>⚡ Lite 대용량 모델 (초고속 안정 · 일 500회)</span>
            </div>
            <div className="quotas-model-list">
              {liteModels.map(renderModelCard)}
            </div>
          </div>

          {/* 4. 그룹 3: Gemma 4 기타 모델 (대규모 한도) */}
          <div className="quotas-group-section">
            <div className="quotas-group-title">
              <span>🌐 Gemma 4 최신 모델 (Google 오픈 모델 · 일 14.4K회)</span>
            </div>
            <div className="quotas-model-list">
              {gemmaModels.map(renderModelCard)}
            </div>
          </div>

          {/* 집계 안내 박스 */}
          <div className="quotas-info-callout" style={{ alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary)' }} />
            <div style={{ fontSize: '0.8rem', lineHeight: '1.45', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-main)' }}>호출 집계 안내:</strong><br />
              Google 정책상 외부 앱에 실시간 통합 잔여량 API를 지원하지 않습니다. 위 수치는 <strong>현재 기기의 서재에서 호출한 누적 횟수</strong>를 기준으로 집계된 참고용 수치입니다.
            </div>
          </div>
        </div>

        {/* 모달 푸터: 구글 AI 콘솔 링크, 새로고침, 확인 */}
        <div className="modal-footer quotas-modal-footer">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <a
              href="https://aistudio.google.com/app/plan_information"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Google AI Studio 공식 콘솔에서 전체 사용량 확인"
            >
              <span>구글 AI 콘솔 열기</span>
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadQuotas}
              title="서재 로컬 카운트 다시 읽기"
            >
              <RefreshCw size={13} />
              <span>새로고침</span>
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
