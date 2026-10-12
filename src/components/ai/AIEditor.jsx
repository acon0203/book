import React, { useState, useEffect, useRef } from 'react';
import './AIEditor.css';
import { History, MessageSquare, RotateCcw, X, Trash2, Check, Send } from 'lucide-react';
import { marked } from 'marked';
import { aiService } from '../../services/aiService';
import { bookService } from '../../services/bookService';
import { storageService } from '../../services/storageService';

// 목차 번호 정제 헬퍼
const cleanTitle = (t) => aiService.cleanOutlineTitle(t);

// AI 총괄 편집장 초기 웰컴 메시지 생성 헬퍼
const getDefaultWelcomeMessage = (bookTitle) => ({
  id: 'welcome',
  role: 'assistant',
  content: `반갑습니다, 작가님! 《${bookTitle || '원고'}》의 총괄 책임 편집장입니다. 🏛️\n\n도서의 타깃 독자와 기획 의도를 지키면서, **도서 제목 추천, 목차 진단, 베스트셀러 요건 비교, 전체 서사/논리 점검, 톤앤매너 감수, 프롤로그/에필로그 기획** 등 집필 전반을 든든하게 총괄해 드립니다.\n\n좌측의 본문을 실시간으로 집필하시면서, 대화창 하단의 **추천 액션**을 누르시거나 원하시는 피드백을 자유롭게 말씀해 주세요!`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
});

// AI 총괄 편집장 핵심 6대 추천 액션
const CHIEF_RECOMMENDED_ACTIONS = [
  {
    id: 'title',
    label: '🎯 도서 제목 추천',
    prompt: '현재 목차와 기획 콘셉트를 바탕으로 대형 서점 매대에서 눈길을 사로잡을 출판용 메인 제목과 킬러 부제 5세트를 제안해줘.'
  },
  {
    id: 'diagnosis',
    label: '📋 목차 진단',
    prompt: '현재 목차 구조의 완결성, 중복 구간, 보강이 필요한 사각지대를 출판 기획 기준에서 꼼꼼히 진단해줘.'
  },
  {
    id: 'bestseller',
    label: '🏆 베스트셀러와 비교',
    prompt: '이 분야 베스트셀러들이 반드시 갖추는 핵심 성공 요건(독자 후킹, 문제 정의, 차별화된 해결책, 단계적 실행력 등)을 우리 책이 제대로 갖추었는지 비교·평가해줘.'
  },
  {
    id: 'narrative',
    label: '🔍 전체 서사/논리 점검',
    prompt: '현재 목차의 기승전결 서사 구조와 장(Chapter) 간의 논리적 흐름 및 인과관계를 전체적으로 점검해줘.'
  },
  {
    id: 'tone',
    label: '🎭 톤앤매너 감수',
    prompt: '우리 타깃 독자의 눈높이에서 볼 때 전체 챕터와 소제목들의 문체 톤앤매너와 난이도가 적절한지 감수해줘.'
  },
  {
    id: 'prologue',
    label: '✍️ 프롤로그/에필로그 기획',
    prompt: '책의 전체 주제와 기획 의도를 관통하는 프롤로그(여는 글)와 에필로그(닫는 글)의 핵심 구성 초안을 기획해줘.'
  }
];

export default function AIEditor({
  isOpen,
  onClose,
  activeBook,
  vault,
  openBook,
  loadBooks,
  setView,
  showToast,
  showActionToast,
  openConfirm
}) {
  const [chiefMessages, setChiefMessages] = useState([]);
  const [chiefInput, setChiefInput] = useState('');
  const [isChiefReplying, setIsChiefReplying] = useState(false);
  const [isApplyingRestructure, setIsApplyingRestructure] = useState(false);
  const [chiefChatHistory, setChiefChatHistory] = useState([]);
  const [isChiefHistoryOpen, setIsChiefHistoryOpen] = useState(false);
  const [activeChiefSessionId, setActiveChiefSessionId] = useState(null);
  const chiefChatEndRef = useRef(null);

  // 도서 변경 시 저장된 대화 복원
  useEffect(() => {
    if (!activeBook?.id) return;
    try {
      const savedHistory = localStorage.getItem(`chief_chat_history_${activeBook.id}`);
      if (savedHistory) setChiefChatHistory(JSON.parse(savedHistory));

      const activeId = localStorage.getItem(`chief_chat_active_id_${activeBook.id}`);
      setActiveChiefSessionId(activeId || null);

      const savedActive = localStorage.getItem(`chief_chat_active_${activeBook.id}`);
      if (savedActive) {
        setChiefMessages(JSON.parse(savedActive));
      } else {
        setChiefMessages([getDefaultWelcomeMessage(activeBook.title)]);
      }
    } catch (e) {
      setChiefMessages([getDefaultWelcomeMessage(activeBook.title)]);
    }
  }, [activeBook?.id]);

  // 대화 내용 자동 보존
  useEffect(() => {
    if (!activeBook?.id || chiefMessages.length === 0) return;
    try {
      localStorage.setItem(`chief_chat_active_${activeBook.id}`, JSON.stringify(chiefMessages));
      if (activeChiefSessionId) {
        localStorage.setItem(`chief_chat_active_id_${activeBook.id}`, activeChiefSessionId);
      } else {
        localStorage.removeItem(`chief_chat_active_id_${activeBook.id}`);
      }
    } catch (e) {
      console.error('Failed to persist chief messages:', e);
    }
  }, [chiefMessages, activeChiefSessionId, activeBook?.id]);

  // 스크롤 자동 이동
  useEffect(() => {
    if (isOpen && chiefChatEndRef.current) {
      chiefChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chiefMessages, isChiefReplying, isOpen]);

  // ESC 키로 편집장 드로어 닫기
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

  // 새 대화 시작
  const handleResetChiefChat = () => {
    const userMessages = chiefMessages.filter((m) => m.role === 'user');
    if (userMessages.length > 0) {
      const firstUserText = userMessages[0]?.content || '편집장 상담 세션';
      const sessionTitle = firstUserText.length > 26 ? `${firstUserText.slice(0, 26)}...` : firstUserText;
      const nowStr = new Date().toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const existingIdx = activeChiefSessionId
        ? chiefChatHistory.findIndex((s) => s.id === activeChiefSessionId)
        : -1;

      let updatedHistory;
      if (existingIdx >= 0) {
        const targetSession = chiefChatHistory[existingIdx];
        const updatedSession = {
          ...targetSession,
          title: sessionTitle,
          updatedAt: nowStr,
          messageCount: chiefMessages.length,
          messages: chiefMessages
        };
        updatedHistory = [...chiefChatHistory];
        updatedHistory[existingIdx] = updatedSession;
        showToast('진행 중이던 대화 기록이 업데이트되고 새 대화가 시작되었습니다.', 'success');
      } else {
        const newSession = {
          id: `session_${Date.now()}`,
          title: sessionTitle,
          createdAt: nowStr,
          messageCount: chiefMessages.length,
          messages: chiefMessages
        };
        updatedHistory = [newSession, ...chiefChatHistory].slice(0, 30);
        showToast('이전 대화가 새 기록으로 보관되고 새 대화가 시작되었습니다.', 'success');
      }

      setChiefChatHistory(updatedHistory);
      try {
        localStorage.setItem(`chief_chat_history_${activeBook?.id}`, JSON.stringify(updatedHistory));
      } catch (e) {}
    } else {
      showToast('새 대화가 준비되었습니다.', 'info');
    }

    setActiveChiefSessionId(null);
    try {
      localStorage.removeItem(`chief_chat_active_id_${activeBook?.id}`);
    } catch (e) {}
    setChiefMessages([getDefaultWelcomeMessage(activeBook?.title)]);
    setIsChiefHistoryOpen(false);
  };

  const handleLoadHistorySession = (session) => {
    setActiveChiefSessionId(session.id);
    setChiefMessages(session.messages || []);
    setIsChiefHistoryOpen(false);
    showToast(`'${session.title}' 대화 기록을 불러왔습니다.`, 'success');
  };

  const handleDeleteHistorySession = async (sessionId, e) => {
    e.stopPropagation();
    const ok = await openConfirm({
      title: '대화 기록 삭제',
      message: '이 대화 기록을 삭제하시겠습니까?',
      danger: true,
      confirmText: '삭제'
    });
    if (ok) {
      const filtered = chiefChatHistory.filter((s) => s.id !== sessionId);
      setChiefChatHistory(filtered);
      if (activeChiefSessionId === sessionId) {
        setActiveChiefSessionId(null);
        try {
          localStorage.removeItem(`chief_chat_active_id_${activeBook?.id}`);
        } catch (e) {}
      }
      try {
        localStorage.setItem(`chief_chat_history_${activeBook?.id}`, JSON.stringify(filtered));
      } catch (e) {}
      showToast('기록이 삭제되었습니다.', 'info');
    }
  };

  const handleSendChiefMessage = async (customPrompt) => {
    const text = (typeof customPrompt === 'string' ? customPrompt : chiefInput).trim();
    if (!text || isChiefReplying) return;

    const cfg = storageService.getConfig();
    if (!cfg.geminiApiKey || !cfg.geminiApiKey.trim()) {
      showActionToast(
        'AI 총괄 편집장 상담을 위해 Google 무료 API 키가 필요합니다. 설정으로 이동하시겠습니까?',
        () => {
          onClose();
          setView('settings');
        },
        () => {},
        { yesText: '설정으로 이동', noText: '취소' }
      );
      return;
    }

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChiefMessages(prev => [...prev, userMsg]);
    setChiefInput('');
    setIsChiefReplying(true);

    try {
      const response = await bookService.consultEditorChief({
        book: activeBook,
        message: text,
        history: chiefMessages,
        vaultNotes: vault || []
      });

      const assistantMsg = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        restructureData: response.restructureData || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChiefMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ 편집장 응답 중 오류가 발생했습니다: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChiefMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChiefReplying(false);
    }
  };

  const handleApplyRestructureFromMsg = async (restructureData) => {
    if (!restructureData?.chapters) return;
    try {
      setIsApplyingRestructure(true);
      await bookService.applyRestructuredOutline(activeBook.id, restructureData.chapters);
      await openBook(activeBook.id);
      await loadBooks();
      showToast('🎉 새 목차가 도서에 성공적으로 반영되었습니다!', 'success');
    } catch (err) {
      showToast(`목차 반영 실패: ${err.message}`, 'error');
    } finally {
      setIsApplyingRestructure(false);
    }
  };

  return (
    <aside className="chief-slide-drawer">
      {/* 편집장 대화창 헤더 */}
      <div className="chief-drawer-header">
        <div className="chief-header-title-group">
          <div className="chief-header-badge-icon">🏛️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2>AI 총괄 편집장</h2>
              <span className="chief-header-tag">Editor-in-Chief</span>
              <span className="chief-online-dot" title="실시간 에이전트 준비 완료" />
            </div>
            <p className="chief-header-desc">
              《{activeBook?.title}》 전담 총괄 파트너 · 목차 재구성 및 서사 밸런스 코칭
            </p>
          </div>
        </div>
        <div className="chief-header-actions">
          <button
            type="button"
            className={`chief-header-btn ${isChiefHistoryOpen ? 'active' : ''}`}
            title="대화 기록 (히스토리)"
            onClick={() => setIsChiefHistoryOpen(!isChiefHistoryOpen)}
          >
            <History size={15} />
            {chiefChatHistory.length > 0 && (
              <span className="chief-history-badge">{chiefChatHistory.length}</span>
            )}
          </button>
          <button
            type="button"
            className="chief-header-btn"
            title="새 대화 시작 (이전 대화 자동 보관)"
            onClick={handleResetChiefChat}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="chief-header-btn close"
            onClick={onClose}
            title="패널 닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {isChiefHistoryOpen ? (
        /* --- 대화 히스토리 보관소 뷰 --- */
        <div className="chief-history-view">
          <div className="chief-history-header">
            <div className="history-title-row">
              <span className="history-title">📚 대화 기록 보관소</span>
              <span className="history-count">총 {chiefChatHistory.length}개 세션</span>
            </div>
            <p className="history-subtitle">
              새 대화를 시작할 때마다 이전 상담 내역이 여기에 안전하게 보관됩니다.
            </p>
          </div>

          <div className="chief-history-list">
            {chiefChatHistory.length === 0 ? (
              <div className="chief-history-empty">
                <History size={32} />
                <p>보관된 이전 대화가 없습니다.</p>
                <span>헤더의 새로고침(새 대화) 버튼을 누르면 현재 대화가 여기에 자동 보관됩니다.</span>
              </div>
            ) : (
              chiefChatHistory.map((session) => (
                <div
                  key={session.id}
                  className={`history-session-card ${session.id === activeChiefSessionId ? 'active' : ''}`}
                  onClick={() => handleLoadHistorySession(session)}
                >
                  <div className="session-card-main">
                    <div className="session-card-title">
                      <MessageSquare size={14} className="session-icon" />
                      <span>{session.title}</span>
                      {session.id === activeChiefSessionId && (
                        <span className="current-session-badge">현재 대화방</span>
                      )}
                    </div>
                    <div className="session-card-meta">
                      <span>{session.updatedAt ? `${session.updatedAt} (수정)` : session.createdAt}</span>
                      <span>·</span>
                      <span>메시지 {session.messageCount || session.messages?.length || 0}개</span>
                    </div>
                  </div>
                  <div className="session-card-actions">
                    <button
                      type="button"
                      className="btn-history-delete"
                      title="기록 삭제"
                      onClick={(e) => handleDeleteHistorySession(session.id, e)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="chief-history-footer">
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => setIsChiefHistoryOpen(false)}
            >
              대화창으로 돌아가기
            </button>
          </div>
        </div>
      ) : (
        /* --- 실시간 채팅 메시지 영역 + 하단 추천 액션/입력창 --- */
        <>
          <div className="chief-chat-area">
            <div className="chief-message-list">
              {chiefMessages.map((msg) => (
                <div key={msg.id} className={`chief-message-row ${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="chief-avatar">🏛️</div>
                  )}
                  <div className="chief-bubble-wrapper">
                    <div className="chief-bubble">
                      <div
                        className="chief-bubble-content markdown-body"
                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }}
                      />

                      {msg.restructureData && msg.restructureData.chapters && (
                        <div className="chief-restructure-card">
                          <div className="restructure-card-header">
                            <span className="restructure-card-badge">✨ 편집장의 개편안 제안</span>
                            <span className="restructure-card-count">
                              총 {msg.restructureData.chapters.length}개 챕터
                            </span>
                          </div>
                          {msg.restructureData.explanation && (
                            <p className="restructure-card-desc">{msg.restructureData.explanation}</p>
                          )}
                          <div className="restructure-card-tree">
                            {msg.restructureData.chapters.map((ch, idx) => (
                              <div key={idx} className="restructure-ch-item">
                                <div className="restructure-ch-title">
                                  <strong>제 {idx + 1}장.</strong> {cleanTitle(ch.title)}
                                </div>
                                <ul className="restructure-sec-list">
                                  {ch.sections?.map((sec, sIdx) => (
                                    <li key={sIdx}>
                                      <span className="sec-tag">{idx + 1}.{sIdx + 1}</span> {cleanTitle(sec.title)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                          <div className="restructure-apply-bar">
                            <span className="apply-notice">
                              ℹ️ 기존 작성 본문은 제목 매칭 풀을 통해 안전하게 보존됩니다.
                            </span>
                            <button
                              type="button"
                              className="btn btn-primary btn-apply-outline"
                              disabled={isApplyingRestructure}
                              onClick={() => handleApplyRestructureFromMsg(msg.restructureData)}
                            >
                              <Check size={15} />
                              <span>{isApplyingRestructure ? '반영 중...' : '🚀 이 수정안을 현재 목차에 즉시 반영하기'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="chief-timestamp">{msg.timestamp}</span>
                  </div>
                </div>
              ))}

              {isChiefReplying && (
                <div className="chief-message-row assistant">
                  <div className="chief-avatar">🏛️</div>
                  <div className="chief-bubble-wrapper">
                    <div className="chief-bubble chief-typing-bubble">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '0.4rem' }}>
                        편집장이 답변과 기획안을 작성하고 있습니다...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chiefChatEndRef} />
            </div>
          </div>

          <div className="chief-chat-input-container">
            <div className="chief-suggestions-bar">
              <span className="suggestions-label">💡 추천 액션:</span>
              <div className="suggestions-scroll">
                {CHIEF_RECOMMENDED_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleSendChiefMessage(action.prompt)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="chief-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChiefMessage();
              }}
            >
              <textarea
                className="chief-chat-textarea"
                placeholder="편집장에게 지시하거나 질문하세요 (예: 1장과 2장을 하나로 합쳐줘, 엔터로 전송)"
                value={chiefInput}
                onChange={(e) => setChiefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChiefMessage();
                  }
                }}
                disabled={isChiefReplying}
                rows={2}
              />
              <button
                type="submit"
                className="btn-chief-send"
                disabled={isChiefReplying || !chiefInput.trim()}
                title="전송 (Enter)"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </>
      )}
    </aside>
  );
}
