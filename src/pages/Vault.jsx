import React, { useEffect, useState, useMemo, useRef } from 'react';
import './Vault.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { aiService } from '../services/aiService';
import { storageService } from '../services/storageService';
import ModelQuotasModal from '../components/ai/ModelQuotasModal';
import {
  Plus, Trash2, X, Users, BookOpen, Layers, Check, Edit2,
  ChevronLeft, Bookmark, Compass, PenTool, CheckCircle, ChevronRight,
  Send, AlertCircle, RefreshCw, Bot, Sparkles, Save, Info, Sliders,
  HelpCircle, Lightbulb, Sun, MessageSquare, Zap
} from 'lucide-react';
import { PIPELINE_STEPS, VAULT_CATEGORIES } from '../data/vaultConstants';
import { OFFICIAL_GENRES, getOfficialGenreId } from '../data/genreConstants';
import { PLOT_CATEGORIES, PLOT_LIBRARY, GENRE_RECOMMENDED_PLOTS } from '../data/plotLibraryDb';

// 제목 정제 헬퍼 (제1장, 1. 등의 접두사 중복 방지)
const cleanTitle = (str) => (str || '').replace(/^제?\s*\d+\s*[장회편절단계권]?\s*[\.:\-]?\s*/i, '').trim();

export default function Vault() {
  const {
    vault, loadVault, deleteVaultItem, activeTagFilter, setTagFilter, showToast,
    books, loadBooks, activeBook, setActiveBook, openBook, setView,
    updateActiveBookPlanning, updateActiveBookCharacters, updateActiveBookPlotStages, openConfirm, openPrompt
  } = useStore();

  // 상단 5대 순차 파이프라인 단계 ('ideas' | 'proposal' | 'materials' | 'story' | 'outline')
  const [activeStep, setActiveStep] = useState('ideas');

  // 새 작품 기획 생성 모달
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectGenre, setNewProjectGenre] = useState('novel');

  // --- Step 0: 아이디어 노트 상태 ---
  const [quickIdeaInput, setQuickIdeaInput] = useState('');
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaContent, setEditingIdeaContent] = useState('');

  // --- Step 1: 출간 기획서 상태 ---
  const [proposalLogline, setProposalLogline] = useState('');
  const [proposalIntention, setProposalIntention] = useState('');
  const [proposalTarget, setProposalTarget] = useState('');
  const [proposalDiff, setProposalDiff] = useState('');

  // --- Step 2: 글감 & 취재창고 상태 ---
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null); // null: 신규, string: 수정
  const [vaultCategory, setVaultCategory] = useState('ALL');
  const [vaultTitle, setVaultTitle] = useState('');
  const [vaultContent, setVaultContent] = useState('');
  const [vaultSource, setVaultSource] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isVaultSubmitting, setIsVaultSubmitting] = useState(false);

  // --- Step 3: 인물 & 뼈대 상태 ---
  const [currentGenreKey, setCurrentGenreKey] = useState('essay');
  const [selectedPlotTemplateId, setSelectedPlotTemplateId] = useState('');
  const [plotStages, setPlotStages] = useState([]);
  const [activeMemoKey, setActiveMemoKey] = useState(null); // 'sIdx_spIdx'
  const [memoInputText, setMemoInputText] = useState('');

  // 플롯 단계/세부 꼭지 인라인 수정 상태
  const [editingStageIdx, setEditingStageIdx] = useState(null);
  const [editingStageTitle, setEditingStageTitle] = useState('');
  const [editingStageDesc, setEditingStageDesc] = useState('');
  const [editingSubplotKey, setEditingSubplotKey] = useState(null); // 'sIdx_spIdx'
  const [editingSubplotTitle, setEditingSubplotTitle] = useState('');
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);

  // 인물 모달
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [editingCharId, setEditingCharId] = useState(null);
  const [charName, setCharName] = useState('');
  const [charRole, setCharRole] = useState('주인공/화자');
  const [charGoal, setCharGoal] = useState('');
  const [charFlaw, setCharFlaw] = useState('');
  const [charTraits, setCharTraits] = useState('');
  const [charRelationship, setCharRelationship] = useState('');

  // --- Step 4: 목차 조립대 (가목차 샌드박스) 상태 ---
  const [draftChapters, setDraftChapters] = useState([]);
  const [editingChapId, setEditingChapId] = useState(null);
  const [editingChapTitle, setEditingChapTitle] = useState('');
  const [editingSecId, setEditingSecId] = useState(null);
  const [editingSecTitle, setEditingSecTitle] = useState('');

  // 목차 기획 모달
  const [isOutlinePlanModalOpen, setIsOutlinePlanModalOpen] = useState(false);
  const [generatedAiOutline, setGeneratedAiOutline] = useState(null);
  const [isAiGeneratingOutline, setIsAiGeneratingOutline] = useState(false);

  // 노션 스타일 드래그 앤 드롭 상태
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'chapter' | 'section', chapterId, sectionId, cIdx, sIdx }
  const [dragOverTarget, setDragOverTarget] = useState(null); // { type, id, position: 'top' | 'bottom' }

  // --- 우측 3열: AI 기획 어시스턴트 & 쿼터 모달 상태 ---
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      role: 'assistant',
      text: '반갑습니다, 작가님. 도서 기획 및 플롯 설계를 돕는 AI 기획 어시스턴트입니다.\n로그라인 진단, 장르별 서사 보강, 목차 구성 등 기획 전반에 대해 언제든 질문해 주세요.'
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiChatLoading, setIsAiChatLoading] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [activeModelName, setActiveModelName] = useState('스마트 자동 전환');
  const chatBodyRef = useRef(null);

  // 1. 초기 로드 및 도서 목록 동기화
  useEffect(() => {
    loadBooks();
    loadVault();
    try {
      const cfg = storageService.getConfig();
      if (cfg?.geminiModel === 'smart_cascade' || !cfg?.geminiModel) {
        setActiveModelName('스마트 자동 전환');
      } else {
        setActiveModelName(cfg.geminiModel);
      }
    } catch {}
  }, []);

  // AI 쿼터/모델 변경 감지
  useEffect(() => {
    const handleConfigUpdate = () => {
      try {
        const cfg = storageService.getConfig();
        if (cfg?.geminiModel === 'smart_cascade' || !cfg?.geminiModel) {
          setActiveModelName('스마트 자동 전환');
        } else {
          setActiveModelName(cfg.geminiModel);
        }
      } catch {}
    };
    window.addEventListener('ai_config_updated', handleConfigUpdate);
    return () => window.removeEventListener('ai_config_updated', handleConfigUpdate);
  }, []);

  // activeBook 변경 시 기획서, 인물, 플롯, 가목차 동기화
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

      // 공식 10대 장르 정규화
      const gKey = getOfficialGenreId(activeBook.genre || activeBook.genreKey);
      setCurrentGenreKey(gKey);

      // 장르별 추천 뼈대 및 기본 뼈대 도출
      const recPlotIds = GENRE_RECOMMENDED_PLOTS[gKey] || GENRE_RECOMMENDED_PLOTS.novel;
      const defaultPlot = PLOT_LIBRARY.find((p) => p.id === recPlotIds[0]) || PLOT_LIBRARY[0];

      // 플롯 뼈대 동기화
      if (Array.isArray(activeBook.plotStages) && activeBook.plotStages.length > 0) {
        setPlotStages(structuredClone(activeBook.plotStages));
        const matched = PLOT_LIBRARY.find((p) => p.name === activeBook.plotStandardName || p.id === activeBook.plotStandardId);
        setSelectedPlotTemplateId(matched ? matched.id : recPlotIds[0]);
      } else {
        setSelectedPlotTemplateId(defaultPlot.id);
        const cloned = defaultPlot.stages.map((st, idx) => ({
          id: `stage_${idx + 1}`,
          title: st.title,
          desc: st.desc || '',
          subplots: (st.subplots || []).map((sp) => ({
            title: typeof sp === 'string' ? sp : sp.title,
            memo: ''
          }))
        }));
        setPlotStages(cloned);
      }

      // 가목차 동기화 (기존 draftOutline 또는 스튜디오 목차)
      if (Array.isArray(activeBook.draftOutline) && activeBook.draftOutline.length > 0) {
        setDraftChapters(structuredClone(activeBook.draftOutline));
      } else if (Array.isArray(activeBook.chapters) && activeBook.chapters.length > 0) {
        const converted = activeBook.chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          sections: (ch.sections || []).map((sec) => ({
            id: sec.id,
            title: sec.title
          }))
        }));
        setDraftChapters(converted);
      } else {
        // 기본 템플릿 목차
        const initial = defaultPlot.stages.map((st, idx) => ({
          id: `draft_chap_${idx + 1}`,
          title: `제${idx + 1}장. ${st.title.replace(/^\d+\.\s*/, '')}`,
          sections: (st.subplots || []).map((sp, spIdx) => ({
            id: `draft_sec_${idx + 1}_${spIdx + 1}`,
            title: typeof sp === 'string' ? sp : sp.title
          }))
        }));
        setDraftChapters(initial);
      }
    }
  }, [activeBook]);

  // 활성 단계 번호 계산 (1~5)
  const currentStepNumber = useMemo(() => {
    const idx = PIPELINE_STEPS.findIndex((s) => s.id === activeStep);
    return idx >= 0 ? idx + 1 : 1;
  }, [activeStep]);

  // 글감 및 아이디어 분리
  const ideaNotes = useMemo(() => {
    return vault.filter((item) => (item.category === 'idea' || !item.category) && !item.isMaterial);
  }, [vault]);

  const materials = useMemo(() => {
    return vault.filter((item) => item.category !== 'idea' || item.isMaterial);
  }, [vault]);

  const filteredMaterials = useMemo(() => {
    if (vaultCategory === 'ALL') return materials;
    return materials.filter((m) => m.category === vaultCategory);
  }, [materials, vaultCategory]);

  const characters = useMemo(() => {
    return activeBook?.characters || [];
  }, [activeBook]);

  // --- Step 0: 아이디어 추가 및 승격 ---
  const handleAddQuickIdea = async (e) => {
    if (e) e.preventDefault();
    if (!quickIdeaInput.trim()) return;
    try {
      await bookService.createVaultItem({
        title: quickIdeaInput.trim().slice(0, 30),
        content: quickIdeaInput.trim(),
        category: 'idea',
        isMaterial: false,
        tags: ['아이디어']
      });
      setQuickIdeaInput('');
      await loadVault();
      showToast('새 아이디어가 기록되었습니다.', 'info');
    } catch (err) {
      showToast(`기록 실패: ${err.message}`, 'error');
    }
  };

  // 아이디어 승격 (글감 보관 오류 완벽 해결)
  const handlePromoteToVault = async (ideaItem) => {
    try {
      await bookService.updateVaultItem(ideaItem.id, {
        isMaterial: true,
        category: 'idea', // 아이디어 발상 태그로 정확히 승격
        tags: Array.from(new Set([...(ideaItem.tags || []), '아이디어', '글감']))
      });
      await loadVault();
      showToast('아이디어가 글감·취재창고로 안전하게 보관되었습니다.', 'success');
    } catch (err) {
      showToast(`보관 실패: ${err.message}`, 'error');
    }
  };

  // 아이디어 인라인 수정
  const handleOpenEditIdea = (idea) => {
    setEditingIdeaId(idea.id);
    setEditingIdeaContent(idea.content || '');
  };

  const handleSaveEditIdea = async (ideaId) => {
    if (!editingIdeaContent.trim()) {
      showToast('내용을 입력해주세요.', 'error');
      return;
    }
    try {
      await bookService.updateVaultItem(ideaId, {
        title: editingIdeaContent.trim().slice(0, 30),
        content: editingIdeaContent.trim()
      });
      setEditingIdeaId(null);
      setEditingIdeaContent('');
      await loadVault();
      showToast('아이디어가 수정되었습니다.', 'success');
    } catch (err) {
      showToast(`수정 실패: ${err.message}`, 'error');
    }
  };

  const handleDeleteIdea = async (id) => {
    try {
      await deleteVaultItem(id);
      showToast('아이디어가 삭제되었습니다.', 'info');
    } catch (err) {
      showToast(`삭제 실패: ${err.message}`, 'error');
    }
  };

  // --- Step 1: 출간 기획서 저장 ---
  const handleSaveProposal = async (e) => {
    if (e) e.preventDefault();
    if (!activeBook) return;
    try {
      const proposalData = {
        logline: proposalLogline.trim(),
        intention: proposalIntention.trim(),
        target: proposalTarget.trim(),
        diff: proposalDiff.trim()
      };
      await updateActiveBookPlanning(proposalData);
      showToast('출간 기획서가 저장되었습니다.', 'success');
    } catch (err) {
      showToast(`기획서 저장 실패: ${err.message}`, 'error');
    }
  };

  // --- Step 2: 취재 자료 등록 및 수정 ---
  const handleOpenCreateMaterial = () => {
    setEditingMaterialId(null);
    setVaultTitle('');
    setVaultContent('');
    setVaultCategory('quote');
    setVaultSource('');
    setTagsInput('');
    setIsVaultModalOpen(true);
  };

  const handleOpenEditMaterial = (item) => {
    setEditingMaterialId(item.id);
    setVaultTitle(item.title || '');
    setVaultContent(item.content || '');
    setVaultCategory(item.category || 'quote');
    setVaultSource(item.sourceRef || item.source || '');
    setTagsInput((item.tags || []).join(', '));
    setIsVaultModalOpen(true);
  };

  const handleCreateOrUpdateMaterial = async (e) => {
    e.preventDefault();
    if (!vaultTitle.trim() && !vaultContent.trim()) {
      showToast('제목 또는 내용을 입력해주세요.', 'error');
      return;
    }
    try {
      setIsVaultSubmitting(true);
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const targetCategory = vaultCategory === 'ALL' ? 'quote' : vaultCategory;
      const categoryLabel = VAULT_CATEGORIES.find((c) => c.id === targetCategory)?.label || '취재자료';
      const finalTags = Array.from(new Set([categoryLabel, ...parsedTags]));

      if (editingMaterialId) {
        // 기존 자료 수정
        await bookService.updateVaultItem(editingMaterialId, {
          title: vaultTitle.trim() || '취재 자료',
          content: vaultContent.trim(),
          category: targetCategory,
          isMaterial: true,
          sourceRef: vaultSource.trim(),
          tags: finalTags
        });
        showToast('취재 자료가 성공적으로 수정되었습니다.', 'success');
      } else {
        // 신규 취재 자료 등록
        await bookService.createVaultItem({
          title: vaultTitle.trim() || '취재 자료',
          content: vaultContent.trim(),
          category: targetCategory,
          isMaterial: true,
          sourceRef: vaultSource.trim(),
          tags: finalTags
        });
        showToast('취재 자료가 성공적으로 등록되었습니다.', 'success');
      }

      setEditingMaterialId(null);
      setVaultTitle('');
      setVaultContent('');
      setVaultSource('');
      setTagsInput('');
      setIsVaultModalOpen(false);
      await loadVault();
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsVaultSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await deleteVaultItem(id);
      showToast('취재 자료가 삭제되었습니다.', 'info');
    } catch (err) {
      showToast(`삭제 실패: ${err.message}`, 'error');
    }
  };

  // --- Step 3: 장르별 표준 서사 뼈대 스위칭 및 플롯/꼭지 편집 로직 ---
  const handleSelectPlotTemplate = async (template) => {
    const ok = await openConfirm({
      title: '서사 뼈대 변경',
      message: `'${template.name}' 구조로 플롯 뼈대를 전환하시겠습니까?\n\n[흐름]: ${template.flow}\n[적합]: ${template.fitFor || '표준 권장'}\n\n(전환 시 기존 플롯 단계가 선택한 구조의 표준 단계로 새로 구성됩니다)`,
      confirmText: '뼈대 적용'
    });
    if (!ok) return;

    setSelectedPlotTemplateId(template.id);
    const clonedStages = (template.stages || []).map((st, idx) => ({
      id: `stage_${Date.now()}_${idx + 1}`,
      title: st.title,
      desc: st.desc || '',
      subplots: (st.subplots || []).map((sp) => ({
        title: typeof sp === 'string' ? sp : sp.title,
        memo: ''
      }))
    }));
    setPlotStages(clonedStages);
    if (activeBook) {
      await bookService.updateBook(activeBook.id, {
        plotStages: clonedStages,
        plotStandardName: template.name,
        plotStandardId: template.id
      });
      await updateActiveBookPlotStages(clonedStages);
      showToast(`'${template.name}' 서사 뼈대가 적용되었습니다.`, 'success');
    }
  };

  // 플롯 단계 추가
  const handleAddNewStage = async () => {
    const stageNum = plotStages.length + 1;
    const newStage = {
      id: `stage_${Date.now()}`,
      title: `${stageNum}. 새로운 플롯 단계`,
      desc: '해당 단계의 주요 사건 전개와 목표를 기록하세요.',
      subplots: [
        { title: `${stageNum}.1 첫 번째 세부 꼭지`, memo: '' }
      ]
    };
    const cloned = [...plotStages, newStage];
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    showToast('새 플롯 단계가 추가되었습니다.', 'info');
  };

  // 플롯 단계 삭제
  const handleDeleteStage = async (sIdx) => {
    const ok = await openConfirm({
      title: '플롯 단계 삭제',
      message: '이 플롯 단계와 하위 세부 꼭지를 모두 삭제하시겠습니까?',
      confirmText: '삭제'
    });
    if (!ok) return;
    const cloned = structuredClone(plotStages);
    cloned.splice(sIdx, 1);
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    showToast('플롯 단계가 삭제되었습니다.', 'info');
  };

  // 플롯 단계명 수정
  const handleCommitEditStage = async (sIdx) => {
    const cloned = structuredClone(plotStages);
    if (editingStageTitle.trim()) {
      cloned[sIdx].title = editingStageTitle.trim();
    }
    if (editingStageDesc !== undefined) {
      cloned[sIdx].desc = editingStageDesc.trim();
    }
    setPlotStages(cloned);
    setEditingStageIdx(null);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
      showToast('플롯 단계 정보가 수정되었습니다.', 'info');
    }
  };

  // 세부 꼭지 추가
  const handleAddNewSubplot = async (sIdx) => {
    const cloned = structuredClone(plotStages);
    const subCount = (cloned[sIdx].subplots || []).length + 1;
    cloned[sIdx].subplots.push({
      title: `${sIdx + 1}.${subCount} 새로운 세부 꼭지`,
      memo: ''
    });
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    showToast('새 세부 꼭지가 추가되었습니다.', 'info');
  };

  // 세부 꼭지 인라인 수정 완료
  const handleCommitEditSubplot = async (sIdx, spIdx) => {
    if (editingSubplotTitle.trim()) {
      const cloned = structuredClone(plotStages);
      const target = cloned[sIdx].subplots[spIdx];
      if (typeof target === 'string') {
        cloned[sIdx].subplots[spIdx] = { title: editingSubplotTitle.trim(), memo: '' };
      } else {
        target.title = editingSubplotTitle.trim();
      }
      setPlotStages(cloned);
      if (activeBook) {
        await updateActiveBookPlotStages(cloned);
      }
    }
    setEditingSubplotKey(null);
    setEditingSubplotTitle('');
  };

  // 세부 꼭지 삭제
  const handleDeleteSubplot = async (sIdx, spIdx) => {
    const cloned = structuredClone(plotStages);
    cloned[sIdx].subplots.splice(spIdx, 1);
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    showToast('세부 꼭지가 삭제되었습니다.', 'info');
  };

  // 세부 꼭지 아이디어 메모 에디터
  const handleOpenMemoEditor = (sIdx, spIdx, currentMemo = '') => {
    const key = `${sIdx}_${spIdx}`;
    setActiveMemoKey(key);
    setMemoInputText(currentMemo);
  };

  const handleSaveSubplotMemo = async (sIdx, spIdx) => {
    const cloned = structuredClone(plotStages);
    const targetSub = cloned[sIdx].subplots[spIdx];
    if (typeof targetSub === 'string') {
      cloned[sIdx].subplots[spIdx] = {
        title: targetSub,
        memo: memoInputText.trim()
      };
    } else {
      targetSub.memo = memoInputText.trim();
    }
    setPlotStages(cloned);
    setActiveMemoKey(null);
    setMemoInputText('');
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
      showToast('세부 꼭지 아이디어 메모가 저장되었습니다.', 'info');
    }
  };

  const handleDeleteSubplotMemo = async (sIdx, spIdx) => {
    const cloned = structuredClone(plotStages);
    const targetSub = cloned[sIdx].subplots[spIdx];
    if (typeof targetSub === 'object' && targetSub !== null) {
      targetSub.memo = '';
    }
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
      showToast('아이디어 메모가 삭제되었습니다.', 'info');
    }
  };

  // 인물 추가/수정
  const handleSaveCharacter = async (e) => {
    e.preventDefault();
    if (!charName.trim()) {
      showToast('인물 이름을 입력해주세요.', 'error');
      return;
    }
    const currentChars = structuredClone(characters);
    if (editingCharId) {
      const idx = currentChars.findIndex((c) => c.id === editingCharId);
      if (idx >= 0) {
        currentChars[idx] = {
          ...currentChars[idx],
          name: charName.trim(),
          role: charRole,
          goal: charGoal.trim(),
          flaw: charFlaw.trim(),
          traits: charTraits.trim(),
          relationship: charRelationship.trim()
        };
      }
    } else {
      currentChars.push({
        id: `char_${Date.now()}`,
        name: charName.trim(),
        role: charRole,
        goal: charGoal.trim(),
        flaw: charFlaw.trim(),
        traits: charTraits.trim(),
        relationship: charRelationship.trim()
      });
    }

    await updateActiveBookCharacters(currentChars);
    setIsCharModalOpen(false);
    setEditingCharId(null);
    setCharName('');
    setCharGoal('');
    setCharFlaw('');
    setCharTraits('');
    setCharRelationship('');
    showToast('인물 프로필이 저장되었습니다.', 'success');
  };

  const handleDeleteChar = async (charId) => {
    const ok = await openConfirm({
      title: '인물 삭제',
      message: '이 등장인물 프로필을 삭제하시겠습니까?',
      confirmText: '삭제'
    });
    if (!ok) return;
    const currentChars = characters.filter((c) => c.id !== charId);
    await updateActiveBookCharacters(currentChars);
    showToast('인물 프로필이 삭제되었습니다.', 'info');
  };

  // --- Step 4: 목차 조립대 로직 ---
  const saveDraftOutline = async (newDraft) => {
    setDraftChapters(newDraft);
    if (activeBook) {
      await bookService.updateBook(activeBook.id, { draftOutline: newDraft });
    }
  };

  const handleAddNewChapter = async () => {
    const cloned = structuredClone(draftChapters);
    const newChapNum = cloned.length + 1;
    cloned.push({
      id: `draft_chap_${Date.now()}`,
      title: `제${newChapNum}장. 새로운 챕터`,
      sections: [
        { id: `draft_sec_${Date.now()}_1`, title: `${newChapNum}.1 첫 번째 소목차` }
      ]
    });
    await saveDraftOutline(cloned);
    showToast('새 챕터가 추가되었습니다.', 'info');
  };

  const handleDeleteChapter = async (cIdx) => {
    const ok = await openConfirm({
      title: '챕터 삭제',
      message: '이 챕터와 포함된 소목차를 목차 조립대에서 삭제하시겠습니까?',
      confirmText: '삭제'
    });
    if (!ok) return;
    const cloned = structuredClone(draftChapters);
    cloned.splice(cIdx, 1);
    await saveDraftOutline(cloned);
    showToast('챕터가 삭제되었습니다.', 'info');
  };

  const handleAddNewSection = async (cIdx) => {
    const cloned = structuredClone(draftChapters);
    const secCount = (cloned[cIdx].sections || []).length + 1;
    cloned[cIdx].sections.push({
      id: `draft_sec_${Date.now()}`,
      title: `${cIdx + 1}.${secCount} 새로운 소목차`
    });
    await saveDraftOutline(cloned);
    showToast('새 소목차가 추가되었습니다.', 'info');
  };

  const handleDeleteSection = async (cIdx, sIdx) => {
    const cloned = structuredClone(draftChapters);
    cloned[cIdx].sections.splice(sIdx, 1);
    await saveDraftOutline(cloned);
    showToast('소목차가 삭제되었습니다.', 'info');
  };

  // 인라인 수정 커밋
  const handleCommitEditChapter = async (cIdx) => {
    if (editingChapTitle.trim()) {
      const cloned = structuredClone(draftChapters);
      cloned[cIdx].title = editingChapTitle.trim();
      await saveDraftOutline(cloned);
    }
    setEditingChapId(null);
    setEditingChapTitle('');
  };

  const handleCommitEditSection = async (cIdx, sIdx) => {
    if (editingSecTitle.trim()) {
      const cloned = structuredClone(draftChapters);
      cloned[cIdx].sections[sIdx].title = editingSecTitle.trim();
      await saveDraftOutline(cloned);
    }
    setEditingSecId(null);
    setEditingSecTitle('');
  };

  // 노션 스타일 드래그 핸들러
  const handleChapterDragStart = (e, chapId, cIdx) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ type: 'chapter', chapterId: chapId, cIdx });
  };

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
      setDragOverTarget({ type: 'chapter-drop-target', id: chapId, targetCIdx: cIdx });
    }
  };

  const handleChapterDrop = async (e, chapId, cIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    if (draggedItem.type === 'chapter') {
      const srcIdx = draggedItem.cIdx;
      let tgtIdx = cIdx;
      if (dragOverTarget?.position === 'bottom' && srcIdx > cIdx) {
        tgtIdx = cIdx + 1;
      } else if (dragOverTarget?.position === 'top' && srcIdx < cIdx) {
        tgtIdx = Math.max(0, cIdx - 1);
      }
      if (srcIdx !== tgtIdx) {
        const cloned = structuredClone(draftChapters);
        const [moved] = cloned.splice(srcIdx, 1);
        cloned.splice(tgtIdx, 0, moved);
        await saveDraftOutline(cloned);
        showToast('챕터 위치가 이동되었습니다.', 'info');
      }
    } else if (draggedItem.type === 'section') {
      const srcChapIdx = draggedItem.cIdx;
      const srcSecIdx = draggedItem.sIdx;
      const cloned = structuredClone(draftChapters);
      const [movedSec] = cloned[srcChapIdx].sections.splice(srcSecIdx, 1);
      cloned[cIdx].sections.unshift(movedSec);
      await saveDraftOutline(cloned);
      showToast('소목차가 해당 챕터의 첫 꼭지로 이동되었습니다.', 'info');
    }
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleSectionDragStart = (e, chapId, secId, cIdx, sIdx) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
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

  const handleSectionDrop = async (e, targetCIdx, targetSIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'section') return;

    const srcChapIdx = draggedItem.cIdx;
    const srcSecIdx = draggedItem.sIdx;
    let tgtSecIdx = targetSIdx;

    if (srcChapIdx === targetCIdx) {
      if (dragOverTarget?.position === 'bottom' && srcSecIdx > targetSIdx) {
        tgtSecIdx = targetSIdx + 1;
      } else if (dragOverTarget?.position === 'top' && srcSecIdx < targetSIdx) {
        tgtSecIdx = Math.max(0, targetSIdx - 1);
      }
    } else {
      if (dragOverTarget?.position === 'bottom') tgtSecIdx = targetSIdx + 1;
    }

    const cloned = structuredClone(draftChapters);
    const [movedSec] = cloned[srcChapIdx].sections.splice(srcSecIdx, 1);
    cloned[targetCIdx].sections.splice(tgtSecIdx, 0, movedSec);
    await saveDraftOutline(cloned);
    showToast('소목차 위치가 이동되었습니다.', 'info');

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // 목차 기획 모달 열기 및 생성
  const handleOpenOutlinePlanModal = () => {
    setGeneratedAiOutline(null);
    setIsOutlinePlanModalOpen(true);
  };

  const handleGenerateAiOutline = async () => {
    try {
      setIsAiGeneratingOutline(true);
      showToast('설계된 뼈대와 기획서를 분석하여 맞춤 목차를 생성 중입니다...', 'info');

      const proposal = {
        logline: proposalLogline,
        intention: proposalIntention,
        target: proposalTarget
      };

      const generated = await bookService.generateOutlineFromPlot({
        bookTitle: activeBook?.title || '미정의 작품',
        bookSubtitle: activeBook?.subtitle || '',
        genre: activeBook?.genre || '소설',
        proposal,
        characters,
        plotStages
      });

      const structured = (generated || []).map((c, idx) => ({
        id: `ai_c_${Date.now()}_${idx + 1}`,
        title: `제${idx + 1}장. ${c.title.replace(/^제?\s*\d+\s*[장회편절단계권]?\s*[\.:\-]?\s*/i, '')}`,
        sections: (c.sections || []).map((s, spIdx) => ({
          id: `ai_s_${Date.now()}_${idx + 1}_${spIdx + 1}`,
          title: s.title
        }))
      }));

      setGeneratedAiOutline(structured);
      showToast('인물·서사 뼈대 기반 AI 맞춤 목차가 도출되었습니다.', 'success');
    } catch (err) {
      showToast(`목차 도출 실패: ${err.message}`, 'error');
    } finally {
      setIsAiGeneratingOutline(false);
    }
  };

  const handleApplyAiOutline = async () => {
    if (!generatedAiOutline) return;
    await saveDraftOutline(structuredClone(generatedAiOutline));
    setIsOutlinePlanModalOpen(false);
    showToast('AI 기획 목차가 목차 조립대에 성공적으로 반영되었습니다.', 'success');
  };

  // 가목차를 스튜디오 본문 목차로 최종 확정 및 반영
  const handleApplyDraftToStudio = async () => {
    if (!activeBook) return;
    if (draftChapters.length === 0) {
      showToast('반영할 가목차가 없습니다.', 'error');
      return;
    }

    const ok = await openConfirm({
      title: '가목차 스튜디오 반영',
      message: `조립한 ${draftChapters.length}개 챕터 가목차를 집필 스튜디오에 최종 반영하시겠습니까?\n(기존 작성된 본문은 제목 매칭을 통해 안전하게 보존됩니다)`,
      confirmText: '목차 반영하기'
    });
    if (!ok) return;

    try {
      await bookService.applyOutline(activeBook.id, draftChapters);
      await loadBooks();
      openBook(activeBook.id);
      showToast('가목차가 집필 스튜디오에 반영되었습니다.', 'success');
    } catch (err) {
      showToast(`스튜디오 반영 실패: ${err.message}`, 'error');
    }
  };

  // 스튜디오로 이동
  const handleSendToStudio = () => {
    if (!activeBook) return;
    openBook(activeBook.id);
    showToast(`'${activeBook.title}' 집필 스튜디오로 이동했습니다.`, 'info');
  };

  // 우측 3열: AI 기획 질의응답
  const handleSendAiMessage = async (customText) => {
    const textToSend = customText || aiChatInput.trim();
    if (!textToSend || isAiChatLoading) return;

    const newMessages = [...aiChatMessages, { role: 'user', text: textToSend }];
    setAiChatMessages(newMessages);
    setAiChatInput('');
    setIsAiChatLoading(true);

    try {
      const planningContext = `
[작품명]: ${activeBook?.title || '미정'}
[로그라인]: ${proposalLogline || '미정'}
[기획의도]: ${proposalIntention || '미정'}
[타깃독자]: ${proposalTarget || '미정'}
[플롯단계]: ${plotStages.map((s) => s.title).join(' -> ')}
      `.trim();

      const prompt = `당신은 출판사 전문 기획 편집장입니다. 아래 작가의 기획서 맥락을 참고하여 질문에 대해 전문적이고 명쾌한 조언을 한국어로 답변하세요.\n\n${planningContext}\n\n[질문]: ${textToSend}`;
      const response = await aiService.generateText(prompt);
      setAiChatMessages((prev) => [...prev, { role: 'assistant', text: response }]);
    } catch (err) {
      setAiChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '죄송합니다. AI 응답 생성 중 일시적인 오류가 발생했습니다. 다시 시도해 주세요.' }
      ]);
    } finally {
      setIsAiChatLoading(false);
      setTimeout(() => {
        if (chatBodyRef.current) {
          chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  // 새 기획 프로젝트 생성
  const handleCreateNewProject = async (e) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) {
      showToast('작품 제목을 입력해주세요.', 'error');
      return;
    }
    try {
      const selectedGenre = OFFICIAL_GENRES.find((g) => g.id === newProjectGenre) || OFFICIAL_GENRES[0];
      const recPlotIds = GENRE_RECOMMENDED_PLOTS[newProjectGenre] || GENRE_RECOMMENDED_PLOTS.novel;
      const defaultPlot = PLOT_LIBRARY.find((p) => p.id === recPlotIds[0]) || PLOT_LIBRARY[0];

      const initialStages = (defaultPlot.stages || []).map((st, idx) => ({
        id: `stage_${idx + 1}`,
        title: st.title,
        desc: st.desc || '',
        subplots: (st.subplots || []).map((sp) => ({
          title: typeof sp === 'string' ? sp : sp.title,
          memo: ''
        }))
      }));

      const newBook = await bookService.createBook({
        title: newProjectTitle.trim(),
        genre: selectedGenre.label,
        genreKey: newProjectGenre,
        proposal: { logline: '', intention: '', target: '', diff: '' },
        characters: [],
        plotStandardName: defaultPlot.name,
        plotStandardId: defaultPlot.id,
        plotStages: initialStages
      });
      await loadBooks();
      setActiveBook(newBook);
      setIsNewProjectModalOpen(false);
      setNewProjectTitle('');
      showToast(`'${newBook.title}' 새 기획 프로젝트가 생성되었습니다.`, 'success');
    } catch (err) {
      showToast(`기획 생성 실패: ${err.message}`, 'error');
    }
  };

  return (
    <div className="vault-page-wrapper" onDragEnd={handleDragEnd}>

      {/* =====================================================================
          1. 상단 탑바 (sample-vault.html 1:1 매칭)
          ===================================================================== */}
      <header className="preview-header-bar">
        <div className="preview-left">
          <button className="preview-back-btn" onClick={() => setView('library')}>
            <ChevronLeft size={14} />
            내 서재로
          </button>

          <div className="top-divider" />

          <div className="top-book-meta">
            <span className="top-book-title">{activeBook?.title || '작품 미선택'}</span>
            <span className="top-genre-badge">
              {activeBook?.genreKey ? PLOT_TEMPLATES[activeBook.genreKey]?.name.split(' ')[0] : (activeBook?.genre || '에세이')}
            </span>
            <div className="top-progress-pill">
              기획 파이프라인 <span>{currentStepNumber} / 5단계</span>
            </div>
          </div>
        </div>

        <div className="preview-right">
          <button className="btn-goto-studio" onClick={handleSendToStudio}>
            <PenTool size={14} />
            집필 스튜디오로 이동
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. 메인 3열 레이아웃 (서가 + 5대 파이프라인 캔버스 & 우측 AI 어시스턴트)
          ===================================================================== */}
      <main className="vault-layout-root">
        <div className="vault-window-container">

          {/* 좌측 1열: 기획 서가 */}
          <aside className="vault-project-col">
            <div className="vault-col-header">
              <div className="vault-col-title-wrap">
                <span className="vault-col-sub">PROJECTS</span>
                <h2 className="vault-col-title">기획 서가</h2>
              </div>
              <button className="btn-new-project" onClick={() => setIsNewProjectModalOpen(true)}>
                <Plus size={14} />
                새 기획
              </button>
            </div>

            <div className="vault-project-list">
              {books.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  기획 중인 도서가 없습니다.
                </div>
              ) : (
                books.map((b) => {
                  const isActive = activeBook?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`project-card ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveBook(b)}
                    >
                      <div className="project-cover-bar" />
                      <div className="project-meta-wrap">
                        <span className="project-title">{b.title}</span>
                        <div className="project-sub-row">
                          <span className="project-genre">{b.genreKey ? PLOT_TEMPLATES[b.genreKey]?.name.split(' ')[0] : (b.genre || '에세이')}</span>
                          <span className="project-step-badge">기획</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* 중앙 2열: 5대 창작 파이프라인 메인 캔버스 */}
          <section className="vault-main-canvas">
            <nav className="pipeline-step-bar">
              {PIPELINE_STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`pipeline-step-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveStep(step.id)}
                  >
                    <div className="step-num-pill">{`0${step.stepNum + 1}`}</div>
                    <div className="step-text-wrap">
                      <div className="step-title-row">
                        <Icon size={14} />
                        <span>{step.title}</span>
                      </div>
                      <span className="step-desc">{step.desc}</span>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="pipeline-content-viewport">
              {!activeBook ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                  좌측 기획 서가에서 작품을 선택하거나 새 기획을 시작해 주세요.
                </div>
              ) : (
                <>
                  {/* [STEP 0] 아이디어 노트 */}
                  {activeStep === 'ideas' && (
                    <div className="ideas-container">
                      <form onSubmit={handleAddQuickIdea} className="ideas-input-box">
                        <Sun size={15} style={{ color: 'var(--color-primary)' }} />
                        <input
                          type="text"
                          className="ideas-input"
                          placeholder="스쳐 지나가는 찰나의 영감이나 단상을 자유롭게 적어보세요... (Enter 등록)"
                          value={quickIdeaInput}
                          onChange={(e) => setQuickIdeaInput(e.target.value)}
                        />
                        <button type="submit" className="btn-add-idea" disabled={!quickIdeaInput.trim()}>
                          <Plus size={14} />
                          아이디어 기록
                        </button>
                      </form>

                      <div className="ideas-card-grid">
                        {ideaNotes.length === 0 ? (
                          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            아직 기록된 아이디어가 없습니다. 상단 입력창에서 단상을 기록해 보세요.
                          </div>
                        ) : (
                          ideaNotes.map((idea) => {
                            const isEditing = editingIdeaId === idea.id;
                            return (
                              <div key={idea.id} className="idea-card">
                                <div className="idea-card-header">
                                  <span className="idea-badge">단상 메모</span>
                                  <span>{new Date(idea.createdAt).toLocaleDateString('ko-KR')}</span>
                                </div>
                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '6px 0' }}>
                                    <textarea
                                      className="vault-form-control"
                                      rows={3}
                                      value={editingIdeaContent}
                                      onChange={(e) => setEditingIdeaContent(e.target.value)}
                                      autoFocus
                                    />
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn-idea-action"
                                        onClick={() => setEditingIdeaId(null)}
                                      >
                                        취소
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-add-idea"
                                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                                        onClick={() => handleSaveEditIdea(idea.id)}
                                      >
                                        저장
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="idea-card-body">{idea.content}</p>
                                )}
                                <div className="idea-card-actions">
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      className="btn-idea-action"
                                      onClick={() => handleOpenEditIdea(idea)}
                                      title="아이디어 수정"
                                    >
                                      <Edit2 size={12} />
                                      수정
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-idea-action"
                                    onClick={() => handlePromoteToVault(idea)}
                                  >
                                    <Bookmark size={13} />
                                    글감 보관
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-idea-action danger"
                                    onClick={() => handleDeleteIdea(idea.id)}
                                    title="아이디어 삭제"
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
                  )}

                  {/* [STEP 1] 출간 기획서 */}
                  {activeStep === 'proposal' && (
                    <div className="proposal-container">
                      <div className="proposal-top-notice">
                        <div className="notice-left">
                          <Info size={16} />
                          단행본 1권을 관통하는 4대 기획 축을 정리하면 집필 방향이 흔들리지 않습니다.
                        </div>
                        <button type="button" className="btn-save-proposal" onClick={handleSaveProposal}>
                          <Save size={14} />
                          기획서 저장
                        </button>
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Sparkles size={15} style={{ color: 'var(--color-primary)' }} />
                            1. 핵심 로그라인 (Core Logline)
                          </label>
                          <span className="proposal-hint">책 전체를 한 문장으로 정의하는 핵심 명제</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="매일 쏟아지는 자극과 피로에 지친 독자들에게, 밤의 고요한 서재에서 건져 올린 단단한 위로를 전하는 이야기."
                          value={proposalLogline}
                          onChange={(e) => setProposalLogline(e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <PenTool size={15} style={{ color: 'var(--color-primary)' }} />
                            2. 기획 의도 및 집필 배경 (Intention)
                          </label>
                          <span className="proposal-hint">왜 지금 이 책을 써야 하는가?</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="누구나 고독한 순간을 마주하지만, 그 시간을 어떻게 보내느냐에 따라 삶의 결이 달라집니다."
                          value={proposalIntention}
                          onChange={(e) => setProposalIntention(e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Users size={15} style={{ color: 'var(--color-primary)' }} />
                            3. 타깃 독자층 (Target Audience)
                          </label>
                          <span className="proposal-hint">누가 이 책을 읽고 공감할 것인가?</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="직장과 일상에서 번아웃을 겪는 20~40대, 나만의 온전한 회복 루틴을 찾고 싶은 독자."
                          value={proposalTarget}
                          onChange={(e) => setProposalTarget(e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Compass size={15} style={{ color: 'var(--color-primary)' }} />
                            4. 기존 도서 대비 차별점 (Differentiation)
                          </label>
                          <span className="proposal-hint">유사 베스트셀러와 다른 나만의 독창성</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="단순한 감성 힐링 문구 나열을 지양하고, 실제 서재에서 행해지는 필사와 사색의 감각적 디테일을 융합한 정밀한 에세이."
                          value={proposalDiff}
                          onChange={(e) => setProposalDiff(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* [STEP 2] 글감 & 취재창고 */}
                  {activeStep === 'materials' && (
                    <div className="materials-container">
                      <div className="materials-filter-bar">
                        <div className="cat-pill-group">
                          {VAULT_CATEGORIES.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              className={`cat-pill-btn ${vaultCategory === cat.id ? 'active' : ''}`}
                              onClick={() => setVaultCategory(cat.id)}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>

                        <button type="button" className="btn-add-idea" onClick={handleOpenCreateMaterial}>
                          <Plus size={14} />
                          취재 자료 등록
                        </button>
                      </div>

                      <div className="materials-grid">
                        {filteredMaterials.length === 0 ? (
                          <div style={{ gridColumn: '1 / -1', padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            해당 분류의 취재 자료가 없습니다. 상단의 [취재 자료 등록] 버튼을 눌러 보관해 보세요.
                          </div>
                        ) : (
                          filteredMaterials.map((item) => {
                            const catObj = VAULT_CATEGORIES.find((c) => c.id === item.category);
                            const catLabel = catObj ? catObj.label : '참고자료';
                            return (
                              <div key={item.id} className="material-card">
                                <div className="material-header">
                                  <span className="material-cat-tag">
                                    {catLabel}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                      type="button"
                                      className="mini-icon-btn"
                                      style={{ width: '22px', height: '22px' }}
                                      onClick={() => handleOpenEditMaterial(item)}
                                      title="취재 자료 수정"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="mini-icon-btn danger"
                                      style={{ width: '22px', height: '22px' }}
                                      onClick={() => handleDeleteMaterial(item.id)}
                                      title="취재 자료 삭제"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                                <h4 className="material-title">{item.title}</h4>
                                <p className="material-body">{item.content}</p>
                                {item.sourceRef && <div className="material-source">출처: {item.sourceRef}</div>}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* [STEP 3] 인물 & 뼈대 */}
                  {activeStep === 'story' && (
                    <div className="story-container">
                      {/* 좌측: 인물/화자 프로필 */}
                      <div className="story-left-col">
                        <div className="story-panel-header">
                          <h3 className="story-panel-title">
                            <Users size={15} style={{ color: 'var(--color-primary)' }} />
                            인물·화자 프로필
                          </h3>
                          <button
                            type="button"
                            className="btn-add-idea"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                            onClick={() => {
                              setEditingCharId(null);
                              setCharName('');
                              setCharRole('주인공/화자');
                              setCharGoal('');
                              setCharFlaw('');
                              setCharTraits('');
                              setCharRelationship('');
                              setIsCharModalOpen(true);
                            }}
                          >
                            + 인물 추가
                          </button>
                        </div>

                        <div className="char-card-list">
                          {characters.length === 0 ? (
                            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              등록된 인물·화자가 없습니다.
                            </div>
                          ) : (
                            characters.map((char) => (
                              <div key={char.id} className="char-card">
                                <div className="char-header">
                                  <span className="char-name">{char.name}</span>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span className="char-role-badge">{char.role}</span>
                                    <button
                                      type="button"
                                      className="mini-icon-btn"
                                      style={{ width: '18px', height: '18px' }}
                                      onClick={() => {
                                        setEditingCharId(char.id);
                                        setCharName(char.name || '');
                                        setCharRole(char.role || '주인공/화자');
                                        setCharGoal(char.goal || '');
                                        setCharFlaw(char.flaw || '');
                                        setCharTraits(char.traits || '');
                                        setCharRelationship(char.relationship || '');
                                        setIsCharModalOpen(true);
                                      }}
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      className="mini-icon-btn danger"
                                      style={{ width: '18px', height: '18px' }}
                                      onClick={() => handleDeleteChar(char.id)}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                                {char.goal && <div className="char-meta-row"><strong>목표:</strong> {char.goal}</div>}
                                {char.flaw && <div className="char-meta-row"><strong>결핍:</strong> {char.flaw}</div>}
                                {char.traits && <div className="char-meta-row"><strong>특징:</strong> {char.traits}</div>}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 우측: 장르 표준 서사 뼈대 & 세부 꼭지별 아이디어 메모 */}
                      <div className="story-right-col">
                        <div className="story-panel-header">
                          <h3 className="story-panel-title">
                            <Layers size={15} style={{ color: 'var(--color-primary)' }} />
                            장르별 서사 뼈대
                          </h3>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                            {activeBook?.genre || '소설'}
                          </span>
                        </div>

                        {/* 도서 장르 기반 추천 뼈대 및 44종 전체 서사 라이브러리 스위처 */}
                        {(() => {
                          const recIds = GENRE_RECOMMENDED_PLOTS[currentGenreKey] || GENRE_RECOMMENDED_PLOTS.novel;
                          const recommendedPlots = recIds.map((id) => PLOT_LIBRARY.find((p) => p.id === id)).filter(Boolean);
                          const currentPlot = PLOT_LIBRARY.find((p) => p.id === selectedPlotTemplateId) || recommendedPlots[0] || PLOT_LIBRARY[0];
                          const isCustomOrOther = !recommendedPlots.some((p) => p.id === selectedPlotTemplateId);

                          return (
                            <>
                              <div className="plot-switcher-wrapper">
                                <div className="plot-genre-switcher">
                                  <span className="plot-rec-label">추천 뼈대</span>
                                  {recommendedPlots.map((plot) => (
                                    <button
                                      key={plot.id}
                                      type="button"
                                      className={`plot-genre-btn ${selectedPlotTemplateId === plot.id ? 'active' : ''}`}
                                      onClick={() => handleSelectPlotTemplate(plot)}
                                      title={plot.flow}
                                    >
                                      {plot.name}
                                    </button>
                                  ))}
                                  <div className="plot-other-select-container">
                                    <select
                                      className={`plot-other-select ${isCustomOrOther ? 'active' : ''}`}
                                      value={isCustomOrOther ? selectedPlotTemplateId : ''}
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const found = PLOT_LIBRARY.find((p) => p.id === e.target.value);
                                          if (found) handleSelectPlotTemplate(found);
                                        }
                                      }}
                                    >
                                      <option value="" disabled>기타 뼈대 둘러보기 (44종)...</option>
                                      {PLOT_CATEGORIES.map((cat) => {
                                        const catPlots = PLOT_LIBRARY.filter((p) => p.category === cat.id);
                                        return (
                                          <optgroup key={cat.id} label={cat.name}>
                                            {catPlots.map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.name} ({p.fitFor})
                                              </option>
                                            ))}
                                          </optgroup>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {currentPlot && (
                                <div className="plot-standard-banner">
                                  <Info size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                  <div className="plot-banner-content">
                                    <span className="plot-banner-title">
                                      <strong>{currentPlot.name}</strong> — {currentPlot.fitFor || '표준 서사 규격'}
                                    </span>
                                    <span className="plot-banner-flow">
                                      [서사 흐름] {currentPlot.flow}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* 플롯 단계 및 세부 꼭지 트리 (수정, 추가, 삭제 지원) */}
                        <div className="plot-stages-tree">
                          {plotStages.map((stage, sIdx) => {
                            const isEditingStage = editingStageIdx === sIdx;
                            return (
                              <div key={stage.id || sIdx} className="plot-stage-group">
                                <div className="plot-stage-bar">
                                  {isEditingStage ? (
                                    <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                                      <input
                                        type="text"
                                        className="plot-inline-input"
                                        value={editingStageTitle}
                                        onChange={(e) => setEditingStageTitle(e.target.value)}
                                        placeholder="단계명 (예: 1. 발단과 결핍의 일상)"
                                        autoFocus
                                      />
                                      <input
                                        type="text"
                                        className="plot-inline-input"
                                        value={editingStageDesc}
                                        onChange={(e) => setEditingStageDesc(e.target.value)}
                                        placeholder="단계 가이드 설명"
                                        style={{ flex: 1.5 }}
                                      />
                                      <button
                                        type="button"
                                        className="btn-add-idea"
                                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                                        onClick={() => handleCommitEditStage(sIdx)}
                                      >
                                        저장
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-idea-action"
                                        onClick={() => setEditingStageIdx(null)}
                                      >
                                        취소
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="plot-stage-left">
                                        <span className="plot-stage-name">{stage.title}</span>
                                      </div>
                                      <div className="plot-stage-right-actions">
                                        <button
                                          type="button"
                                          className="mini-icon-btn"
                                          style={{ width: '22px', height: '22px' }}
                                          onClick={() => {
                                            setEditingStageIdx(sIdx);
                                            setEditingStageTitle(stage.title || '');
                                            setEditingStageDesc(stage.desc || '');
                                          }}
                                          title="단계명 및 설명 수정"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="mini-icon-btn danger"
                                          style={{ width: '22px', height: '22px' }}
                                          onClick={() => handleDeleteStage(sIdx)}
                                          title="단계 삭제"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {stage.desc && !isEditingStage && (
                                  <div className="plot-stage-guide">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <Info size={13} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                                      <span>{stage.desc}</span>
                                    </div>
                                  </div>
                                )}

                                <div className="plot-stage-sub-list">
                                  {(stage.subplots || []).map((sub, spIdx) => {
                                    const subTitle = typeof sub === 'string' ? sub : sub.title;
                                    const subMemo = typeof sub === 'object' && sub !== null ? sub.memo : '';
                                    const memoKey = `${sIdx}_${spIdx}`;
                                    const isEditingThisMemo = activeMemoKey === memoKey;
                                    const isEditingThisSubplot = editingSubplotKey === memoKey;

                                    return (
                                      <div key={spIdx} className="plot-sub-item-wrap">
                                        {isEditingThisSubplot ? (
                                          <div className="plot-sub-item" style={{ background: 'var(--bg-hover)' }}>
                                            <input
                                              type="text"
                                              className="plot-inline-input"
                                              value={editingSubplotTitle}
                                              onChange={(e) => setEditingSubplotTitle(e.target.value)}
                                              autoFocus
                                            />
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button
                                                type="button"
                                                className="btn-add-idea"
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                                onClick={() => handleCommitEditSubplot(sIdx, spIdx)}
                                              >
                                                저장
                                              </button>
                                              <button
                                                type="button"
                                                className="btn-idea-action"
                                                onClick={() => setEditingSubplotKey(null)}
                                              >
                                                취소
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="plot-sub-item">
                                            <span className="plot-sub-title">{subTitle}</span>
                                            <div className="plot-sub-actions">
                                              <button
                                                type="button"
                                                className="mini-icon-btn"
                                                style={{ width: '20px', height: '20px' }}
                                                onClick={() => {
                                                  setEditingSubplotKey(memoKey);
                                                  setEditingSubplotTitle(subTitle);
                                                }}
                                                title="꼭지명 수정"
                                              >
                                                <Edit2 size={11} />
                                              </button>
                                              <button
                                                type="button"
                                                className="btn-idea-action"
                                                onClick={() => handleOpenMemoEditor(sIdx, spIdx, subMemo)}
                                              >
                                                {subMemo ? '메모 수정' : '+ 메모'}
                                              </button>
                                              <button
                                                type="button"
                                                className="mini-icon-btn danger"
                                                style={{ width: '20px', height: '20px' }}
                                                onClick={() => handleDeleteSubplot(sIdx, spIdx)}
                                                title="꼭지 삭제"
                                              >
                                                <Trash2 size={11} />
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {/* 아이디어 메모 뱃지 */}
                                        {subMemo && !isEditingThisMemo && (
                                          <div className="plot-sub-memo-badge">
                                            <div className="memo-content">
                                              <strong>아이디어 구상:</strong> {subMemo}
                                            </div>
                                            <button
                                              type="button"
                                              className="mini-icon-btn danger"
                                              style={{ width: '16px', height: '16px' }}
                                              onClick={() => handleDeleteSubplotMemo(sIdx, spIdx)}
                                              title="메모 삭제"
                                            >
                                              <Trash2 size={10} />
                                            </button>
                                          </div>
                                        )}

                                        {/* 인라인 메모 입력창 */}
                                        {isEditingThisMemo && (
                                          <div className="plot-sub-memo-input-wrap">
                                            <textarea
                                              className="plot-sub-memo-textarea"
                                              placeholder="이 꼭지에서 다룰 핵심 질문, 사례, 영감을 메모해 보세요..."
                                              value={memoInputText}
                                              onChange={(e) => setMemoInputText(e.target.value)}
                                              autoFocus
                                            />
                                            <div className="plot-memo-btns">
                                              <button
                                                type="button"
                                                className="btn-idea-action"
                                                onClick={() => setActiveMemoKey(null)}
                                              >
                                                취소
                                              </button>
                                              <button
                                                type="button"
                                                className="btn-add-idea"
                                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                                                onClick={() => handleSaveSubplotMemo(sIdx, spIdx)}
                                              >
                                                저장
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* 꼭지 추가 버튼 */}
                                  <button
                                    type="button"
                                    className="btn-add-sub-pill"
                                    onClick={() => handleAddNewSubplot(sIdx)}
                                  >
                                    <Plus size={12} />
                                    세부 꼭지 추가
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* 새 플롯 단계 추가 버튼 */}
                          <button
                            type="button"
                            className="btn-add-stage-row"
                            onClick={handleAddNewStage}
                          >
                            <Plus size={14} />
                            새 플롯 단계 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* [STEP 4] 목차 조립대 */}
                  {activeStep === 'outline' && (
                    <div className="outline-sandbox-container">
                      <div className="outline-top-actions">
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>OUTLINE SANDBOX</span>
                          <span style={{ marginLeft: '0.4rem', color: 'var(--text-sub)', fontWeight: 'normal' }}>
                            마우스 드래그로 순서를 재배치하고 호버 시 수정·삭제할 수 있습니다.
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="button" className="btn-plan-outline" onClick={handleOpenOutlinePlanModal}>
                            <Sparkles size={13} />
                            목차 기획
                          </button>
                          <button type="button" className="btn-add-idea" onClick={handleAddNewChapter}>
                            <Plus size={13} />
                            장 추가
                          </button>
                          <button type="button" className="btn-add-idea" style={{ background: 'var(--color-reading)' }} onClick={handleApplyDraftToStudio}>
                            <Check size={13} />
                            스튜디오 반영
                          </button>
                        </div>
                      </div>

                      {/* 목차 리스트 (노션 스타일 드래그 앤 드롭 영역) */}
                      <div className="outline-chapters-container">
                        {draftChapters.length === 0 ? (
                          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            아직 조립된 챕터가 없습니다. 상단의 [목차 기획] 또는 [장 추가] 버튼을 눌러보세요.
                          </div>
                        ) : (
                          draftChapters.map((chap, cIdx) => {
                            const isChapDragging = draggedItem?.type === 'chapter' && draggedItem.chapterId === chap.id;
                            const isChapOverTop = dragOverTarget?.type === 'chapter' && dragOverTarget.id === chap.id && dragOverTarget.position === 'top';
                            const isChapOverBottom = dragOverTarget?.type === 'chapter' && dragOverTarget.id === chap.id && dragOverTarget.position === 'bottom';
                            const isSecTargetHover = dragOverTarget?.type === 'chapter-drop-target' && dragOverTarget.id === chap.id;

                            let headerClass = 'outline-chap-header';
                            if (isChapDragging) headerClass += ' is-dragging';
                            if (isChapOverTop) headerClass += ' drag-over-top';
                            if (isChapOverBottom) headerClass += ' drag-over-bottom';
                            if (isSecTargetHover) headerClass += ' drag-target-hover';

                            return (
                              <div key={chap.id} className="outline-chap-block">
                                <div
                                  className={headerClass}
                                  draggable
                                  onDragStart={(e) => handleChapterDragStart(e, chap.id, cIdx)}
                                  onDragOver={(e) => handleChapterDragOver(e, chap.id, cIdx)}
                                  onDrop={(e) => handleChapterDrop(e, chap.id, cIdx)}
                                >
                                  <div className="chap-left-wrap">
                                    {editingChapId === chap.id ? (
                                      <input
                                        type="text"
                                        className="inline-edit-input"
                                        value={editingChapTitle}
                                        onChange={(e) => setEditingChapTitle(e.target.value)}
                                        onBlur={() => handleCommitEditChapter(cIdx)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleCommitEditChapter(cIdx);
                                          if (e.key === 'Escape') setEditingChapId(null);
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="chap-title-inline">{chap.title}</span>
                                    )}
                                  </div>

                                  <div className="chap-hover-actions">
                                    <button
                                      type="button"
                                      className="mini-icon-btn"
                                      onClick={() => {
                                        setEditingChapId(chap.id);
                                        setEditingChapTitle(chap.title);
                                      }}
                                      title="챕터명 수정"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="mini-icon-btn"
                                      onClick={() => handleAddNewSection(cIdx)}
                                      title="소목차 추가"
                                    >
                                      <Plus size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="mini-icon-btn danger"
                                      onClick={() => handleDeleteChapter(cIdx)}
                                      title="챕터 삭제"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                <div className="outline-sec-list">
                                  {(chap.sections || []).map((sec, sIdx) => {
                                    const isSecDragging = draggedItem?.type === 'section' && draggedItem.sectionId === sec.id;
                                    const isSecOverTop = dragOverTarget?.type === 'section' && dragOverTarget.id === sec.id && dragOverTarget.position === 'top';
                                    const isSecOverBottom = dragOverTarget?.type === 'section' && dragOverTarget.id === sec.id && dragOverTarget.position === 'bottom';

                                    let rowClass = 'outline-sec-row';
                                    if (isSecDragging) rowClass += ' is-dragging';
                                    if (isSecOverTop) rowClass += ' drag-over-top';
                                    if (isSecOverBottom) rowClass += ' drag-over-bottom';

                                    return (
                                      <div
                                        key={sec.id}
                                        className={rowClass}
                                        draggable
                                        onDragStart={(e) => handleSectionDragStart(e, chap.id, sec.id, cIdx, sIdx)}
                                        onDragOver={(e) => handleSectionDragOver(e, sec.id, cIdx, sIdx)}
                                        onDrop={(e) => handleSectionDrop(e, cIdx, sIdx)}
                                      >
                                        <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                                          {editingSecId === sec.id ? (
                                            <input
                                              type="text"
                                              className="inline-edit-input"
                                              value={editingSecTitle}
                                              onChange={(e) => setEditingSecTitle(e.target.value)}
                                              onBlur={() => handleCommitEditSection(cIdx, sIdx)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCommitEditSection(cIdx, sIdx);
                                                if (e.key === 'Escape') setEditingSecId(null);
                                              }}
                                              autoFocus
                                            />
                                          ) : (
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                              {sec.title}
                                            </span>
                                          )}
                                        </div>

                                        <div className="sec-hover-actions">
                                          <button
                                            type="button"
                                            className="mini-icon-btn"
                                            onClick={() => {
                                              setEditingSecId(sec.id);
                                              setEditingSecTitle(sec.title);
                                            }}
                                            title="소목차 수정"
                                          >
                                            <Edit2 size={11} />
                                          </button>
                                          <button
                                            type="button"
                                            className="mini-icon-btn danger"
                                            onClick={() => handleDeleteSection(cIdx, sIdx)}
                                            title="소목차 삭제"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

        </div>

        {/* -----------------------------------------------------------------
            3. 우측 3열: AI 기획 어시스턴트 카드 + 독립 쿼터 바 (sample-vault 1:1)
           ----------------------------------------------------------------- */}
        <aside className="vault-ai-col-wrap">
          <div className="vault-ai-card">
            <div className="ai-col-header">
              <div className="ai-col-title-wrap">
                <Bot size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="ai-col-title">AI 기획 어시스턴트</span>
              </div>
            </div>

            <div className="ai-chat-body" ref={chatBodyRef}>
              {aiChatMessages.map((msg, mIdx) => (
                <div key={mIdx} className={`ai-msg-bubble ${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              {isAiChatLoading && (
                <div className="ai-msg-bubble assistant" style={{ color: 'var(--text-muted)' }}>
                  기획 답변을 구성하고 있습니다...
                </div>
              )}
            </div>

            <div className="ai-quick-prompts">
              <button type="button" className="prompt-chip" onClick={() => handleSendAiMessage('현재 로그라인의 매력도를 출판 관점에서 평가해줘.')}>
                로그라인 평가
              </button>
              <button type="button" className="prompt-chip" onClick={() => handleSendAiMessage('현재 플롯의 클라이맥스 갈등과 전개를 보강해줘.')}>
                플롯 갈등 보강
              </button>
              <button type="button" className="prompt-chip" onClick={() => handleSendAiMessage('베스트셀러 목차 표준과 비교하여 사각지대를 짚어줘.')}>
                목차 표준 비교
              </button>
            </div>

            <div className="ai-input-wrap">
              <input
                type="text"
                className="ai-input"
                placeholder="기획 고민이나 보완점을 질문하세요..."
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendAiMessage();
                }}
              />
              <button type="button" className="btn-add-idea" onClick={() => handleSendAiMessage()} disabled={isAiChatLoading}>
                전송
              </button>
            </div>
          </div>

          {/* 독립된 쿼터 바 카드 */}
          <div
            className="v5-quota-pill-bar"
            onClick={() => setIsQuotaModalOpen(true)}
            title="AI 모델별 일일 잔여 한도 및 모델 전환"
          >
            <div className="v5-quota-pill-left">
              <Zap size={14} className="icon" />
              <span>{activeModelName}</span>
            </div>
            <span className="v5-quota-pill-badge">100%</span>
          </div>
        </aside>
      </main>

      {/* =====================================================================
          모달 팝업 모음
          ===================================================================== */}

      {/* 새 기획 프로젝트 생성 모달 */}
      {isNewProjectModalOpen && (
        <div className="vault-modal-backdrop" onClick={() => setIsNewProjectModalOpen(false)}>
          <div className="vault-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-header">
              <h3 className="vault-modal-title">
                <BookOpen size={18} style={{ color: 'var(--color-primary)' }} />
                새 작품 기획 시작
              </h3>
              <button type="button" className="mini-icon-btn" onClick={() => setIsNewProjectModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateNewProject}>
              <div className="vault-modal-body">
                <div className="vault-form-group">
                  <label>작품 가제</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="예: 심야의 문장과 고요한 방"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="vault-form-group">
                  <label>도서 장르</label>
                  <select
                    className="vault-form-control"
                    value={newProjectGenre}
                    onChange={(e) => setNewProjectGenre(e.target.value)}
                  >
                    {OFFICIAL_GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="vault-modal-footer">
                <button type="button" className="btn-idea-action" onClick={() => setIsNewProjectModalOpen(false)}>
                  취소
                </button>
                <button type="submit" className="btn-add-idea">
                  기획 시작하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 취재 자료 등록 및 수정 모달 */}
      {isVaultModalOpen && (
        <div className="vault-modal-backdrop" onClick={() => setIsVaultModalOpen(false)}>
          <div className="vault-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-header">
              <h3 className="vault-modal-title">
                <Bookmark size={18} style={{ color: 'var(--color-primary)' }} />
                {editingMaterialId ? '취재 자료 수정' : '취재 자료 등록'}
              </h3>
              <button type="button" className="mini-icon-btn" onClick={() => setIsVaultModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateOrUpdateMaterial}>
              <div className="vault-modal-body">
                <div className="vault-form-group">
                  <label>자료 분류</label>
                  <select
                    className="vault-form-control"
                    value={vaultCategory === 'ALL' ? 'quote' : vaultCategory}
                    onChange={(e) => setVaultCategory(e.target.value)}
                  >
                    {VAULT_CATEGORIES.filter((c) => c.id !== 'ALL').map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vault-form-group">
                  <label>자료 제목</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="예: 파스칼의 팡세 - 방 안에 머무는 능력"
                    value={vaultTitle}
                    onChange={(e) => setVaultTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="vault-form-group">
                  <label>핵심 내용 / 발췌문</label>
                  <textarea
                    className="vault-form-control"
                    rows={4}
                    placeholder="인간의 모든 불행은 방 안에 홀로 고요히 머물 줄 모른다는 데서 비롯된다..."
                    value={vaultContent}
                    onChange={(e) => setVaultContent(e.target.value)}
                    required
                  />
                </div>
                <div className="vault-form-group">
                  <label>출처 / 레퍼런스</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="예: 블레즈 파스칼, 《팡세》 139절"
                    value={vaultSource}
                    onChange={(e) => setVaultSource(e.target.value)}
                  />
                </div>
                <div className="vault-form-group">
                  <label>해시태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="사색, 고독, 회복"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="vault-modal-footer">
                <button type="button" className="btn-idea-action" onClick={() => setIsVaultModalOpen(false)}>
                  취소
                </button>
                <button type="submit" className="btn-add-idea" disabled={isVaultSubmitting}>
                  {editingMaterialId ? '수정 완료' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 인물 추가/수정 모달 */}
      {isCharModalOpen && (
        <div className="vault-modal-backdrop" onClick={() => setIsCharModalOpen(false)}>
          <div className="vault-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-header">
              <h3 className="vault-modal-title">
                <Users size={18} style={{ color: 'var(--color-primary)' }} />
                {editingCharId ? '인물 프로필 수정' : '새 인물·화자 추가'}
              </h3>
              <button type="button" className="mini-icon-btn" onClick={() => setIsCharModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveCharacter}>
              <div className="vault-modal-body">
                <div className="vault-form-group">
                  <label>인물 이름 / 화자 호칭</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="예: 서진우 (주인공) / 나 (에세이 1인칭 화자)"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    required
                  />
                </div>
                <div className="vault-form-group">
                  <label>역할 비중</label>
                  <select
                    className="vault-form-control"
                    value={charRole}
                    onChange={(e) => setCharRole(e.target.value)}
                  >
                    <option value="주인공/화자">주인공 / 1인칭 화자</option>
                    <option value="조력자/친구">조력자 / 멘토 / 친구</option>
                    <option value="대립자/갈등원인">대립자 / 갈등 요인</option>
                    <option value="관찰자/주변인">관찰자 / 주변 인물</option>
                  </select>
                </div>
                <div className="vault-form-group">
                  <label>핵심 욕망 / 목표 (Goal)</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="이 인물이 궁극적으로 얻고자 하는 가치나 목적"
                    value={charGoal}
                    onChange={(e) => setCharGoal(e.target.value)}
                  />
                </div>
                <div className="vault-form-group">
                  <label>결핍 / 치명적 약점 (Flaw)</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="인물의 내면적 트라우마나 극복해야 할 약점"
                    value={charFlaw}
                    onChange={(e) => setCharFlaw(e.target.value)}
                  />
                </div>
                <div className="vault-form-group">
                  <label>외모 및 성격 특징 (Traits)</label>
                  <input
                    type="text"
                    className="vault-form-control"
                    placeholder="차분함, 예민한 감각, 밤늦게 차를 마시는 습관 등"
                    value={charTraits}
                    onChange={(e) => setCharTraits(e.target.value)}
                  />
                </div>
              </div>
              <div className="vault-modal-footer">
                <button type="button" className="btn-idea-action" onClick={() => setIsCharModalOpen(false)}>
                  취소
                </button>
                <button type="submit" className="btn-add-idea">
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 목차 기획 모달 */}
      {isOutlinePlanModalOpen && (
        <div className="vault-modal-backdrop" onClick={() => setIsOutlinePlanModalOpen(false)}>
          <div className="vault-modal-box" style={{ width: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-header">
              <h3 className="vault-modal-title">
                <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
                출판 표준 플롯 기반 AI 목차 기획
              </h3>
              <button type="button" className="mini-icon-btn" onClick={() => setIsOutlinePlanModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="vault-modal-body">
              <p style={{ fontSize: '0.84rem', color: 'var(--text-sub)', margin: 0 }}>
                현재 설정된 [인물 & 뼈대]의 표준 서사 단계와 세부 꼭지들을 분석하여 바로 집필 가능한 완성도 높은 가목차 구성을 제안합니다.
              </p>

              {!generatedAiOutline ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <button
                    type="button"
                    className="btn-add-idea"
                    style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                    onClick={handleGenerateAiOutline}
                    disabled={isAiGeneratingOutline}
                  >
                    <Sparkles size={15} />
                    {isAiGeneratingOutline ? '목차 생성 및 정렬 중...' : '플롯 기반 목차 자동 도출'}
                  </button>
                </div>
              ) : (
                <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                  {generatedAiOutline.map((c, i) => (
                    <div key={i} style={{ marginBottom: '0.85rem' }}>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--color-primary)' }}>{c.title}</strong>
                      <div style={{ paddingLeft: '0.75rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {c.sections.map((s, si) => (
                          <div key={si} style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                            • {s.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="vault-modal-footer">
              <button type="button" className="btn-idea-action" onClick={() => setIsOutlinePlanModalOpen(false)}>
                닫기
              </button>
              {generatedAiOutline && (
                <button type="button" className="btn-add-idea" onClick={handleApplyAiOutline}>
                  <Check size={14} />
                  목차 조립대에 반영
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 모델 쿼터 현황 및 전환 모달 */}
      <ModelQuotasModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

    </div>
  );
}
