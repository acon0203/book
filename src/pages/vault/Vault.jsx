import React, { useEffect, useState, useMemo, useRef } from 'react';
import './Vault.css';
import { useStore } from '../../store';
import { bookService } from '../../services/bookService';
import { aiService } from '../../services/aiService';
import { storageService } from '../../services/storageService';
import { marked } from 'marked';
import ModelQuotasModal from '../../components/ai/ModelQuotasModal';
import VaultModals from './VaultModals';
import {
  Plus, Trash2, X, Users, BookOpen, Layers, Check, Edit2,
  ChevronLeft, Bookmark, Compass, PenTool, CheckCircle, ChevronRight,
  Send, AlertCircle, RefreshCw, Bot, Sparkles, Save, Info, Sliders,
  HelpCircle, Lightbulb, Sun, MessageSquare, Zap, ChevronDown, ChevronUp,
  PanelLeftClose, PanelRightClose, Columns2, GripVertical, RotateCcw, Clock
} from 'lucide-react';
import { PIPELINE_STEPS, VAULT_CATEGORIES } from '../../data/vaultConstants';
import { OFFICIAL_GENRES, getOfficialGenreId } from '../../data/genreConstants';
import { PLOT_CATEGORIES, PLOT_LIBRARY, GENRE_RECOMMENDED_PLOTS } from '../../data/plotLibraryDb';

// 제목 정제 헬퍼 (제1장, 1. 등의 접두사 중복 방지)
const cleanTitle = (str) => aiService.cleanOutlineTitle(str);

// 한글 조사 결합 시 marked 파서의 볼드 누락 버그 방지 렌더러
const renderMarkdown = (text) => {
  if (!text) return '';
  // **단어**로, **[단어]**라는 처럼 한글 조사가 바로 붙어 파서가 놓치는 패턴을 <strong> 태그로 선제 치환
  const preprocessed = text.replace(/\*\*([^\*\n]+?)\*\*/g, '<strong>$1</strong>');
  return marked.parse(preprocessed, { breaks: true, gfm: true });
};

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
      customSpeaker: '',
      customListener: '',
      customTone: '',
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
      coreMessage: '',
      subTopics: '',
      narrativeApproach: ''
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
    coreMessage: '',
    subTopics: '',
    narrativeApproach: ''
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
        { id: 'third_omniscient', label: '3인칭 전지적 시점' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
      ],
      listeners: [
        { id: 'unspecified_reader', label: '불특정 독자' },
        { id: 'specific_character', label: '특정 청자 (서간체)' },
        { id: 'future_someone', label: '미래의 누군가' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
      ],
      tones: genreKey === 'webnovel' ? [
        { id: 'present_plain', label: '~한다 (현재형/속도감)' },
        { id: 'past_plain', label: '~했다 (과거형 서술)' }
      ] : [
        { id: 'past_plain', label: '~했다 (과거형 서술)' },
        { id: 'present_plain', label: '~한다 (현재형/생동감)' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
      ]
    };
  }

  if (isEssay) {
    return {
      speakers: [
        { id: 'first_author', label: "1인칭 작가 ('나')" },
        { id: 'first_observer', label: "관찰자 ('나')" },
        { id: 'virtual_speaker', label: '가상의 화자' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
      ],
      listeners: [
        { id: 'myself', label: '나 자신 (독백)' },
        { id: 'unknown_you', label: '이름 모를 당신' },
        { id: 'precious_person', label: '소중한 그 사람' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
      ],
      tones: [
        { id: 'plain', label: '~했다 / ~다 (평어체)' },
        { id: 'polite_soft', label: '~해요 (부드러운 대화체)' },
        { id: 'polite_formal', label: '~합니다 (정중한 경어체)' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
      ]
    };
  }

  // 비문학 (인문, 사회, 경제, 과학, 자기계발 등)
  return {
    speakers: [
      { id: 'expert_objective', label: '저자/전문가 (객관적 관찰)' },
      { id: 'friendly_mentor', label: '친근한 멘토 / 길잡이' },
      { id: 'first_practitioner', label: '1인칭 실천가 (경험담 공유)' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
    ],
    listeners: [
      { id: 'readers', label: "'독자 여러분' (일반 독자)" },
      { id: 'beginners', label: '초심자 / 입문자' },
      { id: 'colleagues', label: '동료 실무자 / 전문가' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
    ],
    tones: [
      { id: 'formal_explain', label: '~합니다 / ~입니다 (설명체)' },
      { id: 'assertive', label: '~이다 / ~한다 (단정체)' },
      { id: 'friendly_soft', label: '~해요 / ~해보세요 (친근체)' },
        { id: 'custom', label: '사용자 지정 (직접 입력)' }
    ]
  };
};

export default function Vault() {
  const {
    vault, loadVault, deleteVaultItem, activeTagFilter, setTagFilter, showToast, showActionToast,
    books, loadBooks, activeBook, setActiveBook, openBook, setView, deleteBook, updateBookInfo,
    updateActiveBookPlanning, updateActiveBookCharacters, updateActiveBookPlotStages, openConfirm, openPrompt
  } = useStore();

  // 상단 5대 순차 파이프라인 단계 ('ideas' | 'proposal' | 'materials' | 'story' | 'outline')
  const [activeStep, setActiveStep] = useState('ideas');

  // 새 작품 기획 생성 및 정보 수정 모달
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectGenre, setNewProjectGenre] = useState('novel');

  // --- Step 0: 아이디어 노트 상태 (전체보기 / 공용 / 현재 기획 3종 필터) ---
  const [quickIdeaInput, setQuickIdeaInput] = useState('');
  const [ideaScopeFilter, setIdeaScopeFilter] = useState('ALL'); // 'ALL' | 'SHARED' | 'CURRENT'
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaContent, setEditingIdeaContent] = useState('');
  const [editingIdeaBookId, setEditingIdeaBookId] = useState('SHARED');

  // --- Step 1: 출간 기획서 상태 ---
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalGenre, setProposalGenre] = useState('소설');
  const [proposalAuthor, setProposalAuthor] = useState('');
  const [proposalLogline, setProposalLogline] = useState('');
  const [proposalIntention, setProposalIntention] = useState('');
  const [proposalTarget, setProposalTarget] = useState('');
  const [proposalDiff, setProposalDiff] = useState('');
  const proposalDebounceTimerRef = useRef(null);
  const [proposalSaveStatus, setProposalSaveStatus] = useState('saved'); // 'saved' | 'saving'

  // --- Step 2: 글감 & 취재창고 상태 (작품별 완전 분리) ---
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

  // --- 우측 3열: 책임 편집장(기획 코칭) & 쿼터 모달 상태 ---
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      role: 'assistant',
      text: '반갑습니다, 작가님. 도서 기획과 서사 설계를 총괄하는 책임 편집장입니다.\n로그라인 진단, 타깃 독자 분석, 뼈대·목차 조립 등 기획 전반에 대해 상의해 주세요.'
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiChatLoading, setIsAiChatLoading] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [isAiHistoryOpen, setIsAiHistoryOpen] = useState(false);
  const [aiHistorySessions, setAiHistorySessions] = useState([]);
  const [activeModelName, setActiveModelName] = useState('스마트 자동 전환');
  const chatBodyRef = useRef(null);
  const lastLoadedBookIdRef = useRef(null);

  // --- 아이디어 노트 & 글감·취재창고 되돌리기(Undo) / 다시 실행(Redo) 히스토리 스택 ---
  const vaultHistoryRef = useRef([]); // [{ vault, desc }]
  const vaultHistoryIdxRef = useRef(-1);

  const pushVaultHistory = (newVaultSnapshot, desc = '') => {
    const currentStack = vaultHistoryRef.current.slice(0, Math.max(0, vaultHistoryIdxRef.current + 1));
    currentStack.push({
      vault: structuredClone(newVaultSnapshot),
      desc
    });
    if (currentStack.length > 40) currentStack.shift();
    vaultHistoryRef.current = currentStack;
    vaultHistoryIdxRef.current = currentStack.length - 1;
  };

  const ensureVaultHistoryInit = () => {
    if (vaultHistoryRef.current.length === 0) {
      pushVaultHistory(storageService.getVault(), '초기 상태');
    }
  };

  const handleUndoVault = async () => {
    if (vaultHistoryIdxRef.current <= 0) {
      showToast('더 이상 되돌릴 작업이 없습니다.', 'info');
      return;
    }
    vaultHistoryIdxRef.current -= 1;
    const target = vaultHistoryRef.current[vaultHistoryIdxRef.current];
    if (target) {
      storageService.saveVault(structuredClone(target.vault));
      await loadVault();
      showToast(`되돌리기 실행${target.desc ? `: ${target.desc} 복원` : ''}`, 'info');
    }
  };

  const handleRedoVault = async () => {
    if (vaultHistoryIdxRef.current >= vaultHistoryRef.current.length - 1) {
      showToast('다시 실행할 작업이 없습니다.', 'info');
      return;
    }
    vaultHistoryIdxRef.current += 1;
    const target = vaultHistoryRef.current[vaultHistoryIdxRef.current];
    if (target) {
      storageService.saveVault(structuredClone(target.vault));
      await loadVault();
      showToast(`다시 실행: ${target.desc || '다음 작업 복원'}`, 'info');
    }
  };

  // 1. 초기 로드 및 도서 목록 동기화 (+ 기존 이동 처리된 아이디어 원본 자동 복구)
  useEffect(() => {
    loadBooks();
    try {
      const rawVault = storageService.getVault();
      let recovered = false;
      const migrated = [];
      for (const item of rawVault) {
        if (item.category === 'idea' && item.isMaterial === true && !item.sourceIdeaId) {
          // 원본 아이디어를 아이디어 노트에 그대로 복원하고, 복제본으로 분리
          const originalIdea = {
            ...item,
            isMaterial: false,
            bookId: null,
            tags: ['아이디어']
          };
          const clonedMaterial = {
            ...item,
            id: `vault_clone_${item.id}`,
            sourceIdeaId: item.id,
            isMaterial: true
          };
          migrated.push(clonedMaterial, originalIdea);
          recovered = true;
        } else {
          migrated.push(item);
        }
      }
      if (recovered) {
        // 되돌리기(Ctrl+Z) 시 글감 보관 전 상태(원본만 있는 상태)로도 돌아갈 수 있게 히스토리 세팅
        const prePromoteState = migrated.filter((v) => !v.sourceIdeaId);
        storageService.saveVault(migrated);
        vaultHistoryRef.current = [
          { vault: structuredClone(prePromoteState), desc: '글감 보관 해제' },
          { vault: structuredClone(migrated), desc: '글감 보관' }
        ];
        vaultHistoryIdxRef.current = 1;
      }
    } catch {}
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

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleGlobalSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('ai_config_updated', handleConfigUpdate);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // activeBook 변경 시 기획서, 인물, 플롯, 가목차 동기화 (도서 변경 시에만 초기화하여 작성 중 덮어쓰기 방지)
  useEffect(() => {
    if (!activeBook) return;
    if (lastLoadedBookIdRef.current === activeBook.id) return;
    lastLoadedBookIdRef.current = activeBook.id;

    if (activeBook) {
      setProposalTitle(activeBook.title || '');
      setProposalGenre(activeBook.genre || OFFICIAL_GENRES.find((g) => g.id === activeBook.genreKey)?.label || '소설');
      const prop = activeBook.proposal || {};
      setProposalAuthor(prop.author || prop.authorBackground || activeBook.authorBackground || activeBook.narrativeConfig?.authorBackground || '');
      setProposalLogline(prop.logline || activeBook.logline || '');
      setProposalIntention(prop.intention || activeBook.intention || '');
      setProposalTarget(prop.target || activeBook.target || '');
      setProposalDiff(prop.diff || activeBook.diff || '');

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

      // 플롯 뼈대 동기화 (구버전 과도한 예시형 기본 타이틀이면 범용 표준 타이틀로 자동 갱신)
      if (Array.isArray(activeBook.plotStages) && activeBook.plotStages.length > 0) {
        const matched = PLOT_LIBRARY.find((p) => p.name === activeBook.plotStandardName || p.id === activeBook.plotStandardId);
        const targetTemplate = matched || defaultPlot;
        setSelectedPlotTemplateId(targetTemplate.id);

        const hasCustomMemo = activeBook.plotStages.some((st) => (st.subplots || []).some((sp) => sp.memo && sp.memo.trim()));
        const legacyTitles = [
          '1부. 반드시 버려야 할 나쁜 습관 10가지',
          '1장. 입문자가 가장 많이 하는 질문 TOP 5',
          '1장. 대중이 믿고 있는 거짓 상식들',
          '1장. 빚더미 밑바닥에서 피눈물 흘리던 시절',
          '1장. 정글로 뛰어들던 첫날 (출발)',
          '1부. 나를 마주하는 조용한 시간',
          '1장. 그 시절의 유년과 풋내',
          '봄의 기록. 싹을 틔우는 인내',
          '1. 부치지 못한 첫 번째 편지 (어머니/아버지에게)',
          '1장. 그늘진 현장의 생생한 목소리'
        ];
        const firstStageTitle = activeBook.plotStages[0]?.title || '';
        const firstSubTitle = activeBook.plotStages[0]?.subplots?.[0]?.title || '';
        const isLegacyExample = !hasCustomMemo && (
          legacyTitles.includes(firstStageTitle) ||
          firstSubTitle.includes('미루기 습관') ||
          firstSubTitle.includes('여의도 입성') ||
          firstSubTitle.includes('통장 잔고 0원') ||
          firstSubTitle.includes('새벽 2시의 불 켜진 방')
        );

        if (isLegacyExample && targetTemplate?.stages) {
          const refreshed = targetTemplate.stages.map((st, idx) => ({
            id: `stage_${idx + 1}`,
            title: st.title,
            desc: st.desc || '',
            subplots: (st.subplots || []).map((sp) => ({
              title: typeof sp === 'string' ? sp : sp.title,
              memo: ''
            }))
          }));
          setPlotStages(refreshed);
          updateActiveBookPlotStages(refreshed);
        } else {
          setPlotStages(structuredClone(activeBook.plotStages));
        }
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

  // 단계별 되돌리기(Ctrl+Z / Cmd+Z) & 다시 실행(Ctrl+Y) 리스너
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // 사용자가 인풋창이나 텍스트에어리어에서 직접 타이핑 중일 때는 브라우저 기본 텍스트 입력을 우선함
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (!isCmdOrCtrl) return;

      const isVaultStep = activeStep === 'ideas' || activeStep === 'materials';

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (isVaultStep) handleRedoVault();
          else handleRedoStep5();
        } else {
          if (isVaultStep) handleUndoVault();
          else handleUndoStep5();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (isVaultStep) handleRedoVault();
        else handleRedoStep5();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeStep, activeBook, plotStages, draftChapters, vault]);

  // 활성 단계 번호 계산 (아이디어 노트는 0, 출간 기획서~목차 조립은 1~4)
  const currentStepNumber = useMemo(() => {
    const found = PIPELINE_STEPS.find((s) => s.id === activeStep);
    return found ? found.stepNum : 1;
  }, [activeStep]);

  // 글감 및 아이디어 분리 (아이디어 노트는 공용 + 기획별 필터, 글감·취재창고는 작품별 분리)
  const allIdeaNotes = useMemo(() => {
    return vault.filter((item) => (item.category === 'idea' || !item.category) && !item.isMaterial);
  }, [vault]);

  const sharedIdeasCount = useMemo(() => {
    return allIdeaNotes.filter((item) => !item.bookId || item.bookId === 'SHARED').length;
  }, [allIdeaNotes]);

  const currentBookIdeasCount = useMemo(() => {
    if (!activeBook) return 0;
    return allIdeaNotes.filter((item) => item.bookId === activeBook.id).length;
  }, [allIdeaNotes, activeBook]);

  const ideaNotes = useMemo(() => {
    if (ideaScopeFilter === 'ALL') return allIdeaNotes;
    if (ideaScopeFilter === 'SHARED') {
      return allIdeaNotes.filter((item) => !item.bookId || item.bookId === 'SHARED');
    }
    if (ideaScopeFilter === 'CURRENT') {
      if (!activeBook) return allIdeaNotes;
      return allIdeaNotes.filter((item) => item.bookId === activeBook.id);
    }
    return allIdeaNotes.filter((item) => item.bookId === ideaScopeFilter);
  }, [allIdeaNotes, ideaScopeFilter, activeBook]);

  // 글감·취재창고: 현재 선택된 기획(activeBook) 작품별로 완전 분리
  const allMaterials = useMemo(() => {
    return vault.filter((item) => item.category !== 'idea' || item.isMaterial);
  }, [vault]);

  const materials = useMemo(() => {
    if (!activeBook) return [];
    return allMaterials.filter((item) => item.bookId === activeBook.id);
  }, [allMaterials, activeBook]);

  const unassignedMaterialsCount = useMemo(() => {
    return allMaterials.filter((item) => !item.bookId || item.bookId === 'SHARED').length;
  }, [allMaterials]);

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
      ensureVaultHistoryInit();
      const targetBookId = ideaScopeFilter === 'CURRENT' && activeBook ? activeBook.id : null;

      await bookService.createVaultItem({
        title: quickIdeaInput.trim().slice(0, 30),
        content: quickIdeaInput.trim(),
        category: 'idea',
        isMaterial: false,
        bookId: targetBookId,
        tags: ['아이디어']
      });
      setQuickIdeaInput('');
      await loadVault();
      pushVaultHistory(storageService.getVault(), '아이디어 추가');
      showToast('새 아이디어가 기록되었습니다.', 'info');
    } catch (err) {
      showToast(`기록 실패: ${err.message}`, 'error');
    }
  };

  // 아이디어 복제 보관 & 보관 해제 토글 (원본은 아이디어 노트에 그대로 유지)
  const handlePromoteToVault = async (ideaItem) => {
    const targetBookId =
      (ideaItem.bookId && ideaItem.bookId !== 'SHARED' ? ideaItem.bookId : null) ||
      activeBook?.id ||
      null;
    const targetBookObj = books.find((b) => b.id === targetBookId);

    // 이미 해당 작품의 글감·취재창고에 복제되어 있는지 확인
    const existingClone = allMaterials.find(
      (m) => m.sourceIdeaId === ideaItem.id && (m.bookId || null) === targetBookId
    );

    try {
      ensureVaultHistoryInit();

      if (existingClone) {
        // 이미 보관된 상태면 다시 눌렀을 때 보관 해제(복제본 삭제)
        await bookService.deleteVaultItem(existingClone.id);
        await loadVault();
        pushVaultHistory(storageService.getVault(), '글감 보관 해제');
        showToast('글감 보관이 해제되었습니다.', 'info');
        return;
      }

      // 원본 아이디어는 그대로 두고 글감·취재창고에 복제 생성
      await bookService.createVaultItem({
        title: ideaItem.title || (ideaItem.content || '').slice(0, 30) || '아이디어 글감',
        content: ideaItem.content,
        category: 'idea',
        isMaterial: true,
        sourceIdeaId: ideaItem.id,
        bookId: targetBookId,
        tags: Array.from(new Set([...(ideaItem.tags || []), '아이디어', '글감']))
      });
      await loadVault();
      pushVaultHistory(storageService.getVault(), '글감 보관');

      const msg = targetBookObj
        ? `'${targetBookObj.title}'의 글감·취재창고로 복제 보관되었습니다.`
        : '글감·취재창고로 복제 보관되었습니다.';
      showActionToast(msg, () => handleUndoVault(), null, {
        yesText: '되돌리기 (Ctrl+Z)',
        noText: '닫기'
      });
    } catch (err) {
      showToast(`보관 실패: ${err.message}`, 'error');
    }
  };

  // 아이디어 인라인 수정
  const handleOpenEditIdea = (idea) => {
    setEditingIdeaId(idea.id);
    setEditingIdeaContent(idea.content || '');
    setEditingIdeaBookId(idea.bookId || 'SHARED');
  };

  const handleSaveEditIdea = async (ideaId) => {
    if (!editingIdeaContent.trim()) {
      showToast('내용을 입력해주세요.', 'error');
      return;
    }
    try {
      ensureVaultHistoryInit();
      const resolvedBookId = editingIdeaBookId && editingIdeaBookId !== 'SHARED' ? editingIdeaBookId : null;
      await bookService.updateVaultItem(ideaId, {
        title: editingIdeaContent.trim().slice(0, 30),
        content: editingIdeaContent.trim(),
        bookId: resolvedBookId
      });
      setEditingIdeaId(null);
      setEditingIdeaContent('');
      await loadVault();
      pushVaultHistory(storageService.getVault(), '아이디어 수정');
      showToast('아이디어가 수정되었습니다.', 'success');
    } catch (err) {
      showToast(`수정 실패: ${err.message}`, 'error');
    }
  };

  const handleDeleteIdea = async (id) => {
    try {
      ensureVaultHistoryInit();
      await deleteVaultItem(id);
      pushVaultHistory(storageService.getVault(), '아이디어 삭제');
      showActionToast('아이디어가 삭제되었습니다.', () => handleUndoVault(), null, {
        yesText: '되돌리기 (Ctrl+Z)',
        noText: '닫기'
      });
    } catch (err) {
      showToast(`삭제 실패: ${err.message}`, 'error');
    }
  };

  const handleUpdateProposalTitle = async (newTitle) => {
    setProposalTitle(newTitle);
    if (!activeBook || !newTitle.trim() || newTitle.trim() === activeBook.title) return;
    try {
      await updateBookInfo(activeBook.id, { title: newTitle.trim() });
    } catch (err) {
      console.error('Failed to sync proposal title:', err);
    }
  };

  const handleUpdateProposalGenre = async (newGenre) => {
    setProposalGenre(newGenre);
    if (!activeBook || newGenre === activeBook.genre) return;
    try {
      const gId = getOfficialGenreId(newGenre);
      await updateBookInfo(activeBook.id, { genre: newGenre, genreKey: gId });
      setCurrentGenreKey(gId);
    } catch (err) {
      console.error('Failed to sync proposal genre:', err);
    }
  };

  // --- Step 1: 출간 기획서 실시간 자동 저장(Auto-Save) 핸들러 ---
  const handleProposalFieldChange = (field, value) => {
    if (field === 'logline') setProposalLogline(value);
    else if (field === 'intention') setProposalIntention(value);
    else if (field === 'target') setProposalTarget(value);
    else if (field === 'diff') setProposalDiff(value);
    else if (field === 'author') {
      setProposalAuthor(value);
      setNarrativeConfig((prev) => ({ ...prev, authorBackground: value }));
    }

    if (!activeBook?.id) return;
    setProposalSaveStatus('saving');

    if (proposalDebounceTimerRef.current) {
      clearTimeout(proposalDebounceTimerRef.current);
    }

    proposalDebounceTimerRef.current = setTimeout(async () => {
      try {
        const updatedData = {
          logline: field === 'logline' ? value : proposalLogline,
          intention: field === 'intention' ? value : proposalIntention,
          target: field === 'target' ? value : proposalTarget,
          diff: field === 'diff' ? value : proposalDiff,
          author: field === 'author' ? value : proposalAuthor,
          authorBackground: field === 'author' ? value : proposalAuthor
        };
        await updateActiveBookPlanning({
          proposal: updatedData,
          authorBackground: updatedData.author,
          narrativeConfig: {
            ...(activeBook.narrativeConfig || {}),
            authorBackground: updatedData.author
          },
          ...updatedData
        });
        setProposalSaveStatus('saved');
      } catch (err) {
        console.error('Failed to auto-save proposal:', err);
        setProposalSaveStatus('saved');
      }
    }, 600);
  };

  // --- 기획서재 전체 통합 저장 핸들러 (스튜디오 글로벌 저장과 동일) ---
  const handleGlobalSave = async () => {
    if (!activeBook) return;
    try {
      const trimmedTitle = proposalTitle.trim();
      if (trimmedTitle && (trimmedTitle !== activeBook.title || proposalGenre !== activeBook.genre)) {
        const gId = getOfficialGenreId(proposalGenre);
        await updateBookInfo(activeBook.id, {
          title: trimmedTitle,
          genre: proposalGenre,
          genreKey: gId
        });
        setCurrentGenreKey(gId);
      }

      const proposalData = {
        logline: proposalLogline,
        intention: proposalIntention,
        target: proposalTarget,
        diff: proposalDiff,
        author: proposalAuthor,
        authorBackground: proposalAuthor
      };

      await updateActiveBookPlanning({
        proposal: proposalData,
        authorBackground: proposalAuthor.trim(),
        narrativeConfig: {
          ...(activeBook.narrativeConfig || {}),
          authorBackground: proposalAuthor.trim(),
          ...(narrativeConfig || {})
        },
        ...proposalData
      });

      await bookService.updateBook(activeBook.id, {
        narrativeConfig,
        plotStages
      });

      setProposalSaveStatus('saved');
      showToast('현재 기획 내용이 모두 안전하게 저장되었습니다.', 'success');
    } catch (err) {
      showToast(`기획 저장 실패: ${err.message}`, 'error');
    }
  };

  // --- Step 1: 출간 기획서 저장 ---
  const handleSaveProposal = async (e) => {
    if (e) e.preventDefault();
    if (!activeBook) return;
    try {
      const trimmedTitle = proposalTitle.trim();
      if (trimmedTitle && (trimmedTitle !== activeBook.title || proposalGenre !== activeBook.genre)) {
        const gId = getOfficialGenreId(proposalGenre);
        await updateBookInfo(activeBook.id, {
          title: trimmedTitle,
          genre: proposalGenre,
          genreKey: gId
        });
        setCurrentGenreKey(gId);
      }

      const proposalData = {
        logline: proposalLogline.trim(),
        intention: proposalIntention.trim(),
        target: proposalTarget.trim(),
        diff: proposalDiff.trim(),
        author: proposalAuthor.trim(),
        authorBackground: proposalAuthor.trim()
      };
      await updateActiveBookPlanning({
        proposal: proposalData,
        authorBackground: proposalAuthor.trim(),
        narrativeConfig: {
          ...(activeBook.narrativeConfig || {}),
          authorBackground: proposalAuthor.trim()
        },
        ...proposalData
      });
      showToast('출간 기획서가 저장되었습니다.', 'success');
    } catch (err) {
      showToast(`기획서 저장 실패: ${err.message}`, 'error');
    }
  };

  // --- Step 2: 취재 자료 등록 및 수정 (현재 선택된 작품 전용) ---
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

  // 기존 미지정 취재 자료를 현재 작품으로 일괄 귀속
  const handleClaimUnassignedMaterials = async () => {
    if (!activeBook) return;
    ensureVaultHistoryInit();
    const unassigned = allMaterials.filter((m) => !m.bookId || m.bookId === 'SHARED');
    for (const item of unassigned) {
      await bookService.updateVaultItem(item.id, { bookId: activeBook.id });
    }
    await loadVault();
    pushVaultHistory(storageService.getVault(), '기존 자료 가져오기');
    showToast(`기존 자료 ${unassigned.length}건이 '${activeBook.title}' 작품으로 귀속되었습니다.`, 'success');
  };

  const handleCreateOrUpdateMaterial = async (e) => {
    e.preventDefault();
    if (!vaultTitle.trim() && !vaultContent.trim()) {
      showToast('제목 또는 내용을 입력해주세요.', 'error');
      return;
    }
    try {
      setIsVaultSubmitting(true);
      ensureVaultHistoryInit();
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
          bookId: activeBook?.id || null,
          sourceRef: vaultSource.trim(),
          tags: finalTags
        });
        showToast('취재 자료가 성공적으로 수정되었습니다.', 'success');
      } else {
        // 신규 취재 자료 등록 (현재 선택된 작품에 귀속)
        await bookService.createVaultItem({
          title: vaultTitle.trim() || '취재 자료',
          content: vaultContent.trim(),
          category: targetCategory,
          isMaterial: true,
          bookId: activeBook?.id || null,
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
      pushVaultHistory(storageService.getVault(), editingMaterialId ? '취재 자료 수정' : '취재 자료 등록');
    } catch (err) {
      showToast(`저장 실패: ${err.message}`, 'error');
    } finally {
      setIsVaultSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      ensureVaultHistoryInit();
      await deleteVaultItem(id);
      pushVaultHistory(storageService.getVault(), '취재 자료 삭제');
      showActionToast('취재 자료가 삭제되었습니다.', () => handleUndoVault(), null, {
        yesText: '되돌리기 (Ctrl+Z)',
        noText: '닫기'
      });
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
- speaker: "third_limited"(3인칭 제한적 시점), "first_protagonist"(1인칭 주인공 시점), "first_observer"(1인칭 관찰자 시점), "third_omniscient"(3인칭 전지적 시점) 중 택1
- listener: "unspecified_reader"(불특정 독자), "specific_character"(특정 청자 서간체), "future_someone"(미래의 누군가) 중 택1
- tone: "past_plain"(~했다 과거형), "present_plain"(~한다 현재형) 중 택1
- worldSetting: "배경 및 세계관 한 줄 요약"
- relationshipMemo: "주요 인물 간 긴장 관계 한 줄 요약"
` : isEssay ? `
- speaker: "first_author"(1인칭 작가 '나'), "first_observer"(관찰자 '나'), "virtual_speaker"(가상의 화자) 중 택1
- listener: "myself"(나 자신 독백), "unknown_you"(이름 모를 당신), "precious_person"(소중한 그 사람) 중 택1
- tone: "plain"(~했다 평어체), "polite_soft"(~해요 대화체), "polite_formal"(~합니다 경어체) 중 택1
- worldSetting: "에세이의 주된 공간/계절적 분위기 메모"
- relationshipMemo: "글에 등장하는 주요 인연들과의 정서적 관계"
` : `
- speaker: "expert_objective"(저자/전문가 객관적 관찰), "friendly_mentor"(친근한 멘토/길잡이), "first_practitioner"(1인칭 실천가 경험담 공유) 중 택1
- listener: "readers"('독자 여러분' 일반 독자), "beginners"(초심자/입문자), "colleagues"(동료 실무자/전문가) 중 택1
- tone: "formal_explain"(~합니다 설명체), "assertive"(~이다 단정체), "friendly_soft"(~해요 친근체) 중 택1
- subTopics: "책 전체를 관통하여 다룰 3~5가지 핵심 소주제들 (예: 1. ..., 2. ..., 3. ...)"
- narrativeApproach: "이 책에서 화자가 주제를 풀어내는 고유한 서술 방식 및 화자 캐릭터 (예: 실패담 기반의 솔직한 조언, 소크라테스식 문답, 진료실 비유 상담 등)"
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

  // 세부 꼭지 추가 (insertAfterIdx가 주어지면 해당 꼭지 바로 아래에 삽입)
  const handleAddNewSubplot = async (sIdx, insertAfterIdx = null) => {
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
    const cloned = structuredClone(plotStages);
    if (!cloned[sIdx].subplots) cloned[sIdx].subplots = [];
    const targetIdx = (insertAfterIdx !== null && insertAfterIdx !== undefined)
      ? insertAfterIdx + 1
      : cloned[sIdx].subplots.length;
    const subNum = targetIdx + 1;
    const newTitle = `${sIdx + 1}.${subNum} 새로운 세부 꼭지`;
    cloned[sIdx].subplots.splice(targetIdx, 0, {
      title: newTitle,
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
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
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
    pushStep5History(plotStages, cloned, '새 챕터 추가');
    showToast('새 챕터가 추가되었습니다.', 'info');
  };

  const handleDeleteChapter = async (cIdx) => {
    const ok = await openConfirm({
      title: '챕터 삭제',
      message: '이 챕터와 포함된 소목차를 목차 조립대에서 삭제하시겠습니까?',
      confirmText: '삭제'
    });
    if (!ok) return;
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
    const cloned = structuredClone(draftChapters);
    cloned.splice(cIdx, 1);
    await saveDraftOutline(cloned);
    pushStep5History(plotStages, cloned, '챕터 삭제');
    showToast('챕터가 삭제되었습니다. (되돌리려면 Ctrl+Z)', 'info');
  };

  const handleAddNewSection = async (cIdx, insertAfterIdx = null) => {
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
    const cloned = structuredClone(draftChapters);
    if (!cloned[cIdx].sections) cloned[cIdx].sections = [];
    const targetIdx = (insertAfterIdx !== null && insertAfterIdx !== undefined)
      ? insertAfterIdx + 1
      : cloned[cIdx].sections.length;
    const secNum = targetIdx + 1;
    cloned[cIdx].sections.splice(targetIdx, 0, {
      id: `draft_sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: `${cIdx + 1}.${secNum} 새로운 소목차`
    });
    await saveDraftOutline(cloned);
    pushStep5History(plotStages, cloned, '소목차 추가');
    showToast('새 소목차가 추가되었습니다.', 'info');
  };

  const handleDeleteSection = async (cIdx, sIdx) => {
    if (step5HistoryRef.current.length === 0) {
      pushStep5History(plotStages, draftChapters, '초기 상태');
    }
    const cloned = structuredClone(draftChapters);
    cloned[cIdx].sections.splice(sIdx, 1);
    await saveDraftOutline(cloned);
    pushStep5History(plotStages, cloned, '소목차 삭제');
    showToast('소목차가 삭제되었습니다. (되돌리려면 Ctrl+Z)', 'info');
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

  // 파이프라인 단계별 맞춤 퀵 프롬프트 목록
  const getStepQuickPrompts = () => {
    switch (activeStep) {
      case 'proposal':
        return [
          { label: '핵심 컨셉 진단', prompt: '현재 도서명(가제)과 핵심 컨셉의 대중적 매력도와 시장성을 날카롭게 진단해줘.' },
          { label: '타깃 독자 구체화', prompt: '타깃 독자층을 더 뾰족하고 생생한 실제 구매자 페르소나로 좁혀서 정의해줘.' },
          { label: '기존 도서 차별점', prompt: '동일 분야 베스트셀러 대비 이 책만이 가진 결정적 차별점 3가지를 도출해줘.' }
        ];
      case 'story':
        return [
          { label: '화자·청자 추천', prompt: '현재 기획의도를 독자에게 가장 강렬하게 전달할 최적의 화자와 청자 조합을 추천해줘.' },
          { label: '기본 어투 추천', prompt: '이 장르와 타깃 독자의 몰입을 극대화할 수 있는 문체와 어투를 제안해줘.' },
          { label: '집필 원칙 조언', prompt: '이 책을 집필할 때 흔히 빠지기 쉬운 함정과 반드시 고수해야 할 집필 원칙을 알려줘.' }
        ];
      case 'outline':
        return [
          { label: '목차 표준 비교', prompt: '베스트셀러 목차 표준과 비교하여 현재 뼈대의 사각지대나 누락된 꼭지를 짚어줘.' },
          { label: '플롯 갈등 보강', prompt: '현재 플롯의 클라이맥스 갈등과 독자의 몰입도를 높일 전개 텐션을 보강해줘.' },
          { label: '4단계 뼈대 제안', prompt: '이 책의 기획을 기승전결(또는 4단계 비문학 뼈대)로 나누어 목차 조립대에 반영할 수 있게 제안해줘.' }
        ];
      case 'ideas':
        return [
          { label: '소재 확장 발상', prompt: '현재 아이디어에서 파생할 수 있는 참신한 소재와 극적인 반전 모티브를 제안해줘.' },
          { label: '트렌드 키워드', prompt: '요즘 독자들이 반응하는 이 분야의 최신 트렌드 키워드와 후킹 요소를 분석해줘.' },
          { label: '핵심 갈등 설정', prompt: '이 발상을 단숨에 몰입감 넘치는 이야기로 바꿀 핵심 갈등과 딜레마를 제안해줘.' }
        ];
      case 'materials':
        return [
          { label: '근거 자료 보강', prompt: '이 주장의 설득력을 높이기 위해 추가로 수집해야 할 데이터, 연구 결과, 인터뷰를 조언해줘.' },
          { label: '실사례 취재 팁', prompt: '독자의 공감을 얻기 위한 실제 성공/실패 사례를 발굴하는 취재 질문을 추천해줘.' },
          { label: '글감 카테고리화', prompt: '수집한 글감들을 목차의 흐름에 따라 체계적으로 분류하는 가이드를 제시해줘.' }
        ];
      default:
        return [
          { label: '로그라인 평가', prompt: '현재 로그라인의 매력도를 출판 관점에서 평가해줘.' },
          { label: '플롯 갈등 보강', prompt: '현재 플롯의 클라이맥스 갈등과 전개를 보강해줘.' },
          { label: '목차 표준 비교', prompt: '베스트셀러 목차 표준과 비교하여 사각지대를 짚어줘.' }
        ];
    }
  };

  // 책임 편집장 대화 초기화 (새 대화 시작 및 기존 세션 자동 보관)
  const handleResetPlanningChat = () => {
    const userMsgs = aiChatMessages.filter(m => m.role === 'user');
    if (userMsgs.length > 0) {
      storageService.archiveAiChatSession(activeBook?.id, 'planning', aiChatMessages);
    }
    const stepNames = {
      ideas: '아이디어 발상',
      proposal: '출간 기획서',
      materials: '글감 & 취재창고',
      story: '작품 서사 & 인물 설정',
      outline: '목차 & 플롯 뼈대'
    };
    setAiChatMessages([
      {
        role: 'assistant',
        text: `새 기획 상담을 시작합니다, 작가님. 현재 **${stepNames[activeStep] || '도서 기획'}** 단계에 머물고 계시네요. 어떤 부분을 중점적으로 다듬어볼까요?`
      }
    ]);
    showToast('새 대화가 시작되었습니다. 이전 대화는 기록에 보관되었습니다.', 'info');
  };

  // 대화 히스토리 모달 열기
  const handleOpenAiHistory = () => {
    const sessions = storageService.getAiChatHistory(activeBook?.id, 'planning');
    setAiHistorySessions(sessions);
    setIsAiHistoryOpen(true);
  };

  // 과거 대화 세션 복원
  const handleRestoreAiSession = (session) => {
    if (!session?.messages) return;
    const userMsgs = aiChatMessages.filter(m => m.role === 'user');
    if (userMsgs.length > 0) {
      storageService.archiveAiChatSession(activeBook?.id, 'planning', aiChatMessages);
    }
    setAiChatMessages(session.messages);
    setIsAiHistoryOpen(false);
    showToast(`'${session.title}' 대화 기록을 복원했습니다.`, 'success');
  };

  // 과거 대화 세션 삭제
  const handleDeleteAiSession = (sessionId, e) => {
    e.stopPropagation();
    const updated = storageService.deleteAiChatSession(activeBook?.id, 'planning', sessionId);
    setAiHistorySessions(updated);
    showToast('대화 기록이 삭제되었습니다.', 'info');
  };

  // 책임 편집장이 제안한 출간 기획안 원클릭 반영 핸들러
  const handleApplyAiProposal = async (propData) => {
    if (!propData) return;
    const ok = await openConfirm({
      title: '출간 기획서 자동 반영',
      message: '책임 편집장이 제안한 기획안을 현재 출간 기획서에 적용하시겠습니까?\n입력 중이던 항목들이 새 제안으로 깔끔하게 업데이트됩니다.',
      confirmText: '기획서에 반영',
      danger: false
    });
    if (!ok) return;

    if (propData.title) {
      setProposalTitle(propData.title);
      if (activeBook?.id) updateBookInfo(activeBook.id, { title: propData.title });
    }
    if (propData.genre) {
      setProposalGenre(propData.genre);
      if (activeBook?.id) updateBookInfo(activeBook.id, { genre: propData.genre });
    }
    if (propData.logline) setProposalLogline(propData.logline);
    if (propData.intention) setProposalIntention(propData.intention);
    if (propData.target) setProposalTarget(propData.target);
    if (propData.diff) setProposalDiff(propData.diff);
    if (propData.author) {
      setProposalAuthor(propData.author);
      setNarrativeConfig(prev => ({ ...prev, authorBackground: propData.author }));
    }

    if (activeBook?.id) {
      updateActiveBookPlanning({
        proposalTitle: propData.title || proposalTitle,
        proposalGenre: propData.genre || proposalGenre,
        proposalLogline: propData.logline || proposalLogline,
        proposalIntention: propData.intention || proposalIntention,
        proposalTarget: propData.target || proposalTarget,
        proposalDiff: propData.diff || proposalDiff,
        proposalAuthor: propData.author || proposalAuthor
      });
    }
    showToast('출간 기획서에 성공적으로 반영되었습니다.', 'success');
  };

  // 우측 3열: 책임 편집장 실시간 기획 & 서사 코칭
  const handleSendAiMessage = async (customText) => {
    const textToSend = customText || aiChatInput.trim();
    if (!textToSend || isAiChatLoading) return;

    const newMessages = [...aiChatMessages, { role: 'user', text: textToSend }];
    setAiChatMessages(newMessages);
    setAiChatInput('');
    setIsAiChatLoading(true);

    try {
      const res = await aiService.chatWithPlanningEditor({
        book: activeBook,
        currentStep: activeStep,
        proposalTitle,
        proposalGenre,
        proposalAuthor,
        proposalLogline,
        proposalIntention,
        proposalTarget,
        proposalDiff,
        plotStages,
        narrativeConfig,
        narrativeOptions: getNarrativeOptions(currentGenreKey),
        message: textToSend,
        history: aiChatMessages
      });

      setAiChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.content,
          restructureData: res.restructureData,
          proposalData: res.proposalData
        }
      ]);
    } catch (err) {
      console.error('[PlanningEditor Error]:', err);
      setAiChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `죄송합니다. AI 응답 생성 중 오류가 발생했습니다: ${err.message || '일시적 네트워크 지연'}` }
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

  // 책임 편집장이 제안한 플롯 뼈대 원클릭 직접 반영 핸들러
  const handleApplyAiStages = async (newStages) => {
    if (!newStages || newStages.length === 0) return;
    const ok = await openConfirm({
      title: '플롯 뼈대 개편안 반영',
      message: `책임 편집장이 제안한 총 ${newStages.length}개 단계를 현재 플롯 뼈대에 반영하시겠습니까?\n'확인'을 누르면 새 기획안으로 조립대가 즉시 업데이트됩니다.`,
      confirmText: '뼈대에 반영',
      danger: false
    });
    if (!ok) return;

    setPlotStages(newStages);
    if (activeBook) {
      updateBookInfo(activeBook.id, {
        stages: newStages,
        plotStages: newStages
      });
    }
    pushVaultHistory({ ...vault, stages: newStages }, '책임 편집장 뼈대 개편안 반영');
    showToast(`총 ${newStages.length}개 단계가 플롯 뼈대에 성공적으로 반영되었습니다.`, 'success');
  };

  // 새 기획 모달 열기
  const handleOpenNewProjectModal = () => {
    setEditingProjectId(null);
    setNewProjectTitle('');
    setNewProjectGenre('novel');
    setIsNewProjectModalOpen(true);
  };

  // 기존 기획 프로젝트 정보 수정 모달 열기
  const handleOpenEditProjectModal = (e, book) => {
    if (e) e.stopPropagation();
    const matchedGenre = book.genreKey || OFFICIAL_GENRES.find((g) => g.label === book.genre)?.id || 'novel';
    setEditingProjectId(book.id);
    setNewProjectTitle(book.title || '');
    setNewProjectGenre(matchedGenre);
    setIsNewProjectModalOpen(true);
  };

  // 새 기획 프로젝트 생성 및 기존 프로젝트 정보 수정
  const handleCreateNewProject = async (e) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) {
      showToast('작품 제목을 입력해주세요.', 'error');
      return;
    }
    try {
      const selectedGenre = OFFICIAL_GENRES.find((g) => g.id === newProjectGenre) || OFFICIAL_GENRES[0];

      if (editingProjectId) {
        await updateBookInfo(editingProjectId, {
          title: newProjectTitle.trim(),
          genre: selectedGenre.label,
          genreKey: newProjectGenre
        });
        setIsNewProjectModalOpen(false);
        setEditingProjectId(null);
        setNewProjectTitle('');
        return;
      }

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
      setEditingProjectId(null);
      setNewProjectTitle('');
      showToast(`'${newBook.title}' 새 기획 프로젝트가 생성되었습니다.`, 'success');
    } catch (err) {
      showToast(`기획 저장 실패: ${err.message}`, 'error');
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
              {activeBook?.genre || OFFICIAL_GENRES.find((g) => g.id === activeBook?.genreKey)?.label || '소설'}
            </span>
            <div className="top-progress-pill">
              {activeStep === 'ideas' ? (
                <>아이디어 노트 <span>전체 공용</span></>
              ) : (
                <>기획 파이프라인 <span>{currentStepNumber} / 4단계</span></>
              )}
            </div>
          </div>
        </div>

        <div className="preview-right">
          <button
            type="button"
            className="btn-vault-global-save"
            onClick={handleGlobalSave}
            title="현재 기획 전체 저장 (Ctrl+S)"
          >
            <Save size={14} />
            <span>기획 저장</span>
          </button>
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
              <button className="btn-new-project" onClick={handleOpenNewProjectModal}>
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
                      {/* 우측 상단 호버 오버레이 수정 / 삭제 버튼 */}
                      <div className="project-card-actions">
                        <button
                          type="button"
                          className="btn-edit-project"
                          onClick={(e) => handleOpenEditProjectModal(e, b)}
                          title={`'${b.title}' 프로젝트 정보 수정`}
                          aria-label="프로젝트 정보 수정"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-delete-project"
                          onClick={(e) => handleDeleteProject(e, b.id, b.title)}
                          title={`'${b.title}' 프로젝트 삭제`}
                          aria-label="프로젝트 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="project-cover-bar" />
                      <div className="project-meta-wrap">
                        <span className="project-title" title={b.title}>{b.title}</span>
                        <div className="project-sub-row">
                          <span className="project-genre">{b.genre || OFFICIAL_GENRES.find((g) => g.id === b.genreKey)?.label || '소설'}</span>
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
                const isActive = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`pipeline-step-item ${isActive ? 'active' : ''} ${step.isShared ? 'is-shared-step' : ''}`}
                    onClick={() => setActiveStep(step.id)}
                    title={`${step.title} — ${step.desc}`}
                  >
                    <div className={`step-num-pill ${step.isShared ? 'shared-pill' : ''}`}>
                      {step.badgeLabel || `0${step.stepNum}`}
                    </div>
                    <div className="step-text-wrap">
                      <div className="step-title-row">
                        <span>{step.title}</span>
                      </div>
                      <span className="step-desc">{step.desc}</span>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="pipeline-content-viewport">
              {!activeBook && activeStep !== 'ideas' ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                  좌측 기획 서가에서 작품을 선택하거나 새 기획을 시작해 주세요.
                </div>
              ) : (
                <>
                  {/* [공용] 아이디어 노트 (전체 보기 / 공용 / 현재 기획 3종 필터) */}
                  {activeStep === 'ideas' && (
                    <div className="ideas-container">
                      {/* 상단 3종 필터 버튼 */}
                      <div className="ideas-scope-bar">
                        <div className="ideas-scope-tabs">
                          <button
                            type="button"
                            className={`scope-tab-btn ${ideaScopeFilter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setIdeaScopeFilter('ALL')}
                          >
                            전체 보기 ({allIdeaNotes.length})
                          </button>
                          <button
                            type="button"
                            className={`scope-tab-btn ${ideaScopeFilter === 'SHARED' ? 'active' : ''}`}
                            onClick={() => setIdeaScopeFilter('SHARED')}
                          >
                            미분류 ({sharedIdeasCount})
                          </button>
                          {activeBook && (
                            <button
                              type="button"
                              className={`scope-tab-btn ${ideaScopeFilter === 'CURRENT' ? 'active' : ''}`}
                              onClick={() => setIdeaScopeFilter('CURRENT')}
                            >
                              현재 기획 ({currentBookIdeasCount})
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 아이디어 등록 폼 */}
                      <form onSubmit={handleAddQuickIdea} className="ideas-input-box">
                        <Sun size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        <input
                          type="text"
                          className="ideas-input"
                          placeholder="스쳐 지나가는 아이디어나 메모를 자유롭게 적어보세요... (Enter 등록)"
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
                            {ideaScopeFilter === 'ALL'
                              ? '아직 기록된 아이디어가 없습니다. 상단 입력창에서 아이디어를 기록해 보세요.'
                              : '선택한 필터에 해당하는 아이디어가 없습니다.'}
                          </div>
                        ) : (
                          ideaNotes.map((idea) => {
                            const isEditing = editingIdeaId === idea.id;
                            const ownerBook = idea.bookId && idea.bookId !== 'SHARED'
                              ? books.find((b) => b.id === idea.bookId)
                              : null;
                            const promoteTargetBook = ownerBook || activeBook;
                            const targetBookId = promoteTargetBook?.id || null;
                            const isSavedAsMaterial = allMaterials.some(
                              (m) => m.sourceIdeaId === idea.id && (m.bookId || null) === targetBookId
                            );
                            return (
                              <div key={idea.id} className="idea-card">
                                <div className="idea-card-header">
                                  <span>{new Date(idea.createdAt).toLocaleDateString('ko-KR')}</span>
                                </div>
                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '6px 0' }}>
                                    <select
                                      className="vault-form-control"
                                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.76rem' }}
                                      value={editingIdeaBookId || 'SHARED'}
                                      onChange={(e) => setEditingIdeaBookId(e.target.value)}
                                    >
                                      <option value="SHARED">미분류</option>
                                      {books.map((b) => (
                                        <option key={b.id} value={b.id}>
                                          {b.title}
                                        </option>
                                      ))}
                                    </select>
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
                                      title="아이디어 내용 및 소속 기획 수정"
                                    >
                                      <Edit2 size={12} />
                                      수정
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={`btn-idea-action ${isSavedAsMaterial ? 'active' : ''}`}
                                    onClick={() => handlePromoteToVault(idea)}
                                    title={
                                      isSavedAsMaterial
                                        ? '클릭하여 글감 보관 해제'
                                        : promoteTargetBook
                                        ? `'${promoteTargetBook.title}' 작품의 글감·취재창고로 복제 보관`
                                        : '글감·취재창고로 복제 보관'
                                    }
                                  >
                                    <Bookmark size={13} />
                                    {isSavedAsMaterial ? '글감 보관됨' : '글감 보관'}
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

                  {/* [STEP 01] 출간 기획서 */}
                  {activeStep === 'proposal' && (
                    <div className="proposal-container">
                      <div className="proposal-top-notice">
                        <div className="notice-left">
                          <Info size={16} />
                          단행본 1권을 관통하는 5대 기획 축을 정리하면 집필 방향이 흔들리지 않습니다.
                        </div>
                      </div>

                      {/* 도서 기본 메타: 제목(가제) 및 장르 (1줄 가로 배치 및 상호 연동) */}
                      <div className="proposal-meta-card">
                        <div className="proposal-meta-field flex-title">
                          <label className="proposal-meta-label">
                            <BookOpen size={14} style={{ color: 'var(--color-primary)' }} />
                            제목(가제)
                          </label>
                          <input
                            type="text"
                            className="proposal-meta-input"
                            placeholder="도서 제목(가제)을 입력하세요"
                            value={proposalTitle}
                            onChange={(e) => setProposalTitle(e.target.value)}
                            onBlur={(e) => handleUpdateProposalTitle(e.target.value)}
                          />
                        </div>
                        <div className="proposal-meta-field flex-genre">
                          <label className="proposal-meta-label">
                            <Layers size={14} style={{ color: 'var(--color-primary)' }} />
                            장르
                          </label>
                          <select
                            className="proposal-meta-select"
                            value={proposalGenre}
                            onChange={(e) => handleUpdateProposalGenre(e.target.value)}
                          >
                            {OFFICIAL_GENRES.map((g) => (
                              <option key={g.id} value={g.label}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Sparkles size={15} style={{ color: 'var(--color-primary)' }} />
                            1. 핵심 컨셉
                          </label>
                          <span className="proposal-hint">책 전체를 한 문장으로 정의하는 핵심 명제</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="매일 쏟아지는 자극과 피로에 지친 독자들에게, 밤의 고요한 서재에서 건져 올린 단단한 위로를 전하는 이야기."
                          value={proposalLogline}
                          onChange={(e) => handleProposalFieldChange('logline', e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <PenTool size={15} style={{ color: 'var(--color-primary)' }} />
                            2. 기획 의도 및 집필 배경
                          </label>
                          <span className="proposal-hint">왜 지금 이 책을 써야 하는가?</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="누구나 고독한 순간을 마주하지만, 그 시간을 어떻게 보내느냐에 따라 삶의 결이 달라집니다."
                          value={proposalIntention}
                          onChange={(e) => handleProposalFieldChange('intention', e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Users size={15} style={{ color: 'var(--color-primary)' }} />
                            3. 타깃 독자층
                          </label>
                          <span className="proposal-hint">누가 이 책을 읽고 공감할 것인가?</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="직장과 일상에서 번아웃을 겪는 20~40대, 나만의 온전한 회복 루틴을 찾고 싶은 독자."
                          value={proposalTarget}
                          onChange={(e) => handleProposalFieldChange('target', e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Compass size={15} style={{ color: 'var(--color-primary)' }} />
                            4. 기존 도서 대비 차별점
                          </label>
                          <span className="proposal-hint">유사 베스트셀러와 다른 나만의 독창성</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="단순한 감성 힐링 문구 나열을 지양하고, 실제 서재에서 행해지는 필사와 사색의 감각적 디테일을 융합한 정밀한 에세이."
                          value={proposalDiff}
                          onChange={(e) => handleProposalFieldChange('diff', e.target.value)}
                        />
                      </div>

                      <div className="proposal-section-card">
                        <div className="proposal-label-row">
                          <label className="proposal-label">
                            <Users size={15} style={{ color: 'var(--color-primary)' }} />
                            5. 저자 소개 및 전문성
                          </label>
                          <span className="proposal-hint">이 책을 쓰는 저자의 이력, 전문적 자격 및 집필 배경</span>
                        </div>
                        <textarea
                          className="proposal-textarea"
                          placeholder="해당 분야 10년 차 실무자로서 겪은 생생한 현장 경험과 노하우, 원고를 신뢰할 수 있는 저자의 주요 이력 및 배경."
                          value={proposalAuthor}
                          onChange={(e) => handleProposalFieldChange('author', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* [STEP 02] 글감 & 취재창고 (작품별 전용 분리) */}
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
                          <div style={{ gridColumn: '1 / -1', padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.7 }}>
                            해당 분류의 취재 자료가 없습니다. 상단의 [취재 자료 등록] 버튼을 눌러 보관해 보세요.
                            {unassignedMaterialsCount > 0 && activeBook && (
                              <div style={{ marginTop: '0.6rem' }}>
                                <button
                                  type="button"
                                  className="btn-idea-action"
                                  style={{ display: 'inline-flex' }}
                                  onClick={handleClaimUnassignedMaterials}
                                >
                                  미지정 기존 자료 {unassignedMaterialsCount}건 현재 작품으로 가져오기
                                </button>
                              </div>
                            )}
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
                                <div key={opt.id} className="trio-option-item">
                                  <label
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
                                  {opt.id === 'custom' && narrativeConfig.speaker === 'custom' && (
                                    <input
                                      type="text"
                                      className="trio-custom-input"
                                      placeholder="예: 3년 차 사모펀드 운용역"
                                      value={narrativeConfig.customSpeaker || ''}
                                      onChange={(e) => handleUpdateNarrativeConfig('customSpeaker', e.target.value)}
                                      autoFocus
                                    />
                                  )}
                                </div>
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
                                <div key={opt.id} className="trio-option-item">
                                  <label
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
                                  {opt.id === 'custom' && narrativeConfig.listener === 'custom' && (
                                    <input
                                      type="text"
                                      className="trio-custom-input"
                                      placeholder="예: 사모펀드 예비 지원자, 취준생 후배"
                                      value={narrativeConfig.customListener || ''}
                                      onChange={(e) => handleUpdateNarrativeConfig('customListener', e.target.value)}
                                      autoFocus
                                    />
                                  )}
                                </div>
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
                                <div key={opt.id} className="trio-option-item">
                                  <label
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
                                  {opt.id === 'custom' && narrativeConfig.tone === 'custom' && (
                                    <input
                                      type="text"
                                      className="trio-custom-input"
                                      placeholder="예: 긴장감 넘치는 비즈니스 고백체"
                                      value={narrativeConfig.customTone || ''}
                                      onChange={(e) => handleUpdateNarrativeConfig('customTone', e.target.value)}
                                      autoFocus
                                    />
                                  )}
                                </div>
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
                                  {isLiterature ? '배경 및 관계도 더 설정하기' : '핵심 소주제 및 화자 전개 방식 더 설정하기'}
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
                                      <label className="more-field-label">다룰 핵심 소주제들</label>
                                      <textarea
                                        className="more-textarea"
                                        placeholder={`책 전체를 관통하여 다룰 3~5가지 핵심 소주제나 키워드를 적어보세요.\n(예: 1. 바이브코딩 철학, 2. 1일 1앱 MVP 빠른 개발 실무, 3. 광고/결제 연동 수익화)`}
                                        rows={4}
                                        value={narrativeConfig.subTopics || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('subTopics', e.target.value)}
                                      />
                                    </div>
                                    <div className="more-field-group">
                                      <label className="more-field-label">화자의 전개 방식 및 서술 특성</label>
                                      <textarea
                                        className="more-textarea"
                                        placeholder={`단순 저자 이력이 아닌, 이 책에서 화자가 주제를 풀어내는 고유한 서술 방식이나 화자 캐릭터를 메모하세요.\n(예: 실패담 기반의 솔직한 조언, 소크라테스식 질문 던지기, 진료실 비유 상담 등)`}
                                        rows={4}
                                        value={narrativeConfig.narrativeApproach || ''}
                                        onChange={(e) => handleUpdateNarrativeConfig('narrativeApproach', e.target.value)}
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
                            <div className="card-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn-add-stage-header"
                                onClick={handleAddNewStage}
                                title="새로운 플롯 단계 추가"
                              >
                                <Plus size={13} />
                                <span>단계 추가</span>
                              </button>
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
                                    {recommendedPlots.slice(0, 3).map((plot) => (
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
                                        <option value="" disabled>기타 추천 뼈대</option>
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
                                                <button 
                                                  type="button" 
                                                  className="mini-icon-btn" 
                                                  onClick={() => handleAddNewSubplot(sIdx, spIdx)} 
                                                  title="아래에 세부 꼭지 추가"
                                                >
                                                  <Plus size={12} />
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
                                            className="mini-icon-btn"
                                            onClick={() => handleAddNewSection(cIdx, sIdx)}
                                            title="아래에 소목차 추가"
                                          >
                                            <Plus size={12} />
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
            3. 우측 3열: 책임 편집장 (기획 코칭) + 독립 쿼터 바 (sample-vault 1:1)
           ----------------------------------------------------------------- */}
        <aside className="vault-ai-col-wrap">
          <div className="vault-ai-card">
            <div className="ai-col-header">
              <div className="ai-col-title-wrap">
                <Bot size={16} style={{ color: 'var(--color-primary)' }} />
                <span className="ai-col-title">책임 편집장 (기획 코칭)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="btn-vault-icon-action"
                  onClick={handleOpenAiHistory}
                  title="과거 대화 기록"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                >
                  <Clock size={15} />
                </button>
                <button
                  type="button"
                  className="btn-vault-icon-action"
                  onClick={handleResetPlanningChat}
                  title="새 대화 시작"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>

            <div className="ai-chat-body" ref={chatBodyRef}>
              {aiChatMessages.map((msg, mIdx) => (
                <div key={mIdx} className={`ai-msg-bubble ${msg.role}`}>
                  {msg.role === 'assistant' ? (
                    <>
                      <div
                        className="ai-msg-markdown"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(msg.text || '')
                        }}
                      />
                      {/* 출간기획서 제안 카드 (Step 01) */}
                      {msg.proposalData && (
                        <div className="vault-ai-restructure-card">
                          <div className="restructure-card-head">
                            <span className="restructure-card-badge">편집장의 출간 기획안 제안</span>
                          </div>
                          <div style={{ fontSize: '0.82rem', lineHeight: 1.5, margin: '8px 0', color: 'var(--text-secondary)' }}>
                            {msg.proposalData.title && <div><strong>도서명:</strong> {msg.proposalData.title}</div>}
                            {msg.proposalData.genre && <div><strong>장르:</strong> {msg.proposalData.genre}</div>}
                            {msg.proposalData.logline && <div><strong>핵심 컨셉:</strong> {msg.proposalData.logline}</div>}
                            {msg.proposalData.target && <div><strong>타깃 독자:</strong> {msg.proposalData.target}</div>}
                            {msg.proposalData.diff && <div><strong>차별점:</strong> {msg.proposalData.diff}</div>}
                          </div>
                          <button
                            type="button"
                            className="btn-apply-vault-restructure"
                            onClick={() => handleApplyAiProposal(msg.proposalData)}
                          >
                            <Check size={14} /> 이 기획안을 내 출간기획서에 직접 반영하기
                          </button>
                        </div>
                      )}

                      {msg.restructureData && msg.restructureData.stages && msg.restructureData.stages.length > 0 && (
                        <div className="vault-ai-restructure-card">
                          <div className="restructure-card-head">
                            <span className="restructure-card-badge">편집장의 뼈대 개편안 제안</span>
                            <span className="restructure-card-count">
                              총 {msg.restructureData.stages.length}개 단계
                            </span>
                          </div>
                          {msg.restructureData.explanation && (
                            <p className="restructure-card-exp">{msg.restructureData.explanation}</p>
                          )}
                          <div className="restructure-preview-list">
                            {msg.restructureData.stages.map((stg, sIdx) => (
                              <div key={sIdx} className="restructure-stg-item">
                                <span className="stg-num">{sIdx + 1}.</span>
                                <span className="stg-title">{stg.title}</span>
                                {stg.subplots && stg.subplots.length > 0 && (
                                  <span className="stg-sub-count">({stg.subplots.length}개 꼭지)</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="btn-apply-vault-restructure"
                            onClick={() => handleApplyAiStages(msg.restructureData.stages)}
                          >
                            <Check size={14} /> 이 기획안을 내 플롯 뼈대에 직접 반영하기
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ai-msg-user-text">{msg.text}</div>
                  )}
                </div>
              ))}
              {isAiChatLoading && (
                <div className="ai-msg-bubble assistant" style={{ color: 'var(--text-muted)' }}>
                  기획 답변을 구성하고 있습니다...
                </div>
              )}
            </div>

            <div className="ai-quick-prompts">
              {getStepQuickPrompts().map((qp, qIdx) => (
                <button
                  key={qIdx}
                  type="button"
                  className="prompt-chip"
                  onClick={() => handleSendAiMessage(qp.prompt)}
                >
                  {qp.label}
                </button>
              ))}
            </div>

            <div className="ai-input-wrap">
              <textarea
                className="ai-input"
                rows={1}
                placeholder="기획 고민이나 보완점을 질문하세요..."
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) return; // Shift + Enter는 줄바꿈 허용
                    if (e.nativeEvent.isComposing) return; // 한글 조합 중복 방지
                    e.preventDefault();
                    handleSendAiMessage();
                  }
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
        // 1. 새 프로젝트 / 수정
        isNewProjectModalOpen={isNewProjectModalOpen}
        setIsNewProjectModalOpen={setIsNewProjectModalOpen}
        editingProjectId={editingProjectId}
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
      {/* 기획 코칭 대화 히스토리 모달 */}
      {isAiHistoryOpen && (
        <div className="modal-overlay" onClick={() => setIsAiHistoryOpen(false)}>
          <div
            className="modal-box"
            style={{ width: '480px', maxWidth: '92vw', padding: 0, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: '1rem 1.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>기획 코칭 대화 기록</h3>
                {activeBook?.title && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                    {activeBook.title}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAiHistoryOpen(false)}
                title="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ background: 'var(--bg-card)', padding: '1.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {aiHistorySessions.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
                  <Clock size={36} style={{ color: 'var(--text-dim)', opacity: 0.35, marginBottom: '0.85rem' }} />
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>
                    아직 보관된 기획 대화가 없습니다.
                  </p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    새로고침(새 대화 시작) 버튼을 누르면 이전 대화가 자동으로 보관됩니다.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {aiHistorySessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => handleRestoreAiSession(sess)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    >
                      <div style={{ minWidth: 0, flex: 1, marginRight: '10px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sess.title}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {new Date(sess.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • 메시지 {sess.messageCount}개
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAiSession(sess.id, e)}
                        title="기록 삭제"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ModelQuotasModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />

    </div>
  );
}
