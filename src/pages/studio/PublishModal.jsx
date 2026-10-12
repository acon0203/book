import React, { useState, useEffect } from 'react';
import { Send, X, CheckSquare } from 'lucide-react';
import { aiService } from '../../services/aiService';
import './PublishModal.css';

// 목차 번호 정제 헬퍼
const cleanTitle = (t) => aiService.cleanOutlineTitle(t);

export default function PublishModal({
  isOpen,
  onClose,
  activeBook,
  currentChapter,
  currentSection,
  currentChapterIndex,
  activeSectionId,
  localTitle,
  editor,
  toggleSectionPublish,
  updateBatchPublishSections,
}) {
  const [selectedPublishSectionIds, setSelectedPublishSectionIds] = useState(new Set());

  // 모달 열릴 때 현재 발행된 소목차 ID들로 선택 상태 초기화
  useEffect(() => {
    if (isOpen && activeBook) {
      const pubIds = new Set();
      (activeBook.chapters || []).forEach(c => {
        (c.sections || []).forEach(s => {
          if (s.status === 'published') pubIds.add(s.id);
        });
      });
      setSelectedPublishSectionIds(pubIds);
    }
  }, [isOpen, activeBook]);

  // ESC 키로 모달 닫기
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

  if (!isOpen) return null;

  const allSections = activeBook?.chapters?.flatMap(c => c.sections || []) || [];
  const isCurrentPublished = currentSection?.status === 'published';

  const handleSelectAll = () => {
    setSelectedPublishSectionIds(new Set(allSections.map(s => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPublishSectionIds(new Set());
  };

  const handleToggleChapterSelection = (chap) => {
    const chapSecIds = (chap.sections || []).map(s => s.id);
    const allSelected = chapSecIds.length > 0 && chapSecIds.every(id => selectedPublishSectionIds.has(id));
    const next = new Set(selectedPublishSectionIds);
    if (allSelected) {
      chapSecIds.forEach(id => next.delete(id));
    } else {
      chapSecIds.forEach(id => next.add(id));
    }
    setSelectedPublishSectionIds(next);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-publish" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="modal-header publish-unified-header">
          <div className="publish-header-left">
            <div className="publish-header-icon-box">
              <Send size={18} />
            </div>
            <div className="publish-header-title-wrap">
              <h2>연재 발행하기</h2>
              <span className="publish-book-badge">《{activeBook?.title}》</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body publish-unified-body">
          {/* 1. 상단 섹션: 이번화 바로 발행 (컴팩트 카드) */}
          <div className="publish-section-block">
            <div className="publish-section-label-row">
              <span className="section-step-tag">1</span>
              <span className="publish-section-label">이번화 바로 발행</span>
              <span className="publish-section-subguide">현재 작성 중인 이 회차만 독자에게 즉시 공개합니다</span>
            </div>

            {currentSection ? (
              <div className={`publish-now-card ${isCurrentPublished ? 'is-published' : ''}`}>
                <div className="publish-now-content">
                  <div className="publish-now-meta">
                    <span className="publish-chap-pill">
                      제{currentChapterIndex + 1}장 · {cleanTitle(currentChapter?.title || '')}
                    </span>
                    <span className={`publish-status-tag ${isCurrentPublished ? 'pub' : 'draft'}`}>
                      {isCurrentPublished ? '✓ 연재 발행중' : '초고 (미발행)'}
                    </span>
                  </div>
                  <h4 className="publish-now-title">
                    {currentChapterIndex + 1}.{((currentChapter?.sections?.findIndex(s => s.id === activeSectionId) ?? 0) + 1)} {localTitle || currentSection?.title || '소목차'}
                  </h4>
                  <div className="publish-now-stats">
                    <span>분량 <strong>{(editor?.getText()?.trim()?.length || 0).toLocaleString()}자</strong></span>
                    <span className="divider-dot">·</span>
                    <span>
                      {currentSection.publishedAt
                        ? `${new Date(currentSection.publishedAt).toLocaleDateString('ko-KR')} 발행됨`
                        : '아직 독자에게 공개되지 않음'}
                    </span>
                  </div>
                </div>

                <div className="publish-now-btn-wrap">
                  {isCurrentPublished ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-now-action"
                      onClick={async () => {
                        await toggleSectionPublish(currentChapter.id, currentSection.id);
                      }}
                    >
                      발행 취소
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-now-action"
                      onClick={async () => {
                        await toggleSectionPublish(currentChapter.id, currentSection.id);
                      }}
                    >
                      <Send size={14} />
                      <span>이번화만 발행</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-selection-notice">선택된 소목차가 없습니다.</div>
            )}
          </div>

          {/* 2. 하단 섹션: 선택하여 발행하기 (전체 목차 체크박스) */}
          <div className="publish-section-block">
            <div className="publish-section-label-row">
              <span className="section-step-tag">2</span>
              <span className="publish-section-label">선택하여 발행하기</span>
              <span className="publish-section-subguide">전체 목차에서 원하는 회차를 체크하여 일괄 반영합니다</span>
              
              <div className="publish-batch-quick-actions">
                <button
                  type="button"
                  className="btn-quick-select"
                  onClick={handleSelectAll}
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  className="btn-quick-select"
                  onClick={handleDeselectAll}
                >
                  전체 해제
                </button>
              </div>
            </div>

            <div className="publish-batch-tree-wrapper">
              {(activeBook?.chapters || []).map((chap, cIdx) => {
                const chapSections = chap.sections || [];
                const chapSelectedCount = chapSections.filter(s => selectedPublishSectionIds.has(s.id)).length;
                const isAllChapSelected = chapSections.length > 0 && chapSelectedCount === chapSections.length;

                return (
                  <div key={chap.id} className="publish-batch-chap-group">
                    <div className="publish-batch-chap-header">
                      <div className="chap-info-left">
                        <span className="chap-label-badge">제{cIdx + 1}장</span>
                        <strong className="chap-title-text">{cleanTitle(chap.title)}</strong>
                        <span className="chap-count-badge">
                          {chapSelectedCount}/{chapSections.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-chap-toggle-check"
                        onClick={() => handleToggleChapterSelection(chap)}
                      >
                        {isAllChapSelected ? '챕터 해제' : '챕터 전체 선택'}
                      </button>
                    </div>

                    <div className="publish-batch-sec-list">
                      {chapSections.length === 0 ? (
                        <div className="batch-empty-row">소목차가 없습니다.</div>
                      ) : (
                        chapSections.map((sec, sIdx) => {
                          const isChecked = selectedPublishSectionIds.has(sec.id);
                          const isOriginallyPublished = sec.status === 'published';

                          return (
                            <label
                              key={sec.id}
                              className={`publish-batch-sec-row ${isChecked ? 'is-checked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                className="publish-batch-sec-checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedPublishSectionIds);
                                  if (e.target.checked) next.add(sec.id);
                                  else next.delete(sec.id);
                                  setSelectedPublishSectionIds(next);
                                }}
                              />
                              <div className="publish-batch-sec-main">
                                <span className="sec-num">{cIdx + 1}.{sIdx + 1}</span>
                                <span className="sec-title">{cleanTitle(sec.title)}</span>
                              </div>
                              <div className="publish-batch-sec-meta">
                                <span className="sec-words">{(sec.wordCount || 0).toLocaleString()}자</span>
                                <span className={`sec-status-badge ${isOriginallyPublished ? 'pub' : 'draft'}`}>
                                  {isOriginallyPublished ? '발행중' : '초고'}
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="modal-footer publish-unified-footer">
          <div className="publish-footer-stat">
            선택된 회차: <strong>{selectedPublishSectionIds.size}</strong> / {allSections.length}개
          </div>
          <div className="publish-footer-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              닫기
            </button>
            <button
              type="button"
              className="btn btn-primary btn-save-batch"
              onClick={async () => {
                await updateBatchPublishSections(Array.from(selectedPublishSectionIds));
                onClose();
              }}
            >
              <CheckSquare size={15} />
              <span>선택한 {selectedPublishSectionIds.size}개 회차 일괄 발행 저장</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
