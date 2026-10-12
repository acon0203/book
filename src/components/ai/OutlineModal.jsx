import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle } from 'lucide-react';
import bestsellerDb from '../../data/bestseller-db.json';
import { bookService } from '../../services/bookService';
import { storageService } from '../../services/storageService';
import './OutlineModal.css';

export default function OutlineModal({
  isOpen,
  onClose,
  activeBook,
  openBook,
  loadBooks,
  setView,
  showToast,
  showActionToast
}) {
  const [selectedGenre, setSelectedGenre] = useState('essay');
  const [chapterCount, setChapterCount] = useState('4');
  const [customChapterCount, setCustomChapterCount] = useState(4);
  const [sectionsPerChapter, setSectionsPerChapter] = useState('10');
  const [customSectionCount, setCustomSectionCount] = useState(10);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [isOutlineSubmitting, setIsOutlineSubmitting] = useState(false);
  const [outlineError, setOutlineError] = useState(null);

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

  // 목차 기획 제출 핸들러
  const handleGenerateOutline = async (e) => {
    e.preventDefault();

    // API 키 등록 여부 확인: 미등록 시 액션 토스트로 설정 이동 안내
    const cfg = storageService.getConfig();
    if (!cfg.geminiApiKey || !cfg.geminiApiKey.trim()) {
      showActionToast(
        'AI 목차 생성을 위해 Google 무료 API 키가 필요합니다. 설정으로 이동하시겠습니까?',
        () => {
          onClose();
          setView('settings');
        },
        () => {},
        { yesText: '설정으로 이동', noText: '취소' }
      );
      return;
    }

    try {
      setIsOutlineSubmitting(true);
      setOutlineError(null);
      showToast('AI가 목차를 기획 중입니다...', 'info');
      const effChapters = chapterCount === 'custom' ? (parseInt(customChapterCount, 10) || 5) : parseInt(chapterCount, 10);
      const effSections = sectionsPerChapter === 'custom' ? (parseInt(customSectionCount, 10) || 5) : parseInt(sectionsPerChapter, 10);

      const genreData = selectedGenre && bestsellerDb.genres[selectedGenre];
      const combinedPrompt = [
        genreData?.promptTip,
        extraPrompt.trim()
      ].filter(Boolean).join('\n\n[추가 요구사항]: ');

      await bookService.generateOutline({
        bookId: activeBook.id,
        title: activeBook.title,
        subtitle: activeBook.subtitle || '',
        targetAudience: activeBook.targetAudience || '',
        genre: activeBook.genre || (genreData ? genreData.name : ''),
        chapterCount: effChapters,
        sectionsPerChapter: effSections,
        extraPrompt: combinedPrompt
      });
      await openBook(activeBook.id);
      await loadBooks();
      showToast('목차 설계 완료!', 'success');
      onClose();
    } catch (err) {
      if (err.isFixedModelFailure) {
        setOutlineError({
          message: err.message,
          fixedModelName: err.fixedModelName || '선택한 AI 모델',
          isFixed: true
        });
        showActionToast(
          `선택하신 [${err.fixedModelName}] 모델 호출에 실패했습니다. 설정으로 이동하여 안정적인 모델(Gemini 3.5 Flash Lite)로 변경하시겠습니까?`,
          () => {
            onClose();
            setView('settings');
          },
          () => {},
          { yesText: '설정으로 이동', noText: '취소' }
        );
      } else {
        setOutlineError({
          message: err.message,
          isFixed: false
        });
        showToast(`기획 실패: ${err.message}`, 'error');
      }
    } finally {
      setIsOutlineSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🤖 AI 목차 자동 기획</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleGenerateOutline}>
          <div className="modal-body">
            <div className="form-group">
              <label>도서 제목</label>
              <input type="text" className="form-control" value={activeBook?.title || ''} disabled />
            </div>

            {/* 베스트셀러 장르 템플릿 선택 칩 */}
            <div className="form-group" style={{ marginBottom: '1.1rem' }}>
              <label className="outline-genre-header">
                <span>📚 베스트셀러 표준 규격 템플릿 (25권 표본 DB)</span>
                {selectedGenre && bestsellerDb.genres[selectedGenre] && (
                  <span className="outline-genre-badge">
                    {bestsellerDb.genres[selectedGenre].standards.chapters}장 × {bestsellerDb.genres[selectedGenre].standards.sectionsPerChapter}꼭지 표준
                  </span>
                )}
              </label>
              <div className="outline-genre-grid">
                {Object.values(bestsellerDb.genres).map((g) => {
                  const isSelected = selectedGenre === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`outline-genre-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedGenre(g.id);
                        setChapterCount(String(g.standards.chapters));
                        setCustomChapterCount(g.standards.chapters);
                        setSectionsPerChapter(String(g.standards.sectionsPerChapter));
                        setCustomSectionCount(g.standards.sectionsPerChapter);
                      }}
                    >
                      <span className="outline-genre-icon">{g.icon}</span>
                      <span className="outline-genre-name">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="outline-counts-row">
              <div className="form-group">
                <label>챕터 수</label>
                <select
                  className="form-control"
                  value={chapterCount}
                  onChange={(e) => setChapterCount(e.target.value)}
                >
                  <option value="3">3장 (미니북 / 단편)</option>
                  <option value="4">4장 (기승전결 / 에세이)</option>
                  <option value="5">5장 (단행본 표준 - 추천)</option>
                  <option value="6">6장 (단계별 가이드)</option>
                  <option value="7">7장 (심층 전문서)</option>
                  <option value="custom">✏️ 직접 입력...</option>
                </select>
                {chapterCount === 'custom' && (
                  <input
                    type="number"
                    className="form-control outline-custom-input"
                    min="1"
                    max="20"
                    placeholder="챕터 수 입력 (1~20)"
                    value={customChapterCount}
                    onChange={(e) => setCustomChapterCount(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  />
                )}
              </div>
              <div className="form-group">
                <label>챕터당 소목차 수</label>
                <select
                  className="form-control"
                  value={sectionsPerChapter}
                  onChange={(e) => setSectionsPerChapter(e.target.value)}
                >
                  <option value="4">4개 (긴 호흡 / 심층 주제)</option>
                  <option value="6">6개 (균형 잡힌 구성)</option>
                  <option value="8">8개 (단행본 표준 - 추천)</option>
                  <option value="10">10개 (스피디 / 현대 트렌드)</option>
                  <option value="12">12개 (숏폼 칼럼형)</option>
                  <option value="custom">✏️ 직접 입력...</option>
                </select>
                {sectionsPerChapter === 'custom' && (
                  <input
                    type="number"
                    className="form-control outline-custom-input"
                    min="1"
                    max="20"
                    placeholder="소목차 수 입력 (1~20)"
                    value={customSectionCount}
                    onChange={(e) => setCustomSectionCount(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  />
                )}
              </div>
            </div>

            {/* 실시간 출판 분량 & DB 기반 레퍼런스 가이드 */}
            {(() => {
              const effChapters = chapterCount === 'custom' ? (parseInt(customChapterCount, 10) || 1) : parseInt(chapterCount, 10);
              const effSections = sectionsPerChapter === 'custom' ? (parseInt(customSectionCount, 10) || 1) : parseInt(sectionsPerChapter, 10);
              const total = effChapters * effSections;

              const genreInfo = selectedGenre && bestsellerDb.genres[selectedGenre];
              const avgWords = genreInfo ? genreInfo.standards.avgWordsPerSection : 2500;
              const estWords = total * avgWords;
              // 단행본 조판 기준: 본문 페이지(실질 380~420자/쪽) + 챕터 도비라/여백 + 앞뒤 부속물(약 20쪽)
              const estBookPages = Math.round((estWords / 400) + (effChapters * 2) + 20);
              const estA4Pages = Math.round(estWords / 1800);

              return (
                <div className="outline-spec-card">
                  <div className="outline-spec-main">
                    <span>📚 예상 책 분량: <strong className="outline-spec-pages-highlight">약 {estBookPages}쪽</strong> ({effChapters}장 × {effSections}꼭지 = 총 {total}꼭지)</span>
                    <span className="outline-spec-words">본문 약 {estWords.toLocaleString()}자 (A4 약 {estA4Pages}장)</span>
                  </div>
                  
                  {genreInfo && (
                    <div className="outline-spec-detail">
                      <div className="outline-spec-detail-row">
                        <span>🎯 <strong className="outline-spec-bold">{genreInfo.name} 기준</strong>: 꼭지당 약 {avgWords.toLocaleString()}자</span>
                        <span className="outline-spec-dim">{genreInfo.characteristics}</span>
                      </div>
                      <div>
                        📖 <span className="outline-spec-dim">실측 표본:</span> {genreInfo.sampleBooks.slice(0, 3).map(b => `《${b.title}》(${b.structure})`).join(', ')} 등
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="form-group">
              <label>특별 요구사항</label>
              <textarea
                className="form-control outline-prompt-textarea"
                placeholder="예: 초보자도 쉽게 따라할 수 있는 실습 위주로 설계해줘"
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
              />
            </div>

            {/* AI 모델 호출 실패 시 모달 내 직관적 에러 안내 배너 */}
            {outlineError && (
              <div className="outline-error-banner">
                <div className="outline-error-header">
                  <AlertTriangle size={18} />
                  <span>{outlineError.isFixed ? `[${outlineError.fixedModelName}] 모델 응답 실패` : '목차 기획 실패'}</span>
                </div>
                <p className="outline-error-msg">
                  {outlineError.message}
                  {outlineError.isFixed && (
                    <span className="outline-error-tip">
                      💡 구글 AI Studio에서 해당 모델이 일시 점검 중이거나 불안정한 상태입니다. 가장 빠르고 안정적인 <strong>Gemini 3.5 Flash Lite</strong> 또는 <strong>스마트 자동 전환</strong>으로 모델을 변경해 보세요.
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  className="btn btn-primary outline-error-action-btn"
                  onClick={() => {
                    onClose();
                    setView('settings');
                  }}
                >
                  <span>⚙️ 설정으로 이동하여 AI 모델 변경하기 ➔</span>
                </button>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={isOutlineSubmitting}>
              <Sparkles size={15} />
              <span>{isOutlineSubmitting ? '설계 중...' : 'AI 목차 생성'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
