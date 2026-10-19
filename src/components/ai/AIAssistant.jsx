import React, { useState, useEffect, useRef, useMemo } from 'react';
import './AIAssistant.css';
import { marked } from 'marked';
import { bookService } from '../../services/bookService';
import { getActiveModelQuota } from '../../utils/quotaManager';
import {
  Zap, Bot, Lightbulb, Copy, Check, RotateCcw, Clock, Send, Sparkles, X, ChevronRight, Bookmark, Layers
} from 'lucide-react';

const V5_TONE_DATA = {
  guide: {
    title: '가이드형 어조',
    desc: '명확한 행동 지침과 실천적 솔루션을 단계별로 제시하는 실용적인 문체입니다.',
    quote: '"첫 단추를 꿸 때는 세 가지만 기억하자. 첫째, 불필요한 수식어를 걷어낼 것. 둘째, 독자의 질문에 바로 답할 것."'
  },
  story: {
    title: '스토리텔링 어조',
    desc: '감각적인 정경 묘사와 서사적 흐름을 살려 장면과 감정을 생생하게 그리는 문체입니다.',
    quote: '"밤 열한 시가 넘으면 오직 낡은 책상만이 고요한 침묵을 지킨 채, 낮 동안 머금은 온기를 은은하게 내어준다."'
  },
  talk: {
    title: '대화형 어조',
    desc: '독자에게 말을 건네듯 친근하고 생생한 호흡으로 몰입감을 주는 구어체 중심 문체입니다.',
    quote: '"솔직히 말해볼게요. 처음 빈 화면을 마주했을 때 도망치고 싶지 않았던 작가가 어디 있을까요?"'
  },
  explain: {
    title: '해설형 어조',
    desc: '심도 있는 분석과 전문적 배경 지식을 논리정연하게 풀어내는 지적이고 객관적인 문체입니다.',
    quote: '"본 현상은 서사 구조론에서 설명하는 고유 갈등 축에 해당하며, 후반부 카타르시스를 증폭시키는 기제다."'
  }
};

const V5_LENGTH_DATA = {
  compact: {
    title: '간결 분량',
    desc: '약 600자 ~ 900자 (200자 원고지 3 ~ 4.5매 내외)',
    quote: '핵심 메시지와 전달 포인트만 압축하여 독자가 단숨에 읽어 내려갈 수 있는 요약형 분량입니다.'
  },
  standard: {
    title: '표준 분량',
    desc: '약 1,300자 ~ 1,800자 (200자 원고지 6.5 ~ 9매 내외)',
    quote: '한 꼭지의 서사 전개와 감정선이 가장 안정적으로 완결되는 정규 1화 연재 권장 분량입니다.'
  },
  deep: {
    title: '상세 분량',
    desc: '약 2,200자 ~ 3,000자 (200자 원고지 11 ~ 15매 내외)',
    quote: '다각도의 묘사, 풍부한 대화와 깊이 있는 분석을 모두 담아내는 대작형 집중 분량입니다.'
  }
};

const V5_POLISH_DATA = {
  expand: {
    title: '풍부하게 스타일',
    desc: '원문의 뼈대에 오감 묘사와 섬세한 서정적 감정선을 덧입혀 장면을 입체적으로 확장합니다.',
    quote: '"창살 틈새로 스며든 비스듬한 달빛이 식어버린 찻잔 위로 푸른 그림자를 드리우고 있었다."'
  },
  clear: {
    title: '윤문/다듬기 스타일',
    desc: '원문의 핵심 의미와 서사 톤을 그대로 유지하면서 어색한 문장 구조와 조사를 매끄럽게 가다듬습니다.',
    quote: '"단단한 나무 결에 가만히 손을 얹자, 낮 동안 머금었던 미지근한 온기가 손끝을 타고 은은하게 스며들었다."'
  },
  grammar: {
    title: '맞춤법 교정 스타일',
    desc: '표준 맞춤법, 띄어쓰기, 문장 부호 규정을 철저히 검증하여 신뢰도 높은 무결점 문장으로 교정합니다.',
    quote: '"오랫동안 벼르고 벼려왔던 그 한마디를, 비로소 그의 귓가에 가만히 건넬 수 있었다."'
  },
  concise: {
    title: '명료하게 스타일',
    desc: '군더더기 수식어와 중복 표현을 과감히 걷어내고 의미를 단번에 전달하는 단단한 문장으로 정제합니다.',
    quote: '"책상을 어루만졌다. 낮의 온기가 아직 남아있었다."'
  },
  friendly: {
    title: '대화체 스타일',
    desc: '격식체를 부드러운 대화 및 독백 구어체로 전환하여 친근하고 생생한 호흡을 형성합니다.',
    quote: '"책상에 손을 얹어보니까요, 낮 동안 햇살을 잔뜩 머금었던 온기가 그대로 느껴지는 거 있죠."'
  }
};

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
  // AI 패널 탭 상태 ('draft' | 'polish' | 'chief')
  const [activeAiTab, setActiveAiTab] = useState('draft');

  // AI 초고 집필 상태
  const [draftKeywords, setDraftKeywords] = useState('');
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftTone, setDraftTone] = useState('story');
  const [draftLength, setDraftLength] = useState('standard');
  const [draftOutput, setDraftOutput] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isDraftConfirmModalOpen, setIsDraftConfirmModalOpen] = useState(false);

  // AI 문장 교정 상태
  const [polishInput, setPolishInput] = useState('');
  const [polishPreset, setPolishPreset] = useState('clear');
  const [customInstruction, setCustomInstruction] = useState('');
  const [polishOutput, setPolishOutput] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);

  // AI 총괄 편집장 실시간 대화 상태
  const [chiefMessages, setChiefMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: `반갑습니다, 작가님. ${activeBook?.title ? activeBook.title + '의' : ''} 총괄 책임 편집장입니다.\n\n도서 제목 추천, 목차 진단, 베스트셀러 요건 비교, 전체 서사 및 논리 점검, 문체 감수 등 집필 전반을 든든하게 총괄해 드립니다. 하단의 추천 질문을 누르시거나 궁금한 점을 질문해 주세요.`,
      time: '방금 전'
    }
  ]);
  const [chiefInput, setChiefInput] = useState('');
  const [isChiefThinking, setIsChiefThinking] = useState(false);
  const chiefChatEndRef = useRef(null);

  // 실시간 AI 쿼터 상태 및 리스너
  const [activeQuota, setActiveQuota] = useState(() => getActiveModelQuota());

  useEffect(() => {
    const handleQuotaUpdate = () => {
      setActiveQuota(getActiveModelQuota());
    };
    window.addEventListener('ai_quota_updated', handleQuotaUpdate);
    return () => window.removeEventListener('ai_quota_updated', handleQuotaUpdate);
  }, []);

  // 총괄 편집장 메시지 스크롤 자동 이동
  useEffect(() => {
    if (activeAiTab === 'chief') {
      chiefChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chiefMessages, activeAiTab]);

  // 현재 작성 중인 소목차와 매칭되는 창작실 서사 뼈대 단계 및 꼭지 메모 계산
  const plotContext = useMemo(() => {
    if (!activeBook?.plotStages || activeBook.plotStages.length === 0) return null;
    const chapIdx = (activeBook.chapters || []).findIndex(c => c.id === currentChapter?.id);
    if (chapIdx < 0 || chapIdx >= activeBook.plotStages.length) return null;

    const stage = activeBook.plotStages[chapIdx];
    const secIdx = (currentChapter?.sections || []).findIndex(s => s.id === currentSection?.id);
    const subplot = (stage?.subplots && secIdx >= 0 && secIdx < stage.subplots.length) ? stage.subplots[secIdx] : null;
    const subplotTitle = typeof subplot === 'string' ? subplot : subplot?.title || '';
    const subplotMemo = typeof subplot === 'object' ? subplot?.memo || '' : '';

    return {
      standardName: activeBook.plotStandardName || '표준 서사 뼈대',
      stageTitle: stage.title || `단계 ${chapIdx + 1}`,
      stageDesc: stage.desc || '',
      subplotTitle,
      subplotMemo
    };
  }, [activeBook, currentChapter, currentSection]);

  // AI 초고 집필 에이전트 실행
  const handleRunDraftAgent = async () => {
    if (!currentSection) {
      showToast('작성할 목차(소목차)를 먼저 선택해주세요.', 'error');
      return;
    }
    try {
      setIsDrafting(true);
      showToast('AI 에이전트가 초고를 집필하고 있습니다...', 'info');

      const referenceNotes = vault && selectedVaultIds?.length > 0
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
        genre: activeBook?.genre || '',
        plotContext
      });

      setDraftOutput(result.content);
      setIsDraftConfirmModalOpen(true);
      showToast('초고 집필이 완료되었습니다. 본문 반영 방식을 선택해주세요.', 'success');
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
    setIsDraftConfirmModalOpen(false);
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
    setIsDraftConfirmModalOpen(false);
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
      showToast('AI 문장 교정이 완료되었습니다.', 'success');
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
    showToast('교정 문장이 본문에 반영되었습니다.', 'success');
  };

  // 에디터에서 드래그 선택 텍스트 가져오기
  const handleFetchSelection = () => {
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
  };

  // 총괄 편집장 메시지 전송
  const handleSendChiefMessage = async (customPrompt) => {
    const textToSend = (customPrompt || chiefInput).trim();
    if (!textToSend || isChiefThinking) return;

    const userMsg = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: textToSend,
      time: '방금 전'
    };

    setChiefMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setChiefInput('');
    setIsChiefThinking(true);

    try {
      const referenceNotes = vault && selectedVaultIds?.length > 0
        ? vault
            .filter(v => selectedVaultIds.includes(v.id))
            .map(v => `[${v.title}]\n${v.content}`)
            .join('\n\n')
        : '';

      const wordCount = (editor?.getText() || localContent || '').replace(/\s/g, '').length;

      const res = await bookService.consultEditorChief({
        bookTitle: activeBook?.title || '',
        bookSubtitle: activeBook?.subtitle || '',
        chapterTitle: currentChapter?.title || '',
        sectionTitle: localTitle || currentSection?.title || '',
        targetAudience: activeBook?.targetAudience || '',
        genre: activeBook?.genre || '',
        chapters: activeBook?.chapters || [],
        totalSections: (activeBook?.chapters || []).reduce((acc, c) => acc + (c.sections?.length || 0), 0),
        wordCount,
        targetLength: draftLength,
        vaultNotes: referenceNotes,
        currentMessage: textToSend,
        history: chiefMessages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }))
      });

      const replyMsg = {
        id: 'reply-' + Date.now(),
        role: 'assistant',
        content: res.reply || res.content || '답변을 완성하지 못했습니다.',
        time: '방금 전'
      };
      setChiefMessages(prev => [...prev, replyMsg]);
    } catch (err) {
      if (err.isFixedModelFailure) {
        showActionToast(
          `선택하신 [${err.fixedModelName}] 모델 호출 실패: ${err.message}. 설정으로 이동하여 모델을 변경하시겠습니까?`,
          () => setView('settings'),
          () => {},
          { yesText: '설정으로 이동', noText: '취소' }
        );
      } else {
        showToast(`편집장 답변 실패: ${err.message}`, 'error');
      }
    } finally {
      setIsChiefThinking(false);
    }
  };

  // 총괄 편집장 대화 초기화
  const handleResetChiefChat = () => {
    setChiefMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `반갑습니다, 작가님. ${activeBook?.title ? activeBook.title + '의' : ''} 총괄 책임 편집장입니다.\n\n새 대화가 시작되었습니다. 도서 제목 제안, 목차 진단 등 궁금한 점을 질문해 주세요.`,
        time: '방금 전'
      }
    ]);
    showToast('편집장과의 대화가 초기화되었습니다.', 'info');
  };

  const currentToneInfo = V5_TONE_DATA[draftTone] || V5_TONE_DATA.story;
  const currentLengthInfo = V5_LENGTH_DATA[draftLength] || V5_LENGTH_DATA.standard;
  const currentPolishInfo = V5_POLISH_DATA[polishPreset] || V5_POLISH_DATA.clear;

  return (
    <aside className="v5-right-col">
      {/* 🌟 AI 어시스턴트 단일 통합 카드 */}
      <div className="v5-unified-card">
        {/* 1. 소제목 (밑에 구분선만 긋기 & 로봇 픽토그램) */}
        <div className="v5-card-header">
          <h3 className="v5-card-title">
            <Bot size={17} className="v5-picto" />
            <span>AI 어시스턴트</span>
          </h3>
        </div>

        {/* 2. 분류 탭 네비게이션 (아래 내용 영역과 한 면으로 이어지는 옅은 폴더 색인 탭) */}
        <div className="v5-folder-tabs-nav">
          <button
            type="button"
            className={`v5-folder-tab ${activeAiTab === 'draft' ? 'active' : ''}`}
            onClick={() => setActiveAiTab('draft')}
          >
            초고 집필
          </button>
          <button
            type="button"
            className={`v5-folder-tab ${activeAiTab === 'polish' ? 'active' : ''}`}
            onClick={() => setActiveAiTab('polish')}
          >
            문장 교정
          </button>
          <button
            type="button"
            className={`v5-folder-tab ${activeAiTab === 'chief' ? 'active' : ''}`}
            onClick={() => setActiveAiTab('chief')}
          >
            총괄 편집장
          </button>
        </div>

        {/* 3. 카드 내부 본문 (선택된 탭과 매끄럽게 연결) */}
        <div className="v5-card-body">
          {/* [탭 1] 초고 집필 */}
          {activeAiTab === 'draft' && (
            <div className="v5-tab-pane active">
              {/* 상단 창작실 연동 풀 너비 박스 (전구 픽토그램 + 창작실 연동 (N)) */}
              <button
                type="button"
                className="v5-btn-vault-full"
                onClick={() => {
                  loadVault();
                  setIsVaultModalOpen(true);
                }}
                title="창작실 소재 연동"
              >
                <Lightbulb size={15} className="v5-picto" />
                <span>창작실 연동 ({selectedVaultIds?.length || 0})</span>
              </button>

              {/* 창작실 서사 뼈대 & 꼭지 메모 연동 카드 */}
              {plotContext && (
                <div className="v5-plot-guide-card">
                  <div className="v5-plot-guide-header">
                    <span className="v5-plot-guide-badge">
                      <Layers size={11} />
                      서사 뼈대 연동
                    </span>
                    <span className="v5-plot-guide-standard">{plotContext.standardName}</span>
                  </div>
                  <div className="v5-plot-guide-body">
                    <div className="v5-plot-stage-name">{plotContext.stageTitle}</div>
                    {plotContext.stageDesc && <div className="v5-plot-stage-desc">{plotContext.stageDesc}</div>}
                    {plotContext.subplotTitle && (
                      <div className="v5-plot-subplot-row">
                        <Bookmark size={11} className="v5-sub-icon" />
                        <span><strong>꼭지 목표:</strong> {plotContext.subplotTitle}</span>
                      </div>
                    )}
                    {plotContext.subplotMemo && (
                      <div className="v5-plot-memo-row">
                        <span><strong>기획 메모:</strong> {plotContext.subplotMemo}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 핵심 키워드 & 소재 (이모지 없음) */}
              <div className="v5-field-group">
                <label className="v5-field-label">핵심 키워드 & 소재</label>
                <input
                  type="text"
                  className="v5-input"
                  placeholder="예: 사모펀드 실사, 숨은 부채, 현장 체크리스트"
                  value={draftKeywords}
                  onChange={(e) => setDraftKeywords(e.target.value)}
                />
              </div>

              {/* 작가 지시어 (명령어) */}
              <div className="v5-field-group">
                <label className="v5-field-label">작가 지시어 (명령어)</label>
                <textarea
                  className="v5-textarea"
                  rows={2}
                  placeholder="집필 방향 지시 (예: 고요한 심야 분위기를 생생한 감각 묘사로 풀어줘)"
                  value={draftInstruction}
                  onChange={(e) => setDraftInstruction(e.target.value)}
                />
              </div>

              {/* 어조 설정 섹션 (독립 분리) */}
              <div className="v5-field-group">
                <label className="v5-field-label">집필 어조</label>
                <div className="v5-chips-wrap">
                  {[
                    { id: 'guide', label: '가이드형' },
                    { id: 'story', label: '스토리텔링' },
                    { id: 'talk', label: '대화형' },
                    { id: 'explain', label: '해설형' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`v5-chip-opt ${draftTone === t.id ? 'active' : ''}`}
                      onClick={() => setDraftTone(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {/* 어조 실시간 예시 안내 박스 */}
                <div className="v5-chip-hint-box">
                  <span className="v5-hint-title">{currentToneInfo.title}</span>
                  <p className="v5-hint-desc">{currentToneInfo.desc}</p>
                  <div className="v5-hint-quote">{currentToneInfo.quote}</div>
                </div>
              </div>

              {/* 분량 설정 섹션 (독립 분리) */}
              <div className="v5-field-group">
                <label className="v5-field-label">목표 분량</label>
                <div className="v5-chips-wrap">
                  {[
                    { id: 'compact', label: '간결' },
                    { id: 'standard', label: '표준' },
                    { id: 'deep', label: '상세' }
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`v5-chip-opt ${draftLength === l.id ? 'active' : ''}`}
                      onClick={() => setDraftLength(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                {/* 분량 구간 실시간 안내 박스 */}
                <div className="v5-chip-hint-box">
                  <span className="v5-hint-title">{currentLengthInfo.title}</span>
                  <p className="v5-hint-desc">
                    <strong>{currentLengthInfo.desc}</strong>
                  </p>
                  <div className="v5-hint-quote">{currentLengthInfo.quote}</div>
                </div>
              </div>

              {/* 초고 집필 시작 버튼 */}
              <button
                type="button"
                className="v5-btn-primary"
                onClick={handleRunDraftAgent}
                disabled={isDrafting}
              >
                {isDrafting ? '초고 에이전트 집필 중...' : '초고 집필 시작'}
              </button>
            </div>
          )}

          {/* [탭 2] 문장 교정 */}
          {activeAiTab === 'polish' && (
            <div className="v5-tab-pane active">
              {/* 수정 전 원문 + 가져오기 */}
              <div className="v5-field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="v5-field-label">수정 전 원문</label>
                  <button
                    type="button"
                    className="v5-btn-text"
                    onClick={handleFetchSelection}
                    title="에디터에서 드래그한 문장을 가져옵니다"
                  >
                    선택 가져오기
                  </button>
                </div>
                <textarea
                  className="v5-textarea"
                  rows={3}
                  placeholder="교정할 문장을 입력하거나 본문에서 '선택 가져오기'를 누르세요..."
                  value={polishInput}
                  onChange={(e) => setPolishInput(e.target.value)}
                />
              </div>

              {/* 교정 스타일 칩 & 실시간 예시 안내 */}
              <div className="v5-field-group">
                <label className="v5-field-label">교정 스타일</label>
                <div className="v5-chips-wrap">
                  {[
                    { id: 'expand', label: '풍부하게' },
                    { id: 'clear', label: '윤문/다듬기' },
                    { id: 'grammar', label: '맞춤법' },
                    { id: 'concise', label: '명료하게' },
                    { id: 'friendly', label: '대화체' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`v5-chip-opt ${polishPreset === p.id ? 'active' : ''}`}
                      onClick={() => setPolishPreset(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* 교정 스타일 실시간 예시 안내 박스 */}
                <div className="v5-chip-hint-box">
                  <span className="v5-hint-title">{currentPolishInfo.title}</span>
                  <p className="v5-hint-desc">{currentPolishInfo.desc}</p>
                  <div className="v5-hint-quote">{currentPolishInfo.quote}</div>
                </div>
              </div>

              {/* 추가 지침 */}
              <div className="v5-field-group">
                <label className="v5-field-label">추가 지침</label>
                <input
                  type="text"
                  className="v5-input"
                  placeholder="예: 은유적 깊이와 심야 서정성 강화"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                />
              </div>

              {/* 교정 실행 버튼 */}
              <button
                type="button"
                className="v5-btn-secondary"
                onClick={handleRunPolish}
                disabled={isPolishing}
              >
                {isPolishing ? '문장 교정 중...' : '문장 교정 실행'}
              </button>

              {/* 교정 결과 박스 & 반영 */}
              {polishOutput && (
                <div className="v5-result-box">
                  <div className="v5-result-meta">
                    <span>수정 제안 결과</span>
                    <button
                      type="button"
                      className="v5-btn-mini"
                      onClick={() => {
                        navigator.clipboard.writeText(polishOutput);
                        showToast('클립보드에 복사되었습니다.', 'info');
                      }}
                    >
                      <Copy size={12} style={{ display: 'inline', marginRight: '3px' }} />
                      복사
                    </button>
                  </div>
                  <textarea
                    className="v5-textarea"
                    rows={3}
                    style={{ minHeight: '60px' }}
                    value={polishOutput}
                    onChange={(e) => setPolishOutput(e.target.value)}
                  />
                  <button type="button" className="v5-btn-apply" onClick={handleApplyPolish}>
                    본문에 즉시 반영하기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* [탭 3] 총괄 편집장 실시간 대화창 */}
          {activeAiTab === 'chief' && (
            <div className="v5-tab-pane active" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="v5-chief-chat-container">
                {/* 채팅 헤더 (히스토리, 새대화) */}
                <div className="v5-chief-chat-header">
                  <span className="v5-chief-title">책임 편집장 코칭</span>
                  <div className="v5-chief-head-actions">
                    <button
                      type="button"
                      className="v5-chief-head-btn"
                      onClick={handleResetChiefChat}
                      title="새 대화 시작"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                {/* 실시간 대화 메시지 목록 */}
                <div className="v5-chief-messages-list">
                  {chiefMessages.map((msg) => (
                    <div key={msg.id} className={`v5-chief-msg-row ${msg.role}`}>
                      {msg.role === 'assistant' && (
                        <div className="v5-chief-avatar">편집장</div>
                      )}
                      <div className="v5-chief-bubble-wrap">
                        <div className="v5-chief-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </div>
                        <span className="v5-chief-time">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  {isChiefThinking && (
                    <div className="v5-chief-msg-row assistant">
                      <div className="v5-chief-avatar">편집장</div>
                      <div className="v5-chief-bubble-wrap">
                        <div className="v5-chief-bubble" style={{ color: 'var(--text-muted)' }}>
                          원고 맥락을 분석하고 조언을 정리하는 중입니다...
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chiefChatEndRef} />
                </div>

                {/* 추천 질문 칩 바 */}
                <div className="v5-chief-suggestions-bar">
                  <span className="v5-chief-suggest-label">추천 질문:</span>
                  <div className="v5-chief-suggest-chips">
                    {[
                      '현재 목차를 바탕으로 출판용 메인 제목 5세트를 제안해줘',
                      '현재 목차 구조의 완결성과 보강점을 진단해줘',
                      '이 분야 베스트셀러 성공 요건과 우리 책을 비교해줘',
                      '서사 기승전결과 인과관계를 점검해줘',
                      '타깃 독자 눈높이에 맞춰 문체 톤앤매너를 감수해줘'
                    ].map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        className="v5-chief-suggest-chip"
                        onClick={() => handleSendChiefMessage(promptText)}
                        disabled={isChiefThinking}
                      >
                        {promptText.length > 12 ? promptText.slice(0, 12) + '...' : promptText}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메시지 입력 폼 */}
                <form
                  className="v5-chief-input-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChiefMessage();
                  }}
                >
                  <textarea
                    className="v5-chief-textarea"
                    placeholder="편집장에게 지시하거나 질문하세요 (Ctrl+Enter로 전송)"
                    value={chiefInput}
                    onChange={(e) => setChiefInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSendChiefMessage();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="v5-btn-chief-send"
                    disabled={isChiefThinking || !chiefInput.trim()}
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 패널 최하단: 고정 푸터 (번개 픽토그램 + 모델명 + 쿼터 잔여 뱃지) */}
      <div
        className="v5-quota-pill-bar"
        onClick={() => setIsQuotaModalOpen(true)}
        title="클릭하여 AI 모델별 일일 잔여 한도 상세 확인"
      >
        <div className="v5-quota-pill-left">
          <Zap size={14} className="v5-picto" />
          <span>{activeQuota?.name || 'Gemini'}</span>
        </div>
        <span className="v5-quota-pill-badge">
          {activeQuota?.isExhausted ? '0%' : `${Math.round(Number(activeQuota?.remainingPct || 100))}%`}
        </span>
      </div>

      {/* [v5 전용] 초고 반영 확인 팝업 모달 (다른 여백 클릭 시 닫히지 않음) */}
      {isDraftConfirmModalOpen && (
        <div
          className="v5-modal-backdrop"
          style={{ display: 'flex' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="v5-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="v5-modal-header">
              <h4 className="v5-modal-title">생성된 초고를 입력하시겠습니까?</h4>
              <button
                type="button"
                className="v5-modal-close"
                onClick={() => setIsDraftConfirmModalOpen(false)}
                title="닫기 (입력 취소)"
              >
                ✕
              </button>
            </div>
            <div className="v5-modal-preview">
              <div style={{ whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto', fontSize: '0.8rem', lineHeight: '1.6' }}>
                {draftOutput}
              </div>
            </div>
            <div className="v5-modal-actions">
              <button
                type="button"
                className="v5-btn-modal-replace"
                onClick={handleApplyDraftReplace}
              >
                본문 전체 반영
              </button>
              <button
                type="button"
                className="v5-btn-modal-append"
                onClick={handleApplyDraftAppend}
              >
                끝에 이어붙이기
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
