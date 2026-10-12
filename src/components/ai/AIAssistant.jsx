import React, { useState, useEffect } from 'react';
import './AIAssistant.css';
import { marked } from 'marked';
import { bookService } from '../../services/bookService';
import { getActiveModelQuota } from '../../utils/quotaManager';
import {
  Zap, Wand2, Bot, Lightbulb, Copy, Check, Plus, Sparkles
} from 'lucide-react';

export default function AIAssistant({
  activeBook,
  currentChapter,
  currentSection,
  localTitle,
  localContent,
  editor,
  vault,
  selectedVaultIds,
  loadVault,
  setIsVaultModalOpen,
  setIsQuotaModalOpen,
  setLocalContent,
  updateActiveSectionContent,
  saveActiveSection,
  setView,
  showToast,
  showActionToast
}) {
  // AI 패널 탭 상태 ('draft' | 'polish')
  const [activeAiTab, setActiveAiTab] = useState('draft');

  // AI 초고 집필 에이전트 상태
  const [draftKeywords, setDraftKeywords] = useState('');
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftTone, setDraftTone] = useState('practical');
  const [draftLength, setDraftLength] = useState('standard');
  const [includeVaultInDraft, setIncludeVaultInDraft] = useState(true);
  const [draftOutput, setDraftOutput] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  // AI 문장 교정 스튜디오 상태
  const [polishInput, setPolishInput] = useState('');
  const [polishPreset, setPolishPreset] = useState('expand');
  const [customInstruction, setCustomInstruction] = useState('');
  const [polishOutput, setPolishOutput] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);

  // 실시간 AI 쿼터 상태 및 리스너
  const [activeQuota, setActiveQuota] = useState(() => getActiveModelQuota());

  useEffect(() => {
    const handleQuotaUpdate = () => {
      setActiveQuota(getActiveModelQuota());
    };
    window.addEventListener('ai_quota_updated', handleQuotaUpdate);
    return () => window.removeEventListener('ai_quota_updated', handleQuotaUpdate);
  }, []);

  // AI 초고 집필 에이전트 실행
  const handleRunDraftAgent = async () => {
    if (!currentSection) {
      showToast('작성할 목차(섹션)를 먼저 선택해주세요.', 'error');
      return;
    }
    try {
      setIsDrafting(true);
      showToast('🤖 AI 에이전트가 초고를 집필하고 있습니다...', 'info');

      const referenceNotes = includeVaultInDraft
        ? vault
            .filter(v => selectedVaultIds.includes(v.id))
            .map(v => `[자료 금고: ${v.title}]\n${v.content}`)
            .join('\n\n')
        : '';

      const result = await bookService.generateSection({
        bookTitle: activeBook?.title || '',
        bookSubtitle: activeBook?.subtitle || '',
        chapterTitle: currentChapter?.title || '',
        sectionTitle: localTitle || currentSection.title,
        keywords: draftKeywords.trim(),
        instruction: draftInstruction.trim(),
        tone: draftTone,
        targetLength: draftLength,
        existingContent: editor?.getText() || localContent,
        referenceNotes,
        targetAudience: activeBook?.targetAudience || '',
        genre: activeBook?.genre || ''
      });

      setDraftOutput(result.content);
      showToast('✨ 초고 집필이 완료되었습니다! 아래에서 본문 반영 방식을 선택하세요.', 'success');
    } catch (err) {
      if (err.isFixedModelFailure) {
        showActionToast(
          `선택하신 [${err.fixedModelName}] 모델 호출 실패: ${err.message}. 설정으로 이동하여 모델을 변경하시겠습니까?`,
          () => setView('settings'),
          () => {},
          { yesText: '설정으로 이동', noText: '취소' }
        );
      } else {
        showToast(`집필 실패: ${err.message}`, 'error');
      }
    } finally {
      setIsDrafting(false);
    }
  };

  // 초고 본문 전체 덮어쓰기
  const handleApplyDraftReplace = async () => {
    if (!draftOutput.trim() || !editor) return;
    const parsedHtml = marked.parse(draftOutput);
    editor.commands.setContent(parsedHtml);
    const updatedHtml = editor.getHTML();
    setLocalContent(updatedHtml);
    updateActiveSectionContent(updatedHtml);
    if (saveActiveSection) await saveActiveSection();
    showToast('초고가 본문에 전체 반영되었습니다.', 'success');
  };

  // 초고 현재 본문 끝에 이어쓰기
  const handleApplyDraftAppend = async () => {
    if (!draftOutput.trim() || !editor) return;
    const parsedHtml = marked.parse(draftOutput);
    if (editor.isEmpty) {
      editor.commands.setContent(parsedHtml);
    } else {
      editor.commands.insertContent(`<br><br>${parsedHtml}`);
    }
    const updatedHtml = editor.getHTML();
    setLocalContent(updatedHtml);
    updateActiveSectionContent(updatedHtml);
    if (saveActiveSection) await saveActiveSection();
    showToast('초고가 본문 끝에 이어서 추가되었습니다.', 'success');
  };

  // AI 교정 실행
  const handleRunPolish = async () => {
    if (!polishInput.trim()) {
      showToast('교정할 문장을 입력하거나 본문에서 선택하세요.', 'error');
      return;
    }
    try {
      setIsPolishing(true);
      const res = await bookService.polishContent({
        originalText: polishInput,
        preset: polishPreset,
        customInstruction: customInstruction.trim()
      });
      setPolishOutput(res.polishedText);
      showToast('AI 교정 완료!', 'success');
    } catch (err) {
      if (err.isFixedModelFailure) {
        showActionToast(
          `선택하신 [${err.fixedModelName}] 모델 호출 실패: ${err.message}. 설정으로 이동하여 모델을 변경하시겠습니까?`,
          () => setView('settings'),
          () => {},
          { yesText: '설정으로 이동', noText: '취소' }
        );
      } else {
        showToast(`교정 실패: ${err.message}`, 'error');
      }
    } finally {
      setIsPolishing(false);
    }
  };

  // 교정문 본문 반영
  const handleApplyPolish = () => {
    if (!polishOutput.trim() || !editor) return;
    const formattedHtml = marked.parse(polishOutput).trim();
    editor.chain().focus().insertContent(formattedHtml).run();
    const updatedHtml = editor.getHTML();
    setLocalContent(updatedHtml);
    updateActiveSectionContent(updatedHtml);
    showToast('본문에 반영되었습니다.', 'success');
  };

  return (
    <aside className="ai-polish-pane">
      {/* 상단 듀얼 탭 */}
      <div className="ai-tabs-container">
        <button
          type="button"
          className={`ai-tab-btn ${activeAiTab === 'draft' ? 'active' : ''}`}
          onClick={() => setActiveAiTab('draft')}
        >
          <Zap size={14} />
          <span>AI 초고 집필</span>
        </button>
        <button
          type="button"
          className={`ai-tab-btn ${activeAiTab === 'polish' ? 'active' : ''}`}
          onClick={() => setActiveAiTab('polish')}
        >
          <Wand2 size={14} />
          <span>AI 문장 교정</span>
        </button>
      </div>

      {/* 스크롤 가능한 AI 본문 영역 */}
      <div className="ai-pane-scrollable-body">
        {activeAiTab === 'draft' ? (
          /* --- 1. AI 초고 집필 에이전트 뷰 --- */
          <div className="draft-agent-view">
            <div className="polish-header">
              <div className="polish-header-title">
                <Bot size={16} color="var(--primary)" />
                <span>AI 초고 집필 에이전트</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-vault-link-ai"
                onClick={() => { loadVault(); setIsVaultModalOpen(true); }}
                title="창작실 소재 연동: 아이디어 메모, 캐릭터 설정, 복선 레퍼런스 열람 및 AI 반영"
              >
                <Lightbulb size={14} style={{ color: 'var(--primary)' }} />
                <span>창작실 연동 ({selectedVaultIds?.length || 0})</span>
              </button>
            </div>

            {/* 1. 핵심 키워드 & 소재 */}
            <div className="polish-card">
              <div className="polish-card-header">
                <span className="polish-card-title">🔑 핵심 키워드 & 소재</span>
              </div>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.82rem' }}
                placeholder="예: 사모펀드 실사, 숨은 부채, 현장 체크리스트"
                value={draftKeywords}
                onChange={(e) => setDraftKeywords(e.target.value)}
              />
              <div className="draft-quick-tags">
                {['실제 현장 일화', '핵심 체크리스트', '자주 묻는 Q&A', '주의할 실수 3가지', '실전 노하우'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="draft-quick-tag"
                    onClick={() => {
                      setDraftKeywords((prev) => prev ? `${prev}, ${tag}` : tag);
                    }}
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 작가 지시어 (Prompt/명령어) */}
            <div className="polish-card">
              <div className="polish-card-header">
                <span className="polish-card-title">⚡ 작가 지시어 (명령어)</span>
              </div>
              <textarea
                className="polish-textarea"
                style={{ minHeight: '65px' }}
                placeholder="원하는 방향을 지시하세요 (예: 초보 투자자도 이해하기 쉽게 생생한 스토리로 풀고, 마지막엔 실전 요약을 정리해줘)"
                value={draftInstruction}
                onChange={(e) => setDraftInstruction(e.target.value)}
              />
              <div className="draft-prompt-presets">
                {[
                  { label: '💡 생생한 사례 중심', text: '실제 현장 일화나 생생한 사례를 흥미진진하게 풀어내어 독자의 몰입도를 높여줘.' },
                  { label: '📋 실전 체크리스트', text: '독자가 실무에 바로 써먹을 수 있는 구체적인 체크리스트와 액션 플랜을 포함해줘.' },
                  { label: '❓ Q&A 문답형', text: '독자들이 가장 궁금해하는 핵심 질문 3가지를 던지고 명쾌하게 해답을 제시해줘.' },
                  { label: '🎯 3단계 로드맵', text: '초보자도 차근차근 따라갈 수 있는 직관적인 3단계 실행 가이드를 제시해줘.' }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="draft-prompt-chip"
                    onClick={() => setDraftInstruction(preset.text)}
                    title={preset.text}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 집필 톤 & 분량 설정 */}
            <div className="polish-card">
              <span className="polish-card-title">🎨 집필 톤 & 분량 설정</span>
              <div className="agent-option-row">
                <span className="option-label">어조</span>
                <div className="preset-chips">
                  {[
                    { id: 'practical', label: '🛠️ 실전가이드' },
                    { id: 'story', label: '📖 스토리텔링' },
                    { id: 'friendly', label: '💬 친근한대화' },
                    { id: 'academic', label: '🎓 전문해설' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`preset-chip ${draftTone === t.id ? 'active' : ''}`}
                      onClick={() => setDraftTone(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="agent-option-row">
                <span className="option-label">분량</span>
                <div className="preset-chips">
                  {[
                    { id: 'compact', label: '⚡ 간결 (800자)' },
                    { id: 'standard', label: '📄 표준 (1,500자)' },
                    { id: 'deep', label: '📚 상세 (2,500자)' }
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`preset-chip ${draftLength === l.id ? 'active' : ''}`}
                      onClick={() => setDraftLength(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 자료 금고 연동 옵션 */}
              {selectedVaultIds?.length > 0 && (
                <label className="draft-vault-toggle">
                  <input
                    type="checkbox"
                    checked={includeVaultInDraft}
                    onChange={(e) => setIncludeVaultInDraft(e.target.checked)}
                  />
                  <span>선택된 자료 금고 메모 ({selectedVaultIds.length}건) 참조</span>
                </label>
              )}
            </div>

            {/* AI 초고 작성 시작 독립 실행 버튼 */}
            <button
              type="button"
              className="btn btn-primary btn-draft-run-btn"
              onClick={handleRunDraftAgent}
              disabled={isDrafting}
            >
              <Zap size={15} />
              <span>{isDrafting ? '초고 에이전트 집필 중...' : '⚡ AI 초고 작성 시작'}</span>
            </button>

            {/* 4. 생성된 초고 결과 */}
            {draftOutput && (
              <div className="polish-card draft-result-card">
                <div className="polish-card-header">
                  <span className="polish-card-title" style={{ color: 'var(--primary)' }}>
                    📝 생성된 초고 ({draftOutput.length.toLocaleString()} 자)
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(draftOutput);
                      showToast('클립보드에 복사되었습니다.', 'info');
                    }}
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <textarea
                  className="polish-textarea draft-output-area"
                  value={draftOutput}
                  onChange={(e) => setDraftOutput(e.target.value)}
                />
                <div className="draft-apply-actions">
                  <button
                    type="button"
                    className="btn-apply-polish"
                    onClick={handleApplyDraftReplace}
                    title="에디터 내용을 이 초고로 완전히 교체합니다"
                  >
                    <Check size={14} />
                    <span>본문 전체 반영 (덮어쓰기)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleApplyDraftAppend}
                    style={{ width: '100%', justifyContent: 'center' }}
                    title="기존 본문 끝에 이어서 추가합니다"
                  >
                    <Plus size={14} />
                    <span>본문 끝에 이어쓰기</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* --- 2. AI 문장 교정 스튜디오 뷰 --- */
          <div className="polish-agent-view">
            <div className="polish-header">
              <div className="polish-header-title">
                <Wand2 size={16} color="var(--primary)" />
                <span>AI 문장 교정 스튜디오</span>
              </div>
              <span className="polish-header-sub">본문 드래그 후 '선택 가져오기'를 누르세요.</span>
            </div>

            <div className="polish-card">
              <div className="polish-card-header">
                <span className="polish-card-title">📎 수정 전 원문</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!editor) return;
                    const { from, to } = editor.state.selection;
                    const selectedText = editor.state.doc.textBetween(from, to, ' ');
                    if (selectedText.trim()) {
                      setPolishInput(selectedText.trim());
                      showToast('선택한 문장을 가져왔습니다.', 'info');
                    } else if (!editor.isEmpty) {
                      setPolishInput(editor.getText().trim());
                      showToast('전체 문장을 가져왔습니다.', 'info');
                    } else {
                      showToast('본문에서 문장을 드래그하여 선택하세요.', 'info');
                    }
                  }}
                >
                  선택 가져오기
                </button>
              </div>
              <textarea
                className="polish-textarea"
                placeholder="교정할 문장을 입력하세요..."
                value={polishInput}
                onChange={(e) => setPolishInput(e.target.value)}
              />
            </div>

            <div className="polish-card">
              <span className="polish-card-title">💡 교정 스타일</span>
              <div className="preset-chips">
                {[
                  { id: 'expand', label: '🌱 풍부하게' },
                  { id: 'clear', label: '✨ 윤문/다듬기' },
                  { id: 'grammar', label: '🔍 맞춤법 교정' },
                  { id: 'concise', label: '✂️ 핵심만 명료하게' },
                  { id: 'friendly', label: '💬 친근한 대화체' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`preset-chip ${polishPreset === p.id ? 'active' : ''}`}
                    onClick={() => setPolishPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="form-control"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                placeholder="추가 지침 (예: 초보자 눈높이로)"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleRunPolish} disabled={isPolishing} style={{ width: '100%' }}>
                <Sparkles size={14} />
                <span>{isPolishing ? '교정 중...' : 'AI 문장 교정 실행'}</span>
              </button>
            </div>

            <div className="polish-card">
              <div className="polish-card-header">
                <span className="polish-card-title" style={{ color: 'var(--primary)' }}>📝 수정 후 결과</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(polishOutput);
                    showToast('클립보드에 복사되었습니다.', 'info');
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>
              <textarea
                className="polish-textarea"
                placeholder="AI 교정 결과가 여기에 표시됩니다."
                value={polishOutput}
                onChange={(e) => setPolishOutput(e.target.value)}
              />
              <button type="button" className="btn-apply-polish" onClick={handleApplyPolish}>
                <Check size={14} />
                <span>본문에 즉시 반영하기</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 패널 최하단: 고정 푸터 (선택된 모델의 실시간 잔여량 버튼) */}
      <div className="ai-quota-pane-footer">
        <button
          type="button"
          className="btn-quota-status-pill"
          onClick={() => setIsQuotaModalOpen(true)}
          title="클릭하여 AI 모델별 일일 잔여 한도 상세 확인"
        >
          <div className="quota-pill-left">
            <Zap size={13} className="quota-pill-icon" />
            <span className="quota-pill-name">{activeQuota?.name || 'Gemini'}</span>
          </div>
          <div className="quota-pill-right">
            <span className={`quota-pill-pct ${Number(activeQuota?.remainingPct) <= 20 ? 'urgent' : ''}`}>
              {activeQuota?.isExhausted ? '0%' : `${Math.round(Number(activeQuota?.remainingPct || 100))}%`}
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
}
