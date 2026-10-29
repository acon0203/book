import React, { useEffect, useState, useMemo, useRef } from 'react';
import './Vault.css';
import { useStore } from '../../store';
import { bookService } from '../../services/bookService';
import { aiService } from '../../services/aiService';
import { storageService } from '../../services/storageService';
import ModelQuotasModal from '../../components/ai/ModelQuotasModal';
import VaultModals from './VaultModals';
import {
  Plus, Trash2, X, Users, BookOpen, Layers, Check, Edit2,
  ChevronLeft, Bookmark, Compass, PenTool, CheckCircle, ChevronRight,
  Send, AlertCircle, RefreshCw, Bot, Sparkles, Save, Info, Sliders,
  HelpCircle, Lightbulb, Sun, MessageSquare, Zap, ChevronDown, ChevronUp,
  PanelLeftClose, PanelRightClose, Columns2, GripVertical
} from 'lucide-react';
import { PIPELINE_STEPS, VAULT_CATEGORIES } from '../../data/vaultConstants';
import { OFFICIAL_GENRES, getOfficialGenreId } from '../../data/genreConstants';
import { PLOT_CATEGORIES, PLOT_LIBRARY, GENRE_RECOMMENDED_PLOTS } from '../../data/plotLibraryDb';

// 제목 정제 헬퍼 (제1장, 1. 등의 접두사 중복 방지)
const cleanTitle = (str) => (str || '').replace(/^제?\s*\d+\s*[장회편절단계권]?\s*[\.:\-]?\s*/i, '').trim();

// 도서별 실시간 진행 단계 태그 판별 헬퍼 (기획 / 뼈대 / 목차 / 집필 / 연재 / 완결)
const getBookStageTag = (b) => {
  if (!b) return { label: '기획', stage: 'planning' };
  if (b.isCompleted) return { label: '완결', stage: 'completed' };

  // 1. 연재 발행 회차가 1개 이상 있는지
  const hasPublished = b.chapters?.some((c) =>
    c.status === 'published' || c.sections?.some((s) => s.status === 'published')
  );
  if (hasPublished) return { label: '연재', stage: 'published' };

  // 2. 본문이 작성된 섹션이 있는지 (태그 제외 텍스트 존재)
  const hasWriting = b.chapters?.some((c) =>
    c.sections?.some((s) => (s.content || '').replace(/<[^>]*>/g, '').trim().length > 0)
  );
  if (hasWriting) return { label: '집필', stage: 'writing' };

  // 3. 목차가 구조화되어 있는지 (챕터 2개 이상 또는 총 소목차 2개 이상)
  const totalSections = b.chapters?.reduce((acc, c) => acc + (c.sections?.length || 0), 0) || 0;
  if ((b.chapters?.length || 0) > 1 || totalSections > 1) {
    return { label: '목차', stage: 'outline' };
  }

  // 4. 서사 뼈대 또는 등장인물이 설정되어 있는지
  const hasCharacters = Array.isArray(b.characters) && b.characters.length > 0;
  const hasPlot = Array.isArray(b.plotStages) && b.plotStages.length > 0 && b.plotStages.some((st) => st.subplots?.some((sp) => sp.memo));
  if (hasCharacters || hasPlot) {
    return { label: '뼈대', stage: 'story' };
  }

  // 5. 기본 기획 단계
  return { label: '기획', stage: 'planning' };
};

// 장르별 스마트 서사 3요소 기본값 헬퍼
const getDefaultNarrativeConfig = (genreKey) => {
  const isFiction = genreKey === 'novel' || genreKey === 'webnovel';
  const isEssay = genreKey === 'essay';

  if (isFiction) {
    return {
      speaker: 'third_limited',
      listener: 'unspecified_reader',
      tone: 'past_plain',
      worldSetting: '',
      relationshipMemo: '',
      authorBackground: '',
      caseStudyMemo: '',
      coreMessage: ''
    };
  }

  if (isEssay) {
    return {
      speaker: 'first_author',
      listener: 'myself',
      tone: 'plain',
      worldSetting: '',
      relationshipMemo: '',
      authorBackground: '',
      caseStudyMemo: '',
      coreMessage: ''
    };
  }

  return {
    speaker: 'expert_objective',
    listener: 'readers',
    tone: 'formal_explain',
    worldSetting: '',
    relationshipMemo: '',
    authorBackground: '',
    caseStudyMemo: '',
    coreMessage: ''
  };
};

// 장르별 필수 3요소 (화자/청자/어투) 선택지 옵션 목록
const getNarrativeOptions = (genreKey) => {
  const isFiction = genreKey === 'novel' || genreKey === 'webnovel';
  const isEssay = genreKey === 'essay';

  if (isFiction) {
    return {
      speakers: [
        { id: 'third_limited', label: '3인칭 제한적 시점' },
        { id: 'first_protagonist', label: '1인칭 주인공 시점' },
        { id: 'first_observer', label: '1인칭 관찰자 시점' },
        { id: 'third_omniscient', label: '3인칭 전지적 시점' }
      ],
      listeners: [
        { id: 'unspecified_reader', label: '불특정 독자' },
        { id: 'specific_character', label: '특정 청자 (서간체)' },
        { id: 'future_someone', label: '미래의 누군가' }
      ],
      tones: genreKey === 'webnovel' ? [
        { id: 'present_plain', label: '~한다 (현재형/속도감)' },
        { id: 'past_plain', label: '~했다 (과거형 서술)' }
      ] : [
        { id: 'past_plain', label: '~했다 (과거형 서술)' },
        { id: 'present_plain', label: '~한다 (현재형/생동감)' }
      ]
    };
  }

  if (isEssay) {
    return {
      speakers: [
        { id: 'first_author', label: "1인칭 작가 ('나')" },
        { id: 'first_observer', label: "관찰자 ('나')" },
        { id: 'virtual_speaker', label: '가상의 화자' }
      ],
      listeners: [
        { id: 'myself', label: '나 자신 (독백)' },
        { id: 'unknown_you', label: '이름 모를 당신' },
        { id: 'precious_person', label: '소중한 그 사람' }
      ],
      tones: [
        { id: 'plain', label: '~했다 / ~다 (평어체)' },
        { id: 'polite_soft', label: '~해요 (부드러운 대화체)' },
        { id: 'polite_formal', label: '~합니다 (정중한 경어체)' }
      ]
    };
  }

  // 비문학 (인문, 사회, 경제, 과학, 자기계발 등)
  return {
    speakers: [
      { id: 'expert_objective', label: '저자/전문가 (객관적 관찰)' },
      { id: 'friendly_mentor', label: '친근한 멘토 / 길잡이' },
      { id: 'first_practitioner', label: '1인칭 실천가 (경험담 공유)' }
    ],
    listeners: [
      { id: 'readers', label: "'독자 여러분' (일반 독자)" },
      { id: 'beginners', label: '초심자 / 입문자' },
      { id: 'colleagues', label: '동료 실무자 / 전문가' }
    ],
    tones: [
      { id: 'formal_explain', label: '~합니다 / ~입니다 (설명체)' },
      { id: 'assertive', label: '~이다 / ~한다 (단정체)' },
      { id: 'friendly_soft', label: '~해요 / ~해보세요 (친근체)' }
    ]
  };
};

export default function Vault() {
  const {
    vault, loadVault, deleteVaultItem, activeTagFilter, setTagFilter, showToast,
    books, loadBooks, activeBook, setActiveBook, openBook, setView, deleteBook,
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

  // --- Step 3: 작품 설정 & 인물 상태 ---
  const [currentGenreKey, setCurrentGenreKey] = useState('essay');
  const [narrativeConfig, setNarrativeConfig] = useState({
    speaker: '',
    listener: '',
    tone: '',
    worldSetting: '',
    relationshipMemo: '',
    authorBackground: '',
    caseStudyMemo: '',
    coreMessage: ''
  });
  const [isMoreSettingsOpen, setIsMoreSettingsOpen] = useState(false);
  const [isAiGeneratingNarrative, setIsAiGeneratingNarrative] = useState(false);

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

  // --- Step 5: 목차 조립대 (가목차 샌드박스) 상태 ---
  const [draftChapters, setDraftChapters] = useState([]);
  const [editingChapId, setEditingChapId] = useState(null);
  const [editingChapTitle, setEditingChapTitle] = useState('');
  const [editingSecId, setEditingSecId] = useState(null);
  const [editingSecTitle, setEditingSecTitle] = useState('');
  // Step 5: 뼈대 구성 & 목차 조립대 듀얼 패널 너비 드래그 조절 & 스냅 접기 상태
  const [step5SplitRatio, setStep5SplitRatio] = useState(50); // % (기본 50:50)
  const [isDraggingStep5, setIsDraggingStep5] = useState(false);
  const [step5Collapsed, setStep5Collapsed] = useState('none'); // 'none' | 'left' | 'right'
  const step5ContainerRef = useRef(null);

  // 중앙 스플릿 바 마우스/터치 드래그 리사이징 핸들러 (방안 2)
  const handleStartStep5Drag = (e) => {
    e.preventDefault();
    setIsDraggingStep5(true);
    const container = step5ContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMove = (clientX) => {
      const offset = clientX - rect.left;
      const totalWidth = rect.width;
      if (totalWidth <= 0) return;

      const rawRatio = (offset / totalWidth) * 100;

      // 좌측 임계치(14% 이하)로 밀어붙이면 좌측 접힘으로 스냅
      if (rawRatio < 14) {
        setStep5Collapsed('left');
      } else if (rawRatio > 86) {
        // 우측 임계치(86% 이상)로 밀어붙이면 우측 접힘으로 스냅
        setStep5Collapsed('right');
      } else {
        // 정상 구간: 부드러운 실시간 너비 조절
        setStep5Collapsed('none');
        const bounded = Math.max(18, Math.min(82, rawRatio));
        setStep5SplitRatio(bounded);
      }
    };

    const onMouseMove = (moveEvent) => handleMove(moveEvent.clientX);
    const onTouchMove = (touchEvent) => {
      if (touchEvent.touches?.[0]) handleMove(touchEvent.touches[0].clientX);
    };

    const onEnd = () => {
      setIsDraggingStep5(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  };

  // 중앙 브릿지 더블클릭 시 5:5 기본 위치로 즉각 복원
  const handleResetStep5Split = () => {
    setStep5SplitRatio(50);
    setStep5Collapsed('none');
  };

  // 목차 기획 모달
  const [isOutlinePlanModalOpen, setIsOutlinePlanModalOpen] = useState(false);
  const [outlinePlanMode, setOutlinePlanMode] = useState('plot'); // 'plot' (뼈대 기반) | 'standard' (기획서/장르 기반)
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

      // 작품 서사 설정(narrativeConfig) 동기화
      const defaultNarrative = getDefaultNarrativeConfig(gKey);
      setNarrativeConfig({
        ...defaultNarrative,
        ...(activeBook.narrativeConfig || {})
      });

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

      // Step 5 히스토리 스택 초기화
      step5HistoryRef.current = [];
      step5HistoryIdxRef.current = -1;
    }
  }, [activeBook]);

  // Step 5 서사 뼈대 & 목차 조립대 되돌리기(Ctrl+Z / Cmd+Z) & 다시 실행(Ctrl+Y) 리스너
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // 사용자가 인풋창이나 텍스트에어리어에서 직접 타이핑 중일 때는 브라우저 기본 텍스트 입력을 우선함
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (!isCmdOrCtrl) return;

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoStep5();
        } else {
          handleUndoStep5();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoStep5();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeBook, plotStages, draftChapters]);

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

  // --- Step 3: 작품 서사 설정(화자·청자·어투) 핸들러 ---
  const handleUpdateNarrativeConfig = async (key, val) => {
    if (!activeBook) return;
    const updated = {
      ...narrativeConfig,
      [key]: val
    };
    setNarrativeConfig(updated);
    try {
      const updatedBook = { ...activeBook, narrativeConfig: updated };
      await bookService.updateBook(activeBook.id, updatedBook);
      setActiveBook(updatedBook);
    } catch (err) {
      console.error('Failed to update narrativeConfig:', err);
    }
  };

  // 출간 기획서 기반 AI 초안 채우기 핸들러
  const handleAiFillNarrativeConfig = async () => {
    if (!activeBook) return;
    try {
      setIsAiGeneratingNarrative(true);
      showToast('출간 기획서를 바탕으로 작품 설정을 도출하고 있습니다...', 'info');

      const isFiction = currentGenreKey === 'novel' || currentGenreKey === 'webnovel';
      const isEssay = currentGenreKey === 'essay';

      const prompt = `
당신은 베테랑 단행본 기획 총괄 편집장입니다.
아래 작가의 출간 기획서를 심층 분석하여, 이 작품에 가장 적합한 서사 3요소(화자, 청자, 어투)와 보조 설정을 JSON으로 제안하세요.

[도서 제목]: ${activeBook.title || '미정'}
[장르]: ${activeBook.genre || '소설'}
[로그라인]: ${proposalLogline || '미정'}
[기획의도]: ${proposalIntention || '미정'}
[타깃독자]: ${proposalTarget || '미정'}

아래 항목 중 해당 장르에 맞는 값만 선택하여 오직 JSON 형식으로만 응답하세요(마크다운 코드블록 없이 순수 JSON만 출력):

${isFiction ? `
- speaker: "third_limited"(3인칭 제한적 시점) 또는 "first_hero"(1인칭 주인공 시점) 또는 "third_omniscient"(3인칭 전지적 시점) 중 택1
- listener: "unspecified_reader"(불특정 독자) 또는 "specific_character"(극중 특정 인물) 중 택1
- tone: "past_plain"(~했다 과거형) 또는 "present_plain"(~한다 현재형 웹소설) 중 택1
- worldSetting: "배경 및 세계관 한 줄 요약"
- relationshipMemo: "주요 인물 간 긴장 관계 한 줄 요약"
` : isEssay ? `
- speaker: "first_author"(1인칭 '나') 또는 "first_humble"(1인칭 '저') 중 택1
- listener: "myself"(나 자신 독백) 또는 "intimate_friend"(친근한 누군가/편지) 또는 "anonymous_reader"(익명의 독자) 중 택1
- tone: "plain"(~했다 평어체) 또는 "haeyo"(~해요 대화체) 또는 "formal"(~합니다 경어체) 중 택1
- worldSetting: "에세이의 주된 공간/계절적 분위기 메모"
- relationshipMemo: "글에 등장하는 주요 인연들과의 정서적 관계"
` : `
- speaker: "expert_objective"(저자/전문가 객관적 서술) 또는 "mentor_first"(1:1 코치/멘토 '나') 중 택1
- listener: "readers"('독자 여러분') 또는 "you"('당신') 또는 "none"(호칭 생략) 중 택1
- tone: "formal_explain"(~합니다 설명체) 또는 "assertive_plain"(~이다 단정체) 또는 "coaching"(~해볼까요?) 중 택1
- authorBackground: "이 책을 서술하는 저자의 전문적 자격/배경"
- caseStudyMemo: "독자를 설득할 핵심 실사례 및 데이터 메모"
- coreMessage: "반드시 전달해야 할 한 줄 핵심 메시지"
`}
`.trim();

      const responseText = await aiService.generateText(prompt);
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const updated = {
        ...narrativeConfig,
        ...parsed
      };
      setNarrativeConfig(updated);
      setIsMoreSettingsOpen(true); // 채워진 내용 확인하도록 아코디언 자동 오픈

      const updatedBook = { ...activeBook, narrativeConfig: updated };
      await bookService.updateBook(activeBook.id, updatedBook);
      setActiveBook(updatedBook);

      showToast('기획서 기반 작품 서사 설정이 완성되었습니다!', 'success');
    } catch (err) {
      console.error('[AiFillNarrativeConfig] Error:', err);
      showToast('AI 설정 도출 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
    } finally {
      setIsAiGeneratingNarrative(false);
    }
  };

  // --- Step 4 & 5: 장르별 표준 서사 뼈대 스위칭 및 플롯/꼭지 편집 로직 ---
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

  // --- Step 5: 실행 취소(Undo) / 다시 실행(Redo) 히스토리 스택 ---
  const step5HistoryRef = useRef([]); // [{ plotStages, draftChapters, desc }]
  const step5HistoryIdxRef = useRef(-1);

  // 새로운 변경사항을 히스토리에 기록하는 함수
  const pushStep5History = (newPlotStages, newDraftChapters, desc = '') => {
    // 현재 인덱스 이후의 Redo 분기는 잘라내고 새 스냅샷 추가
    const currentStack = step5HistoryRef.current.slice(0, Math.max(0, step5HistoryIdxRef.current + 1));
    const entry = {
      plotStages: structuredClone(newPlotStages),
      draftChapters: structuredClone(newDraftChapters),
      desc
    };
    currentStack.push(entry);
    // 최대 40개까지 유지
    if (currentStack.length > 40) currentStack.shift();
    step5HistoryRef.current = currentStack;
    step5HistoryIdxRef.current = currentStack.length - 1;
  };

  // 실행 취소 (Undo - Ctrl+Z)
  const handleUndoStep5 = async () => {
    if (step5HistoryIdxRef.current <= 0) {
      showToast('더 이상 되돌릴 작업이 없습니다.', 'info');
      return;
    }
    step5HistoryIdxRef.current -= 1;
    const target = step5HistoryRef.current[step5HistoryIdxRef.current];
    if (target) {
      const clonedPlot = structuredClone(target.plotStages);
      const clonedDraft = structuredClone(target.draftChapters);
      setPlotStages(clonedPlot);
      setDraftChapters(clonedDraft);
      if (activeBook) {
        await updateActiveBookPlotStages(clonedPlot);
        await saveDraftOutline(clonedDraft);
      }
      showToast(`되돌리기 실행${target.desc ? `: ${target.desc} 복원` : ''}`, 'info');
    }
  };

  // 다시 실행 (Redo - Ctrl+Y / Ctrl+Shift+Z)
  const handleRedoStep5 = async () => {
    if (step5HistoryIdxRef.current >= step5HistoryRef.current.length - 1) {
      showToast('다시 실행할 작업이 없습니다.', 'info');
      return;
    }
    step5HistoryIdxRef.current += 1;
    const target = step5HistoryRef.current[step5HistoryIdxRef.current];
    if (target) {
      const clonedPlot = structuredClone(target.plotStages);
      const clonedDraft = structuredClone(target.draftChapters);
      setPlotStages(clonedPlot);
      setDraftChapters(clonedDraft);
      if (activeBook) {
        await updateActiveBookPlotStages(clonedPlot);
        await saveDraftOutline(clonedDraft);
      }
      showToast(`다시 실행: ${target.desc || '다음 작업 복원'}`, 'info');
    }
  };

  // 플롯 단계 추가
  const handleAddNewStage = async () => {
    // 변경 전 상태 보존
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
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
    pushStep5History(cloned, draftChapters, '새 플롯 단계 추가');
    showToast('새 플롯 단계가 추가되었습니다.', 'info');
  };

  // 플롯 단계 삭제
  const handleDeleteStage = async (sIdx) => {
    const ok = await openConfirm({
      title: '플롯 단계 삭제',
      message: '이 플롯 단계와 하위 세부 꼭지를 모두 삭제하시겠습니까?\n(실수로 삭제 시 Ctrl+Z로 즉시 되돌릴 수 있습니다)',
      confirmText: '삭제'
    });
    if (!ok) return;

    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    } else {
      pushStep5History(plotStages, draftChapters, '단계 삭제 전');
    }

    const cloned = structuredClone(plotStages);
    const deletedTitle = cloned[sIdx]?.title || '단계';
    cloned.splice(sIdx, 1);
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    pushStep5History(cloned, draftChapters, `'${deletedTitle}' 단계 삭제`);
    showToast(`'${deletedTitle}' 단계가 삭제되었습니다. (되돌리려면 Ctrl+Z)`, 'info');
  };

  // 플롯 단계명 수정 시작
  const handleStartEditingStage = (sIdx, currentTitle) => {
    setEditingStageIdx(sIdx);
    setEditingStageTitle(currentTitle || '');
  };

  // 플롯 단계명 수정 커밋
  const handleCommitEditStage = async (sIdx) => {
    if (editingStageIdx === null) return;
    if (editingStageTitle.trim()) {
      if (step5HistoryRef.current.length === 0) {
        pushStep5History(plotStages, draftChapters, '수정 전');
      }
      const cloned = structuredClone(plotStages);
      cloned[sIdx].title = editingStageTitle.trim();
      if (editingStageDesc !== undefined) {
        cloned[sIdx].desc = editingStageDesc.trim();
      }
      setPlotStages(cloned);
      if (activeBook) {
        await updateActiveBookPlotStages(cloned);
      }
      pushStep5History(cloned, draftChapters, '단계명 수정');
      showToast('플롯 단계명이 수정되었습니다.', 'info');
    }
    setEditingStageIdx(null);
    setEditingStageTitle('');
  };

  // 세부 꼭지 추가
  const handleAddNewSubplot = async (sIdx) => {
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
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
    pushStep5History(cloned, draftChapters, '세부 꼭지 추가');
    showToast('새 세부 꼭지가 추가되었습니다.', 'info');
  };

  // 세부 꼭지 수정 시작
  const handleStartEditingSubplotTitle = (sIdx, spIdx, currentTitle) => {
    setEditingSubplotKey(`${sIdx}_${spIdx}`);
    setEditingSubplotTitle(currentTitle || '');
  };

  // 세부 꼭지 인라인 수정 완료
  const handleCommitEditSubplot = async (sIdx, spIdx) => {
    if (!editingSubplotKey) return;
    if (editingSubplotTitle.trim()) {
      if (step5HistoryRef.current.length === 0) {
        pushStep5History(plotStages, draftChapters, '수정 전');
      }
      const cloned = structuredClone(plotStages);
      const target = cloned[sIdx]?.subplots?.[spIdx];
      if (target) {
        if (typeof target === 'string') {
          cloned[sIdx].subplots[spIdx] = { title: editingSubplotTitle.trim(), memo: '' };
        } else {
          target.title = editingSubplotTitle.trim();
        }
        setPlotStages(cloned);
        if (activeBook) {
          await updateActiveBookPlotStages(cloned);
        }
        pushStep5History(cloned, draftChapters, '꼭지명 수정');
      }
    }
    setEditingSubplotKey(null);
    setEditingSubplotTitle('');
  };

  // 세부 꼭지 삭제 (Ctrl+Z 되돌리기 보장)
  const handleDeleteSubplot = async (sIdx, spIdx) => {
    // 삭제 직전 스냅샷 보존
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    } else {
      pushStep5History(plotStages, draftChapters, '꼭지 삭제 전');
    }

    const cloned = structuredClone(plotStages);
    const subTarget = cloned[sIdx]?.subplots?.[spIdx];
    const subName = typeof subTarget === 'string' ? subTarget : (subTarget?.title || '세부 꼭지');
    cloned[sIdx].subplots.splice(spIdx, 1);
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    pushStep5History(cloned, draftChapters, `'${subName}' 삭제`);
    showToast(`'${subName}' 꼭지가 삭제되었습니다. (되돌리려면 Ctrl+Z)`, 'info');
  };

  // 세부 꼭지 아이디어 메모 에디터 열기 (두 함수명 모두 완벽 지원)
  const handleOpenMemoEditor = (sIdx, spIdx, currentMemo = '') => {
    const key = `${sIdx}_${spIdx}`;
    setActiveMemoKey(key);
    setMemoInputText(currentMemo || '');
  };
  const handleStartEditMemo = handleOpenMemoEditor;

  const handleSaveSubplotMemo = async (sIdx, spIdx) => {
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '메모 작성 전');
    }
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
    pushStep5History(cloned, draftChapters, '메모 저장');
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
    pushStep5History(cloned, draftChapters, '메모 삭제');
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

  // --- Step 5: 목차 조립대 로직 ---
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

  // --- 플롯 단계 및 세부 꼭지 노션 스타일 드래그 핸들러 ---
  const handlePlotStageDragStart = (e, sIdx) => {
    if (e.target.closest('button, input, textarea')) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ type: 'plot-stage', sIdx });
  };

  const handlePlotStageDragOver = (e, sIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    if (draggedItem.type === 'plot-stage') {
      if (draggedItem.sIdx === sIdx) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'top' : 'bottom';
      setDragOverTarget({ type: 'plot-stage', sIdx, position });
    } else if (draggedItem.type === 'plot-subplot') {
      setDragOverTarget({ type: 'plot-stage-drop-target', sIdx });
    }
  };

  const handlePlotStageDrop = async (e, sIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    if (draggedItem.type === 'plot-stage') {
      const srcIdx = draggedItem.sIdx;
      let tgtIdx = sIdx;
      if (dragOverTarget?.position === 'bottom' && srcIdx > sIdx) {
        tgtIdx = sIdx + 1;
      } else if (dragOverTarget?.position === 'top' && srcIdx < sIdx) {
        tgtIdx = Math.max(0, sIdx - 1);
      }
      if (srcIdx !== tgtIdx) {
        pushStep5History(plotStages, draftChapters, '단계 이동 전');
        const cloned = structuredClone(plotStages);
        const [moved] = cloned.splice(srcIdx, 1);
        cloned.splice(tgtIdx, 0, moved);
        setPlotStages(cloned);
        if (activeBook) {
          await updateActiveBookPlotStages(cloned);
        }
        pushStep5History(cloned, draftChapters, '단계 순서 변경');
        showToast('플롯 단계 순서가 변경되었습니다.', 'info');
      }
    } else if (draggedItem.type === 'plot-subplot') {
      pushStep5History(plotStages, draftChapters, '꼭지 이동 전');
      const srcStageIdx = draggedItem.sIdx;
      const srcSubIdx = draggedItem.spIdx;
      const cloned = structuredClone(plotStages);
      const [movedSub] = cloned[srcStageIdx].subplots.splice(srcSubIdx, 1);
      if (!cloned[sIdx].subplots) cloned[sIdx].subplots = [];
      cloned[sIdx].subplots.unshift(movedSub);
      setPlotStages(cloned);
      if (activeBook) {
        await updateActiveBookPlotStages(cloned);
      }
      pushStep5History(cloned, draftChapters, '꼭지 단계 이동');
      showToast('세부 꼭지가 해당 단계의 첫 번째로 이동되었습니다.', 'info');
    }
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handlePlotSubplotDragStart = (e, sIdx, spIdx) => {
    if (e.target.closest('button, input, textarea')) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ type: 'plot-subplot', sIdx, spIdx });
  };

  const handlePlotSubplotDragOver = (e, sIdx, spIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'plot-subplot') return;
    if (draggedItem.sIdx === sIdx && draggedItem.spIdx === spIdx) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'top' : 'bottom';
    setDragOverTarget({ type: 'plot-subplot', sIdx, spIdx, position });
  };

  const handlePlotSubplotDrop = async (e, targetSIdx, targetSpIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'plot-subplot') return;

    const srcStageIdx = draggedItem.sIdx;
    const srcSubIdx = draggedItem.spIdx;
    let tgtSubIdx = targetSpIdx;

    if (srcStageIdx === targetSIdx) {
      if (dragOverTarget?.position === 'bottom' && srcSubIdx > targetSpIdx) {
        tgtSubIdx = targetSpIdx + 1;
      } else if (dragOverTarget?.position === 'top' && srcSubIdx < targetSpIdx) {
        tgtSubIdx = Math.max(0, targetSpIdx - 1);
      }
    } else {
      if (dragOverTarget?.position === 'bottom') tgtSubIdx = targetSpIdx + 1;
    }

    pushStep5History(plotStages, draftChapters, '꼭지 이동 전');
    const cloned = structuredClone(plotStages);
    const [movedSub] = cloned[srcStageIdx].subplots.splice(srcSubIdx, 1);
    if (!cloned[targetSIdx].subplots) cloned[targetSIdx].subplots = [];
    cloned[targetSIdx].subplots.splice(tgtSubIdx, 0, movedSub);
    setPlotStages(cloned);
    if (activeBook) {
      await updateActiveBookPlotStages(cloned);
    }
    pushStep5History(cloned, draftChapters, '꼭지 순서 변경');
    showToast('세부 꼭지 순서가 변경되었습니다.', 'info');

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // 목차 조립대 노션 스타일 드래그 핸들러
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
        pushStep5History(plotStages, draftChapters, '챕터 이동 전');
        const cloned = structuredClone(draftChapters);
        const [moved] = cloned.splice(srcIdx, 1);
        cloned.splice(tgtIdx, 0, moved);
        await saveDraftOutline(cloned);
        pushStep5History(plotStages, cloned, '챕터 순서 변경');
        showToast('챕터 위치가 이동되었습니다.', 'info');
      }
    } else if (draggedItem.type === 'section') {
      pushStep5History(plotStages, draftChapters, '소목차 이동 전');
      const srcChapIdx = draggedItem.cIdx;
      const srcSecIdx = draggedItem.sIdx;
      const cloned = structuredClone(draftChapters);
      const [movedSec] = cloned[srcChapIdx].sections.splice(srcSecIdx, 1);
      cloned[cIdx].sections.unshift(movedSec);
      await saveDraftOutline(cloned);
      pushStep5History(plotStages, cloned, '소목차 챕터 이동');
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

    pushStep5History(plotStages, draftChapters, '소목차 이동 전');
    const cloned = structuredClone(draftChapters);
    const [movedSec] = cloned[srcChapIdx].sections.splice(srcSecIdx, 1);
    cloned[targetCIdx].sections.splice(tgtSecIdx, 0, movedSec);
    await saveDraftOutline(cloned);
    pushStep5History(plotStages, cloned, '소목차 순서 변경');
    showToast('소목차 위치가 이동되었습니다.', 'info');

    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // 목차 기획 모달 열기 및 생성 (mode: 'plot' | 'standard')
  const handleOpenOutlinePlanModal = (mode = 'plot') => {
    setOutlinePlanMode(mode);
    setGeneratedAiOutline(null);
    setIsOutlinePlanModalOpen(true);
  };

  const handleGenerateAiOutline = async () => {
    try {
      setIsAiGeneratingOutline(true);
      const isPlotMode = outlinePlanMode === 'plot';

      if (isPlotMode) {
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
          plotStages,
          narrativeConfig
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
        showToast('서사 뼈대 기반 AI 맞춤 목차가 도출되었습니다.', 'success');
      } else {
        showToast('출간 기획서와 장르 표준을 기반으로 완성 목차를 생성 중입니다...', 'info');

        const promptData = {
          title: activeBook?.title || '미정의 작품',
          subtitle: activeBook?.subtitle || '',
          genre: activeBook?.genre || '소설',
          targetAudience: proposalTarget || '',
          chapterCount: 5,
          sectionsPerChapter: 3,
          extraPrompt: `로그라인: ${proposalLogline}\n기획의도: ${proposalIntention}\n차별점: ${proposalDiff}`
        };

        const rawChapters = await aiService.generateOutline(promptData);
        const structured = (rawChapters || []).map((c, idx) => ({
          id: `ai_c_${Date.now()}_${idx + 1}`,
          title: `제${idx + 1}장. ${(c.title || '').replace(/^제?\s*\d+\s*[장회편절단계권]?\s*[\.:\-]?\s*/i, '')}`,
          sections: (c.sections || []).map((s, spIdx) => ({
            id: `ai_s_${Date.now()}_${idx + 1}_${spIdx + 1}`,
            title: s.title
          }))
        }));

        setGeneratedAiOutline(structured);
        showToast('출간 기획 기반 AI 목차가 도출되었습니다.', 'success');
      }
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

  // 기획 프로젝트 삭제 핸들러
  const handleDeleteProject = async (e, bookId, bookTitle) => {
    if (e) e.stopPropagation();
    const ok = await openConfirm({
      title: '도서 프로젝트 삭제',
      message: `'${bookTitle}' 프로젝트를 정말 삭제하시겠습니까?\n기획 내용 및 작성된 모든 원고가 영구 삭제됩니다.`,
      danger: true,
      confirmText: '삭제'
    });
    if (ok) {
      await deleteBook(bookId);
      const remainingBooks = books.filter((b) => b.id !== bookId);
      if (activeBook?.id === bookId) {
        if (remainingBooks.length > 0) {
          setActiveBook(remainingBooks[0]);
        } else {
          setActiveBook(null);
        }
      }
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
          {activeBook && (
            <button
              type="button"
              className="btn-vault-top-delete"
              onClick={(e) => handleDeleteProject(e, activeBook.id, activeBook.title)}
              title="현재 기획 프로젝트 삭제"
            >
              <Trash2 size={13} />
              <span>프로젝트 삭제</span>
            </button>
          )}
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
                  const stageInfo = getBookStageTag(b);
                  return (
                    <div
                      key={b.id}
                      className={`project-card ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveBook(b)}
                    >
                      {/* 우측 상단 호버 오버레이 삭제 버튼 */}
                      <button
                        type="button"
                        className="btn-delete-project"
                        onClick={(e) => handleDeleteProject(e, b.id, b.title)}
                        title={`'${b.title}' 프로젝트 삭제`}
                        aria-label="프로젝트 삭제"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div className="project-cover-bar" />
                      <div className="project-meta-wrap">
                        <span className="project-title" title={b.title}>{b.title}</span>
                        <div className="project-sub-row">
                          <span className="project-genre">{b.genreKey ? PLOT_TEMPLATES[b.genreKey]?.name.split(' ')[0] : (b.genre || '에세이')}</span>
                          <span className={`project-step-badge stage-${stageInfo.stage}`}>
                            {stageInfo.label}
                          </span>
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

                  {/* [STEP 4] 작품 서사 설정 & 인물 */}
                  {activeStep === 'story' && (() => {
                    const narrativeOptions = getNarrativeOptions(currentGenreKey);
                    const isLiterature = currentGenreKey === 'novel' || currentGenreKey === 'webnovel' || currentGenreKey === 'essay';

                    return (
                      <div className="narrative-setting-container">
                        {/* 상단 헤더 & AI 초안 채우기 버튼 */}
                        <div className="narrative-top-header">
                          <div className="narrative-header-text">
                            <h3 className="narrative-title">
                              <Sliders size={16} style={{ color: 'var(--color-primary)' }} />
                              작품 서사 설정 & 인물
                            </h3>
                            <p className="narrative-desc">
                              화자·청자·어투 3요소를 확정하고 등장인물 및 작품 설정을 구체화합니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-ai-narrative-fill"
                            onClick={handleAiFillNarrativeConfig}
                            disabled={isAiGeneratingNarrative}
                            title="출간 기획서의 로그라인과 타깃을 분석하여 최적의 서사 설정을 자동 채웁니다"
                          >
                            <Sparkles size={14} />
                            {isAiGeneratingNarrative ? 'AI 분석 중...' : '출간 기획서 기반 AI 초안 채우기'}
                          </button>
                        </div>

                        {/* 필수 3요소 카드 그리드 (화자, 청자, 어투) */}
                        <div className="essential-trio-grid">
                          {/* 1. 화자 (시점) */}
                          <div className="trio-card">
                            <div className="trio-card-header">
                              <span className="trio-badge">필수 1</span>
                              <h4 className="trio-card-title">화자 (시점)</h4>
                            </div>
                            <div className="trio-options-list">
                              {narrativeOptions.speakers.map((opt) => (
                                <label
                                  key={opt.id}
                                  className={`trio-radio-label ${narrativeConfig.speaker === opt.id ? 'active' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name="narrative_speaker"
                                    value={opt.id}
                                    checked={narrativeConfig.speaker === opt.id}
                                    onChange={() => handleUpdateNarrativeConfig('speaker', opt.id)}
                                  />
                                  <span className="trio-radio-text">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* 2. 청자 (대상 독자) */}
                          <div className="trio-card">
                            <div className="trio-card-header">
                              <span className="trio-badge">필수 2</span>
                              <h4 className="trio-card-title">청자 (대상 독자)</h4>
                            </div>
                            <div className="trio-options-list">
                              {narrativeOptions.listeners.map((opt) => (
                                <label
                                  key={opt.id}
                                  className={`trio-radio-label ${narrativeConfig.listener === opt.id ? 'active' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name="narrative_listener"
                                    value={opt.id}
                                    checked={narrativeConfig.listener === opt.id}
                                    onChange={() => handleUpdateNarrativeConfig('listener', opt.id)}
                                  />
                                  <span className="trio-radio-text">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* 3. 어투 (문체/종결형) */}
                          <div className="trio-card">
                            <div className="trio-card-header">
                              <span className="trio-badge">필수 3</span>
                              <h4 className="trio-card-title">기본 어투 (문체)</h4>
                            </div>
                            <div className="trio-options-list">
                              {narrativeOptions.tones.map((opt) => (
                                <label
                                  key={opt.id}
                                  className={`trio-radio-label ${narrativeConfig.tone === opt.id ? 'active' : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name="narrative_tone"
                                    value={opt.id}
                                    checked={narrativeConfig.tone === opt.id}
                                    onChange={() => handleUpdateNarrativeConfig('tone', opt.id)}
                                  />
                                  <span className="trio-radio-text">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 하단 2열 그리드: 인물/화자 프로필 + 더 설정하기 (선택 사항) */}
                        <div className="narrative-bottom-grid">
                          {/* 좌측: 인물·화자 프로필 */}
                          <div className="narrative-char-col">
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

                      {/* 우측: 더 설정하기 (선택 사항 접힘/펼침 아코디언) */}
                      <div className="narrative-extra-col">

                          <div className="more-settings-box">
                            <button
                              type="button"
                              className="more-settings-toggle"
                              onClick={() => setIsMoreSettingsOpen(!isMoreSettingsOpen)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="more-badge">선택 사항</span>
                                <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>
                                  {isLiterature ? '배경 및 관계도 더 설정하기' : '저자 전문성 및 핵심 사례 더 설정하기'}
                                </span>
                              </div>
                              {isMoreSettingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isMoreSettingsOpen && (
                              <div className="more-settings-content">
                                {isLiterature ? (
                                  <>
                                    <div className="more-field-group">
                                      <label className="more-field-label">세계관 및 시대적 배경 메모</label>
                                      <textarea
                                        className="more-textarea"
                                        placeholder="공간적 배경, 시대 분위기, 규칙이나 제약 조건 등을 자유롭게 기록하세요."
                                        rows={4}
                                        value={narrativeConfig.worldSetting || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('worldSetting', e.target.value)}
                                      />
                                    </div>
                                    <div className="more-field-group">
                                      <label className="more-field-label">인물 관계도 및 핵심 갈등 구도</label>
                                      <textarea
                                        className="more-textarea"
                                        placeholder="주인공과 주변 인물 간의 대립, 조력, 애증 등 핵심 갈등 축을 메모하세요."
                                        rows={4}
                                        value={narrativeConfig.relationshipMemo || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('relationshipMemo', e.target.value)}
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="more-field-group">
                                      <label className="more-field-label">저자 전문성 및 집필 배경</label>
                                      <textarea
                                        className="more-textarea"
                                        placeholder="독자에게 신뢰를 줄 수 있는 저자의 현장 경험, 이력, 집필 동기를 메모하세요."
                                        rows={3}
                                        value={narrativeConfig.authorBackground || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('authorBackground', e.target.value)}
                                      />
                                    </div>
                                    <div className="more-field-group">
                                      <label className="more-field-label">핵심 실사례 및 데이터/레퍼런스</label>
                                      <textarea
                                        className="more-textarea"
                                        placeholder="본문에 인용하거나 증명에 활용할 대표 사례, 연구 결과, 통계 등을 기록하세요."
                                        rows={3}
                                        value={narrativeConfig.caseStudyMemo || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('caseStudyMemo', e.target.value)}
                                      />
                                    </div>
                                    <div className="more-field-group">
                                      <label className="more-field-label">1줄 핵심 메시지</label>
                                      <input
                                        type="text"
                                        className="more-input"
                                        placeholder="독자가 책을 덮을 때 가슴에 남아야 할 단 하나의 핵심 메시지"
                                        value={narrativeConfig.coreMessage || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('coreMessage', e.target.value)}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                  {/* [STEP 5] 서사 뼈대 & 목차 조립대 (좌: 뼈대 구성 카드, 우: 목차 조립대 카드) */}
                  {activeStep === 'outline' && (
                    <div 
                      ref={step5ContainerRef}
                      className={`step5-main-layout layout-${step5Collapsed} ${isDraggingStep5 ? 'is-resizing' : ''}`}
                    >
                      {/* 좌측 카드 섹션: 뼈대 구성 */}
                      {step5Collapsed === 'left' ? (
                        <aside 
                          className="step5-card-box left-box is-collapsed"
                          onClick={handleResetStep5Split}
                          title="클릭하여 뼈대 구성 펼치기 (5:5 복원)"
                          role="button"
                          tabIndex={0}
                        >
                          <button 
                            type="button" 
                            className="btn-rail-expand"
                            onClick={(e) => { e.stopPropagation(); handleResetStep5Split(); }}
                            title="뼈대 구성 펼치기"
                          >
                            <ChevronRight size={15} />
                          </button>
                          <div className="rail-icon-wrap">
                            <Layers size={16} style={{ color: 'var(--color-primary)' }} />
                          </div>
                          <div className="collapsed-rail-title">뼈대 구성</div>
                          {activeBook?.genre && (
                            <span className="collapsed-rail-badge">{activeBook.genre}</span>
                          )}
                        </aside>
                      ) : (
                        <section 
                          className="step5-card-box left-box"
                          style={step5Collapsed === 'none' ? { flex: `0 0 calc(${step5SplitRatio}% - 14px)`, width: `calc(${step5SplitRatio}% - 14px)` } : { flex: 1 }}
                        >
                          <div className="step5-card-header">
                            <div className="card-header-left">
                              <Layers size={16} style={{ color: 'var(--color-primary)' }} />
                              <h3 className="card-header-title">뼈대 구성</h3>
                              <span className="card-genre-pill">{activeBook?.genre || '소설'}</span>
                            </div>
                            <div className="card-header-actions">
                              <button
                                type="button"
                                className="btn-bridge-action"
                                onClick={() => handleOpenOutlinePlanModal('plot')}
                                title="현재 설정된 서사 뼈대를 분석하여 완성 목차를 자동 도출합니다"
                              >
                                <Sparkles size={13} />
                                이 뼈대로 목차 기획
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>

                        <div className="step5-card-body">
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
                          {/* 플롯 단계 및 세부 꼭지 트리 (수정, 추가, 삭제 및 노션 스타일 드래그 순서 변경 지원) */}
                          <div className="plot-stages-tree">
                          {plotStages.map((stage, sIdx) => {
                            const isStageDragging = draggedItem?.type === 'plot-stage' && draggedItem.sIdx === sIdx;
                            const isStageOverTop = dragOverTarget?.type === 'plot-stage' && dragOverTarget.sIdx === sIdx && dragOverTarget.position === 'top';
                            const isStageOverBottom = dragOverTarget?.type === 'plot-stage' && dragOverTarget.sIdx === sIdx && dragOverTarget.position === 'bottom';
                            const isStageTargetHover = dragOverTarget?.type === 'plot-stage-drop-target' && dragOverTarget.sIdx === sIdx;

                            let stageBarClass = 'plot-stage-bar';
                            if (isStageDragging) stageBarClass += ' is-dragging';
                            if (isStageOverTop) stageBarClass += ' drag-over-top';
                            if (isStageOverBottom) stageBarClass += ' drag-over-bottom';
                            if (isStageTargetHover) stageBarClass += ' drag-target-hover';

                            const isEditingStage = editingStageIdx === sIdx;
                            return (
                              <div key={stage.id || sIdx} className="plot-stage-group">
                                <div 
                                  className={stageBarClass}
                                  draggable
                                  onDragStart={(e) => handlePlotStageDragStart(e, sIdx)}
                                  onDragOver={(e) => handlePlotStageDragOver(e, sIdx)}
                                  onDrop={(e) => handlePlotStageDrop(e, sIdx)}
                                  onDragEnd={handleDragEnd}
                                >
                                  {isEditingStage ? (
                                    <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                                      <input
                                        type="text"
                                        className="inline-edit-input"
                                        value={editingStageTitle}
                                        onChange={(e) => setEditingStageTitle(e.target.value)}
                                        onBlur={() => handleCommitEditStage(sIdx)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleCommitEditStage(sIdx);
                                          if (e.key === 'Escape') setEditingStageIdx(null);
                                        }}
                                        placeholder="단계명 (예: 1. 발단과 결핍의 일상)"
                                        autoFocus
                                      />
                                      <button type="button" className="mini-icon-btn" onClick={() => handleCommitEditStage(sIdx)} title="저장">
                                        <Check size={12} />
                                      </button>
                                      <button type="button" className="mini-icon-btn" onClick={() => setEditingStageIdx(null)} title="취소">
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="plot-stage-title-text">{stage.title}</span>
                                      <div className="plot-stage-actions">
                                        <button 
                                          type="button" 
                                          className="mini-icon-btn" 
                                          onClick={() => handleStartEditingStage(sIdx, stage.title)} 
                                          title="단계명 수정"
                                        >
                                          <Edit2 size={11} />
                                        </button>
                                        <button 
                                          type="button" 
                                          className="mini-icon-btn" 
                                          onClick={() => handleAddNewSubplot(sIdx)} 
                                          title="세부 꼭지 추가"
                                        >
                                          <Plus size={12} />
                                        </button>
                                        <button type="button" className="mini-icon-btn danger" onClick={() => handleDeleteStage(sIdx)} title="단계 삭제">
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* 세부 꼭지 목록 및 발상 메모 카드 */}
                                <div className="plot-subplots-list">
                                  {(stage.subplots || []).map((sub, spIdx) => {
                                    const subTitle = typeof sub === 'string' ? sub : sub.title;
                                    const subMemo = typeof sub === 'object' && sub !== null ? sub.memo || '' : '';
                                    const subKey = `${sIdx}_${spIdx}`;
                                    const isEditingSub = editingSubplotKey === subKey;
                                    const isMemoActive = activeMemoKey === subKey;

                                    const isSubDragging = draggedItem?.type === 'plot-subplot' && draggedItem.sIdx === sIdx && draggedItem.spIdx === spIdx;
                                    const isSubOverTop = dragOverTarget?.type === 'plot-subplot' && dragOverTarget.sIdx === sIdx && dragOverTarget.spIdx === spIdx && dragOverTarget.position === 'top';
                                    const isSubOverBottom = dragOverTarget?.type === 'plot-subplot' && dragOverTarget.sIdx === sIdx && dragOverTarget.spIdx === spIdx && dragOverTarget.position === 'bottom';

                                    let subCardClass = 'plot-subplot-card';
                                    if (isSubDragging) subCardClass += ' is-dragging';
                                    if (isSubOverTop) subCardClass += ' drag-over-top';
                                    if (isSubOverBottom) subCardClass += ' drag-over-bottom';

                                    return (
                                      <div 
                                        key={subKey} 
                                        className={subCardClass}
                                        draggable
                                        onDragStart={(e) => handlePlotSubplotDragStart(e, sIdx, spIdx)}
                                        onDragOver={(e) => handlePlotSubplotDragOver(e, sIdx, spIdx)}
                                        onDrop={(e) => handlePlotSubplotDrop(e, sIdx, spIdx)}
                                        onDragEnd={handleDragEnd}
                                      >
                                        <div className="plot-subplot-main">
                                          {isEditingSub ? (
                                            <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                                              <input
                                                type="text"
                                                className="inline-edit-input"
                                                value={editingSubplotTitle}
                                                onChange={(e) => setEditingSubplotTitle(e.target.value)}
                                                onBlur={() => handleCommitEditSubplot(sIdx, spIdx)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleCommitEditSubplot(sIdx, spIdx);
                                                  if (e.key === 'Escape') setEditingSubplotKey(null);
                                                }}
                                                placeholder="세부 꼭지명 입력"
                                                autoFocus
                                              />
                                              <button type="button" className="mini-icon-btn" onClick={() => handleCommitEditSubplot(sIdx, spIdx)} title="저장">
                                                <Check size={12} />
                                              </button>
                                              <button type="button" className="mini-icon-btn" onClick={() => setEditingSubplotKey(null)} title="취소">
                                                <X size={12} />
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <span className="plot-subplot-title-text">{subTitle}</span>
                                              <div className="plot-subplot-actions">
                                                <button
                                                  type="button"
                                                  className={`mini-memo-btn ${subMemo ? 'has-memo' : ''}`}
                                                  onClick={() => handleOpenMemoEditor(sIdx, spIdx, subMemo)}
                                                  title={subMemo ? '메모 수정' : '발상 메모 추가'}
                                                >
                                                  <Lightbulb size={11} />
                                                  {subMemo ? '메모' : '+ 메모'}
                                                </button>
                                                <button 
                                                  type="button" 
                                                  className="mini-icon-btn" 
                                                  onClick={() => handleStartEditingSubplotTitle(sIdx, spIdx, subTitle)} 
                                                  title="꼭지명 수정"
                                                >
                                                  <Edit2 size={11} />
                                                </button>
                                                <button type="button" className="mini-icon-btn danger" onClick={() => handleDeleteSubplot(sIdx, spIdx)} title="꼭지 삭제">
                                                  <Trash2 size={11} />
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {/* 기존 저장된 메모 내용 표시 */}
                                        {subMemo && !isMemoActive && (
                                          <div className="subplot-memo-display">
                                            <span className="memo-label">아이디어:</span>
                                            <span className="memo-text">{subMemo}</span>
                                            <button
                                              type="button"
                                              className="mini-memo-del-btn"
                                              onClick={() => handleDeleteSubplotMemo(sIdx, spIdx)}
                                              title="메모 삭제"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                        )}

                                        {/* 메모 인라인 입력창 */}
                                        {isMemoActive && (
                                          <div className="subplot-memo-input-wrap">
                                            <input
                                              type="text"
                                              className="subplot-memo-input"
                                              placeholder="이 꼭지에 담을 나만의 디테일 발상, 복선, 실사례를 메모하세요..."
                                              value={memoInputText}
                                              onChange={(e) => setMemoInputText(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveSubplotMemo(sIdx, spIdx);
                                              }}
                                              autoFocus
                                            />
                                            <button
                                              type="button"
                                              className="btn-add-idea"
                                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                                              onClick={() => handleSaveSubplotMemo(sIdx, spIdx)}
                                            >
                                              저장
                                            </button>
                                            <button
                                              type="button"
                                              className="btn-idea-action"
                                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                                              onClick={() => setActiveMemoKey(null)}
                                            >
                                              취소
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
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
                    </section>
                  )}

                  {/* 가운데 리사이저 드래그 분할선 & 뱃지 (방안 2) */}
                  {step5Collapsed === 'none' && (
                    <div 
                      className={`step5-flow-divider ${isDraggingStep5 ? 'is-active' : ''}`}
                      onMouseDown={handleStartStep5Drag}
                      onTouchStart={handleStartStep5Drag}
                      onDoubleClick={handleResetStep5Split}
                      title="좌우 드래그: 너비 조절 | 더블클릭: 5:5 균등 분할"
                    >
                      <div className="divider-line" />
                      <div 
                        className="divider-badge"
                        title="좌우 드래그: 너비 조절 | 더블클릭: 5:5 균등 분할"
                      >
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.5 4.5L1 7L2.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M5.5 4.5L7 7L5.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="divider-line" />
                    </div>
                  )}

                  {/* 우측 카드 섹션: 목차 조립대 */}
                  {step5Collapsed === 'right' ? (
                    <aside 
                      className="step5-card-box right-box is-collapsed"
                      onClick={handleResetStep5Split}
                      title="클릭하여 목차 조립대 펼치기 (5:5 복원)"
                      role="button"
                      tabIndex={0}
                    >
                      <button 
                        type="button" 
                        className="btn-rail-expand"
                        onClick={(e) => { e.stopPropagation(); handleResetStep5Split(); }}
                        title="목차 조립대 펼치기"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <div className="rail-icon-wrap">
                        <BookOpen size={16} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div className="collapsed-rail-title">목차 조립대</div>
                      {draftChapters.length > 0 && (
                        <span className="collapsed-rail-badge">{draftChapters.length}장</span>
                      )}
                    </aside>
                  ) : (
                    <section 
                      className="step5-card-box right-box"
                      style={step5Collapsed === 'none' ? { flex: 1, minWidth: 0 } : { flex: 1 }}
                    >
                      <div className="step5-card-header">
                        <div className="card-header-left">
                          <BookOpen size={16} style={{ color: 'var(--color-primary)' }} />
                          <h3 className="card-header-title">목차 조립대</h3>
                        </div>
                        <div className="card-header-actions">
                          <button
                            type="button"
                            className="btn-plan-outline"
                            onClick={() => handleOpenOutlinePlanModal('standard')}
                            title="뼈대 설정 없이 출간 기획서와 장르 표준을 바탕으로 목차를 바로 기획합니다"
                          >
                            <Sparkles size={13} />
                            AI 목차 기획
                          </button>
                          <button type="button" className="btn-add-idea" onClick={handleAddNewChapter}>
                            <Plus size={13} />
                            장 추가
                          </button>
                          <button
                            type="button"
                            className="btn-add-idea"
                            style={{ background: 'var(--color-reading)' }}
                            onClick={handleApplyDraftToStudio}
                          >
                            <Check size={13} />
                            스튜디오 반영
                          </button>
                        </div>
                      </div>

                      <div className="step5-card-body">
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
                                  onDragEnd={handleDragEnd}
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
                                        onDragEnd={handleDragEnd}
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
                    </section>
                  )}
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
          모달 팝업 모음 (VaultModals 컴포넌트로 분리 관리)
          ===================================================================== */}
      <VaultModals
        // 1. 새 프로젝트
        isNewProjectModalOpen={isNewProjectModalOpen}
        setIsNewProjectModalOpen={setIsNewProjectModalOpen}
        newProjectTitle={newProjectTitle}
        setNewProjectTitle={setNewProjectTitle}
        newProjectGenre={newProjectGenre}
        setNewProjectGenre={setNewProjectGenre}
        handleCreateNewProject={handleCreateNewProject}

        // 2. 취재 자료
        isVaultModalOpen={isVaultModalOpen}
        setIsVaultModalOpen={setIsVaultModalOpen}
        editingMaterialId={editingMaterialId}
        vaultCategory={vaultCategory}
        setVaultCategory={setVaultCategory}
        vaultTitle={vaultTitle}
        setVaultTitle={setVaultTitle}
        vaultContent={vaultContent}
        setVaultContent={setVaultContent}
        vaultSource={vaultSource}
        setVaultSource={setVaultSource}
        tagsInput={tagsInput}
        setTagsInput={setTagsInput}
        isVaultSubmitting={isVaultSubmitting}
        handleCreateOrUpdateMaterial={handleCreateOrUpdateMaterial}

        // 3. 인물
        isCharModalOpen={isCharModalOpen}
        setIsCharModalOpen={setIsCharModalOpen}
        editingCharId={editingCharId}
        charName={charName}
        setCharName={setCharName}
        charRole={charRole}
        setCharRole={setCharRole}
        charGoal={charGoal}
        setCharGoal={setCharGoal}
        charFlaw={charFlaw}
        setCharFlaw={setCharFlaw}
        charTraits={charTraits}
        setCharTraits={setCharTraits}
        handleSaveCharacter={handleSaveCharacter}

        // 4. 목차 기획
        isOutlinePlanModalOpen={isOutlinePlanModalOpen}
        setIsOutlinePlanModalOpen={setIsOutlinePlanModalOpen}
        outlinePlanMode={outlinePlanMode}
        generatedAiOutline={generatedAiOutline}
        isAiGeneratingOutline={isAiGeneratingOutline}
        handleGenerateAiOutline={handleGenerateAiOutline}
        handleApplyAiOutline={handleApplyAiOutline}
      />

      {/* AI 모델 쿼터 현황 및 전환 모달 */}
      <ModelQuotasModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

    </div>
  );
}
