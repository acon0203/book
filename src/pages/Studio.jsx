import React, { useState, useEffect, useRef } from 'react';
import './Studio.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { marked } from 'marked';
import TiptapEditor from '../components/TiptapEditor';
import { htmlToParagraphs, paragraphsToHtml, generateBlockId } from '../utils/paragraphParser';
import bestsellerDb from '../data/bestseller-db.json';
import { storageService } from '../services/storageService';
import { aiService } from '../services/aiService';
import {
  ArrowLeft, Plus, Sparkles, Download, Save, Lightbulb, Copy, Check, Wand2, X, FileText, Calendar, Send,
  PenTool, Bot, Zap, RotateCcw, FilePlus, Layers, MoveUp, MoveDown, Trash2, LayoutList, AlertTriangle,
  History, MessageSquare, ChevronUp, ChevronDown, ChevronRight, BookOpen
} from 'lucide-react';
import ModelQuotasModal from '../components/ModelQuotasModal';
import { getActiveModelQuota } from '../utils/quotaManager';

marked.setOptions({ breaks: true, gfm: true });

// 목차 번호 중복 방지 헬퍼 (1장, 제1장, 1.1 등 접두사 정제)
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

export default function Studio() {
  const {
    activeBook, activeChapterId, activeSectionId,
    setActiveChapterId, setActiveSectionId,
    updateActiveSectionContent, updateActiveSectionTitle, saveActiveSection,
    addChapter, updateChapterTitle, deleteChapter, addSection, deleteSection,
    moveChapter, moveSection, reorderChapters, reorderSections, openBook, loadBooks,
    setChapterDeadline, toggleChapterPublish,
    vault, loadVault, selectedVaultIds, toggleSelectVaultId, clearSelectedVaultIds,
    createBookVersion, restoreBookVersion, deleteBookVersion,
    openReader, setView, showToast, showActionToast
  } = useStore();

  // 챕터별 소목차 접기/펼치기 상태 (Set<chapterId>)
  const [collapsedChapterIds, setCollapsedChapterIds] = useState(new Set());

  const toggleChapterCollapse = (chapId, e) => {
    if (e) e.stopPropagation();
    setCollapsedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapId)) {
        next.delete(chapId);
      } else {
        next.add(chapId);
      }
      return next;
    });
  };

  // 노션 스타일 드래그 앤 드롭 상태
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'chapter' | 'section', chapterId, sectionId, cIdx, sIdx }
  const [dragOverTarget, setDragOverTarget] = useState(null); // { type, id, position: 'top' | 'bottom' }

  const handleChapterDragStart = (e, chapId, cIdx) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chapId);
    setDraggedItem({ type: 'chapter', chapterId: chapId, cIdx });
  };

  const handleChapterDragOver = (e, chapId, cIdx) => {
    e.preventDefault();
    if (!draggedItem) return;
    if (draggedItem.type === 'chapter') {
      if (draggedItem.cIdx === cIdx) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'top' : 'bottom';
      setDragOverTarget({ type: 'chapter', id: chapId, position });
    } else if (draggedItem.type === 'section') {
      // 소목차를 다른 챕터 헤더로 끌어올 경우 (해당 챕터로 이동)
      setDragOverTarget({ type: 'chapter-drop-target', id: chapId, position: 'inside' });
    }
  };

  const handleChapterDrop = (e, chapId, targetCIdx) => {
    e.preventDefault();
    if (!draggedItem) return;
    if (draggedItem.type === 'chapter') {
      const srcIdx = draggedItem.cIdx;
      let tgtIdx = targetCIdx;
      if (dragOverTarget?.position === 'bottom' && srcIdx < targetCIdx) {
        // keep
      } else if (dragOverTarget?.position === 'bottom' && srcIdx > targetCIdx) {
        tgtIdx = targetCIdx + 1;
      } else if (dragOverTarget?.position === 'top' && srcIdx < targetCIdx) {
        tgtIdx = Math.max(0, targetCIdx - 1);
      }
      if (srcIdx !== tgtIdx) {
        reorderChapters(srcIdx, tgtIdx);
      }
    } else if (draggedItem.type === 'section') {
      // 소목차를 해당 챕터의 첫 번째 꼭지로 이동
      reorderSections(draggedItem.chapterId, chapId, draggedItem.sIdx, 0);
    }
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleSectionDragStart = (e, chapId, secId, cIdx, sIdx) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', secId);
    setDraggedItem({ type: 'section', chapterId: chapId, sectionId: secId, cIdx, sIdx });
  };

  const handleSectionDragOver = (e, secId, cIdx, sIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'section') return;
    if (draggedItem.sectionId === secId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'top' : 'bottom';
    setDragOverTarget({ type: 'section', id: secId, position, targetCIdx: cIdx, targetSIdx: sIdx });
  };

  const handleSectionDrop = (e, targetChapId, targetSIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'section') return;
    const srcChapId = draggedItem.chapterId;
    const srcSIdx = draggedItem.sIdx;
    let tgtSIdx = targetSIdx;
    if (srcChapId === targetChapId) {
      if (dragOverTarget?.position === 'bottom' && srcSIdx < targetSIdx) {
        // keep
      } else if (dragOverTarget?.position === 'bottom' && srcSIdx > targetSIdx) {
        tgtSIdx = targetSIdx + 1;
      } else if (dragOverTarget?.position === 'top' && srcSIdx < targetSIdx) {
        tgtSIdx = Math.max(0, targetSIdx - 1);
      }
    } else {
      if (dragOverTarget?.position === 'bottom') {
        tgtSIdx = targetSIdx + 1;
      }
    }
    reorderSections(srcChapId, targetChapId, srcSIdx, tgtSIdx);
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // D-Day 계산 헬퍼
  const calculateDDay = (deadline) => {
    if (!deadline) return { text: '마감 미정', status: 'none' };
    const target = new Date(deadline);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: '오늘 마감 D-Day 🔥', status: 'urgent' };
    if (diffDays > 0) return { text: `D-${diffDays}`, status: diffDays <= 3 ? 'urgent' : 'normal' };
    return { text: `D+${Math.abs(diffDays)} 초과 ⚠️`, status: 'urgent' };
  };

  // 현재 활성 챕터/섹션
  const currentChapterIndex = activeBook?.chapters?.findIndex(c => c.id === activeChapterId) ?? -1;
  const currentChapter = currentChapterIndex >= 0 ? activeBook.chapters[currentChapterIndex] : null;
  const currentSection = currentChapter?.sections?.find(s => s.id === activeSectionId);

  // 에디터 로컬 상태
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const debounceRef = useRef(null);

  // 목차 챕터 인라인 더블클릭 수정 상태
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');

  // 에디터 듀얼 모드 ('doc': 본문 모드 | 'block': 문단 블록 모드)
  const [editorMode, setEditorMode] = useState('doc');
  const [paragraphs, setParagraphs] = useState([]);
  const [activeParagraphId, setActiveParagraphId] = useState(null);

  // 전자책 미리보기 팝업 모달 상태
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  // AI 모델 쿼터 모달 상태
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [activeQuota, setActiveQuota] = useState(() => getActiveModelQuota());

  useEffect(() => {
    const handleQuotaUpdate = () => {
      setActiveQuota(getActiveModelQuota());
    };
    window.addEventListener('ai_quota_updated', handleQuotaUpdate);
    return () => window.removeEventListener('ai_quota_updated', handleQuotaUpdate);
  }, []);

  // 공통 Tiptap 에디터 ref 인스턴스
  const editorRef = useRef(null);

  // 하위 호환성을 위한 editor 안전 프록시 객체 (참조 안정성 보장)
  const editor = React.useMemo(() => ({
    getHTML: () => editorRef.current?.getHTML() || '',
    getText: () => editorRef.current?.getText() || '',
    get isEmpty() {
      return editorRef.current ? editorRef.current.isEmpty() : true;
    },
    commands: {
      setContent: (html) => editorRef.current?.setContent(html),
      insertContent: (html) => editorRef.current?.insertContent(html),
      focus: () => editorRef.current?.focus()
    },
    chain: () => ({
      focus: () => ({
        insertContent: (html) => ({
          run: () => editorRef.current?.insertContent(html)
        })
      })
    }),
    state: {
      get selection() {
        return { from: 0, to: 0 };
      },
      doc: {
        textBetween: () => editorRef.current?.getSelectedText() || ''
      }
    }
  }), []);

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

  // 모달 제어 상태
  const [isOutlineModalOpen, setIsOutlineModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isCreateVersionModalOpen, setIsCreateVersionModalOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef(null);

  // 저장 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target)) {
        setIsSaveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 새 버전 저장 핸들러 (현재 작성 중인 글 자동 저장 후 버전 생성)
  const handleCreateVersion = async (e) => {
    e?.preventDefault();
    if (!newVersionName.trim()) {
      showToast('버전 이름을 입력해주세요.', 'info');
      return;
    }
    // 현재 에디터 내용 먼저 저장
    let html = '';
    if (editorMode === 'block') {
      html = paragraphsToHtml(paragraphs);
      if (editor) editor.commands.setContent(html);
    } else {
      html = editor ? editor.getHTML() : localContent;
    }
    updateActiveSectionContent(html);
    await saveActiveSection();

    const ok = await createBookVersion(newVersionName.trim());
    if (ok) {
      setIsCreateVersionModalOpen(false);
      setNewVersionName('');
    }
  };

  // 버전 되돌리기(복원) 핸들러
  const handleRestoreVersion = async (version) => {
    const confirmMsg = `'${version.name}' 버전으로 되돌리시겠습니까?\n현재 작업 중인 본문이 해당 버전 시점으로 복원됩니다.`;
    if (window.confirm(confirmMsg)) {
      const ok = await restoreBookVersion(version.id);
      if (ok) {
        setIsVersionModalOpen(false);
      }
    }
  };

  // 버전 삭제 핸들러
  const handleDeleteVersion = async (version) => {
    if (window.confirm(`'${version.name}' 버전 기록을 삭제하시겠습니까?`)) {
      await deleteBookVersion(version.id);
    }
  };

  // 모달 내부 상태
  const [selectedGenre, setSelectedGenre] = useState('essay');
  const [chapterCount, setChapterCount] = useState('4');
  const [customChapterCount, setCustomChapterCount] = useState(4);
  const [sectionsPerChapter, setSectionsPerChapter] = useState('10');
  const [customSectionCount, setCustomSectionCount] = useState(10);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [isOutlineSubmitting, setIsOutlineSubmitting] = useState(false);
  const [outlineError, setOutlineError] = useState(null);
  const [exportFormat, setExportFormat] = useState('md');

  // AI 총괄 편집장(Editor-in-Chief) 대화형 에이전트 상태
  const [isChiefModalOpen, setIsChiefModalOpen] = useState(false);
  const [chiefMessages, setChiefMessages] = useState([]);
  const [chiefInput, setChiefInput] = useState('');
  const [isChiefReplying, setIsChiefReplying] = useState(false);
  const [isApplyingRestructure, setIsApplyingRestructure] = useState(false);
  const [isChiefHistoryOpen, setIsChiefHistoryOpen] = useState(false);
  const [chiefChatHistory, setChiefChatHistory] = useState([]);
  const [activeChiefSessionId, setActiveChiefSessionId] = useState(null);
  const chiefChatEndRef = useRef(null);

  // 활성 섹션 변경 시 Tiptap 본문 및 문단 블록 동기화
  useEffect(() => {
    if (currentSection) {
      setLocalTitle(currentSection.title || '');
      const content = currentSection.content || '';
      setLocalContent(content);
      if (editorRef.current && editorRef.current.getHTML() !== content) {
        editorRef.current.setContent(content);
      }
      setParagraphs(htmlToParagraphs(content));
    } else {
      setLocalTitle('');
      setLocalContent('');
      if (editorRef.current) {
        editorRef.current.setContent('');
      }
      setParagraphs([]);
    }
  }, [currentSection?.id]);

  // 에디터 모드 전환 ('doc' ↔ 'block')
  const switchEditorMode = (newMode) => {
    if (newMode === editorMode) return;
    if (newMode === 'block') {
      const currentHtml = editor ? editor.getHTML() : localContent;
      const parsed = htmlToParagraphs(currentHtml);
      setParagraphs(parsed);
      setActiveParagraphId(parsed[0]?.id || null);
      setEditorMode('block');
    } else {
      const combinedHtml = paragraphsToHtml(paragraphs);
      setLocalContent(combinedHtml);
      if (editor) {
        editor.commands.setContent(combinedHtml);
      }
      updateActiveSectionContent(combinedHtml);
      setEditorMode('doc');
    }
  };

  // 문단 서식 태그 변경 (H1, H2, H3, P, Blockquote)
  const handleSetParagraphTag = (id, newTag) => {
    setParagraphs((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const tag = newTag || 'p';
          return {
            ...p,
            tag,
            html: `<${tag}>${p.text || ''}</${tag}>`
          };
        }
        return p;
      });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = paragraphsToHtml(updated);
        setLocalContent(html);
        if (editor) editor.commands.setContent(html);
        updateActiveSectionContent(html);
      }, 300);
      return updated;
    });
  };

  // 문단 모드 인라인 서식 적용 헬퍼 (굵게, 기울임, 밑줄, 취소선, 리스트, 코드 등)
  const applyInlineFormatToParagraph = (prefix, suffix = '', isLinePrefix = false) => {
    const targetId = activeParagraphId || paragraphs[0]?.id;
    if (!targetId) return;

    const textarea = document.querySelector(`.paragraph-textarea[data-id="${targetId}"]`);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const selected = val.substring(start, end);

    let replacement = '';
    let newCursorStart = start;
    let newCursorEnd = end;

    if (isLinePrefix) {
      replacement = `${prefix}${selected || '목록 항목'}`;
      newCursorStart = start + prefix.length;
      newCursorEnd = newCursorStart + (selected ? selected.length : 5);
    } else {
      const innerText = selected || '내용';
      replacement = `${prefix}${innerText}${suffix}`;
      newCursorStart = start + prefix.length;
      newCursorEnd = newCursorStart + innerText.length;
    }

    const nextVal = val.substring(0, start) + replacement + val.substring(end);
    handleParagraphChange(targetId, nextVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 10);
  };

  // 문단 모드 서식 지우기
  const clearInlineFormatInParagraph = () => {
    const targetId = activeParagraphId || paragraphs[0]?.id;
    if (!targetId) return;
    const textarea = document.querySelector(`.paragraph-textarea[data-id="${targetId}"]`);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const selected = val.substring(start, end);

    if (selected) {
      const cleaned = selected
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/<u>(.*?)<\/u>/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/^[•\->1-9\.]+\s+/gm, '');
      const nextVal = val.substring(0, start) + cleaned + val.substring(end);
      handleParagraphChange(targetId, nextVal);
    } else {
      handleSetParagraphTag(targetId, 'p');
    }
  };

  // 문단 내용 수정 (태그 무손실 유지)
  const handleParagraphChange = (id, newText) => {
    setParagraphs((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          const tag = p.tag || 'p';
          return {
            ...p,
            text: newText,
            html: `<${tag}>${newText}</${tag}>`
          };
        }
        return p;
      });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = paragraphsToHtml(updated);
        setLocalContent(html);
        if (editor) editor.commands.setContent(html);
        updateActiveSectionContent(html);
      }, 300);
      return updated;
    });
  };

  // 문단 순서 이동 (위: 'up' / -1, 아래: 'down' / +1)
  const handleMoveParagraph = (index, direction) => {
    const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : Number(direction);
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= paragraphs.length || isNaN(targetIndex)) return;
    setParagraphs((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      const html = paragraphsToHtml(updated);
      setLocalContent(html);
      if (editor) editor.commands.setContent(html);
      updateActiveSectionContent(html);
      return updated;
    });
  };

  // 문단 삭제
  const handleDeleteParagraph = (index) => {
    if (paragraphs.length <= 1) {
      handleParagraphChange(paragraphs[0].id, '');
      return;
    }
    setParagraphs((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const html = paragraphsToHtml(updated);
      setLocalContent(html);
      if (editor) editor.commands.setContent(html);
      updateActiveSectionContent(html);
      return updated;
    });
  };

  // 문단 키워드/요약 메모 수정
  const handleParagraphLabelChange = (id, newLabel) => {
    setParagraphs((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          return { ...p, label: newLabel };
        }
        return p;
      });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = paragraphsToHtml(updated);
        setLocalContent(html);
        if (editor) editor.commands.setContent(html);
        updateActiveSectionContent(html);
      }, 300);
      return updated;
    });
  };

  // 새 문단 추가
  const handleAddParagraph = (afterIndex = -1) => {
    const newBlock = {
      id: generateBlockId(),
      text: '',
      label: '',
      html: '<p></p>',
      tag: 'p',
      role: '본문'
    };
    setParagraphs((prev) => {
      const updated = [...prev];
      if (afterIndex === -1 || afterIndex >= updated.length - 1) {
        updated.push(newBlock);
      } else {
        updated.splice(afterIndex + 1, 0, newBlock);
      }
      const html = paragraphsToHtml(updated);
      setLocalContent(html);
      if (editor) editor.commands.setContent(html);
      updateActiveSectionContent(html);
      return updated;
    });
    setActiveParagraphId(newBlock.id);
  };

  // 특정 문단을 우측 AI 문장 교정기에 전송
  const handleSendParagraphToPolish = (block) => {
    if (!block.text || !block.text.trim()) {
      showToast('다듬을 문단 내용이 비어있습니다.', 'info');
      return;
    }
    setPolishSourceText(block.text);
    setActiveAiTab('polish');
    showToast('✨ 해당 문단이 우측 AI 문장 교정기에 입력되었습니다!', 'success');
  };

  if (!activeBook) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        도서 프로젝트가 선택되지 않았습니다. <button className="btn btn-primary" onClick={() => setView('library')} style={{ marginLeft: '1rem' }}>내 서재로 이동</button>
      </div>
    );
  }

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setLocalTitle(title);
    updateActiveSectionTitle(title);
  };

  const handleSave = async () => {
    setIsSaving(true);
    let html = '';
    if (editorMode === 'block') {
      html = paragraphsToHtml(paragraphs);
      if (editor) editor.commands.setContent(html);
    } else {
      html = editor ? editor.getHTML() : localContent;
    }
    updateActiveSectionContent(html);
    const success = await saveActiveSection();
    setIsSaving(false);
    if (success) showToast('저장되었습니다.', 'success');
  };

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
        bookTitle: activeBook.title,
        bookSubtitle: activeBook.subtitle || '',
        chapterTitle: currentChapter?.title || '',
        sectionTitle: localTitle || currentSection.title,
        keywords: draftKeywords.trim(),
        instruction: draftInstruction.trim(),
        tone: draftTone,
        targetLength: draftLength,
        existingContent: editor?.getText() || localContent,
        referenceNotes,
        targetAudience: activeBook.targetAudience || '',
        genre: activeBook.genre || ''
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
    await saveActiveSection();
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
    await saveActiveSection();
    showToast('초고가 본문 끝에 이어서 추가되었습니다.', 'success');
  };

  // 상단 툴바의 빠른 AI 집필 버튼 클릭 시 (초고 집필 탭으로 포커스 & 즉시 실행)
  const handleGenerateSectionAI = () => {
    setActiveAiTab('draft');
    handleRunDraftAgent();
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

  // 목차 기획 제출
  const handleGenerateOutline = async (e) => {
    e.preventDefault();

    // API 키 등록 여부 확인: 미등록 시 액션 토스트로 설정 이동 안내
    const cfg = storageService.getConfig();
    if (!cfg.geminiApiKey || !cfg.geminiApiKey.trim()) {
      showActionToast(
        'AI 목차 생성을 위해 Google 무료 API 키가 필요합니다. 설정으로 이동하시겠습니까?',
        () => {
          setIsOutlineModalOpen(false);
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
      setIsOutlineModalOpen(false);
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
            setIsOutlineModalOpen(false);
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

  // AI 총괄 편집장 대화 및 히스토리 로컬 스토리지 동기화
  useEffect(() => {
    if (!activeBook?.id) return;
    try {
      const savedActive = localStorage.getItem(`chief_chat_active_${activeBook.id}`);
      const savedActiveId = localStorage.getItem(`chief_chat_active_id_${activeBook.id}`);
      if (savedActive) {
        setChiefMessages(JSON.parse(savedActive));
        setActiveChiefSessionId(savedActiveId || null);
      } else {
        setChiefMessages([getDefaultWelcomeMessage(activeBook.title)]);
        setActiveChiefSessionId(null);
      }
      const savedHistory = localStorage.getItem(`chief_chat_history_${activeBook.id}`);
      if (savedHistory) {
        setChiefChatHistory(JSON.parse(savedHistory));
      } else {
        setChiefChatHistory([]);
      }
    } catch (e) {
      console.error('Failed to load chief chat storage:', e);
      setChiefMessages([getDefaultWelcomeMessage(activeBook.title)]);
      setActiveChiefSessionId(null);
    }
  }, [activeBook?.id]);

  // 대화 변경 시 실시간 자동 보존 (Zero-Latency)
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

  // 대화 초기화 및 이전 대화 히스토리 자동 보관 핸들러 (중복 방지: 기존 세션 덮어쓰기 지원)
  const handleResetChiefChat = () => {
    const userMessages = chiefMessages.filter((m) => m.role === 'user');
    if (userMessages.length > 0) {
      const firstUserText = userMessages[0]?.content || '편집장 상담 세션';
      const sessionTitle = firstUserText.length > 26 ? `${firstUserText.slice(0, 26)}...` : firstUserText;
      const nowStr = new Date().toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      // 기존에 불러와서 이어 쓰던 세션인지 확인
      const existingIdx = activeChiefSessionId
        ? chiefChatHistory.findIndex((s) => s.id === activeChiefSessionId)
        : -1;

      let updatedHistory;
      if (existingIdx >= 0) {
        // ★ 기존 세션 덮어쓰기 업데이트 (중복 생성 방지!)
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
        // ★ 신규 대화 세션 생성
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

    // 신규 세션 상태로 리셋
    setActiveChiefSessionId(null);
    try {
      localStorage.removeItem(`chief_chat_active_id_${activeBook?.id}`);
    } catch (e) {}
    setChiefMessages([getDefaultWelcomeMessage(activeBook?.title)]);
    setIsChiefHistoryOpen(false);
  };

  // 과거 히스토리 세션 불러오기 (세션 ID 추적 등록)
  const handleLoadHistorySession = (session) => {
    setActiveChiefSessionId(session.id);
    setChiefMessages(session.messages || []);
    setIsChiefHistoryOpen(false);
    showToast(`'${session.title}' 대화 기록을 불러왔습니다.`, 'success');
  };

  // 과거 히스토리 세션 삭제
  const handleDeleteHistorySession = (sessionId, e) => {
    e.stopPropagation();
    if (window.confirm('이 대화 기록을 삭제하시겠습니까?')) {
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

  // 편집장 채팅 스크롤 자동 이동
  useEffect(() => {
    if (isChiefModalOpen && chiefChatEndRef.current) {
      chiefChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chiefMessages, isChiefReplying, isChiefModalOpen]);

  // 편집장 메시지 전송 핸들러
  const handleSendChiefMessage = async (customPrompt) => {
    const text = (typeof customPrompt === 'string' ? customPrompt : chiefInput).trim();
    if (!text || isChiefReplying) return;

    const cfg = storageService.getConfig();
    if (!cfg.geminiApiKey || !cfg.geminiApiKey.trim()) {
      showActionToast(
        'AI 총괄 편집장 상담을 위해 Google 무료 API 키가 필요합니다. 설정으로 이동하시겠습니까?',
        () => {
          setIsChiefModalOpen(false);
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

  // 편집장 제안 목차 즉시 도서 반영
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

  // 내보내기 텍스트 생성 (번호 중복 없는 깔끔한 포맷)
  const getExportText = () => {
    if (exportFormat === 'md') {
      let md = `# ${activeBook.title}\n\n`;
      if (activeBook.subtitle) md += `> ${activeBook.subtitle}\n\n`;
      activeBook.chapters?.forEach((c, cI) => {
        md += `## 제 ${cI + 1}장. ${cleanTitle(c.title)}\n\n`;
        c.sections?.forEach((s, sI) => {
          md += `### ${cI + 1}.${sI + 1} ${cleanTitle(s.title)}\n\n${s.content || ''}\n\n`;
        });
      });
      return md;
    }
    let txt = `[${activeBook.title}]\n\n`;
    activeBook.chapters?.forEach((c, cI) => {
      txt += `[제 ${cI + 1}장. ${cleanTitle(c.title)}]\n\n`;
      c.sections?.forEach((s, sI) => {
        txt += `(${cI + 1}.${sI + 1} ${cleanTitle(s.title)})\n${s.content || ''}\n\n`;
      });
    });
    return txt;
  };

  return (
    <div className="studio-container">
      {/* 1열: 목차 패널 */}
      <aside className="toc-panel">
        <div className="toc-header">
          <button className="back-btn" onClick={() => setView('library')}>
            <ArrowLeft size={14} />
            <span>내 서재로</span>
          </button>
          <div className="toc-book-title-row">
            <div className="toc-book-title" title={activeBook.title}>{activeBook.title}</div>
            <button
              type="button"
              className="btn-toc-version-history"
              onClick={() => setIsVersionModalOpen(true)}
              title="버전 관리"
            >
              <History size={15} />
            </button>
          </div>
          <div className="toc-actions">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', width: '100%' }}>
              <button className="btn btn-secondary" onClick={() => {
                const t = window.prompt('추가할 챕터명:');
                if (t?.trim()) addChapter(cleanTitle(t.trim()));
              }}>
                <Plus size={13} />
                <span>챕터 추가</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setIsOutlineModalOpen(true)}>
                <Sparkles size={13} />
                <span>목차 기획</span>
              </button>
            </div>

            {/* AI 총괄 편집장(Editor-in-Chief) 전역 에이전트 호출 배너 */}
            <button
              type="button"
              className="btn-editor-chief-banner"
              onClick={() => {
                setIsChiefModalOpen(true);
                setChiefResult(null);
              }}
              title="도서 총괄 코칭 및 목차 지능형 재구성/진단"
            >
              <div className="chief-banner-icon">🏛️</div>
              <div className="chief-banner-text">
                <strong>AI 총괄 편집장</strong>
                <span>목차 진단 · 병합 · 코칭</span>
              </div>
              <span className="chief-badge-pill">Agent</span>
            </button>

            <button className="btn btn-primary btn-full" onClick={() => setIsExportModalOpen(true)}>
              <Download size={13} />
              <span>전자책 내보내기</span>
            </button>
          </div>
        </div>

        <div className="toc-list" onDragEnd={handleDragEnd}>
          {activeBook.chapters?.map((chap, cIdx) => {
            const isCollapsed = collapsedChapterIds.has(chap.id);
            const isChapterDragging = draggedItem?.type === 'chapter' && draggedItem?.chapterId === chap.id;
            const isChapterOver = dragOverTarget?.type === 'chapter' && dragOverTarget?.id === chap.id;

            const isChapterDropTarget = dragOverTarget?.type === 'chapter-drop-target' && dragOverTarget?.id === chap.id;

            return (
              <div key={chap.id || cIdx} className="chapter-group">
                <div
                  className={`chapter-header ${isChapterDragging ? 'is-dragging' : ''} ${isChapterOver ? `drag-over-${dragOverTarget.position}` : ''} ${isChapterDropTarget ? 'drag-target-hover' : ''}`}
                  draggable={editingChapterId !== chap.id}
                  onDragStart={(e) => handleChapterDragStart(e, chap.id, cIdx)}
                  onDragOver={(e) => handleChapterDragOver(e, chap.id, cIdx)}
                  onDrop={(e) => handleChapterDrop(e, chap.id, cIdx)}
                >
                  {/* 접기/펼치기 토글 버튼 */}
                  <button
                    type="button"
                    className="btn-collapse-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChapterCollapse(chap.id, e);
                    }}
                    title={isCollapsed ? '소목차 펼치기' : '소목차 접기'}
                  >
                    <ChevronRight size={13} className={`collapse-chevron ${isCollapsed ? '' : 'open'}`} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', flex: 1 }}>
                    {editingChapterId === chap.id ? (
                      <input
                        type="text"
                        className="chapter-inline-edit-input"
                        value={editingChapterTitle}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingChapterTitle(e.target.value)}
                        onBlur={() => {
                          if (editingChapterTitle.trim() && editingChapterTitle.trim() !== cleanTitle(chap.title)) {
                            updateChapterTitle(chap.id, cleanTitle(editingChapterTitle.trim()));
                          }
                          setEditingChapterId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingChapterTitle.trim() && editingChapterTitle.trim() !== cleanTitle(chap.title)) {
                              updateChapterTitle(chap.id, cleanTitle(editingChapterTitle.trim()));
                            }
                            setEditingChapterId(null);
                          } else if (e.key === 'Escape') {
                            setEditingChapterId(null);
                          }
                        }}
                      />
                    ) : (
                      <span
                        title="더블클릭하여 챕터명 수정"
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                        onDoubleClick={() => {
                          setEditingChapterId(chap.id);
                          setEditingChapterTitle(cleanTitle(chap.title));
                        }}
                      >
                        {cIdx + 1}장. {cleanTitle(chap.title)}
                      </span>
                    )}

                    <span className={`chapter-badge-mini ${chap.status === 'published' ? 'published' : 'draft'}`}>
                      {chap.status === 'published' ? '연재중' : '초고'}
                    </span>
                  </div>

                  <div className="chapter-header-actions">
                    <button
                      type="button"
                      className="btn-add-section"
                      onClick={(e) => {
                        e.stopPropagation();
                        const t = window.prompt('추가할 소목차명:');
                        if (t?.trim()) addSection(chap.id, cleanTitle(t.trim()));
                      }}
                      title="소목차 추가"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-delete-chapter"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`'${cleanTitle(chap.title)}' 챕터를 삭제하시겠습니까?\n포함된 모든 소목차와 본문도 함께 삭제됩니다.`)) {
                          deleteChapter(chap.id);
                        }
                      }}
                      title="챕터 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 소목차 목록 (접혔을 때는 숨김) */}
                {!isCollapsed && (
                  <div
                    className="section-list"
                    onDragOver={(e) => {
                      if (draggedItem?.type === 'section' && (!chap.sections || chap.sections.length === 0)) {
                        e.preventDefault();
                      }
                    }}
                    onDrop={(e) => {
                      if (draggedItem?.type === 'section' && (!chap.sections || chap.sections.length === 0)) {
                        e.preventDefault();
                        reorderSections(draggedItem.chapterId, chap.id, draggedItem.sIdx, 0);
                        setDraggedItem(null);
                        setDragOverTarget(null);
                      }
                    }}
                  >
                    {chap.sections?.map((sec, sIdx) => {
                      const isActive = chap.id === activeChapterId && sec.id === activeSectionId;
                      const isSecDragging = draggedItem?.type === 'section' && draggedItem?.sectionId === sec.id;
                      const isSecOver = dragOverTarget?.type === 'section' && dragOverTarget?.id === sec.id;
                      const rawText = (sec.content || '').replace(/<[^>]*>/g, '').trim();
                      const isDone = rawText.length > 0;

                      return (
                        <div
                          key={sec.id || sIdx}
                          className={`section-item ${isActive ? 'active' : ''} ${isSecDragging ? 'is-dragging' : ''} ${isSecOver ? `drag-over-${dragOverTarget.position}` : ''}`}
                          draggable={true}
                          onDragStart={(e) => handleSectionDragStart(e, chap.id, sec.id, cIdx, sIdx)}
                          onDragOver={(e) => handleSectionDragOver(e, sec.id, cIdx, sIdx)}
                          onDrop={(e) => handleSectionDrop(e, chap.id, sIdx)}
                          onClick={() => {
                            setActiveChapterId(chap.id);
                            setActiveSectionId(sec.id);
                          }}
                        >
                          <span className="section-item-title">{cIdx + 1}.{sIdx + 1} {cleanTitle(sec.title)}</span>
                          <div className="section-item-meta">
                            <div
                              className={`status-dot ${isDone ? 'completed' : ''}`}
                              title={isDone ? `집필 완료 (${rawText.length.toLocaleString()}자)` : '미작성 (빈 원고)'}
                            />
                            <button
                              type="button"
                              className="btn-delete-section"
                              title="소목차 삭제"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`'${cleanTitle(sec.title)}' 소목차를 삭제하시겠습니까?\n작성된 원고 내용도 함께 삭제됩니다.`)) {
                                  deleteSection(chap.id, sec.id);
                                }
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2열: 에디터 작업 영역 */}
      <main className="editor-workspace">
        {/* 1행: 상위 챕터 정보 바 (챕터명 + 주간 마감 D-Day + 연재 발행) */}
        {currentChapter && (
          <div className="editor-sprint-bar">
            <div className="sprint-left-group">
              <div className="chapter-title-header-wrapper">
                <span className="chapter-num-prefix">
                  {currentChapterIndex >= 0 ? `제 ${currentChapterIndex + 1}장.` : ''}
                </span>
                <input
                  type="text"
                  className="chapter-title-header-input"
                  value={cleanTitle(currentChapter.title)}
                  placeholder="챕터명을 입력하세요"
                  title="클릭하여 챕터명 직접 수정"
                  onChange={(e) => updateChapterTitle(currentChapter.id, e.target.value)}
                />
              </div>
              {(() => {
                const dday = calculateDDay(currentChapter.deadline);
                return (
                  <span className={`dday-badge ${dday.status}`}>
                    <Calendar size={12} />
                    <span>{dday.text}</span>
                  </span>
                );
              })()}
              <input
                type="date"
                className="deadline-picker"
                title="주간 마감 목표일 설정"
                value={currentChapter.deadline || ''}
                onChange={(e) => setChapterDeadline(currentChapter.id, e.target.value)}
              />
            </div>

            <div className="publish-group">
              {currentChapter.status === 'published' ? (
                <>
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                    ✓ {new Date(currentChapter.publishedAt || Date.now()).toLocaleDateString('ko-KR')} 연재 발행됨
                  </span>
                  <button
                    className="btn-publish draft"
                    onClick={() => toggleChapterPublish(currentChapter.id)}
                    title="발행을 취소하고 초고 상태로 되돌립니다"
                  >
                    발행 취소
                  </button>
                </>
              ) : (
                <button
                  className="btn-publish published"
                  onClick={() => toggleChapterPublish(currentChapter.id)}
                  title="독자와 피어 리뷰어에게 이 챕터를 공개 연재합니다"
                >
                  <Send size={13} />
                  <span>🚀 챕터 연재 발행하기</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2행: 하위 소목차(절) 작업 툴바 (소목차 제목 인풋 + 글자수 + 저장/AI 도구) */}
        <header className="editor-toolbar">
          <input
            type="text"
            className="section-title-input"
            placeholder="소목차 제목을 입력하세요"
            value={localTitle}
            onChange={handleTitleChange}
          />
          <div className="editor-tools">
            <span className="word-count-badge">{(editor?.getText()?.trim()?.length || 0).toLocaleString()} 자</span>
            <button className="btn btn-secondary" onClick={() => { loadVault(); setIsVaultModalOpen(true); }}>
              <Lightbulb size={15} />
              <span>자료 금고 ({selectedVaultIds.length})</span>
            </button>
            <button className="btn btn-primary" onClick={handleGenerateSectionAI} disabled={isGenerating}>
              <Sparkles size={15} />
              <span>{isGenerating ? 'AI 집필 중...' : 'AI 소목차 집필'}</span>
            </button>
            {/* 디스켓 저장 드롭다운 (저장 / 새 버전으로 저장) */}
            <div className="save-dropdown-wrapper" ref={saveMenuRef}>
              <button
                type="button"
                className={`btn btn-secondary btn-save-icon-only ${isSaveMenuOpen ? 'active' : ''}`}
                onClick={() => setIsSaveMenuOpen(prev => !prev)}
                title="저장 메뉴 (저장 / 새 버전으로 저장)"
                disabled={isSaving}
              >
                <Save size={16} />
              </button>
              {isSaveMenuOpen && (
                <div className="save-dropdown-menu">
                  <button
                    type="button"
                    className="save-dropdown-item"
                    onClick={async () => {
                      setIsSaveMenuOpen(false);
                      await handleSave();
                    }}
                  >
                    <Save size={14} />
                    <span>저장</span>
                  </button>
                  <button
                    type="button"
                    className="save-dropdown-item"
                    onClick={() => {
                      setIsSaveMenuOpen(false);
                      const nextVer = `v${(activeBook.versions?.length || 0) + 1}.0`;
                      setNewVersionName(nextVer);
                      setIsCreateVersionModalOpen(true);
                    }}
                  >
                    <History size={14} />
                    <span>새 버전으로 저장</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 2열 에디터 서브 탑바: 듀얼 모드 토글 (본문 모드 vs 문단 모드) & 미리보기 버튼 */}
        <div className="editor-sub-topbar">
          <div className="editor-mode-toggle-group">
            <button
              type="button"
              className={`btn-mode-toggle ${editorMode === 'doc' ? 'active' : ''}`}
              onClick={() => switchEditorMode('doc')}
              title="한 편의 글을 끊김 없이 작성하는 표준 통합 에디터"
            >
              <FileText size={13} />
              <span>본문 모드</span>
            </button>
            <button
              type="button"
              className={`btn-mode-toggle ${editorMode === 'block' ? 'active' : ''}`}
              onClick={() => switchEditorMode('block')}
              title="문단을 모듈형 블록으로 순서 변경, 추가/삭제, 개별 퇴고하는 모드"
            >
              <Layers size={13} />
              <span>문단 모드 ({paragraphs.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-html-preview-popup"
              onClick={() => {
                if (activeBook) {
                  openReader(activeBook.id, activeChapterId);
                }
              }}
              title="문피아·네이버 스타일 표준 통합 웹 뷰어로 즉시 열람합니다"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <BookOpen size={14} style={{ color: 'var(--primary)' }} />
              <span>표준 뷰어로 읽기</span>
            </button>
            <button
              className="btn-html-preview-popup"
              onClick={() => setIsPreviewModalOpen(true)}
              title="작성 중인 원고의 완성된 전자책 스타일 뷰를 팝업으로 봅니다"
            >
              <span className="preview-eye-icon">👁</span> HTML 미리보기 팝업
            </button>
          </div>
        </div>

        <div className="editor-body-split">
          <div className="main-textarea-pane">
            {editorMode === 'doc' ? (
              /* 본문 모드: 분리된 독립 고성능 TiptapEditor 엔진 */
              <TiptapEditor
                ref={editorRef}
                content={localContent}
                onChange={(html) => {
                  setLocalContent(html);
                  updateActiveSectionContent(html);
                }}
                onSelectText={(text) => {
                  if (text) setPolishSourceText(text);
                }}
              />
            ) : (
              /* 문단 모듈 워크스페이스 (문단 블록 전용 툴바 및 카드 리스트) */
              <>
                <div className="rich-toolbar">
                  <div className="toolbar-group">
                    <select
                      className="toolbar-select"
                      value={(paragraphs.find(p => p.id === activeParagraphId) || paragraphs[0])?.tag || 'p'}
                      onChange={(e) => {
                        const cur = paragraphs.find(p => p.id === activeParagraphId) || paragraphs[0];
                        if (cur) handleSetParagraphTag(cur.id, e.target.value);
                      }}
                      title="단락 서식 (본문 / 제목 / 인용구)"
                    >
                      <option value="p">Normal (본문)</option>
                      <option value="h1">대제목 (H1)</option>
                      <option value="h2">중제목 (H2)</option>
                      <option value="h3">소제목 (H3)</option>
                      <option value="blockquote">인용문 (Quote)</option>
                    </select>
                  </div>

                  <div className="toolbar-divider" />

                  <div className="toolbar-group">
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('**', '**')}
                      title="굵게 (Ctrl+B)"
                    >
                      <b>B</b>
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('*', '*')}
                      title="기울임 (Ctrl+I)"
                    >
                      <i>I</i>
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('<u>', '</u>')}
                      title="밑줄 (Ctrl+U)"
                    >
                      <u>U</u>
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('~~', '~~')}
                      title="취소선"
                    >
                      <s>S</s>
                    </button>
                  </div>

                  <div className="toolbar-divider" />

                  <div className="toolbar-group">
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('• ', '', true)}
                      title="글머리 기호 목록"
                    >
                      •≡
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('1. ', '', true)}
                      title="번호 매기기 목록"
                    >
                      1≡
                    </button>
                    <button
                      type="button"
                      className={`tool-btn ${(paragraphs.find(p => p.id === activeParagraphId) || paragraphs[0])?.tag === 'blockquote' ? 'active' : ''}`}
                      onClick={() => {
                        const cur = paragraphs.find(p => p.id === activeParagraphId) || paragraphs[0];
                        if (cur) handleSetParagraphTag(cur.id, cur.tag === 'blockquote' ? 'p' : 'blockquote');
                      }}
                      title="인용 블록"
                    >
                      ❞
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => applyInlineFormatToParagraph('`', '`')}
                      title="코드 블록"
                    >
                      &lt;/&gt;
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => clearInlineFormatInParagraph()}
                      title="서식 지우기"
                    >
                      T<sub>x</sub>
                    </button>
                  </div>

                  <div className="toolbar-group" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      활성 블록: <strong style={{ color: 'var(--primary)' }}>#{paragraphs.findIndex(p => p.id === activeParagraphId) >= 0 ? paragraphs.findIndex(p => p.id === activeParagraphId) + 1 : 1}</strong>
                      {(() => {
                        const cur = paragraphs.find(p => p.id === activeParagraphId) || paragraphs[0];
                        return cur?.tag && cur.tag !== 'p' ? ` (${cur.tag.toUpperCase()})` : '';
                      })()}
                    </span>
                  </div>
                </div>

                {/* 문단 모듈 워크스페이스 */}
                <div className="paragraph-workspace">
                <div className="paragraph-workspace-header">
                  <div className="paragraph-workspace-title">
                    <Layers size={16} />
                    <span>문단 모듈 편집기 ({paragraphs.length}개 블록)</span>
                  </div>
                  <span className="paragraph-workspace-guide">
                    문단별로 독립된 카드로 분리되어 순서 이동, 개별 AI 퇴고 및 블록 삽입/삭제가 가능합니다.
                  </span>
                </div>

                <div className="paragraph-cards-container">
                  {paragraphs.length === 0 ? (
                    <div className="empty-paragraphs-notice">
                      <p>작성된 문단이 없습니다. 새 문단을 추가해 집필을 시작하세요.</p>
                      <button
                        type="button"
                        className="btn-add-first-paragraph"
                        onClick={() => handleAddParagraph(-1)}
                      >
                        <Plus size={15} />
                        <span>첫 문단 추가</span>
                      </button>
                    </div>
                  ) : (
                    paragraphs.map((p, idx) => (
                      <React.Fragment key={p.id}>
                        <div
                          className={`paragraph-card ${activeParagraphId === p.id ? 'active' : ''}`}
                          onClick={() => setActiveParagraphId(p.id)}
                        >
                          <div className="paragraph-card-header">
                            <div className="paragraph-meta-info">
                              <span className="paragraph-badge">#{idx + 1}</span>
                              {p.tag && p.tag !== 'p' && (
                                <span className="paragraph-tag-badge" title={`단락 서식: ${p.tag.toUpperCase()}`}>
                                  {p.tag === 'h1' ? 'H1 대제목' : p.tag === 'h2' ? 'H2 중제목' : p.tag === 'h3' ? 'H3 소제목' : p.tag === 'blockquote' ? '인용구' : p.tag.toUpperCase()}
                                </span>
                              )}
                              <input
                                type="text"
                                className="paragraph-label-input"
                                value={p.label || ''}
                                placeholder="📌 키워드 / 요약 메모"
                                title="문단 모드에서만 보이는 작가용 메모/키워드"
                                onChange={(e) => handleParagraphLabelChange(p.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="paragraph-char-count">{(p.text || '').length}자</span>
                            </div>
                            <div className="paragraph-actions">
                              <button
                                type="button"
                                className="btn-block-action"
                                title="위로 이동"
                                disabled={idx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveParagraph(idx, 'up');
                                }}
                              >
                                <MoveUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-block-action"
                                title="아래로 이동"
                                disabled={idx === paragraphs.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveParagraph(idx, 'down');
                                }}
                              >
                                <MoveDown size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-block-action btn-polish-block"
                                title="이 문단을 AI 문장 교정에 전송"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendParagraphToPolish(p);
                                }}
                              >
                                <Wand2 size={13} />
                                <span>AI 퇴고</span>
                              </button>
                              <button
                                type="button"
                                className="btn-block-action btn-delete-block"
                                title="문단 삭제"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteParagraph(idx);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="paragraph-card-body">
                            <textarea
                              className="paragraph-textarea"
                              data-id={p.id}
                              value={p.text || ''}
                              placeholder="문단 내용을 입력하세요..."
                              onChange={(e) => handleParagraphChange(p.id, e.target.value)}
                              onFocus={() => setActiveParagraphId(p.id)}
                              rows={Math.max(2, Math.min(12, Math.ceil(((p.text || '').length || 1) / 45) + ((p.text || '').split('\n').length - 1)))}
                            />
                          </div>
                        </div>

                        {/* 문단 사이 삽입 구분선 버튼 */}
                        <div className="paragraph-inserter-row">
                          <button
                            type="button"
                            className="btn-insert-between"
                            onClick={() => handleAddParagraph(idx)}
                            title="이 사이에 새 문단 추가"
                          >
                            <Plus size={13} />
                            <span>문단 추가</span>
                          </button>
                        </div>
                      </React.Fragment>
                    ))
                  )}

                  {paragraphs.length > 0 && (
                    <button
                      type="button"
                      className="btn-bottom-add-paragraph"
                      onClick={() => handleAddParagraph(paragraphs.length - 1)}
                    >
                      <Plus size={16} />
                      <span>새 문단 추가</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

          {/* 3열: AI 코파일럿 패널 (AI 초고 집필 에이전트 & AI 문장 교정) */}
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
                  <span className="polish-header-sub">
                    {currentChapter ? `📍 제 ${currentChapterIndex + 1}장. ${cleanTitle(currentChapter.title)} > ${cleanTitle(localTitle || currentSection?.title || '소목차')}` : '키워드와 지시어로 소목차 본문을 완성합니다.'}
                  </span>
                </div>

                {/* 1. 핵심 키워드 및 소재 */}
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
                  {selectedVaultIds.length > 0 && (
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

                {/* AI 초고 작성 시작 독립 실행 버튼 (설정 박스 바깥) */}
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

            {/* 패널 최하단: 스크롤 범위에 포함되지 않는 고정 푸터 (선택된 모델의 실시간 잔여량 버튼) */}
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
        </div>
      </main>

      {/* 우측 덮어쓰기 패널: AI 총괄 편집장 (우측 패널과 1:1 동일 크기, 백드롭 없이 에디터 작업 병행 가능, X버튼으로만 닫힘) */}
      {isChiefModalOpen && (
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
                onClick={() => setIsChiefModalOpen(false)}
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
              {/* 채팅 메시지 영역 */}
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

                          {/* 메시지에 목차 개편안 데이터가 포함된 경우 원클릭 미리보기 & 반영 카드 */}
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

                  {/* 편집장 생각 중 인디케이터 */}
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

              {/* 하단 입력 영역: 추천 기능 칩 + 대화 입력창 */}
              <div className="chief-chat-input-container">
                {/* 추천 기능 칩 바 (도서 제목 추천, 목차 진단, 베스트셀러와 비교, 전체 서사/논리 점검, 톤앤매너 감수, 프롤로그/에필로그 기획) */}
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

                {/* 대화 입력 폼 */}
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
      )}

      {/* 모달 1: AI 목차 기획 */}
      {isOutlineModalOpen && (
        <div className="modal-overlay" onClick={() => setIsOutlineModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI 목차 자동 기획</h2>
              <button className="modal-close-btn" onClick={() => setIsOutlineModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleGenerateOutline}>
              <div className="modal-body">
                <div className="form-group">
                  <label>도서 제목</label>
                  <input type="text" className="form-control" value={activeBook.title} disabled />
                </div>

                {/* 베스트셀러 장르 템플릿 선택 칩 */}
                <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📚 베스트셀러 표준 규격 템플릿 (25권 표본 DB)</span>
                    {selectedGenre && bestsellerDb.genres[selectedGenre] && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 500 }}>
                        {bestsellerDb.genres[selectedGenre].standards.chapters}장 × {bestsellerDb.genres[selectedGenre].standards.sectionsPerChapter}꼭지 표준
                      </span>
                    )}
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.45rem',
                    marginTop: '0.35rem'
                  }}>
                    {Object.values(bestsellerDb.genres).map((g) => {
                      const isSelected = selectedGenre === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGenre(g.id);
                            setChapterCount(String(g.standards.chapters));
                            setCustomChapterCount(g.standards.chapters);
                            setSectionsPerChapter(String(g.standards.sectionsPerChapter));
                            setCustomSectionCount(g.standards.sectionsPerChapter);
                          }}
                          style={{
                            padding: '0.55rem 0.65rem',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'var(--bg-active, rgba(0, 114, 245, 0.1))' : 'var(--bg-card-sub)',
                            color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ fontSize: '1rem' }}>{g.icon}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>챕터 수</label>
                    <select
                      className="form-control"
                      value={chapterCount}
                      onChange={(e) => {
                        setChapterCount(e.target.value);
                      }}
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
                        className="form-control"
                        style={{ marginTop: '0.4rem' }}
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
                      onChange={(e) => {
                        setSectionsPerChapter(e.target.value);
                      }}
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
                        className="form-control"
                        style={{ marginTop: '0.4rem' }}
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
                    <div style={{
                      backgroundColor: 'var(--bg-card-sub)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md, 8px)',
                      padding: '0.85rem 1rem',
                      marginBottom: '1rem',
                      fontSize: '0.83rem',
                      color: 'var(--text-muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span>📚 예상 책 분량: <strong style={{ color: 'var(--primary)', fontSize: '0.94rem' }}>약 {estBookPages}쪽</strong> ({effChapters}장 × {effSections}꼭지 = 총 {total}꼭지)</span>
                        <span style={{ fontSize: '0.8rem' }}>본문 약 {estWords.toLocaleString()}자 (A4 약 {estA4Pages}장)</span>
                      </div>
                      
                      {genreInfo && (
                        <div style={{
                          borderTop: '1px solid var(--border-color)',
                          paddingTop: '0.45rem',
                          marginTop: '0.45rem',
                          fontSize: '0.78rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>🎯 <strong style={{ color: 'var(--text-main)' }}>{genreInfo.name} 기준</strong>: 꼭지당 약 {avgWords.toLocaleString()}자</span>
                            <span style={{ color: 'var(--text-dim)' }}>{genreInfo.characteristics}</span>
                          </div>
                          <div>
                            📖 <span style={{ color: 'var(--text-dim)' }}>실측 표본:</span> {genreInfo.sampleBooks.slice(0, 3).map(b => `《${b.title}》(${b.structure})`).join(', ')} 등
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="form-group">
                  <label>특별 요구사항</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '80px' }}
                    placeholder="예: 초보자도 쉽게 따라할 수 있는 실습 위주로 설계해줘"
                    value={extraPrompt}
                    onChange={(e) => setExtraPrompt(e.target.value)}
                  />
                </div>

                {/* AI 모델 호출 실패 시 모달 내 직관적 에러 안내 배너 */}
                {outlineError && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.35rem' }}>
                      <AlertTriangle size={18} />
                      <span>{outlineError.isFixed ? `[${outlineError.fixedModelName}] 모델 응답 실패` : '목차 기획 실패'}</span>
                    </div>
                    <p style={{ margin: '0 0 0.65rem 0', color: 'var(--text-muted)', lineHeight: 1.45, fontSize: '0.82rem' }}>
                      {outlineError.message}
                      {outlineError.isFixed && (
                        <span style={{ display: 'block', marginTop: '0.35rem', color: 'var(--text-dim)' }}>
                          💡 구글 AI Studio에서 해당 모델이 일시 점검 중이거나 불안정한 상태입니다. 가장 빠르고 안정적인 <strong>Gemini 3.5 Flash Lite</strong> 또는 <strong>스마트 자동 전환</strong>으로 모델을 변경해 보세요.
                        </span>
                      )}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        padding: '0.5rem 0.85rem',
                        fontSize: '0.83rem',
                        width: '100%',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontWeight: 600
                      }}
                      onClick={() => {
                        setIsOutlineModalOpen(false);
                        setView('settings');
                      }}
                    >
                      <span>⚙️ 설정으로 이동하여 AI 모델 변경하기 ➔</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsOutlineModalOpen(false)}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={isOutlineSubmitting}>
                  <Sparkles size={15} />
                  <span>{isOutlineSubmitting ? '설계 중...' : 'AI 목차 생성'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 2: 전자책 내보내기 */}
      {isExportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExportModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 전자책 전체 내보내기</h2>
              <button className="modal-close-btn" onClick={() => setIsExportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>내보낼 형식</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className={`btn ${exportFormat === 'md' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setExportFormat('md')}>
                    <FileText size={15} /> Markdown (.md)
                  </button>
                  <button type="button" className={`btn ${exportFormat === 'txt' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setExportFormat('txt')}>
                    <FileText size={15} /> Text (.txt)
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>원고 미리보기</label>
                <textarea
                  className="form-control"
                  style={{ height: '220px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  value={getExportText()}
                  readOnly
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => {
                navigator.clipboard.writeText(getExportText());
                showToast('클립보드에 복사되었습니다.', 'info');
              }}>
                <Copy size={15} /> 복사
              </button>
              <button type="button" className="btn btn-primary" onClick={() => {
                const text = getExportText();
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${activeBook.title}.${exportFormat}`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('다운로드되었습니다.', 'success');
              }}>
                <Download size={15} /> 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 자료 금고 선택 */}
      {isVaultModalOpen && (
        <div className="modal-overlay" onClick={() => setIsVaultModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💡 AI 집필 참고 자료 선택</h2>
              <button className="modal-close-btn" onClick={() => setIsVaultModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>선택된 자료: {selectedVaultIds.length}개</span>
                {selectedVaultIds.length > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelectedVaultIds}>
                    선택 초기화
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                {vault.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>자료가 없습니다.</p>
                ) : (
                  vault.map(v => {
                    const sel = selectedVaultIds.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => toggleSelectVaultId(v.id)}
                        style={{
                          display: 'flex', gap: '0.6rem', padding: '0.6rem 0.8rem', borderRadius: '6px',
                          background: sel ? 'var(--bg-active)' : 'var(--bg-panel)',
                          border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-glass)'}`, cursor: 'pointer'
                        }}
                      >
                        <input type="checkbox" checked={sel} onChange={() => {}} style={{ accentColor: 'var(--primary)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: sel ? 'var(--primary)' : 'var(--text-main)' }}>{v.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{v.content?.substring(0, 60)}...</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setIsVaultModalOpen(false)}>
                <Check size={16} /> 적용 완료 ({selectedVaultIds.length}개)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 4: 본문 HTML 미리보기 팝업 (전자책 스타일) */}
      {isPreviewModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPreviewModalOpen(false)}>
          <div className="modal-box modal-box-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📖</span>
                <h2>본문 HTML 미리보기</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsPreviewModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', background: '#0f1117', padding: '2rem' }}>
              <div className="book-preview-paper">
                <div className="book-preview-header-meta">
                  <strong>제 {currentChapter?.title || '1장'}</strong> · <span>{localTitle || currentSection?.title || '소목차'}</span>
                </div>
                <div
                  className="book-preview-content markdown-body"
                  dangerouslySetInnerHTML={{
                    __html: (editor && !editor.isEmpty)
                      ? editor.getHTML()
                      : '<p style="color:#718096;text-align:center;padding:3rem 0;">작성된 본문 내용이 없습니다. 리치 에디터에서 내용을 작성해 보세요.</p>'
                  }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                * 실제 전자책 리더기 및 웹 뷰어에서 렌더링되는 서식입니다.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPreviewModalOpen(false)}>
                  닫기
                </button>
                <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                  🖨️ 인쇄 / PDF 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달 5: 새 버전으로 저장 */}
      {isCreateVersionModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateVersionModalOpen(false)}>
          <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} className="text-primary" />
                <h2>새 버전으로 저장</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsCreateVersionModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateVersion}>
              <div className="modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', marginBottom: '1rem', lineHeight: '1.5' }}>
                  현재 《{activeBook.title}》의 모든 챕터와 원고 상태를 별도의 버전 이력으로 안전하게 보관합니다.
                </p>
                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                    버전 이름 / 식별 태그
                  </label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="예: v1.0 초고 탈고본, 2차 퇴고본 등"
                    value={newVersionName}
                    autoFocus
                    onChange={(e) => setNewVersionName(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateVersionModalOpen(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={15} />
                  <span>버전 저장하기</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 6: 버전 관리 (과거 기록 확인 및 되돌리기) */}
      {isVersionModalOpen && (
        <div className="modal-overlay" onClick={() => setIsVersionModalOpen(false)}>
          <div className="modal-box modal-box-version" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} className="text-primary" />
                <h2>버전 관리</h2>
                <span className="version-book-title-badge">《{activeBook.title}》</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsVersionModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="version-list-intro">
                <p>보관된 버전 기록을 확인하고 원하는 시점의 원고로 언제든 되돌릴 수 있습니다.</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const nextVer = `v${(activeBook.versions?.length || 0) + 1}.0`;
                    setNewVersionName(nextVer);
                    setIsCreateVersionModalOpen(true);
                  }}
                >
                  <Plus size={13} />
                  <span>현재 원고 새 버전으로 저장</span>
                </button>
              </div>

              {(!activeBook.versions || activeBook.versions.length === 0) ? (
                <div className="version-empty-state">
                  <History size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <p>아직 보관된 버전 기록이 없습니다.</p>
                  <span>우측 상단 디스켓 버튼의 [새 버전으로 저장]을 누르면 이 시점의 원고가 보관됩니다.</span>
                </div>
              ) : (
                <div className="version-card-list">
                  {activeBook.versions.map((ver, idx) => (
                    <div key={ver.id || idx} className={`version-card ${ver.isAutoBackup ? 'is-autobackup' : ''}`}>
                      <div className="version-card-main">
                        <div className="version-card-title-row">
                          <strong className="version-card-name">{ver.name}</strong>
                          {ver.isAutoBackup ? (
                            <span className="badge-autobackup">자동 백업</span>
                          ) : (
                            <span className="badge-manual-version">버전 #{activeBook.versions.length - idx}</span>
                          )}
                        </div>
                        <div className="version-card-meta">
                          <span>🕒 {new Date(ver.createdAt).toLocaleString('ko-KR')}</span>
                          <span>·</span>
                          <span>📝 {(ver.totalWords || 0).toLocaleString()} 자</span>
                          <span>·</span>
                          <span>📚 {ver.chapterCount || ver.chapters?.length || 0}개 챕터</span>
                        </div>
                      </div>
                      <div className="version-card-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm btn-version-restore"
                          onClick={() => handleRestoreVersion(ver)}
                          title="이 버전으로 원고 전체 되돌리기"
                        >
                          <RotateCcw size={13} />
                          <span>되돌리기</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-version-delete"
                          onClick={() => handleDeleteVersion(ver)}
                          title="버전 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                * 되돌리기를 실행하면 현재 화면의 원고가 해당 시점의 데이터로 교체됩니다.
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setIsVersionModalOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 AI Model Quotas 모달 */}
      <ModelQuotasModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />
    </div>
  );
}
