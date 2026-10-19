import React, { useState, useEffect, useRef } from 'react';
import './Studio.css';
import { useStore } from '../../store';
import { bookService } from '../../services/bookService';
import { marked } from 'marked';
import TiptapEditor from '../../components/TiptapEditor';
import { htmlToParagraphs, paragraphsToHtml, generateBlockId } from '../../utils/paragraphParser';
import { storageService } from '../../services/storageService';
import { aiService } from '../../services/aiService';
import {
  ArrowLeft, Plus, Sparkles, Download, Save, Lightbulb, Copy, Check, Wand2, X, FileText, Calendar, Send,
  PenTool, Bot, Zap, RotateCcw, FilePlus, Layers, MoveUp, MoveDown, Trash2, LayoutList, AlertTriangle,
  History, MessageSquare, ChevronUp, ChevronDown, ChevronRight, BookOpen, UploadCloud, Clock, Search, Replace,
  CheckSquare, Edit2
} from 'lucide-react';
import ModelQuotasModal from '../../components/ai/ModelQuotasModal';
import AIEditor from '../../components/ai/AIEditor';
import AIAssistant from '../../components/ai/AIAssistant';
import OutlineModal from '../../components/ai/OutlineModal';
import ManuscriptImportModal from '../../components/ManuscriptImportModal';
import PublishModal from './PublishModal';
import { ExportModal, VaultModal, VersionModal } from './StudioModals';
import BookInfoModal from '../../components/BookInfoModal';

marked.setOptions({ breaks: true, gfm: true });

// 목차 번호 중복 방지 헬퍼 (1장, 제1장, 1.1 등 접두사 정제)
const cleanTitle = (t) => aiService.cleanOutlineTitle(t);


export default function Studio() {
  const {
    activeBook, activeChapterId, activeSectionId, isBooksLoading,
    setActiveChapterId, setActiveSectionId,
    updateActiveSectionContent, updateActiveSectionTitle, saveActiveSection,
    addChapter, updateChapterTitle, deleteChapter, addSection, updateSectionTitle, deleteSection,
    moveChapter, moveSection, reorderChapters, reorderSections, undoChapterOrder, openBook, loadBooks,
    setChapterDeadline, toggleChapterPublish, toggleSectionPublish, toggleChapterPublishAll, toggleBookPublishAll,
    updateBatchPublishSections,
    vault, loadVault, selectedVaultIds, toggleSelectVaultId, clearSelectedVaultIds,
    createBookVersion, saveOrUpdateLatestVersion, restoreBookVersion, deleteBookVersion,
    toggleBookCompleted,
    openReader, setView, showToast, showActionToast,
    openConfirm, openPrompt
  } = useStore();

  // 최초 로드 시 activeBook이 없으면 loadBooks 실행
  useEffect(() => {
    if (!activeBook) {
      loadBooks();
    }
  }, [activeBook, loadBooks]);

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

    if (diffDays === 0) return { text: '오늘 마감 D-Day', status: 'urgent' };
    if (diffDays > 0) return { text: `D-${diffDays}`, status: diffDays <= 3 ? 'urgent' : 'normal' };
    return { text: `D+${Math.abs(diffDays)} 초과`, status: 'urgent' };
  };

  // 현재 활성 챕터/섹션
  const currentChapterIndex = activeBook?.chapters?.findIndex(c => c.id === activeChapterId) ?? -1;
  const currentChapter = currentChapterIndex >= 0 ? activeBook.chapters[currentChapterIndex] : null;
  const currentSectionIndex = currentChapter?.sections?.findIndex(s => s.id === activeSectionId) ?? -1;
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

  // 목차 소제목 인라인 더블클릭 수정 상태
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  // 브레드크럼 소제목 인라인 더블클릭 수정 상태
  const [isEditingBreadcrumbTitle, setIsEditingBreadcrumbTitle] = useState(false);
  const [editingBreadcrumbValue, setEditingBreadcrumbValue] = useState('');

  // 소제목 이름 변경 확정 핸들러
  const handleCommitSectionRename = (chapterId, sectionId, newTitle) => {
    const trimmed = cleanTitle(newTitle?.trim() || '');
    if (trimmed) {
      updateSectionTitle(chapterId, sectionId, trimmed);
      if (sectionId === activeSectionId) {
        setLocalTitle(trimmed);
        updateActiveSectionTitle(trimmed);
      }
    }
    setEditingSectionId(null);
  };

  // 브레드크럼 소제목 이름 변경 확정 핸들러
  const handleCommitBreadcrumbRename = () => {
    const trimmed = cleanTitle(editingBreadcrumbValue?.trim() || '');
    if (trimmed && currentChapter && currentSection) {
      updateSectionTitle(currentChapter.id, currentSection.id, trimmed);
      setLocalTitle(trimmed);
      updateActiveSectionTitle(trimmed);
    }
    setIsEditingBreadcrumbTitle(false);
  };

  // 에디터 듀얼 모드 ('doc': 본문 모드 | 'block': 문단 블록 모드)
  const [editorMode, setEditorMode] = useState('doc');
  const [paragraphs, setParagraphs] = useState([]);
  const [activeParagraphId, setActiveParagraphId] = useState(null);

  // AI 모델 쿼터 모달 상태
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  // 공통 Tiptap 에디터 ref 인스턴스
  const editorRef = useRef(null);

  // 화면 이탈(다른 메뉴 이동 등 언마운트) 시 에디터 내용 자동 저장 세이프가드
  const activeBookRef = useRef(activeBook);
  const activeChapterIdRef = useRef(activeChapterId);
  const activeSectionIdRef = useRef(activeSectionId);
  activeBookRef.current = activeBook;
  activeChapterIdRef.current = activeChapterId;
  activeSectionIdRef.current = activeSectionId;

  useEffect(() => {
    return () => {
      if (editorRef.current && activeBookRef.current && activeChapterIdRef.current && activeSectionIdRef.current) {
        try {
          const html = editorRef.current.getHTML();
          if (html) {
            updateActiveSectionContent(html);
            saveActiveSection();
          }
        } catch (e) {
          console.warn('Unmount auto save error:', e);
        }
      }
    };
  }, []);

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



  // 모달 제어 상태
  const [isOutlineModalOpen, setIsOutlineModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isBookInfoModalOpen, setIsBookInfoModalOpen] = useState(false);

  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef(null);
  const dateInputRef = useRef(null);

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

  // 소목차 임시저장(세이브포인트) 상태 및 관리
  const [draftList, setDraftList] = useState([]);
  const [isDraftMenuOpen, setIsDraftMenuOpen] = useState(false);
  const draftMenuRef = useRef(null);
  const [lastSavedTime, setLastSavedTime] = useState(Date.now());
  const [timeAgoText, setTimeAgoText] = useState('방금 전 자동 저장됨');

  // 활성 소목차 변경 시 해당 소목차의 임시저장 목록 불러오기
  useEffect(() => {
    if (activeBook?.id && activeSectionId) {
      try {
        const key = `book_drafts_${activeBook.id}_${activeSectionId}`;
        const raw = localStorage.getItem(key);
        setDraftList(raw ? JSON.parse(raw) : []);
      } catch {
        setDraftList([]);
      }
      setLastSavedTime(Date.now());
    }
  }, [activeBook?.id, activeSectionId]);

  // 자동저장 상대 시간 타이머 (3초마다 갱신)
  useEffect(() => {
    const updateAgo = () => {
      if (!lastSavedTime) {
        setTimeAgoText('자동 저장 대기');
        return;
      }
      const diffSec = Math.floor((Date.now() - lastSavedTime) / 1000);
      if (diffSec < 5) {
        setTimeAgoText('방금 전 자동 저장됨');
      } else if (diffSec < 60) {
        setTimeAgoText(`${diffSec}초 전 자동 저장됨`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) {
          setTimeAgoText(`${diffMin}분 전 자동 저장됨`);
        } else {
          const diffHours = Math.floor(diffMin / 60);
          setTimeAgoText(`${diffHours}시간 전 자동 저장됨`);
        }
      }
    };
    updateAgo();
    const timer = setInterval(updateAgo, 3000);
    return () => clearInterval(timer);
  }, [lastSavedTime]);

  // 임시저장 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (draftMenuRef.current && !draftMenuRef.current.contains(e.target)) {
        setIsDraftMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 수동 임시저장 생성 (스냅샷 보관 및 도서 원고 실제 저장)
  const handleSaveDraft = async (toggleMenu = false) => {
    if (!activeBook?.id || !activeSectionId) return;
    let html = '';
    if (editorMode === 'block') {
      html = paragraphsToHtml(paragraphs);
    } else {
      html = editorRef.current ? editorRef.current.getHTML() : (editor ? editor.getHTML() : localContent);
    }
    const plainText = html.replace(/<[^>]*>/g, '').trim();
    const newDraft = {
      id: `draft_${Date.now()}`,
      timestamp: Date.now(),
      title: localTitle || currentSection?.title || '제목 없음',
      content: html,
      charCount: plainText.length,
      preview: plainText.slice(0, 70) || '(빈 원고)'
    };

    const key = `book_drafts_${activeBook.id}_${activeSectionId}`;
    const updated = [newDraft, ...draftList.filter(d => d.content !== html)].slice(0, 10);
    setDraftList(updated);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('임시저장 실패', e);
    }

    // 실제 도서 원고 상태 및 로컬 스토리지에 즉시 확정 저장
    updateActiveSectionContent(html);
    if (localTitle) {
      updateActiveSectionTitle(localTitle);
    }
    await saveActiveSection();

    setLastSavedTime(Date.now());
    showToast('현재 소목차 원고가 안전하게 저장되었습니다.', 'success');
    if (toggleMenu) {
      setIsDraftMenuOpen(prev => !prev);
    }
  };

  // 임시저장 복원
  const handleRestoreDraft = async (draft) => {
    const ok = await openConfirm({
      title: '임시저장본 복원',
      message: `'${new Date(draft.timestamp).toLocaleTimeString()}'에 저장된 임시본(${draft.charCount}자)으로 복원하시겠습니까?\n현재 원고는 새로운 임시저장본으로 자동 백업됩니다.`,
      confirmText: '복원하기'
    });
    if (!ok) return;

    // 현재 원고 먼저 백업
    handleSaveDraft(false);

    // 복원
    const restoredHtml = draft.content || '';
    setLocalContent(restoredHtml);
    if (draft.title) {
      setLocalTitle(draft.title);
      updateActiveSectionTitle(draft.title);
    }
    if (editorMode === 'block') {
      setParagraphs(htmlToParagraphs(restoredHtml));
    } else {
      if (editor) editor.commands.setContent(restoredHtml);
    }
    updateActiveSectionContent(restoredHtml);
    setLastSavedTime(Date.now());
    setIsDraftMenuOpen(false);
    showToast('임시 저장된 원고가 복원되었습니다.', 'success');
  };

  // 임시저장 삭제
  const handleDeleteDraft = (e, draftId) => {
    e.stopPropagation();
    const key = `book_drafts_${activeBook.id}_${activeSectionId}`;
    const updated = draftList.filter(d => d.id !== draftId);
    setDraftList(updated);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    showToast('임시저장 항목이 삭제되었습니다.', 'info');
  };

  // 새 버전 저장 핸들러 (전역 다이얼로그 openPrompt 활용)
  const triggerCreateVersionPrompt = async () => {
    setIsSaveMenuOpen(false);
    const defaultVer = `v${(activeBook.versions?.length || 0) + 1}.0`;
    const verName = await openPrompt({
      title: '새 버전으로 저장',
      placeholder: '예: v1.0 초고 탈고본, 2차 퇴고본 등',
      defaultValue: defaultVer,
      confirmText: '버전 저장'
    });
    if (!verName?.trim()) return;

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
    await createBookVersion(verName.trim());
  };

  // 버전 되돌리기(복원) 핸들러
  const handleRestoreVersion = async (version) => {
    const confirmMsg = `'${version.name}' 버전으로 되돌리시겠습니까?\n현재 작업 중인 본문이 해당 버전 시점으로 복원됩니다.`;
    const ok = await openConfirm({
      title: '버전 되돌리기',
      message: confirmMsg,
      confirmText: '되돌리기'
    });
    if (ok) {
      const restored = await restoreBookVersion(version.id);
      if (restored) {
        setIsVersionModalOpen(false);
      }
    }
  };

  // 버전 삭제 핸들러
  const handleDeleteVersion = async (version) => {
    const ok = await openConfirm({
      title: '버전 삭제',
      message: `'${version.name}' 버전 기록을 삭제하시겠습니까?`,
      danger: true,
      confirmText: '삭제'
    });
    if (ok) {
      await deleteBookVersion(version.id);
    }
  };

  // --- 본문 전용 찾기 및 찾아바꾸기 (Ctrl+F) 상태 ---
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findMatches, setFindMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const findInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  // 편집기 영역 포커스 활성화 여부 판별 헬퍼
  const checkIsEditorFocused = () => {
    // 1) Tiptap 에디터 내부 포커스 확인
    if (editorRef.current?.isFocused && editorRef.current.isFocused()) return true;
    // 2) DOM activeElement 판별
    const active = document.activeElement;
    if (!active) return false;
    return !!(
      active.closest('.tiptap-editor-container') ||
      active.closest('.main-textarea-pane') ||
      active.closest('.paragraph-workspace') ||
      active.closest('.editor-find-bar') ||
      active.classList.contains('section-title-input') ||
      active.classList.contains('paragraph-textarea') ||
      active.classList.contains('ProseMirror')
    );
  };

  // 수동 즉시 저장 및 세이브포인트 생성 (Ctrl+S)
  const handleManualQuickSave = () => {
    let html = '';
    if (editorMode === 'block') {
      html = paragraphsToHtml(paragraphs);
    } else {
      html = editorRef.current ? editorRef.current.getHTML() : localContent;
    }
    updateActiveSectionContent(html);
    if (localTitle) {
      updateActiveSectionTitle(localTitle);
    }
    handleSaveDraft(false);
    showToast('원고가 즉시 임시저장되었습니다. (스냅샷 보관됨)', 'success', 2000);
  };

  // 본문 검색어 변경 시 매칭 목록 업데이트
  const handleFindQueryChange = (query) => {
    setFindQuery(query);
    if (!query) {
      setFindMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    if (editorMode === 'doc') {
      const matches = editorRef.current?.findMatches ? editorRef.current.findMatches(query) : [];
      setFindMatches(matches);
      if (matches.length > 0) {
        setCurrentMatchIndex(0);
        editorRef.current?.selectMatch?.(matches[0].from, matches[0].to);
      } else {
        setCurrentMatchIndex(-1);
      }
    } else {
      const matches = [];
      const qLower = query.toLowerCase();
      paragraphs.forEach((p, pIdx) => {
        const textLower = (p.text || '').toLowerCase();
        let idx = textLower.indexOf(qLower);
        while (idx !== -1) {
          matches.push({ paragraphId: p.id, pIdx, idx, length: query.length });
          idx = textLower.indexOf(qLower, idx + 1);
        }
      });
      setFindMatches(matches);
      if (matches.length > 0) {
        setCurrentMatchIndex(0);
        setActiveParagraphId(matches[0].paragraphId);
      } else {
        setCurrentMatchIndex(-1);
      }
    }
  };

  // 다음 찾기
  const handleFindNext = () => {
    if (findMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % findMatches.length;
    setCurrentMatchIndex(nextIdx);
    const m = findMatches[nextIdx];
    if (editorMode === 'doc') {
      editorRef.current?.selectMatch?.(m.from, m.to);
    } else {
      setActiveParagraphId(m.paragraphId);
    }
  };

  // 이전 찾기
  const handleFindPrev = () => {
    if (findMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + findMatches.length) % findMatches.length;
    setCurrentMatchIndex(prevIdx);
    const m = findMatches[prevIdx];
    if (editorMode === 'doc') {
      editorRef.current?.selectMatch?.(m.from, m.to);
    } else {
      setActiveParagraphId(m.paragraphId);
    }
  };

  // 현재 단어 치환
  const handleReplaceCurrent = () => {
    if (findMatches.length === 0 || currentMatchIndex < 0) return;
    const m = findMatches[currentMatchIndex];
    if (editorMode === 'doc') {
      editorRef.current?.replaceCurrent?.(m.from, m.to, replaceQuery);
      const newHtml = editorRef.current?.getHTML() || '';
      setLocalContent(newHtml);
      updateActiveSectionContent(newHtml);
      setTimeout(() => handleFindQueryChange(findQuery), 50);
    } else {
      const updated = paragraphs.map(p => {
        if (p.id === m.paragraphId) {
          const before = (p.text || '').substring(0, m.idx);
          const after = (p.text || '').substring(m.idx + m.length);
          return { ...p, text: before + replaceQuery + after };
        }
        return p;
      });
      setParagraphs(updated);
      updateActiveSectionContent(paragraphsToHtml(updated));
      setTimeout(() => handleFindQueryChange(findQuery), 50);
    }
    showToast('선택한 단어를 바꾸었습니다.', 'success', 1500);
  };

  // 모든 일치 단어 일괄 치환
  const handleReplaceAll = () => {
    if (!findQuery) return;
    if (editorMode === 'doc') {
      const count = editorRef.current?.replaceAll ? editorRef.current.replaceAll(findQuery, replaceQuery) : 0;
      const newHtml = editorRef.current?.getHTML() || '';
      setLocalContent(newHtml);
      updateActiveSectionContent(newHtml);
      setFindMatches([]);
      setCurrentMatchIndex(-1);
      showToast(`${count}개의 일치 단어를 모두 바꾸었습니다.`, 'success');
    } else {
      let count = 0;
      const reg = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const updated = paragraphs.map(p => {
        if (!p.text) return p;
        const occ = (p.text.match(reg) || []).length;
        count += occ;
        return { ...p, text: p.text.replaceAll(reg, replaceQuery) };
      });
      setParagraphs(updated);
      updateActiveSectionContent(paragraphsToHtml(updated));
      setFindMatches([]);
      setCurrentMatchIndex(-1);
      showToast(`${count}개의 일치 단어를 모두 바꾸었습니다.`, 'success');
    }
  };

  // 전역 단축키 이벤트 리스너 (Ctrl+S, Ctrl+F, Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 1. Ctrl+S: 편집기가 활성화되어 있을 때만 브라우저 기본 저장 차단 및 즉시 임시저장
      if (isCtrl && key === 's') {
        if (checkIsEditorFocused()) {
          e.preventDefault();
          handleManualQuickSave();
        }
        return;
      }

      // 2. Ctrl+F / Ctrl+H: 편집기 인라인 검색바 및 찾아바꾸기 열기
      if (isCtrl && (key === 'f' || key === 'h')) {
        if (checkIsEditorFocused() || isFindBarOpen) {
          e.preventDefault();
          setIsFindBarOpen(true);
          const isReplaceMode = key === 'h';
          setTimeout(() => {
            if (isReplaceMode && replaceInputRef.current) {
              replaceInputRef.current.focus();
              replaceInputRef.current.select();
            } else if (findInputRef.current) {
              findInputRef.current.focus();
              findInputRef.current.select();
            }
          }, 40);
        }
        return;
      }

      // 3. Ctrl+Z: 편집기 바깥(목차 사이드바 등)일 때 목차 순서 되돌리기 실행
      if (isCtrl && key === 'z' && !e.shiftKey) {
        if (!checkIsEditorFocused()) {
          e.preventDefault();
          undoChapterOrder();
        }
        return;
      }

      // 4. Escape: 인라인 검색바가 열려있을 때 닫기
      if (key === 'escape' && isFindBarOpen) {
        setIsFindBarOpen(false);
        editorRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    localTitle, localContent, paragraphs, editorMode,
    isFindBarOpen, findQuery, replaceQuery, findMatches, currentMatchIndex,
    undoChapterOrder
  ]);

  // AI 총괄 편집장(Editor-in-Chief) 모달 열림 상태
  const [isChiefModalOpen, setIsChiefModalOpen] = useState(false);

  // 활성 섹션 변경 시 Tiptap 본문 및 문단 블록 동기화
  useEffect(() => {
    if (currentSection) {
      setLocalTitle(currentSection.title || '');
      const content = currentSection.content || '';
      setLocalContent(content);
      if (editorRef.current && editorRef.current.getHTML() !== content) {
        editorRef.current.setContent(content, { emitUpdate: false });
      }
      setParagraphs(htmlToParagraphs(content));
    } else {
      setLocalTitle('');
      setLocalContent('');
      if (editorRef.current) {
        editorRef.current.setContent('', { emitUpdate: false });
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
        setLastSavedTime(Date.now());
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
    showToast('해당 문단이 우측 AI 문장 교정기에 입력되었습니다.', 'success');
  };

  if (!activeBook) {
    if (isBooksLoading) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', height: '60vh' }}>
          도서 원고를 불러오는 중입니다...
        </div>
      );
    }
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', height: '60vh' }}>
        도서 프로젝트가 선택되지 않았습니다. <button className="btn btn-primary" onClick={() => setView('library')} style={{ marginLeft: '1rem' }}>내 서재로 이동</button>
      </div>
    );
  }

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setLocalTitle(title);
    updateActiveSectionTitle(title);
    setLastSavedTime(Date.now());
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
    await saveActiveSection();
    // 책 전체 저장 시 히스토리 자동 갱신 (첫 저장이면 v1.0 자동 생성, 이후 저장은 최신 버전 덮어쓰기)
    await saveOrUpdateLatestVersion('v1.0');
    setIsSaving(false);
  };

  // 도서 완결/연재중 드롭다운 및 토글 핸들러
  const handleStatusChange = async (e) => {
    const val = e.target.value;
    if (!activeBook) return;
    const isCompleted = val === 'completed';
    if (isCompleted && !activeBook.isCompleted) {
      const ok = await openConfirm({
        title: '도서 완결(완성작) 등록',
        message: `${activeBook.title} 도서의 집필을 마치고 [완성 작품]으로 등록하시겠습니까?\n\n• 독자 공간의 '완성 서가'에 완결 도서로 전시됩니다.\n• 언제든 다시 연재중으로 되돌릴 수 있습니다.`,
        confirmText: '완결 등록'
      });
      if (ok) toggleBookCompleted(activeBook.id);
    } else if (!isCompleted && activeBook.isCompleted) {
      const ok = await openConfirm({
        title: '연재중으로 전환',
        message: `${activeBook.title} 도서를 다시 [연재중] 상태로 전환하시겠습니까?\n\n• 완성 서가에서 연재 공간으로 변경됩니다.`,
        confirmText: '연재중 전환'
      });
      if (ok) toggleBookCompleted(activeBook.id);
    }
  };

  const handleToggleComplete = async () => {
    if (!activeBook) return;
    if (!activeBook.isCompleted) {
      const ok = await openConfirm({
        title: '도서 완결(완성작) 등록',
        message: `${activeBook.title} 도서의 집필을 마치고 [완성 작품]으로 등록하시겠습니까?\n\n• 독자 공간의 '완성 서가'에 완결 도서로 전시됩니다.\n• 언제든 다시 연재중으로 되돌릴 수 있습니다.`,
        confirmText: '완결 등록'
      });
      if (ok) toggleBookCompleted(activeBook.id);
    } else {
      const ok = await openConfirm({
        title: '연재중으로 전환',
        message: `${activeBook.title} 도서를 다시 [연재중] 상태로 전환하시겠습니까?\n\n• 완성 서가에서 연재 공간으로 변경됩니다.`,
        confirmText: '연재중 전환'
      });
      if (ok) toggleBookCompleted(activeBook.id);
    }
  };

  return (
    <div className="studio-container">
      {/* 🌟 전역 최상단 탑바: < 내 서재로 | 도서명 (좌측) | 연재중/완결 드롭다운 | ✏️ 💾 🕒 | 📅 마감 D-Day (우측 끝) */}
      <header className="studio-top-bar">
        <div className="top-bar-left">
          <button className="preview-back-btn" onClick={() => setView('library')}>
            <ArrowLeft size={13} />
            <span>내 서재로</span>
          </button>

          <div className="top-divider"></div>

          <div
            className="top-book-title-wrap"
            onClick={() => setIsBookInfoModalOpen(true)}
            title="도서 기본 정보 수정 (클릭하여 수정)"
          >
            <span className="top-book-title">{activeBook?.title}</span>
          </div>
        </div>

        <div className="top-bar-right">
          <div className="top-status-dropdown-wrap">
            <select
              className="top-status-select"
              value={activeBook?.isCompleted ? 'completed' : 'ongoing'}
              onChange={handleStatusChange}
              title="연재 상태 변경"
            >
              <option value="ongoing">연재중</option>
              <option value="completed">완결</option>
            </select>
          </div>

          <div className="top-icon-btn-group">
            <button
              type="button"
              className="top-icon-btn"
              onClick={() => setIsBookInfoModalOpen(true)}
              title="도서 기본 정보 수정 (제목, 필명, 장르, 표지 등)"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="top-icon-btn"
              onClick={handleSave}
              disabled={isSaving}
              title="책 전체 저장"
            >
              <Save size={13} />
            </button>
            <button
              type="button"
              className="top-icon-btn"
              onClick={() => setIsVersionModalOpen(true)}
              title="버전 관리 (히스토리)"
            >
              <History size={13} />
            </button>
          </div>

          <div className="top-deadline-group">
            <button
              type="button"
              className={`top-deadline-badge ${currentChapter?.deadline ? 'active' : ''}`}
              onClick={() => {
                if (!currentChapter) {
                  showToast('마감일을 설정할 챕터를 먼저 선택해주세요.', 'info');
                  return;
                }
                if (dateInputRef.current) {
                  if (typeof dateInputRef.current.showPicker === 'function') {
                    dateInputRef.current.showPicker();
                  } else {
                    dateInputRef.current.focus();
                  }
                }
              }}
              title={currentChapter?.deadline ? `마감 목표일: ${currentChapter.deadline} (클릭하여 변경)` : '챕터 마감 목표일 설정 (클릭하여 달력 열기)'}
            >
              <Calendar size={13} />
              <span>{calculateDDay(currentChapter?.deadline).text}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="top-deadline-hidden-input"
              value={currentChapter?.deadline || ''}
              onChange={(e) => {
                if (currentChapter) {
                  setChapterDeadline(currentChapter.id, e.target.value);
                }
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
      </header>

      {/* 🌟 스튜디오 메인 3열 바디 (좌: 목차, 중: 에디터, 우: AI 어시스턴트) */}
      {/* 🌟 스튜디오 메인 바디 (패딩과 갭으로 좌우/상하 띄워짐) */}
      <div className="studio-main-body">
        {/* 🌟 좌측 대형 통합 카드 윈도우 (목차 컬럼 + 에디터 캔버스 컬럼 일체화) */}
        <div className="v4-main-window">
          {/* [내부 좌측: 목차 컬럼] */}
          <aside className="v4-toc-col">
            <div className="v4-toc-header">
              <span className="v4-toc-header-title">목차 및 구조</span>
              <button
                type="button"
                className="v4-btn-outline-plan"
                onClick={() => setIsOutlineModalOpen(true)}
                title="AI 목차 기획 마법사"
              >
                <span>목차 기획</span>
              </button>
            </div>

            <div className="v4-toc-scroll" onDragEnd={handleDragEnd}>
              {activeBook.chapters?.map((chap, cIdx) => {
                const isCollapsed = collapsedChapterIds.has(chap.id);
                const isChapterDragging = draggedItem?.type === 'chapter' && draggedItem?.chapterId === chap.id;
                const isChapterOver = dragOverTarget?.type === 'chapter' && dragOverTarget?.id === chap.id;
                const isChapterDropTarget = dragOverTarget?.type === 'chapter-drop-target' && dragOverTarget?.id === chap.id;

                const isAllDone = chap.sections?.length > 0 && chap.sections.every(s => (s.content || '').replace(/<[^>]*>/g, '').trim().length > 0);
                const isAnyWriting = chap.sections?.some(s => (s.content || '').replace(/<[^>]*>/g, '').trim().length > 0);

                return (
                  <div key={chap.id || cIdx} className="v4-chap-block">
                    <div
                      className={`v4-chap-row ${isChapterDragging ? 'is-dragging' : ''} ${isChapterOver ? `drag-over-${dragOverTarget.position}` : ''} ${isChapterDropTarget ? 'drag-target-hover' : ''}`}
                      draggable={editingChapterId !== chap.id}
                      onDragStart={(e) => handleChapterDragStart(e, chap.id, cIdx)}
                      onDragOver={(e) => handleChapterDragOver(e, chap.id, cIdx)}
                      onDrop={(e) => handleChapterDrop(e, chap.id, cIdx)}
                      onClick={(e) => toggleChapterCollapse(chap.id, e)}
                    >
                      <div className="v4-chap-left">
                        <span className={`v4-fold-arrow ${isCollapsed ? '' : 'open'}`}>›</span>
                        {editingChapterId === chap.id ? (
                          <input
                            type="text"
                            className="v4-chap-input"
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
                            className="v4-chap-name"
                            title="더블클릭하여 챕터명 수정"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingChapterId(chap.id);
                              setEditingChapterTitle(cleanTitle(chap.title));
                            }}
                          >
                            제 {cIdx + 1}장. {cleanTitle(chap.title)}
                          </span>
                        )}
                      </div>

                      <div className="v4-chap-right">
                        <span className={`v4-status-txt ${!isAllDone && isAnyWriting ? 'writing' : ''}`}>
                          {chap.status === 'published' ? '연재중' : (isAllDone ? '완료' : (isAnyWriting ? '집필중' : '초고'))}
                        </span>

                        <div className="v4-hover-actions">
                          <button
                            type="button"
                            className="v4-mini-btn"
                            title="소목차 추가"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const t = await openPrompt({
                                title: '새 소목차 추가',
                                placeholder: '추가할 소목차명을 입력하세요 (예: 1.1 새로운 여정)'
                              });
                              if (t?.trim()) addSection(chap.id, cleanTitle(t.trim()));
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="v4-mini-btn delete"
                            title="챕터 삭제"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await openConfirm({
                                title: '챕터 삭제',
                                message: `'${cleanTitle(chap.title)}' 챕터를 삭제하시겠습니까?\n포함된 모든 소목차와 본문도 함께 삭제됩니다.`,
                                danger: true,
                                confirmText: '삭제'
                              });
                              if (ok) deleteChapter(chap.id);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 소목차 목록 */}
                    {!isCollapsed && (
                      <div className="v4-sec-list">
                        {chap.sections?.map((sec, sIdx) => {
                          const isActive = chap.id === activeChapterId && sec.id === activeSectionId;
                          const isSecDragging = draggedItem?.type === 'section' && draggedItem?.sectionId === sec.id;
                          const isSecOver = dragOverTarget?.type === 'section' && dragOverTarget?.id === sec.id;
                          const rawText = (sec.content || '').replace(/<[^>]*>/g, '').trim();
                          const isDone = rawText.length > 0;

                          return (
                            <div
                              key={sec.id || sIdx}
                              className={`v4-sec-row ${isActive ? 'active' : ''} ${isSecDragging ? 'is-dragging' : ''} ${isSecOver ? `drag-over-${dragOverTarget.position}` : ''}`}
                              draggable={editingSectionId !== sec.id}
                              onDragStart={(e) => handleSectionDragStart(e, chap.id, sec.id, cIdx, sIdx)}
                              onDragOver={(e) => handleSectionDragOver(e, sec.id, cIdx, sIdx)}
                              onDrop={(e) => handleSectionDrop(e, chap.id, sIdx)}
                              onClick={() => {
                                setActiveChapterId(chap.id);
                                setActiveSectionId(sec.id);
                              }}
                            >
                              <span className={`v4-dot ${isDone ? 'filled' : 'empty'}`} title={isDone ? `집필 완료 (${rawText.length.toLocaleString()}자)` : '미작성'} />
                              {editingSectionId === sec.id ? (
                                <input
                                  type="text"
                                  className="v4-sec-input"
                                  value={editingSectionTitle}
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setEditingSectionTitle(e.target.value)}
                                  onBlur={() => handleCommitSectionRename(chap.id, sec.id, editingSectionTitle)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCommitSectionRename(chap.id, sec.id, editingSectionTitle);
                                    } else if (e.key === 'Escape') {
                                      setEditingSectionId(null);
                                    }
                                  }}
                                />
                              ) : (
                                <span
                                  className="v4-sec-name"
                                  title="더블클릭하여 소제목 수정"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSectionId(sec.id);
                                    setEditingSectionTitle(cleanTitle(sec.title));
                                  }}
                                >
                                  {cIdx + 1}.{sIdx + 1} {cleanTitle(sec.title)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 목차 패널 하단 새 챕터 추가 & 원고 가져오기/내보내기 */}
            <div className="v4-bottom-add-chap">
              <button
                type="button"
                className="v4-btn-chap-bottom"
                onClick={async () => {
                  const t = await openPrompt({
                    title: '새 챕터 추가',
                    placeholder: '추가할 챕터명을 입력하세요 (예: 1장. 시작의 순간)'
                  });
                  if (t?.trim()) addChapter(cleanTitle(t.trim()));
                }}
              >
                + 새 챕터 추가
              </button>
              <div className="v4-bottom-import-export-row">
                <button
                  type="button"
                  className="v4-btn-import-export"
                  onClick={() => setIsImportModalOpen(true)}
                  title="외부 원고 파일(.txt, .md, .docx) 불러오기"
                >
                  <UploadCloud size={13} />
                  <span>원고 가져오기</span>
                </button>
                <button
                  type="button"
                  className="v4-btn-import-export primary"
                  onClick={() => setIsExportModalOpen(true)}
                  title="전체 원고 텍스트/마크다운 내보내기"
                >
                  <Download size={13} />
                  <span>원고 내보내기</span>
                </button>
              </div>
            </div>
          </aside>

          {/* [내부 중앙: 에디터 캔버스 컬럼] */}
          <main className="v4-editor-col">
            {/* 🌟 1번 사진 스타일: 챕터와 소제목이 브레드크럼으로 한 줄로 합쳐진 에디터 상단 바 */}
            <div className="v4-editor-top-bar">
              <div className="v4-breadcrumb">
                <span className="v4-bread-chap">제 {currentChapterIndex >= 0 ? currentChapterIndex + 1 : 1}장</span>
                <span className="v4-bread-sep">&gt;</span>
                {isEditingBreadcrumbTitle ? (
                  <input
                    type="text"
                    className="v4-bread-sec-input"
                    value={editingBreadcrumbValue}
                    autoFocus
                    onChange={(e) => setEditingBreadcrumbValue(e.target.value)}
                    onBlur={handleCommitBreadcrumbRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitBreadcrumbRename();
                      else if (e.key === 'Escape') setIsEditingBreadcrumbTitle(false);
                    }}
                  />
                ) : (
                  <span
                    className="v4-bread-sec"
                    title="더블클릭하여 소제목 수정"
                    onDoubleClick={() => {
                      if (currentSection) {
                        setIsEditingBreadcrumbTitle(true);
                        setEditingBreadcrumbValue(cleanTitle(localTitle || currentSection.title || ''));
                      }
                    }}
                  >
                    {currentChapterIndex >= 0 ? `${currentChapterIndex + 1}.${currentSectionIndex >= 0 ? currentSectionIndex + 1 : 1} ` : ''}
                    {cleanTitle(localTitle || currentSection?.title || '소목차')}
                  </span>
                )}
              </div>

              <div className="v4-actions-group">
                {/* 표준 뷰어 미리보기 */}
                <button
                  type="button"
                  className="v4-btn-action"
                  onClick={() => {
                    if (activeBook) {
                      openReader(activeBook.id, activeChapterId);
                    }
                  }}
                  title="표준 통합 웹 뷰어로 즉시 열람합니다"
                >
                  <BookOpen size={13} />
                  <span>미리보기</span>
                </button>

                {/* 단일 토글 모드 전환 버튼 (본문 모드 ↔ 문단 모드) */}
                <button
                  type="button"
                  className={`v4-btn-action ${editorMode === 'block' ? 'active' : ''}`}
                  onClick={() => switchEditorMode(editorMode === 'doc' ? 'block' : 'doc')}
                  title={editorMode === 'doc' ? '문단 모드로 전환' : '본문 모드로 전환'}
                >
                  <Layers size={13} />
                  <span>{editorMode === 'doc' ? '본문모드' : `문단모드 (${paragraphs.length})`}</span>
                </button>

                {/* 현재 소목차 임시저장 버튼 및 팝오버 래퍼 */}
                <div className="draft-save-wrapper" ref={draftMenuRef} style={{ display: 'inline-flex' }}>
                  <button
                    type="button"
                    className="v4-btn-action"
                    onClick={() => handleSaveDraft(false)}
                    title="현재 작성 중인 원고를 즉시 임시저장합니다"
                  >
                    <Save size={13} />
                    <span>임시저장</span>
                  </button>

                  {/* 임시저장 목록 팝오버 (조회 및 복원 창) */}
                  {isDraftMenuOpen && (
                    <div className="draft-popover-menu">
                      <div className="draft-popover-header">
                        <div className="draft-popover-title">
                          <Clock size={13} />
                          <span>임시 보관함 ({draftList.length})</span>
                        </div>
                        <span className="draft-popover-subtitle">원고 복원 및 스냅샷 내역</span>
                      </div>

                      <div className="draft-popover-list">
                        {draftList.length === 0 ? (
                          <div className="draft-popover-empty">
                            임시 저장된 내역이 없습니다.<br />
                            [임시저장]을 누르면 스냅샷이 보관됩니다.
                          </div>
                        ) : (
                          draftList.map((d) => (
                            <div key={d.id} className="draft-popover-item" onClick={() => handleRestoreDraft(d)}>
                              <div className="draft-item-info">
                                <div className="draft-item-time-row">
                                  <span className="draft-item-time">
                                    {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                  <span className="draft-item-chars">{d.charCount.toLocaleString()}자</span>
                                </div>
                                <div className="draft-item-preview" title={d.preview}>
                                  {d.preview || '(빈 원고)'}
                                </div>
                              </div>
                              <div className="draft-item-actions">
                                <button
                                  type="button"
                                  className="btn-draft-restore"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreDraft(d);
                                  }}
                                  title="이 시점의 원고로 복원"
                                >
                                  복원
                                </button>
                                <button
                                  type="button"
                                  className="btn-draft-delete"
                                  onClick={(e) => handleDeleteDraft(e, d.id)}
                                  title="삭제"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 연재 발행 버튼 */}
                <button
                  type="button"
                  className="v4-btn-action primary"
                  onClick={() => setIsPublishModalOpen(true)}
                  title="연재 발행하기 (이번화 발행 / 선택하여 발행)"
                >
                  <Send size={13} />
                  <span>연재발행</span>
                </button>
              </div>
            </div>

            <div className="v4-editor-canvas">
            {/* 본문 검색 및 찾아바꾸기 인라인 바 (Ctrl+F) */}
            {isFindBarOpen && (
              <div className="editor-find-bar">
                <div className="find-bar-inputs">
                  <div className="find-input-wrap">
                    <Search size={14} className="find-icon" />
                    <input
                      ref={findInputRef}
                      type="text"
                      className="find-input"
                      placeholder="본문 검색 (Enter: 다음, Shift+Enter: 이전)..."
                      value={findQuery}
                      onChange={(e) => handleFindQueryChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.shiftKey) handleFindPrev();
                          else handleFindNext();
                        }
                      }}
                    />
                    {findQuery && (
                      <span className="find-count-badge">
                        {findMatches.length > 0 ? `${currentMatchIndex + 1}/${findMatches.length}` : '0개'}
                      </span>
                    )}
                  </div>

                  <div className="find-input-wrap">
                    <Replace size={14} className="find-icon" />
                    <input
                      ref={replaceInputRef}
                      type="text"
                      className="find-input replace-input"
                      placeholder="바꿀 단어..."
                      value={replaceQuery}
                      onChange={(e) => setReplaceQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleReplaceCurrent();
                      }}
                    />
                  </div>
                </div>

                <div className="find-bar-actions">
                  <button
                    type="button"
                    className="btn-find-action"
                    onClick={handleFindPrev}
                    disabled={findMatches.length === 0}
                    title="이전 찾기 (Shift+Enter)"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-find-action"
                    onClick={handleFindNext}
                    disabled={findMatches.length === 0}
                    title="다음 찾기 (Enter)"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-find-action btn-replace-action"
                    onClick={handleReplaceCurrent}
                    disabled={findMatches.length === 0}
                    title="현재 일치 단어 바꾸기"
                  >
                    바꾸기
                  </button>
                  <button
                    type="button"
                    className="btn-find-action btn-replace-action"
                    onClick={handleReplaceAll}
                    disabled={findMatches.length === 0}
                    title="전체 일치 단어 일괄 바꾸기"
                  >
                    모두 바꾸기
                  </button>
                  <button
                    type="button"
                    className="btn-find-close"
                    onClick={() => {
                      setIsFindBarOpen(false);
                      editorRef.current?.focus();
                    }}
                    title="닫기 (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {editorMode === 'doc' ? (
              /* 본문 모드: 분리된 독립 고성능 TiptapEditor 엔진 */
              <TiptapEditor
                ref={editorRef}
                content={localContent}
                chapterIndex={currentChapterIndex}
                sectionIndex={currentSectionIndex}
                sectionTitle={cleanTitle(localTitle || currentSection?.title || '')}
                onUpdateSectionTitle={(newTitle) => {
                  if (currentChapter && currentSection) {
                    handleCommitSectionRename(currentChapter.id, currentSection.id, newTitle);
                  }
                }}
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
                                placeholder="키워드 / 요약 메모"
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
                              rows={Math.max(2, Math.min(25, Math.ceil(((p.text || '').length || 1) / 45) + ((p.text || '').split('\n').length - 1)))}
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
          </main>
        </div>

        {/* 🌟 우측 독립 카드: AI 집필 에이전트 */}
        <AIAssistant
          activeBook={activeBook}
          currentChapter={currentChapter}
          currentSection={currentSection}
          localTitle={localTitle}
          localContent={localContent}
          editor={editor}
          vault={vault}
          selectedVaultIds={selectedVaultIds}
          loadVault={loadVault}
          setIsVaultModalOpen={setIsVaultModalOpen}
          setIsQuotaModalOpen={setIsQuotaModalOpen}
          setLocalContent={setLocalContent}
          updateActiveSectionContent={updateActiveSectionContent}
          saveActiveSection={saveActiveSection}
          setView={setView}
          showToast={showToast}
          showActionToast={showActionToast}
        />
      </div>

      {/* AI 총괄 편집장 드로어 (src/components/ai/AIEditor.jsx) */}
      <AIEditor
        isOpen={isChiefModalOpen}
        onClose={() => setIsChiefModalOpen(false)}
        activeBook={activeBook}
        vault={vault}
        openBook={openBook}
        loadBooks={loadBooks}
        setView={setView}
        showToast={showToast}
        showActionToast={showActionToast}
        openConfirm={openConfirm}
      />

      {/* 모달 1: AI 목차 기획 */}
      {/* 모달 1: AI 목차 기획 (src/pages/studio/OutlineModal.jsx) */}
      <OutlineModal
        isOpen={isOutlineModalOpen}
        onClose={() => setIsOutlineModalOpen(false)}
        activeBook={activeBook}
        openBook={openBook}
        loadBooks={loadBooks}
        setView={setView}
        showToast={showToast}
        showActionToast={showActionToast}
      />

      {/* 모달 2: 전자책 전체 내보내기 (ExportModal.jsx) */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeBook={activeBook}
        showToast={showToast}
      />

      {/* 모달 3: 자료 금고 선택 (VaultModal.jsx) */}
      <VaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        vault={vault}
        selectedVaultIds={selectedVaultIds}
        toggleSelectVaultId={toggleSelectVaultId}
        clearSelectedVaultIds={clearSelectedVaultIds}
      />


      {/* 모달 5: 버전 관리 (VersionModal.jsx) */}
      <VersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        activeBook={activeBook}
        triggerCreateVersionPrompt={triggerCreateVersionPrompt}
        handleRestoreVersion={handleRestoreVersion}
        handleDeleteVersion={handleDeleteVersion}
      />

      {/* 모달 7: 연재 발행하기 모달 (src/pages/studio/PublishModal.jsx) */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        activeBook={activeBook}
        currentChapter={currentChapter}
        currentSection={currentSection}
        currentChapterIndex={currentChapterIndex}
        activeSectionId={activeSectionId}
        localTitle={localTitle}
        editor={editor}
        toggleSectionPublish={toggleSectionPublish}
        updateBatchPublishSections={updateBatchPublishSections}
      />

      {/* 실시간 AI Model Quotas 모달 */}
      <ModelQuotasModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

      {/* 외부 원고 가져오기 마법사 모달 */}
      <ManuscriptImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentBook={activeBook}
      />

      {/* 도서 기본 정보 수정 모달 */}
      <BookInfoModal
        isOpen={isBookInfoModalOpen}
        onClose={() => setIsBookInfoModalOpen(false)}
        mode="edit"
        book={activeBook}
      />
    </div>
  );
}
