import React, { useState } from 'react';
import './AuthorPersonaModal.css';
import { X, Plus, Trash2, Check, FileText, Sparkles, AlertCircle, Info } from 'lucide-react';

const PRESET_STYLE_CHIPS = [
  '간결한 단문 중심',
  '호흡이 긴 서정적 만연체',
  '속도감 있는 대화체',
  '건조하고 사실적인 묘사',
  '비유와 상징 적극 활용',
  '감정 절제와 객관적 관찰',
  '직설적이고 명확한 전달',
  '감각적 오감 묘사'
];

const PRESET_TABOOS = [
  '번역투 배제 (~에 관하여, ~에 의해, ~적)',
  '인위적 접속사 남발 금지 (하지만, 그러나, 한편)',
  '인터넷 유행어 및 신조어 금지',
  '직접적인 감정 형용 배제 (슬펐다, 기뻤다 등)',
  '일본식 조사 표현 배제 (~의, ~에 있어)',
  '진부한 상투어구 배제'
];

export default function AuthorPersonaModal({ isOpen, onClose, initialData, onSave }) {
  if (!isOpen) return null;

  // 1. 문체 샘플 상태 (최대 5편)
  const [samples, setSamples] = useState(() => {
    if (initialData?.samples && initialData.samples.length > 0) {
      return initialData.samples;
    }
    return [
      {
        id: 'sample_1',
        title: '대표 문체 샘플 1',
        content: ''
      }
    ];
  });
  const [activeSampleTab, setActiveSampleTab] = useState(0);

  // 2. 문체 칩 상태
  const [selectedChips, setSelectedChips] = useState(() => initialData?.styleChips || []);
  const [customChipInput, setCustomChipInput] = useState('');

  // 3. 금기어 상태
  const [selectedTaboos, setSelectedTaboos] = useState(() => initialData?.taboos || []);
  const [customTabooInput, setCustomTabooInput] = useState('');

  // 4. 추가 작가 지침
  const [customInstructions, setCustomInstructions] = useState(initialData?.customInstructions || '');

  // 5. 검증 에러
  const [errorMsg, setErrorMsg] = useState('');

  // 샘플 추가
  const handleAddSample = () => {
    if (samples.length >= 5) {
      setErrorMsg('문체 샘플은 최대 5편까지 등록할 수 있습니다.');
      return;
    }
    const newIdx = samples.length + 1;
    const newSample = {
      id: `sample_${Date.now()}`,
      title: `대표 문체 샘플 ${newIdx}`,
      content: ''
    };
    setSamples([...samples, newSample]);
    setActiveSampleTab(samples.length);
    setErrorMsg('');
  };

  // 샘플 삭제
  const handleRemoveSample = (idx, e) => {
    e.stopPropagation();
    if (samples.length <= 1) {
      setErrorMsg('최소 1편 이상의 문체 샘플이 필요합니다.');
      return;
    }
    const updated = samples.filter((_, i) => i !== idx);
    setSamples(updated);
    if (activeSampleTab >= updated.length) {
      setActiveSampleTab(Math.max(0, updated.length - 1));
    }
    setErrorMsg('');
  };

  // 현재 샘플 내용 변경
  const handleSampleChange = (field, value) => {
    setSamples(prev => prev.map((s, idx) => {
      if (idx === activeSampleTab) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  // 문체 칩 토글
  const handleToggleChip = (chip) => {
    if (selectedChips.includes(chip)) {
      setSelectedChips(selectedChips.filter(c => c !== chip));
    } else {
      setSelectedChips([...selectedChips, chip]);
    }
  };

  // 직접 문체 칩 추가
  const handleAddCustomChip = (e) => {
    e.preventDefault();
    const trimmed = customChipInput.trim();
    if (!trimmed) return;
    if (!selectedChips.includes(trimmed)) {
      setSelectedChips([...selectedChips, trimmed]);
    }
    setCustomChipInput('');
  };

  // 금기어 토글
  const handleToggleTaboo = (taboo) => {
    if (selectedTaboos.includes(taboo)) {
      setSelectedTaboos(selectedTaboos.filter(t => t !== taboo));
    } else {
      setSelectedTaboos([...selectedTaboos, taboo]);
    }
  };

  // 직접 금기어 추가
  const handleAddCustomTaboo = (e) => {
    e.preventDefault();
    const trimmed = customTabooInput.trim();
    if (!trimmed) return;
    if (!selectedTaboos.includes(trimmed)) {
      setSelectedTaboos([...selectedTaboos, trimmed]);
    }
    setCustomTabooInput('');
  };

  // 최종 저장
  const handleSubmit = (e) => {
    e.preventDefault();
    // 빈 샘플 제외
    const validSamples = samples.filter(s => s.content && s.content.trim().length > 0);
    if (validSamples.length === 0) {
      setErrorMsg('최소 1편 이상의 문체 샘플 본문을 입력해 주세요. (단락 100자 이상 권장)');
      return;
    }

    const personaData = {
      id: 'author_default',
      name: '나의 작가 페르소나',
      updatedAt: new Date().toISOString(),
      samples: validSamples,
      styleChips: selectedChips,
      taboos: selectedTaboos,
      customInstructions: customInstructions.trim()
    };

    onSave(personaData);
    onClose();
  };

  const currentSample = samples[activeSampleTab] || samples[0];

  return (
    <div className="author-persona-overlay" onClick={onClose}>
      <div className="author-persona-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="author-persona-modal-header">
          <div className="modal-title-group">
            <Sparkles size={18} className="modal-title-icon" />
            <div>
              <h3>작가 문체 페르소나 설정</h3>
              <p>작품과 무관한 나만의 고유한 문체 습관과 문장 호흡을 정의합니다.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </div>

        {/* 바디 스크롤 영역 */}
        <div className="author-persona-modal-body">
          {/* 가이드 안내 배너 */}
          <div className="persona-info-banner">
            <Info size={15} className="banner-icon" />
            <div className="banner-text">
              <strong>시점(1인칭/3인칭)은 여기서 설정하지 않습니다.</strong>
              <p>시점은 작품마다 달라지므로 창작실(Step 3)에서 책별로 지정합니다. 여기서는 작가님의 순수한 '손버릇과 문장 리듬, 금기어'만 등록해 주세요.</p>
            </div>
          </div>

          {errorMsg && (
            <div className="persona-error-banner">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ==============================================================
              섹션 1: 문체 샘플 (핵심 Few-shot: 3~5편 권장)
              ============================================================== */}
          <div className="persona-section-card">
            <div className="section-title-row">
              <div className="section-title-left">
                <FileText size={16} className="section-icon" />
                <h4>문체 샘플 등록 (핵심: 3~5편 권장)</h4>
              </div>
              <span className="section-badge">{samples.length} / 5편</span>
            </div>
            <p className="section-desc">
              평소 직접 쓰신 글 중 가장 마음에 드는 단락(300~500자 내외)을 붙여넣으세요. AI가 문장의 길이, 호흡, 어휘의 결을 직접 학습합니다.
            </p>

            {/* 샘플 탭 바 */}
            <div className="sample-tab-bar">
              {samples.map((s, idx) => (
                <div 
                  key={s.id || idx}
                  className={`sample-tab-item ${activeSampleTab === idx ? 'active' : ''}`}
                  onClick={() => setActiveSampleTab(idx)}
                >
                  <span className="sample-tab-title">{s.title || `샘플 ${idx + 1}`}</span>
                  {samples.length > 1 && (
                    <button 
                      type="button" 
                      className="sample-tab-remove" 
                      onClick={(e) => handleRemoveSample(idx, e)}
                      title="샘플 삭제"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {samples.length < 5 && (
                <button 
                  type="button" 
                  className="btn-add-sample-tab" 
                  onClick={handleAddSample}
                  title="새 샘플 추가"
                >
                  <Plus size={13} />
                  <span>샘플 추가</span>
                </button>
              )}
            </div>

            {/* 활성 샘플 입력 폼 */}
            {currentSample && (
              <div className="sample-editor-box">
                <div className="sample-input-row">
                  <label>샘플 제목</label>
                  <input 
                    type="text"
                    className="persona-input-text"
                    placeholder="예: 비 오는 날의 골목길, 서재에서의 사색 등"
                    value={currentSample.title || ''}
                    onChange={(e) => handleSampleChange('title', e.target.value)}
                  />
                </div>
                <div className="sample-input-row">
                  <div className="sample-textarea-label-row">
                    <label>샘플 본문 (300~500자 권장)</label>
                    <span className="sample-char-count">{(currentSample.content || '').length}자</span>
                  </div>
                  <textarea 
                    className="persona-textarea"
                    rows={6}
                    placeholder="작가님의 대표적인 문장이나 평소 글쓰기 스타일이 잘 드러난 단락을 그대로 붙여넣으세요..."
                    value={currentSample.content || ''}
                    onChange={(e) => handleSampleChange('content', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ==============================================================
              섹션 2: 문체 스타일 칩 (다중 선택 + 직접 입력)
              ============================================================== */}
          <div className="persona-section-card">
            <div className="section-title-row">
              <div className="section-title-left">
                <Sparkles size={16} className="section-icon" />
                <h4>문체 스타일 칩 (복수 선택)</h4>
              </div>
              <span className="section-badge">{selectedChips.length}개 선택됨</span>
            </div>
            <p className="section-desc">
              나의 글쓰기 스타일에 부합하는 키워드를 선택하거나 직접 추가하세요.
            </p>

            <div className="persona-chip-cloud">
              {PRESET_STYLE_CHIPS.map((chip) => {
                const isSelected = selectedChips.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    className={`persona-chip-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleChip(chip)}
                  >
                    {isSelected && <Check size={12} className="chip-check-icon" />}
                    <span>{chip}</span>
                  </button>
                );
              })}
              {selectedChips
                .filter(c => !PRESET_STYLE_CHIPS.includes(c))
                .map((customChip) => (
                  <button
                    key={customChip}
                    type="button"
                    className="persona-chip-btn selected custom"
                    onClick={() => handleToggleChip(customChip)}
                  >
                    <Check size={12} className="chip-check-icon" />
                    <span>{customChip}</span>
                    <X size={11} className="chip-del-icon" />
                  </button>
                ))}
            </div>

            <div className="persona-custom-input-group">
              <input 
                type="text"
                className="persona-input-text-sm"
                placeholder="직접 문체 스타일 추가 (예: 서늘한 긴장감, 위트 있는 호흡)"
                value={customChipInput}
                onChange={(e) => setCustomChipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomChip(e);
                  }
                }}
              />
              <button 
                type="button" 
                className="btn-add-custom-tag"
                onClick={handleAddCustomChip}
              >
                <Plus size={13} />
                <span>추가</span>
              </button>
            </div>
          </div>

          {/* ==============================================================
              섹션 3: 금기어 & 지양 표현 태그 (다중 선택 + 직접 입력)
              ============================================================== */}
          <div className="persona-section-card">
            <div className="section-title-row">
              <div className="section-title-left">
                <AlertCircle size={16} className="section-icon text-danger" />
                <h4>금기어 및 지양 규칙 (복수 선택)</h4>
              </div>
              <span className="section-badge danger">{selectedTaboos.length}개 적용</span>
            </div>
            <p className="section-desc">
              AI가 문장을 집필할 때 절대 쓰지 말아야 할 어휘나 상투적인 습관을 지정합니다.
            </p>

            <div className="persona-chip-cloud">
              {PRESET_TABOOS.map((taboo) => {
                const isSelected = selectedTaboos.includes(taboo);
                return (
                  <button
                    key={taboo}
                    type="button"
                    className={`persona-chip-btn taboo ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleTaboo(taboo)}
                  >
                    {isSelected && <Check size={12} className="chip-check-icon" />}
                    <span>{taboo}</span>
                  </button>
                );
              })}
              {selectedTaboos
                .filter(t => !PRESET_TABOOS.includes(t))
                .map((customTaboo) => (
                  <button
                    key={customTaboo}
                    type="button"
                    className="persona-chip-btn taboo selected custom"
                    onClick={() => handleToggleTaboo(customTaboo)}
                  >
                    <Check size={12} className="chip-check-icon" />
                    <span>{customTaboo}</span>
                    <X size={11} className="chip-del-icon" />
                  </button>
                ))}
            </div>

            <div className="persona-custom-input-group">
              <input 
                type="text"
                className="persona-input-text-sm"
                placeholder="직접 금기어 추가 (예: '정말로', '매우', 구어체 의성어 금지 등)"
                value={customTabooInput}
                onChange={(e) => setCustomTabooInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTaboo(e);
                  }
                }}
              />
              <button 
                type="button" 
                className="btn-add-custom-tag"
                onClick={handleAddCustomTaboo}
              >
                <Plus size={13} />
                <span>추가</span>
              </button>
            </div>
          </div>

          {/* ==============================================================
              섹션 4: 작가 고유 집필 메모 / 지침 (선택 사항)
              ============================================================== */}
          <div className="persona-section-card">
            <div className="section-title-row">
              <div className="section-title-left">
                <FileText size={16} className="section-icon" />
                <h4>나만의 추가 집필 지침 (선택 사항)</h4>
              </div>
            </div>
            <p className="section-desc">
              문단 길이, 쉼표 사용 빈도 등 작가님만의 고유한 집필 철학을 한 줄로 남겨두세요.
            </p>
            <input 
              type="text"
              className="persona-input-text"
              placeholder="예: 한 문단은 최대 3문장을 넘기지 않는다. 대사 전후에 불필요한 설명 지문을 붙이지 않는다."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="author-persona-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            <span>페르소나 설정 저장</span>
          </button>
        </div>
      </div>
    </div>
  );
}
