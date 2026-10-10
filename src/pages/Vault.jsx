import React, { useEffect, useState, useMemo } from 'react';
import './Vault.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import {
  Plus, Trash2, X, Users, BookOpen, Layers, Sparkles, Check, Edit2, Lightbulb,
  ArrowRight, Shield, Award, HelpCircle, UserPlus, FileText, Tag, Link2, Quote,
  BarChart2, Bookmark, FolderPlus, Compass, PenTool, CheckCircle, ChevronRight,
  Send, AlertCircle, RefreshCw, Wand2
} from 'lucide-react';
import { PLOT_TEMPLATES, PIPELINE_STEPS, VAULT_CATEGORIES } from '../data/vaultConstants';

// 제목 정제 헬퍼 (제1장, 1. 등의 접두사 중복 방지)
const cleanTitle = (str) => (str || '').replace(/^제?\s*\d+\s*[장회편절단계권]?\s*[\.:\-]?\s*/i, '').trim();

export default function Vault() {
  const {
    vault, loadVault, deleteVaultItem, activeTagFilter, setTagFilter, showToast,
    books, activeBook, setActiveBook, openBook, setView,
    updateActiveBookPlanning, updateActiveBookCharacters, updateActiveBookPlotStages
  } = useStore();

  // 상단 5대 순차 파이프라인 단계 ('ideas' | 'proposal' | 'materials' | 'story' | 'outline')
  const [activeStep, setActiveStep] = useState('ideas');

  // 새 작품 기획 생성 모달
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectGenre, setNewProjectGenre] = useState('general');

  // --- Step 0: 아이디어 노트 상태 ---
  const [quickIdeaInput, setQuickIdeaInput] = useState('');

  // --- Step 1: 출간 기획서 상태 ---
  const [proposalLogline, setProposalLogline] = useState('');
  const [proposalIntention, setProposalIntention] = useState('');
  const [proposalTarget, setProposalTarget] = useState('');
  const [proposalDiff, setProposalDiff] = useState('');

  // --- Step 2: 글감 & 취재창고 상태 ---
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultCategory, setVaultCategory] = useState('idea');
  const [vaultTitle, setVaultTitle] = useState('');
  const [vaultContent, setVaultContent] = useState('');
  const [vaultSource, setVaultSource] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isVaultSubmitting, setIsVaultSubmitting] = useState(false);

  // --- Step 3: 인물 & 뼈대 상태 ---
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [editingCharId, setEditingCharId] = useState(null);
  const [charName, setCharName] = useState('');
  const [charRole, setCharRole] = useState('protagonist');
  const [charGoal, setCharGoal] = useState('');
  const [charFlaw, setCharFlaw] = useState('');
  const [charTraits, setCharTraits] = useState('');
  const [charRelationship, setCharRelationship] = useState('');
  const [editingStageId, setEditingStageId] = useState(null);
  const [stageNotes, setStageNotes] = useState('');

  // --- Step 4: 목차 조립대 (가목차 샌드박스) 상태 ---
  const [draftChapters, setDraftChapters] = useState([]);
  const [newDraftChapTitle, setNewDraftChapTitle] = useState('');

  // 챕터 & 소목차 인라인 편집 상태 (더블클릭 또는 연필 클릭)
  const [editingChapId, setEditingChapId] = useState(null);
  const [editingChapTitle, setEditingChapTitle] = useState('');
  const [editingSecId, setEditingSecId] = useState(null);
  const [editingSecTitle, setEditingSecTitle] = useState('');

  // ★ 집필 스튜디오 방식 1:1 드래그 앤 드롭 상태 (핸들 없이 아이템 자체 드래그)
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'chapter' | 'section', chapterId, sectionId, cIdx, sIdx }
  const [dragOverTarget, setDragOverTarget] = useState(null); // { type, id, position: 'top' | 'bottom' }

  // activeBook 변경 시 기획서 및 가목차 상태 동기화
  useEffect(() => {
    if (activeBook) {
      if (activeBook.proposal) {
        setProposalLogline(activeBook.proposal.logline || '');
        setProposalIntention(activeBook.proposal.intention || '');
        setProposalTarget(activeBook.proposal.target || '');
        setProposalDiff(activeBook.proposal.diff || '');
      } else {
        setProposalLogline('');
        setProposalIntention('');
        setProposalTarget('');
        setProposalDiff('');
      }

      if (Array.isArray(activeBook.draftOutline) && activeBook.draftOutline.length > 0) {
        setDraftChapters(structuredClone(activeBook.draftOutline));
      } else if (Array.isArray(activeBook.chapters) && activeBook.chapters.length > 0) {
        const cloned = activeBook.chapters.map((c, cIdx) => ({
          id: `draft_chap_${c.id || cIdx}`,
          title: c.title,
          sections: (c.sections || []).map((s, sIdx) => ({
            id: `draft_sec_${s.id || sIdx}`,
            title: s.title
          }))
        }));
        setDraftChapters(cloned);
      } else {
        setDraftChapters([]);
      }
    }
  }, [activeBook]);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  // 태그 목록
  const tags = useMemo(() => {
    const set = new Set();
    vault.forEach(v => v.tags?.forEach(t => set.add(t)));
    return ['ALL', ...Array.from(set)];
  }, [vault]);

  // 필터링된 자료
  const filteredVault = useMemo(() => {
    if (activeTagFilter === 'ALL') return vault;
    return vault.filter(v => v.tags?.includes(activeTagFilter));
  }, [vault, activeTagFilter]);

  // 도서 인물 & 플롯 & 아이디어
  const ideaNotes = useMemo(() => Array.isArray(activeBook?.ideaNotes) ? activeBook.ideaNotes : [], [activeBook]);
  const characters = useMemo(() => Array.isArray(activeBook?.characters) ? activeBook.characters : [], [activeBook]);
  const plotStages = useMemo(() => Array.isArray(activeBook?.plotStages) ? activeBook.plotStages : [], [activeBook]);

  // --- 새 작품 기획 생성 ---
  const handleCreateNewProject = async (e) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) {
      showToast('작품 제목을 입력해주세요.', 'error');
      return;
    }
    try {
      const newBook = await bookService.createBook({
        title: newProjectTitle.trim(),
        genre: newProjectGenre,
        chapters: [],
        draftOutline: [],
        ideaNotes: [],
        proposal: { logline: '', intention: '', target: '', diff: '' },
        characters: [],
        plotStages: []
      });
      await useStore.getState().loadBooks();
      setActiveBook(newBook);
      setNewProjectTitle('');
      setIsNewProjectModalOpen(false);
      showToast(`'${newBook.title}' 작품 기획이 시작되었습니다!`, 'success');
    } catch (err) {
      showToast(`작품 생성 실패: ${err.message}`, 'error');
    }
  };

  // --- Step 0 : 아이디어 노트 ---
  const handleAddQuickIdea = async (e) => {
    e.preventDefault();
    if (!quickIdeaInput.trim()) return;
    if (!activeBook) {
      showToast('좌측에서 먼저 작품을 선택해주세요.', 'error');
      return;
    }
    const newIdea = {
      id: `idea_${Date.now()}`,
      content: quickIdeaInput.trim(),
      createdAt: new Date().toISOString()
    };
    const updated = [newIdea, ...ideaNotes];
    await updateActiveBookPlanning({ ideaNotes: updated });
    setQuickIdeaInput('');
    showToast('아이디어가 기록되었습니다.', 'success');
  };

  const handleDeleteIdea = async (ideaId) => {
    if (!activeBook) return;
    const updated = ideaNotes.filter(i => i.id !== ideaId);
    await updateActiveBookPlanning({ ideaNotes: updated });
    showToast('아이디어가 삭제되었습니다.', 'info');
  };

  const handlePromoteToVault = async (idea) => {
    await bookService.createVaultItem({
      title: `${activeBook?.title || '작품'} - 영감 메모`,
      content: idea.content,
      tags: ['아이디어', activeBook?.title || '기획'],
      category: 'idea',
      source: 'user'
    });
    await loadVault();
    showToast('글감 창고로 보관되었습니다! 🗂️', 'success');
  };

  // --- Step 1 : 출간 기획서 저장 ---
  const handleSaveProposal = async (e) => {
    e.preventDefault();
    if (!activeBook) return;
    const proposalData = {
      logline: proposalLogline.trim(),
      intention: proposalIntention.trim(),
      target: proposalTarget.trim(),
      diff: proposalDiff.trim(),
      updatedAt: new Date().toISOString()
    };
    await updateActiveBookPlanning({ proposal: proposalData });
    showToast('출간 기획서가 저장되었습니다! 🧭', 'success');
  };

  // --- Step 2 : 자료 수집 ---
  const handleCreateVaultItem = async (e) => {
    e.preventDefault();
    if (!vaultTitle.trim() || !vaultContent.trim()) return;
    try {
      setIsVaultSubmitting(true);
      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      const categoryObj = VAULT_CATEGORIES.find(c => c.id === vaultCategory);
      const categoryTag = categoryObj ? categoryObj.label.split(' ')[1] : '일반';
      const finalTags = Array.from(new Set([categoryTag, ...parsedTags]));

      await bookService.createVaultItem({
        title: vaultTitle.trim(),
        content: vaultContent.trim(),
        tags: finalTags,
        category: vaultCategory,
        sourceRef: vaultSource.trim(),
        source: 'user'
      });
      await loadVault();
      showToast('취재 자료가 보관되었습니다.', 'success');
      setVaultTitle('');
      setVaultContent('');
      setVaultSource('');
      setTagsInput('');
      setIsVaultModalOpen(false);
    } catch (err) {
      showToast(`등록 실패: ${err.message}`, 'error');
    } finally {
      setIsVaultSubmitting(false);
    }
  };

  // --- Step 3 : 인물 & 플롯 ---
  const handleSaveCharacter = (e) => {
    e.preventDefault();
    if (!charName.trim() || !activeBook) return;
    const currentChars = [...characters];
    if (editingCharId) {
      const updated = currentChars.map(c => c.id === editingCharId ? {
        ...c,
        name: charName.trim(),
        role: charRole,
        goal: charGoal.trim(),
        flaw: charFlaw.trim(),
        traits: charTraits.trim(),
        relationship: charRelationship.trim(),
        updatedAt: new Date().toISOString()
      } : c);
      updateActiveBookCharacters(updated);
      showToast('인물 정보가 수정되었습니다.', 'success');
    } else {
      const newChar = {
        id: `char_${Date.now()}`,
        name: charName.trim(),
        role: charRole,
        goal: charGoal.trim(),
        flaw: charFlaw.trim(),
        traits: charTraits.trim(),
        relationship: charRelationship.trim(),
        createdAt: new Date().toISOString()
      };
      updateActiveBookCharacters([...currentChars, newChar]);
      showToast('새 인물이 등록되었습니다!', 'success');
    }
    closeCharModal();
  };

  const closeCharModal = () => {
    setEditingCharId(null);
    setCharName('');
    setCharRole('protagonist');
    setCharGoal('');
    setCharFlaw('');
    setCharTraits('');
    setCharRelationship('');
    setIsCharModalOpen(false);
  };

  const handleApplyPlotTemplate = (templateKey) => {
    if (!activeBook) return;
    const tpl = PLOT_TEMPLATES[templateKey];
    if (!tpl) return;
    if (plotStages.length > 0) {
      if (!window.confirm(`'${tpl.name}' 표준 뼈대를 적용하시겠습니까?\n기존 단계가 교체됩니다.`)) return;
    }
    const newStages = tpl.stages.map(s => ({ ...s, content: '' }));
    updateActiveBookPlotStages(newStages);
    showToast(`'${tpl.name}' 플롯 뼈대가 적용되었습니다!`, 'success');
  };

  const handleSaveStageNotes = (stageId) => {
    if (!activeBook) return;
    const updated = plotStages.map(s => s.id === stageId ? { ...s, content: stageNotes } : s);
    updateActiveBookPlotStages(updated);
    setEditingStageId(null);
    showToast('뼈대 메모가 저장되었습니다.', 'success');
  };

  // --- Step 4 : 목차 조립대 (집필 스튜디오 1:1 방식 드래그 & 더블클릭/연필 수정) ---

  const saveDraftOutline = async (newDraft) => {
    setDraftChapters(newDraft);
    if (activeBook) {
      await updateActiveBookPlanning({ draftOutline: newDraft });
    }
  };

  // 새 챕터 추가
  const handleAddDraftChapter = async (e) => {
    e.preventDefault();
    if (!newDraftChapTitle.trim()) return;
    const newChap = {
      id: `draft_chap_${Date.now()}`,
      title: newDraftChapTitle.trim(),
      sections: [
        { id: `draft_sec_${Date.now()}_1`, title: '1. 시작 꼭지' }
      ]
    };
    const updated = [...draftChapters, newChap];
    await saveDraftOutline(updated);
    setNewDraftChapTitle('');
    showToast(`'${newChap.title}' 가목차가 추가되었습니다.`, 'success');
  };

  // 챕터 인라인 편집 확정
  const handleCommitChapterTitle = async (chapId) => {
    if (!editingChapTitle.trim()) {
      setEditingChapId(null);
      return;
    }
    const updated = draftChapters.map(c => c.id === chapId ? { ...c, title: editingChapTitle.trim() } : c);
    await saveDraftOutline(updated);
    setEditingChapId(null);
  };

  // 챕터 삭제
  const handleDeleteDraftChapter = async (chapId) => {
    if (window.confirm('이 챕터를 가목차에서 삭제하시겠습니까?')) {
      const updated = draftChapters.filter(c => c.id !== chapId);
      await saveDraftOutline(updated);
      showToast('챕터가 삭제되었습니다.', 'info');
    }
  };

  // 소목차 추가 (간소화된 + 버튼)
  const handleAddDraftSection = async (chapId) => {
    const chap = draftChapters.find(c => c.id === chapId);
    if (!chap) return;
    const secCount = (chap.sections?.length || 0) + 1;
    const newSec = {
      id: `draft_sec_${Date.now()}`,
      title: `${secCount}. 새 소목차 꼭지`
    };
    const updated = draftChapters.map(c => c.id === chapId ? {
      ...c,
      sections: [...(c.sections || []), newSec]
    } : c);
    await saveDraftOutline(updated);
    showToast('새 소목차가 추가되었습니다.', 'success');
  };

  // 소목차 인라인 편집 확정
  const handleCommitSectionTitle = async (chapId, secId) => {
    if (!editingSecTitle.trim()) {
      setEditingSecId(null);
      return;
    }
    const updated = draftChapters.map(c => {
      if (c.id !== chapId) return c;
      return {
        ...c,
        sections: c.sections.map(s => s.id === secId ? { ...s, title: editingSecTitle.trim() } : s)
      };
    });
    await saveDraftOutline(updated);
    setEditingSecId(null);
  };

  // 소목차 삭제
  const handleDeleteDraftSection = async (chapId, secId) => {
    const updated = draftChapters.map(c => {
      if (c.id !== chapId) return c;
      return {
        ...c,
        sections: c.sections.filter(s => s.id !== secId)
      };
    });
    await saveDraftOutline(updated);
  };

  // =========================================================================
  // ★ 집필 스튜디오 방식 1:1 드래그 앤 드롭 핸들러 (핸들 없이 아이템 자체 드래그)
  // =========================================================================

  // 챕터 드래그 시작 (핸들 없이 챕터 헤더 자체)
  const handleChapterDragStart = (e, chapId, cIdx) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chapId);
    setDraggedItem({ type: 'chapter', chapterId: chapId, cIdx });
  };

  // 챕터 드래그 오버 (마우스 Y 위치로 top / bottom 판별)
  const handleChapterDragOver = (e, chapId, cIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    if (draggedItem.type === 'chapter') {
      if (draggedItem.chapterId === chapId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'top' : 'bottom';
      setDragOverTarget({ type: 'chapter', id: chapId, position, targetCIdx: cIdx });
    } else if (draggedItem.type === 'section') {
      setDragOverTarget({ type: 'chapter-drop-target', id: chapId });
    }
  };

  // 챕터 드롭
  const handleChapterDrop = async (e, chapId, targetCIdx) => {
    e.preventDefault();
    e.stopPropagation();
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
        const cloned = [...draftChapters];
        const [moved] = cloned.splice(srcIdx, 1);
        cloned.splice(tgtIdx, 0, moved);
        await saveDraftOutline(cloned);
        showToast('챕터 위치가 이동되었습니다.', 'info');
      }
    } else if (draggedItem.type === 'section') {
      // 소목차를 해당 챕터의 첫 번째 꼭지로 이동 (Studio와 100% 동일)
      const cloned = structuredClone(draftChapters);
      const srcChap = cloned.find(c => c.id === draggedItem.chapterId);
      const tgtChap = cloned.find(c => c.id === chapId);
      if (srcChap && tgtChap) {
        const [movedSec] = srcChap.sections.splice(draggedItem.sIdx, 1);
        if (!tgtChap.sections) tgtChap.sections = [];
        tgtChap.sections.unshift(movedSec);
        await saveDraftOutline(cloned);
        showToast('소목차가 해당 챕터의 첫 꼭지로 이동되었습니다.', 'info');
      }
    }
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // 소목차 드래그 시작 (핸들 없이 소목차 아이템 자체)
  const handleSectionDragStart = (e, chapId, secId, cIdx, sIdx) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', secId);
    setDraggedItem({ type: 'section', chapterId: chapId, sectionId: secId, cIdx, sIdx });
  };

  // 소목차 드래그 오버 (마우스 Y 위치로 top / bottom 판별)
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

  // 소목차 드롭
  const handleSectionDrop = async (e, targetChapId, targetSIdx) => {
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

    const cloned = structuredClone(draftChapters);
    const srcChap = cloned.find(c => c.id === srcChapId);
    const tgtChap = cloned.find(c => c.id === targetChapId);
    if (srcChap && tgtChap) {
      const [movedSec] = srcChap.sections.splice(srcSIdx, 1);
      if (!tgtChap.sections) tgtChap.sections = [];
      tgtChap.sections.splice(tgtSIdx, 0, movedSec);
      await saveDraftOutline(cloned);
      showToast('소목차 위치가 이동되었습니다.', 'info');
    }
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // 8대 플롯 뼈대로부터 가목차 자동 생성
  const handleGenerateOutlineFromPlot = async () => {
    if (plotStages.length === 0) {
      showToast('먼저 3단계에서 플롯 뼈대를 설정해주세요.', 'error');
      return;
    }
    if (draftChapters.length > 0) {
      if (!window.confirm('현재 작업 중인 가목차를 3단계 플롯 뼈대로 새로 구성하시겠습니까?\n기존 가목차가 교체됩니다.')) return;
    }

    const generated = plotStages.map((stage, idx) => ({
      id: `draft_chap_${Date.now()}_${idx}`,
      title: `제${idx + 1}장. ${stage.title.replace(/^\d+\.\s*/, '')}`,
      sections: [
        { id: `draft_sec_${Date.now()}_${idx}_1`, title: `1. ${stage.title}의 시작과 배경` },
        { id: `draft_sec_${Date.now()}_${idx}_2`, title: `2. 핵심 사건 및 인사이트` }
      ]
    }));
    await saveDraftOutline(generated);
    showToast('3단계 플롯 뼈대로부터 가목차가 성공적으로 생성되었습니다! 🪄', 'success');
  };

  // 스튜디오 목차 다시 불러오기
  const handleSyncFromStudio = async () => {
    if (!activeBook?.chapters || activeBook.chapters.length === 0) {
      showToast('스튜디오에 등록된 목차가 없습니다.', 'info');
      return;
    }
    if (!window.confirm('집필 스튜디오의 현재 본문 목차를 가목차 작업대로 불러오시겠습니까?')) return;

    const cloned = activeBook.chapters.map((c, cIdx) => ({
      id: `draft_chap_${c.id || cIdx}`,
      title: c.title,
      sections: (c.sections || []).map((s, sIdx) => ({
        id: `draft_sec_${s.id || sIdx}`,
        title: s.title
      }))
    }));
    await saveDraftOutline(cloned);
    showToast('스튜디오 목차를 가목차로 복사해왔습니다. 🔄', 'success');
  };

  // 가목차를 스튜디오 본문 목차로 최종 확정 및 반영
  const handleApplyDraftToStudio = async () => {
    if (!activeBook) return;
    if (draftChapters.length === 0) {
      showToast('반영할 가목차가 없습니다.', 'error');
      return;
    }

    const confirmMsg = `조립한 ${draftChapters.length}개 챕터 가목차를 집필 스튜디오에 최종 반영하시겠습니까?\n(기존에 작성된 본문 내용은 제목 매핑을 통해 안전하게 보존됩니다)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await bookService.applyOutline(activeBook.id, draftChapters);
      await useStore.getState().loadBooks();
      openBook(activeBook.id);
      showToast('가목차가 집필 스튜디오에 반영되었습니다! 집필을 시작하세요! 🚀', 'success');
    } catch (err) {
      showToast(`스튜디오 반영 실패: ${err.message}`, 'error');
    }
  };

  // 스튜디오로 단순 이동
  const handleSendToStudio = () => {
    if (!activeBook) return;
    openBook(activeBook.id);
    showToast(`'${activeBook.title}' 집필 스튜디오로 이동했습니다.`, 'success');
  };

  // 역할 뱃지 라벨
  const getRoleBadge = (role) => {
    switch (role) {
      case 'protagonist':
        return <span className="vault-badge badge-primary">주인공 (주역)</span>;
      case 'antagonist':
        return <span className="vault-badge badge-danger">적대자 (갈등유발)</span>;
      case 'supporting':
        return <span className="vault-badge badge-warning">조연 / 파트너</span>;
      case 'mentor':
        return <span className="vault-badge badge-success">조력자 / 멘토</span>;
      case 'persona':
      default:
        return <span className="vault-badge badge-secondary">타깃 독자 페르소나</span>;
    }
  };

  return (
    <div className="creation-workspace-container">
      {/* =========================================================================
          [좌측 세로 바] 내 작품 & 예비작품 리스팅 바
         ========================================================================= */}
      <aside className="creation-left-sidebar">
        <div className="sidebar-project-header">
          <div className="sidebar-title-row">
            <span className="sidebar-sub-label">PROJECT LIST</span>
            <h3>📚 작품 기획 서가</h3>
          </div>
          <button
            className="btn btn-sm btn-primary btn-add-project"
            onClick={() => setIsNewProjectModalOpen(true)}
            title="새 작품 기획 추가"
          >
            <Plus size={15} />
            <span>새 기획</span>
          </button>
        </div>

        <div className="sidebar-projects-list">
          {(!books || books.length === 0) ? (
            <div className="no-projects-box">
              <BookOpen size={24} />
              <p>기획 중인 작품이 없습니다.</p>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setIsNewProjectModalOpen(true)}
              >
                + 첫 작품 만들기
              </button>
            </div>
          ) : (
            books.map(b => {
              const isSelected = activeBook?.id === b.id;
              const chapCount = b.chapters?.length || 0;
              const hasProposal = b.proposal?.logline ? '기획 완료' : '기획 중';

              return (
                <div
                  key={b.id}
                  className={`project-nav-item ${isSelected ? 'active-project' : ''}`}
                  onClick={() => setActiveBook(b)}
                >
                  <div className="project-item-top">
                    <span className="project-genre-badge">{b.genre || '일반'}</span>
                    <span className="project-status-dot" title={hasProposal} />
                  </div>
                  <strong className="project-item-title">{b.title}</strong>
                  <div className="project-item-meta">
                    <span>목차 {chapCount}장</span>
                    <span>•</span>
                    <span>자료 {vault.length}건</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* =========================================================================
          [우측 메인 영역] 상단 5단계 파이프라인 + 본문 워크스페이스
         ========================================================================= */}
      <div className="creation-main-canvas">
        {/* 상단 1: 선택된 작품 타이틀 & 바로가기 헤더 */}
        <header className="canvas-header">
          <div className="canvas-title-group">
            <div className="canvas-badge-row">
              <span className="active-tag-pill">ACTIVE PROJECT</span>
              {activeBook ? (
                <span className="current-book-name">《{activeBook.title}》</span>
              ) : (
                <span className="current-book-none">좌측에서 작품을 선택하세요</span>
              )}
            </div>
            <p className="canvas-desc">
              아이디어 낙서부터 정식 출간 기획, 글감 수집, 플롯 뼈대, 스튜디오 방식 드래그 목차 조립까지 완성하는 창작 공방입니다.
            </p>
          </div>

          {activeBook && (
            <button
              className="btn btn-secondary btn-jump-studio"
              onClick={handleSendToStudio}
              title="현재 작품의 집필 스튜디오로 이동"
            >
              <Send size={15} />
              <span>집필 스튜디오로 이동</span>
            </button>
          )}
        </header>

        {/* 상단 2: 5단계 창작 파이프라인 가로 프로세스 바 */}
        <nav className="pipeline-steps-nav">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = activeStep === step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  className={`pipeline-step-item ${isCurrent ? 'active-step' : ''}`}
                  onClick={() => setActiveStep(step.id)}
                >
                  <div className="step-num-icon">
                    <span className="step-order">0{step.stepNum}</span>
                    <Icon size={16} />
                  </div>
                  <div className="step-text-wrap">
                    <strong className="step-title">{step.title}</strong>
                    <span className="step-sub">{step.desc}</span>
                  </div>
                </button>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="pipeline-step-arrow">
                    <ChevronRight size={16} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* =========================================================================
            우측 메인 워크스페이스 본문 (스텝별 캔버스)
           ========================================================================= */}
        <main className="canvas-workspace-body" onDragEnd={handleDragEnd}>
          {!activeBook ? (
            <div className="vault-empty-state">
              <BookOpen size={48} className="empty-icon" />
              <h3>좌측에서 기획할 작품을 선택해주세요</h3>
              <p>좌측 서가에서 작업할 책을 클릭하거나 '+ 새 기획' 버튼을 눌러 새로운 이야기를 시작하세요.</p>
            </div>
          ) : (
            <>
              {/* -----------------------------------------------------------------
                  [Step 0] 💡 아이디어 노트
                 ----------------------------------------------------------------- */}
              {activeStep === 'ideas' && (
                <div className="step-pane-content">
                  <div className="pane-section-header">
                    <div>
                      <h3>💡 0단계 : 아이디어 노트 (자유 스크래치패드)</h3>
                      <p>검열이나 형식 없이 머릿속에 번뜩인 영감, 문장, 소재, 낙서를 자유롭게 쏟아내세요.</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddQuickIdea} className="quick-idea-form">
                    <textarea
                      className="form-control quick-idea-textarea"
                      placeholder="무엇이든 자유롭게 적어보세요. (예: 2장 주인공의 결정적 실수, 반전 소재, 문득 떠오른 비유 문장 등)"
                      value={quickIdeaInput}
                      onChange={(e) => setQuickIdeaInput(e.target.value)}
                    />
                    <div className="quick-idea-actions">
                      <span className="quick-idea-tip">💡 작성 후 Enter 또는 기록 버튼 클릭</span>
                      <button type="submit" className="btn btn-primary" disabled={!quickIdeaInput.trim()}>
                        <Plus size={16} />
                        <span>아이디어 기록</span>
                      </button>
                    </div>
                  </form>

                  {ideaNotes.length === 0 ? (
                    <div className="vault-empty-state">
                      <Lightbulb size={40} className="empty-icon" />
                      <h4>아직 기록된 아이디어가 없습니다</h4>
                      <p>위 입력창에 생각나는 첫 번째 생각을 가볍게 적어보세요. 이 아이디어가 다음 단계 기획의 씨앗이 됩니다.</p>
                    </div>
                  ) : (
                    <div className="idea-cards-grid">
                      {ideaNotes.map(idea => (
                        <div key={idea.id} className="idea-card">
                          <p className="idea-card-text">{idea.content}</p>
                          <div className="idea-card-footer">
                            <span className="idea-card-date">
                              {new Date(idea.createdAt).toLocaleDateString('ko-KR')}
                            </span>
                            <div className="idea-card-btns">
                              <button
                                className="btn-text-action"
                                onClick={() => handlePromoteToVault(idea)}
                                title="이 아이디어를 정식 글감 창고로 보관"
                              >
                                <Bookmark size={13} />
                                <span>글감으로 보관</span>
                              </button>
                              <button
                                className="btn-icon-subtle"
                                onClick={() => handleDeleteIdea(idea.id)}
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* -----------------------------------------------------------------
                  [Step 1] 🧭 출간 기획서
                 ----------------------------------------------------------------- */}
              {activeStep === 'proposal' && (
                <div className="step-pane-content">
                  <div className="pane-section-header">
                    <div>
                      <h3>🧭 1단계 : 출간 기획서 (Book Concept)</h3>
                      <p>집필 도중 길을 잃지 않도록 책의 나침반이 되는 4대 핵심 질문에 답해보세요.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProposal} className="proposal-form-container">
                    <div className="proposal-card">
                      <div className="proposal-field">
                        <label>
                          <span className="field-badge">Q1</span>
                          <strong>책의 한 줄 컨셉 (로그라인)</strong>
                        </label>
                        <p className="field-hint">이 책은 한마디로 무엇에 관한 책인가요? 독자가 단번에 혹할 한 줄 메시지를 적어보세요.</p>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="예: 월급 200만 원 직장인이 3년 만에 사모펀드 대표가 되며 배운 자본주의 생존 법칙"
                          value={proposalLogline}
                          onChange={(e) => setProposalLogline(e.target.value)}
                        />
                      </div>

                      <div className="proposal-field">
                        <label>
                          <span className="field-badge">Q2</span>
                          <strong>기획 의도 (왜 지금 이 책인가?)</strong>
                        </label>
                        <p className="field-hint">이 책이 지금 출간되어야 하는 사회적 맥락이나 작가가 반드시 전하고 싶은 본질적 이유를 적으세요.</p>
                        <textarea
                          className="form-control"
                          style={{ minHeight: '80px' }}
                          placeholder="예: 정보는 넘쳐나지만 정작 실전에서 돈을 지키는 현실 감각이 부재한 시기, 날것 그대로의 경험담을 전달하고자 함."
                          value={proposalIntention}
                          onChange={(e) => setProposalIntention(e.target.value)}
                        />
                      </div>

                      <div className="proposal-field">
                        <label>
                          <span className="field-badge">Q3</span>
                          <strong>타깃 독자의 고통 & 결핍 (Who & Pain Point)</strong>
                        </label>
                        <p className="field-hint">누가 18,000원을 내고 이 책을 사서 읽을까요? 그들이 밤잠을 설치며 겪는 진짜 고통은 무엇인가요?</p>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="예: 30대 중반 직장인. 재테크 서적은 많이 읽었으나 실전에서 번번이 손실을 보며 불안해하는 사회초년생"
                          value={proposalTarget}
                          onChange={(e) => setProposalTarget(e.target.value)}
                        />
                      </div>

                      <div className="proposal-field">
                        <label>
                          <span className="field-badge">Q4</span>
                          <strong>기존 베스트셀러 대비 차별화 포인트 (USP)</strong>
                        </label>
                        <p className="field-hint">기존의 유사 경쟁 도서들과 무엇이 다른가요? 내 책만이 줄 수 있는 독점적 가치를 적어보세요.</p>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="예: 이론 중심의 뜬구름 잡는 이야기가 아닌, 실제 계약서와 손실 복구 과정을 가감 없이 공개한 현장 다큐멘터리"
                          value={proposalDiff}
                          onChange={(e) => setProposalDiff(e.target.value)}
                        />
                      </div>

                      <div className="proposal-submit-bar">
                        <button type="submit" className="btn btn-primary">
                          <Check size={16} />
                          <span>출간 기획서 보관하기</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* -----------------------------------------------------------------
                  [Step 2] 🗂️ 글감 & 취재창고
                 ----------------------------------------------------------------- */}
              {activeStep === 'materials' && (
                <div className="step-pane-content">
                  <div className="pane-section-header">
                    <div>
                      <h3>🗂️ 2단계 : 글감 & 취재창고 (Research Materials)</h3>
                      <p>집필 시 옆에 띄워두고 바로 인용할 팩트, 통계, 인터뷰 육성, 발췌문을 수집합니다.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setIsVaultModalOpen(true)}>
                      <Plus size={16} />
                      <span>새 취재 자료 수집</span>
                    </button>
                  </div>

                  <div className="tag-filter-container">
                    <span className="tag-filter-title">
                      <Tag size={14} /> 필터:
                    </span>
                    <div className="tag-bar">
                      {tags.map(t => (
                        <button
                          key={t}
                          className={`tag-btn ${activeTagFilter === t ? 'active' : ''}`}
                          onClick={() => setTagFilter(t)}
                        >
                          {t === 'ALL' ? '전체 보기' : `#${t}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredVault.length === 0 ? (
                    <div className="vault-empty-state">
                      <Bookmark size={48} className="empty-icon" />
                      <h4>보관된 취재 자료가 없습니다</h4>
                      <p>기사 링크, 통계 수치, 인터뷰 대사, 책 발췌문을 수집해보세요. 집필 시 스튜디오 AI가 자동으로 참고합니다.</p>
                      <button className="btn btn-primary" onClick={() => setIsVaultModalOpen(true)}>
                        <Plus size={16} />
                        <span>첫 자료 수집하기</span>
                      </button>
                    </div>
                  ) : (
                    <div className="vault-grid">
                      {filteredVault.map(item => (
                        <article key={item.id} className="vault-card">
                          <div className="vault-card-header">
                            <h4 className="vault-card-title">{item.title}</h4>
                            <button
                              className="btn-icon-subtle"
                              onClick={() => deleteVaultItem(item.id)}
                              title="삭제"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="vault-tags">
                            {item.tags?.map(tag => (
                              <span key={tag} className="vault-tag-badge">#{tag}</span>
                            ))}
                          </div>
                          <p className="vault-card-content">{item.content}</p>
                          {item.sourceRef && (
                            <div className="vault-card-source">
                              <Link2 size={12} />
                              <span>출처: {item.sourceRef}</span>
                            </div>
                          )}
                          <div className="vault-card-footer">
                            <span>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
                            <span>{item.content.length}자</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* -----------------------------------------------------------------
                  [Step 3] 👥 인물 & 뼈대
                 ----------------------------------------------------------------- */}
              {activeStep === 'story' && (
                <div className="step-pane-content">
                  <div className="pane-section-header">
                    <div>
                      <h3>👥 3단계 : 등장인물 시트 & 플롯 뼈대 (Bible)</h3>
                      <p>교보문고 18대 카테고리 매핑 8대 표준 플롯 규격을 로드하고, 인물 관계망을 정립합니다.</p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => { closeCharModal(); setIsCharModalOpen(true); }}
                    >
                      <UserPlus size={16} />
                      <span>새 인물 등록</span>
                    </button>
                  </div>

                  <section className="plot-preset-panel">
                    <div className="preset-panel-header">
                      <Compass size={18} />
                      <div>
                        <h4>출판 정석 8대 표준 플롯 뼈대 불러오기</h4>
                        <p>장르를 선택하면 검증된 기승전결 서사 뼈대와 집필 힌트가 즉시 적용됩니다.</p>
                      </div>
                    </div>
                    <div className="preset-cards-grid">
                      {Object.entries(PLOT_TEMPLATES).map(([key, tpl]) => (
                        <div
                          key={key}
                          className="preset-pill-card"
                          onClick={() => handleApplyPlotTemplate(key)}
                        >
                          <div className="preset-pill-top">
                            <span className="preset-badge">{tpl.badge}</span>
                            <span className="preset-count">{tpl.stages.length}단계</span>
                          </div>
                          <strong className="preset-name">{tpl.name}</strong>
                          <p className="preset-desc">{tpl.desc}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {plotStages.length > 0 && (
                    <div className="plot-stages-timeline">
                      {plotStages.map((stage, idx) => (
                        <article key={stage.id} className="stage-timeline-card">
                          <div className="stage-index-badge">
                            <span>{idx + 1}</span>
                          </div>
                          <div className="stage-main-wrap">
                            <div className="stage-top-bar">
                              <h4 className="stage-title">{stage.title}</h4>
                              <div className="stage-actions">
                                {editingStageId === stage.id ? (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleSaveStageNotes(stage.id)}
                                  >
                                    <Check size={14} /> 저장
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => {
                                      setEditingStageId(stage.id);
                                      setStageNotes(stage.content || '');
                                    }}
                                  >
                                    <Edit2 size={13} /> 아이디어 메모
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="stage-guide-desc">💡 {stage.desc}</p>
                            {editingStageId === stage.id ? (
                              <textarea
                                className="form-control stage-notes-textarea"
                                placeholder="이 단계의 구체적 사건, 에피소드 또는 핵심 메시지를 적으세요."
                                value={stageNotes}
                                onChange={(e) => setStageNotes(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              stage.content && (
                                <div className="stage-memo-display">
                                  <span className="memo-label">✍️ 작가 구상 메모:</span>
                                  <p className="memo-body">{stage.content}</p>
                                </div>
                              )
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="sub-section-divider">
                    <h4>등장인물 & 페르소나 ({characters.length}명)</h4>
                  </div>

                  {characters.length === 0 ? (
                    <div className="vault-empty-state">
                      <Users size={40} className="empty-icon" />
                      <h4>등록된 인물이 없습니다</h4>
                      <p>주인공, 적대자, 조력자 또는 타깃 독자 페르소나를 등록해 서사를 입체화하세요.</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => { closeCharModal(); setIsCharModalOpen(true); }}
                      >
                        <UserPlus size={16} />
                        <span>첫 인물 등록하기</span>
                      </button>
                    </div>
                  ) : (
                    <div className="character-grid">
                      {characters.map(char => (
                        <article key={char.id} className="character-card">
                          <div className="character-card-header">
                            {getRoleBadge(char.role)}
                            <div className="card-actions-row">
                              <button
                                className="btn-icon-subtle"
                                onClick={() => {
                                  setEditingCharId(char.id);
                                  setCharName(char.name);
                                  setCharRole(char.role || 'protagonist');
                                  setCharGoal(char.goal || '');
                                  setCharFlaw(char.flaw || '');
                                  setCharTraits(char.traits || '');
                                  setCharRelationship(char.relationship || '');
                                  setIsCharModalOpen(true);
                                }}
                                title="수정"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn-icon-subtle"
                                onClick={() => {
                                  if (window.confirm('이 인물을 삭제하시겠습니까?')) {
                                    updateActiveBookCharacters(characters.filter(c => c.id !== char.id));
                                  }
                                }}
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <h3 className="character-name">{char.name}</h3>
                          {char.goal && (
                            <div className="char-field-block">
                              <span className="char-field-label">🎯 핵심 욕망 / 목표</span>
                              <p className="char-field-val">{char.goal}</p>
                            </div>
                          )}
                          {char.flaw && (
                            <div className="char-field-block">
                              <span className="char-field-label">⚠️ 결핍 / 치명적 약점</span>
                              <p className="char-field-val">{char.flaw}</p>
                            </div>
                          )}
                          {char.relationship && (
                            <div className="char-field-block char-relation-box">
                              <span className="char-field-label">🔗 인물 관계</span>
                              <p className="char-field-val">{char.relationship}</p>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* -----------------------------------------------------------------
                  [Step 4] 📋 목차 조립대 (집필 스튜디오 1:1 방식 드래그 앤 드롭)
                 ----------------------------------------------------------------- */}
              {activeStep === 'outline' && (
                <div className="step-pane-content">
                  <div className="pane-section-header">
                    <div>
                      <h3>📋 4단계 : 목차 조립대 (가목차 샌드박스)</h3>
                      <p>스튜디오와 동일하게 챕터와 소목차를 직접 드래그하여 순서를 바꾸고, 더블클릭 또는 연필로 수정하세요.</p>
                    </div>
                    <button
                      className="btn btn-primary btn-apply-to-studio"
                      onClick={handleApplyDraftToStudio}
                      disabled={draftChapters.length === 0}
                    >
                      <Send size={16} />
                      <span>🚀 스튜디오 본문 목차로 최종 반영</span>
                    </button>
                  </div>

                  {/* 가목차 상단 도구 바 */}
                  <div className="draft-tools-bar">
                    <form onSubmit={handleAddDraftChapter} className="draft-add-chap-form">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="새 챕터(장) 제목 (예: 제1장. 충격적인 진실)"
                        value={newDraftChapTitle}
                        onChange={(e) => setNewDraftChapTitle(e.target.value)}
                      />
                      <button type="submit" className="btn btn-secondary" disabled={!newDraftChapTitle.trim()}>
                        <Plus size={15} />
                        <span>챕터 추가</span>
                      </button>
                    </form>

                    <div className="draft-tool-buttons">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleGenerateOutlineFromPlot}
                        title="3단계 플롯 뼈대로부터 목차 자동 생성"
                      >
                        <Wand2 size={14} />
                        <span>플롯 뼈대로 자동 구성</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleSyncFromStudio}
                        title="스튜디오 목차 다시 불러오기"
                      >
                        <RefreshCw size={14} />
                        <span>스튜디오 목차 복사</span>
                      </button>
                    </div>
                  </div>

                  {/* 가목차 챕터/소목차 조립 캔버스 (집필 스튜디오 1:1 드래그 앤 드롭 및 인라인 편집) */}
                  {draftChapters.length === 0 ? (
                    <div className="vault-empty-state">
                      <Compass size={48} className="empty-icon" />
                      <h4>작업 중인 가목차가 없습니다</h4>
                      <p>위 입력창에서 첫 번째 챕터를 추가하거나, '플롯 뼈대로 자동 구성' 버튼을 눌러보세요.</p>
                    </div>
                  ) : (
                    <div className="toc-list draft-toc-list" onDragEnd={handleDragEnd}>
                      {draftChapters.map((chap, cIdx) => {
                        const isChapterDragging = draggedItem?.type === 'chapter' && draggedItem?.chapterId === chap.id;
                        const isChapterOver = dragOverTarget?.type === 'chapter' && dragOverTarget?.id === chap.id;
                        const isChapterDropTarget = dragOverTarget?.type === 'chapter-drop-target' && dragOverTarget?.id === chap.id;

                        return (
                          <div key={chap.id || cIdx} className="chapter-group">
                            {/* 챕터 헤더 (스튜디오와 동일하게 카드 자체 draggable, 별도 핸들 없음) */}
                            <div
                              className={`chapter-header ${isChapterDragging ? 'is-dragging' : ''} ${isChapterOver ? `drag-over-${dragOverTarget.position}` : ''} ${isChapterDropTarget ? 'drag-target-hover' : ''}`}
                              draggable={editingChapId !== chap.id}
                              onDragStart={(e) => handleChapterDragStart(e, chap.id, cIdx)}
                              onDragOver={(e) => handleChapterDragOver(e, chap.id, cIdx)}
                              onDrop={(e) => handleChapterDrop(e, chap.id, cIdx)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', flex: 1 }}>
                                {editingChapId === chap.id ? (
                                  <input
                                    type="text"
                                    className="chapter-inline-edit-input"
                                    value={editingChapTitle}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditingChapTitle(e.target.value)}
                                    onBlur={() => handleCommitChapterTitle(chap.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCommitChapterTitle(chap.id);
                                      if (e.key === 'Escape') setEditingChapId(null);
                                    }}
                                  />
                                ) : (
                                  <span
                                    title="더블클릭하여 챕터명 수정 (드래그하여 순서 이동)"
                                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab' }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingChapId(chap.id);
                                      setEditingChapTitle(cleanTitle(chap.title));
                                    }}
                                  >
                                    {cIdx + 1}장. {cleanTitle(chap.title)}
                                  </span>
                                )}

                                <span className="chapter-badge-mini draft">
                                  {chap.sections?.length || 0}꼭지
                                </span>
                              </div>

                              <div className="chapter-header-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn-add-section"
                                  onClick={() => handleAddDraftSection(chap.id)}
                                  title="소목차 추가"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-edit-chapter"
                                  onClick={() => {
                                    if (editingChapId === chap.id) {
                                      handleCommitChapterTitle(chap.id);
                                    } else {
                                      setEditingChapId(chap.id);
                                      setEditingChapTitle(cleanTitle(chap.title));
                                    }
                                  }}
                                  title="챕터명 수정"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-delete-chapter"
                                  onClick={() => handleDeleteDraftChapter(chap.id)}
                                  title="챕터 삭제"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* 소목차 목록 (스튜디오와 동일하게 항목 자체 draggable, 별도 핸들 없음) */}
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
                                  const srcChapId = draggedItem.chapterId;
                                  const srcSIdx = draggedItem.sIdx;
                                  const cloned = structuredClone(draftChapters);
                                  const srcChap = cloned.find(c => c.id === srcChapId);
                                  const tgtChap = cloned.find(c => c.id === chap.id);
                                  if (srcChap && tgtChap) {
                                    const [movedSec] = srcChap.sections.splice(srcSIdx, 1);
                                    if (!tgtChap.sections) tgtChap.sections = [];
                                    tgtChap.sections.push(movedSec);
                                    saveDraftOutline(cloned);
                                    showToast('소목차가 이동되었습니다.', 'info');
                                  }
                                  setDraggedItem(null);
                                  setDragOverTarget(null);
                                }
                              }}
                            >
                              {(!chap.sections || chap.sections.length === 0) ? (
                                <div className="empty-sections-tip" onClick={() => handleAddDraftSection(chap.id)}>
                                  <span>+ 클릭하여 소목차를 추가하세요</span>
                                </div>
                              ) : (
                                chap.sections.map((sec, sIdx) => {
                                  const isSecDragging = draggedItem?.type === 'section' && draggedItem?.sectionId === sec.id;
                                  const isSecOver = dragOverTarget?.type === 'section' && dragOverTarget?.id === sec.id;

                                  return (
                                    <div
                                      key={sec.id || sIdx}
                                      className={`section-item ${isSecDragging ? 'is-dragging' : ''} ${isSecOver ? `drag-over-${dragOverTarget.position}` : ''}`}
                                      draggable={editingSecId !== sec.id}
                                      onDragStart={(e) => handleSectionDragStart(e, chap.id, sec.id, cIdx, sIdx)}
                                      onDragOver={(e) => handleSectionDragOver(e, sec.id, cIdx, sIdx)}
                                      onDrop={(e) => handleSectionDrop(e, chap.id, sIdx)}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', flex: 1 }}>
                                        {editingSecId === sec.id ? (
                                          <input
                                            type="text"
                                            className="section-inline-edit-input"
                                            value={editingSecTitle}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setEditingSecTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleCommitSectionTitle(chap.id, sec.id);
                                              if (e.key === 'Escape') setEditingSecId(null);
                                            }}
                                            onBlur={() => handleCommitSectionTitle(chap.id, sec.id)}
                                          />
                                        ) : (
                                          <span
                                            className="section-item-title"
                                            title="더블클릭하여 소목차 수정 (드래그하여 순서 이동)"
                                            style={{ cursor: 'grab' }}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              setEditingSecId(sec.id);
                                              setEditingSecTitle(cleanTitle(sec.title));
                                            }}
                                          >
                                            {cIdx + 1}.{sIdx + 1} {cleanTitle(sec.title)}
                                          </span>
                                        )}
                                      </div>

                                      <div className="section-item-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          className="btn-edit-section"
                                          title="소목차 수정"
                                          onClick={() => {
                                            if (editingSecId === sec.id) {
                                              handleCommitSectionTitle(chap.id, sec.id);
                                            } else {
                                              setEditingSecId(sec.id);
                                              setEditingSecTitle(cleanTitle(sec.title));
                                            }
                                          }}
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-delete-section"
                                          title="소목차 삭제"
                                          onClick={() => handleDeleteDraftSection(chap.id, sec.id)}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* =========================================================================
          [공통 모달 1] 새 작품 생성 모달
         ========================================================================= */}
      {isNewProjectModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewProjectModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>새 작품(예비작품) 기획 시작</h2>
              <button className="modal-close-btn" onClick={() => setIsNewProjectModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateNewProject}>
              <div className="modal-body">
                <div className="form-group">
                  <label>작품 가제 (임시 제목) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 나의 사모펀드 생존기, 30일 퇴사 프로젝트"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>장르 분류</label>
                  <select
                    className="form-control"
                    value={newProjectGenre}
                    onChange={(e) => setNewProjectGenre(e.target.value)}
                  >
                    <option value="economy">경제/경영</option>
                    <option value="fiction">소설/웹소설</option>
                    <option value="self_improvement">자기계발</option>
                    <option value="essay">에세이/문학</option>
                    <option value="humanities">인문/사회</option>
                    <option value="practical">실무/IT</option>
                    <option value="general">기타/일반</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewProjectModalOpen(false)}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} />
                  <span>기획 시작하기</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          [공통 모달 2] 취재 자료 수집 모달
         ========================================================================= */}
      {isVaultModalOpen && (
        <div className="modal-overlay" onClick={() => setIsVaultModalOpen(false)}>
          <div className="modal-box vault-custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>취재 자료 수집</h2>
              <button className="modal-close-btn" onClick={() => setIsVaultModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateVaultItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label>자료 유형 분류</label>
                  <div className="category-selector-row">
                    {VAULT_CATEGORIES.map(cat => (
                      <button
                        type="button"
                        key={cat.id}
                        className={`cat-pill-btn ${vaultCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setVaultCategory(cat.id)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>자료 제목 *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 2026 AI 트렌드 수치 요약"
                    value={vaultTitle}
                    onChange={(e) => setVaultTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 1장, 팩트, 대사, 취재"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>핵심 내용 및 메모 *</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '120px' }}
                    placeholder="집필 시 AI에게 주입하거나 작가가 참고할 핵심 정보, 발췌문을 입력하세요."
                    value={vaultContent}
                    onChange={(e) => setVaultContent(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>출처 / 참고 URL (선택)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 한국은행 2026 보고서 14p, https://example.com"
                    value={vaultSource}
                    onChange={(e) => setVaultSource(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsVaultModalOpen(false)}
                  disabled={isVaultSubmitting}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={isVaultSubmitting}>
                  <Check size={16} />
                  <span>{isVaultSubmitting ? '저장 중...' : '자료 보관'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          [공통 모달 3] 인물 등록/수정 모달
         ========================================================================= */}
      {isCharModalOpen && (
        <div className="modal-overlay" onClick={closeCharModal}>
          <div className="modal-box vault-custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCharId ? '인물 정보 수정' : '새 인물 등록'}</h2>
              <button className="modal-close-btn" onClick={closeCharModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCharacter}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.8rem' }}>
                  <div className="form-group">
                    <label>인물 이름 *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="예: 강도진, 한세아, 30대 직장인 페르소나"
                      value={charName}
                      onChange={(e) => setCharName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>서사적 역할</label>
                    <select
                      className="form-control"
                      value={charRole}
                      onChange={(e) => setCharRole(e.target.value)}
                    >
                      <option value="protagonist">주인공 (주역)</option>
                      <option value="antagonist">적대자 (갈등 유발)</option>
                      <option value="supporting">조연 / 동료</option>
                      <option value="mentor">조력자 / 멘토</option>
                      <option value="persona">타깃 독자 페르소나</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>🎯 핵심 목표 / 욕망 (Goal)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="이 인물이 가장 간절히 바라는 것"
                    value={charGoal}
                    onChange={(e) => setCharGoal(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>⚠️ 결핍 / 치명적 약점 (Flaw)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="인물을 입체적으로 만드는 약점"
                    value={charFlaw}
                    onChange={(e) => setCharFlaw(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>✨ 성격 및 외모 특징</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: 냉철하지만 가족에게 약함"
                    value={charTraits}
                    onChange={(e) => setCharTraits(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>🔗 다른 인물과의 관계도</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '80px' }}
                    placeholder="다른 인물들과의 적대/협력 관계를 적으세요."
                    value={charRelationship}
                    onChange={(e) => setCharRelationship(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeCharModal}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>{editingCharId ? '수정 완료' : '인물 등록'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
