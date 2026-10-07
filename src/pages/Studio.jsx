import React, { useState, useEffect, useRef } from 'react';
import './Studio.css';
import { useStore } from '../store';
import { bookService } from '../services/bookService';
import { marked } from 'marked';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { htmlToParagraphs, paragraphsToHtml, generateBlockId } from '../utils/paragraphParser';
import bestsellerDb from '../data/bestseller-db.json';
import { storageService } from '../services/storageService';
import {
  ArrowLeft, Plus, Sparkles, Download, Save, Lightbulb, Copy, Check, Wand2, X, FileText, Calendar, Send,
  PenTool, Bot, Zap, RotateCcw, FilePlus, Layers, MoveUp, MoveDown, Trash2, LayoutList, AlertTriangle
} from 'lucide-react';

marked.setOptions({ breaks: true, gfm: true });

export default function Studio() {
  const {
    activeBook, activeChapterId, activeSectionId,
    setActiveChapterId, setActiveSectionId,
    updateActiveSectionContent, updateActiveSectionTitle, saveActiveSection,
    addChapter, updateChapterTitle, deleteChapter, addSection, deleteSection, openBook, loadBooks,
    setChapterDeadline, toggleChapterPublish,
    vault, loadVault, selectedVaultIds, toggleSelectVaultId, clearSelectedVaultIds,
    setView, showToast, showActionToast
  } = useStore();

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

  // Mission 스타일 Tiptap 에디터 인스턴스
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: '전자책에 수록할 본문 내용을 자유롭게 작성해 보세요. 상단 툴바를 활용하여 풍부한 서식 편집이 가능하며, 특정 문장을 드래그하여 우측 AI 교정기로 즉시 퇴고할 수 있습니다.'
      })
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setLocalContent(html);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateActiveSectionContent(html);
      }, 300);
    }
  });

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

  // 활성 섹션 변경 시 Tiptap 본문 및 문단 블록 동기화
  useEffect(() => {
    if (currentSection) {
      setLocalTitle(currentSection.title || '');
      const content = currentSection.content || '';
      setLocalContent(content);
      if (editor && editor.getHTML() !== content) {
        editor.commands.setContent(content);
      }
      setParagraphs(htmlToParagraphs(content));
    } else {
      setLocalTitle('');
      setLocalContent('');
      if (editor) {
        editor.commands.setContent('');
      }
      setParagraphs([]);
    }
  }, [currentSection?.id, editor]);

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

  // 문단 내용 수정
  const handleParagraphChange = (id, newText) => {
    setParagraphs((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            text: newText,
            html: `<p>${newText}</p>`
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

  // 내보내기 텍스트 생성
  const getExportText = () => {
    if (exportFormat === 'md') {
      let md = `# ${activeBook.title}\n\n`;
      if (activeBook.subtitle) md += `> ${activeBook.subtitle}\n\n`;
      activeBook.chapters?.forEach((c, cI) => {
        md += `## 제 ${cI + 1}장. ${c.title}\n\n`;
        c.sections?.forEach((s, sI) => {
          md += `### ${cI + 1}.${sI + 1} ${s.title}\n\n${s.content || ''}\n\n`;
        });
      });
      return md;
    }
    let txt = `[${activeBook.title}]\n\n`;
    activeBook.chapters?.forEach((c, cI) => {
      txt += `[제 ${cI + 1}장. ${c.title}]\n\n`;
      c.sections?.forEach((s, sI) => {
        txt += `(${cI + 1}.${sI + 1} ${s.title})\n${s.content || ''}\n\n`;
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
          <div className="toc-book-title" title={activeBook.title}>{activeBook.title}</div>
          <div className="toc-actions">
            <button className="btn btn-secondary" onClick={() => {
              const t = window.prompt('추가할 챕터명:');
              if (t?.trim()) addChapter(t.trim());
            }}>
              <Plus size={13} />
              <span>챕터 추가</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setIsOutlineModalOpen(true)}>
              <Sparkles size={13} />
              <span>목차 기획</span>
            </button>
            <button className="btn btn-primary btn-full" onClick={() => setIsExportModalOpen(true)}>
              <Download size={13} />
              <span>전자책 내보내기</span>
            </button>
          </div>
        </div>

        <div className="toc-list">
          {activeBook.chapters?.map((chap, cIdx) => (
            <div key={chap.id || cIdx} className="chapter-group">
              <div className="chapter-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', flex: 1 }}>
                  {editingChapterId === chap.id ? (
                    <input
                      type="text"
                      className="chapter-inline-edit-input"
                      value={editingChapterTitle}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingChapterTitle(e.target.value)}
                      onBlur={() => {
                        if (editingChapterTitle.trim() && editingChapterTitle.trim() !== chap.title) {
                          updateChapterTitle(chap.id, editingChapterTitle.trim());
                        }
                        setEditingChapterId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingChapterTitle.trim() && editingChapterTitle.trim() !== chap.title) {
                            updateChapterTitle(chap.id, editingChapterTitle.trim());
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
                        setEditingChapterTitle(chap.title);
                      }}
                    >
                      {cIdx + 1}장. {chap.title}
                    </span>
                  )}
                  <span className={`chapter-badge-mini ${chap.status === 'published' ? 'published' : 'draft'}`}>
                    {chap.status === 'published' ? '연재중' : '초고'}
                  </span>
                </div>
                <div className="chapter-header-actions">
                  <button
                    className="btn-add-section"
                    onClick={() => {
                      const t = window.prompt('추가할 소목차명:');
                      if (t?.trim()) addSection(chap.id, t.trim());
                    }}
                    title="소목차 추가"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    className="btn-delete-chapter"
                    onClick={() => {
                      if (window.confirm(`'${chap.title}' 챕터를 삭제하시겠습니까?\n포함된 모든 소목차와 본문도 함께 삭제됩니다.`)) {
                        deleteChapter(chap.id);
                      }
                    }}
                    title="챕터 삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="section-list">
                {chap.sections?.map((sec, sIdx) => {
                  const isActive = chap.id === activeChapterId && sec.id === activeSectionId;
                  const rawText = (sec.content || '').replace(/<[^>]*>/g, '').trim();
                  const isDone = rawText.length > 0;
                  return (
                    <div
                      key={sec.id || sIdx}
                      className={`section-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveChapterId(chap.id);
                        setActiveSectionId(sec.id);
                      }}
                    >
                      <span className="section-item-title">{cIdx + 1}.{sIdx + 1} {sec.title}</span>
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
                            if (window.confirm(`'${sec.title}' 소목차를 삭제하시겠습니까?\n작성된 원고 내용도 함께 삭제됩니다.`)) {
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
            </div>
          ))}
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
                  value={currentChapter.title}
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
            <button className="btn btn-secondary" onClick={handleSave} disabled={isSaving}>
              <Save size={15} />
              <span>{isSaving ? '저장 중...' : '저장'}</span>
            </button>
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

          <button
            className="btn-html-preview-popup"
            onClick={() => setIsPreviewModalOpen(true)}
            title="작성 중인 원고의 완성된 전자책 스타일 뷰를 팝업으로 봅니다"
          >
            <span className="preview-eye-icon">👁</span> HTML 미리보기 팝업
          </button>
        </div>

        <div className="editor-body-split">
          <div className="main-textarea-pane">
            {editorMode === 'doc' ? (
              <>
                {/* Mission 스타일 Tiptap 리치 서식 툴바 */}
                {editor && (
                  <div className="rich-toolbar">
                    <div className="toolbar-group">
                      <select
                        className="toolbar-select"
                        value={
                          editor.isActive('heading', { level: 1 }) ? 'h1' :
                          editor.isActive('heading', { level: 2 }) ? 'h2' :
                          editor.isActive('heading', { level: 3 }) ? 'h3' :
                          editor.isActive('blockquote') ? 'blockquote' : 'p'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                          else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                          else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                          else if (val === 'blockquote') editor.chain().focus().toggleBlockquote().run();
                          else editor.chain().focus().setParagraph().run();
                        }}
                        title="단락 서식"
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
                        className={`tool-btn ${editor.isActive('bold') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="굵게 (Ctrl+B)"
                      >
                        <b>B</b>
                      </button>
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('italic') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="기울임 (Ctrl+I)"
                      >
                        <i>I</i>
                      </button>
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('underline') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        title="밑줄 (Ctrl+U)"
                      >
                        <u>U</u>
                      </button>
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('strike') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        title="취소선"
                      >
                        <s>S</s>
                      </button>
                    </div>

                    <div className="toolbar-divider" />

                    <div className="toolbar-group">
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="글머리 기호 목록"
                      >
                        •≡
                      </button>
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="번호 매기기 목록"
                      >
                        1≡
                      </button>
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="인용 블록"
                      >
                        ❞
                      </button>
                      <button
                        type="button"
                        className={`tool-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        title="코드 블록"
                      >
                        &lt;/&gt;
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                        title="서식 지우기"
                      >
                        T<sub>x</sub>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mission 스타일 Tiptap 뷰포트 (하얗고 깔끔한 화이트 시트) */}
                <div className="rich-editor-viewport">
                  <div className="rich-editor-body">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </>
            ) : (
              /* 문단 모듈 워크스페이스 */
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

            {activeAiTab === 'draft' ? (
              /* --- 1. AI 초고 집필 에이전트 뷰 --- */
              <div className="draft-agent-view">
                <div className="polish-header">
                  <div className="polish-header-title">
                    <Bot size={16} color="var(--primary)" />
                    <span>AI 초고 집필 에이전트</span>
                  </div>
                  <span className="polish-header-sub">
                    {currentChapter ? `📍 ${currentChapter.title} > ${localTitle || currentSection?.title || '소목차'}` : '키워드와 지시어로 소목차 본문을 완성합니다.'}
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

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleRunDraftAgent}
                    disabled={isDrafting}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  >
                    <Zap size={14} />
                    <span>{isDrafting ? '초고 에이전트 집필 중...' : '⚡ AI 초고 작성 시작'}</span>
                  </button>
                </div>

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
          </aside>
        </div>
      </main>

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
    </div>
  );
}
