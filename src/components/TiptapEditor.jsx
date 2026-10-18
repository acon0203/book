import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent as IndentIcon,
  Outdent as OutdentIcon,
  Palette,
  Highlighter,
  Check
} from 'lucide-react';
import { TextColor, Highlight, TextAlign, Indent, LineHeight } from './tiptapExtensions';
import './TiptapEditor.css';

/**
 * TiptapEditor - 연재서재 공통 리치 텍스트 에디터 컴포넌트
 *
 * @param {string} content - 초기 및 현재 본문 HTML
 * @param {function} onChange - 내용 변경 시 호출되는 콜백 (html) => void
 * @param {string} placeholder - 비어 있을 때 표시할 가이드 문구
 * @param {function} onSelectText - 텍스트 드래그 선택 시 호출되는 콜백 (selectedText) => void
 * @param {boolean} editable - 편집 가능 여부 (기본: true)
 * @param {boolean} showToolbar - 상단 서식 툴바 표시 여부 (기본: true)
 * @param {React.ReactNode} extraToolbarItems - 툴바 우측에 추가할 사용자 정의 요소 (예: 활성 블록 정보 등)
 * @param {number} chapterIndex - 현재 챕터 인덱스
 * @param {number} sectionIndex - 현재 소목차 인덱스
 * @param {string} sectionTitle - 현재 소목차 제목
 * @param {function} onUpdateSectionTitle - 소목차 제목 수정 콜백 (newTitle) => void
 */
const TiptapEditor = forwardRef(function TiptapEditor(
  {
    content = '',
    onChange,
    placeholder = '전자책에 수록할 본문 내용을 자유롭게 작성해 보세요. 상단 툴바를 활용하여 풍부한 서식 편집이 가능하며, 특정 문장을 드래그하여 AI 교정기로 즉시 퇴고할 수 있습니다.',
    onSelectText,
    editable = true,
    showToolbar = true,
    extraToolbarItems = null,
    chapterIndex = 0,
    sectionIndex = 0,
    sectionTitle = '',
    onUpdateSectionTitle = null,
    className = ''
  },
  ref
) {
  const debounceRef = useRef(null);
  const lastHtmlRef = useRef(content || '');
  const [isEditingHeading, setIsEditingHeading] = useState(false);
  const [tempHeading, setTempHeading] = useState('');

  // 툴바 팝오버 상태
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const colorPickerRef = useRef(null);
  const highlightPickerRef = useRef(null);

  // 실시간 글자수 상태
  const [liveCharCount, setLiveCharCount] = useState(0);

  // 커서 이동 및 텍스트 선택 시 툴바 활성 상태(bold, heading 등) 실시간 연동을 위한 틱 상태
  const [, setSelectionTick] = useState(0);

  // 팝오버 외부 클릭 감지
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setIsColorPickerOpen(false);
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target)) {
        setIsHighlightPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // extensions 배열 (StarterKit + 글자색 + 형광펜 + 정렬 + 들여쓰기 + 줄간격)
  const extensions = React.useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),
    Placeholder.configure({
      placeholder
    }),
    TextColor,
    Highlight,
    TextAlign,
    Indent,
    LineHeight
  ], [placeholder]);

  const editor = useEditor(
    {
      editable,
      extensions,
      content: content || '',
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        lastHtmlRef.current = html;
        setLiveCharCount(editor.getText().length);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (onChange) onChange(html);
        }, 300);
      },
      onSelectionUpdate: ({ editor }) => {
        setSelectionTick(t => t + 1);
        if (onSelectText) {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, ' ').trim();
          onSelectText(text);
        }
      },
      onTransaction: () => {
        setSelectionTick(t => t + 1);
      }
    },
    []
  );

  // 외부에서 content prop이 바뀔 때 (다른 섹션 선택 등)만 안전하게 동기화
  useEffect(() => {
    if (!editor) return;
    if (content !== lastHtmlRef.current && content !== editor.getHTML()) {
      lastHtmlRef.current = content || '';
      editor.commands.setContent(content || '');
      setLiveCharCount(editor.getText().length);
    }
  }, [content, editor]);

  // 부모 컴포넌트에서 에디터 조작 명령을 직접 실행할 수 있도록 ref 노출
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    getHTML: () => editor?.getHTML() || '',
    getText: () => editor?.getText() || '',
    isEmpty: () => editor?.isEmpty ?? true,
    isFocused: () => editor?.isFocused ?? false,
    setContent: (newContent) => {
      if (editor) editor.commands.setContent(newContent || '');
    },
    insertContent: (insertHtml) => {
      if (editor) editor.chain().focus().insertContent(insertHtml).run();
    },
    focus: () => {
      if (editor) editor.commands.focus();
    },
    getSelectedText: () => {
      if (!editor) return '';
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, ' ').trim();
    },
    // 본문 검색 및 치환 헬퍼 (Ctrl+F 연동)
    findMatches: (query) => {
      if (!editor || !query) return [];
      const matches = [];
      const qLower = query.toLowerCase();
      editor.state.doc.descendants((node, pos) => {
        if (node.isText) {
          const text = node.text;
          const textLower = text.toLowerCase();
          let idx = textLower.indexOf(qLower);
          while (idx !== -1) {
            matches.push({ from: pos + idx, to: pos + idx + query.length, text: text.substr(idx, query.length) });
            idx = textLower.indexOf(qLower, idx + 1);
          }
        }
      });
      return matches;
    },
    selectMatch: (from, to) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();
    },
    replaceCurrent: (from, to, replaceText) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).insertContent(replaceText).run();
    },
    replaceAll: (query, replaceText) => {
      if (!editor || !query) return 0;
      let count = 0;
      const qLower = query.toLowerCase();
      const matches = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.isText) {
          const text = node.text;
          const textLower = text.toLowerCase();
          let idx = textLower.indexOf(qLower);
          while (idx !== -1) {
            matches.push({ from: pos + idx, to: pos + idx + query.length });
            idx = textLower.indexOf(qLower, idx + 1);
            count++;
          }
        }
      });
      // 뒤에서부터 치환하여 위치 어긋남 방지
      if (matches.length > 0) {
        editor.chain().focus();
        for (let i = matches.length - 1; i >= 0; i--) {
          editor.commands.setTextSelection({ from: matches[i].from, to: matches[i].to });
          editor.commands.insertContent(replaceText);
        }
      }
      return count;
    }
  }));

  // 현재 단락 서식 값 계산 (p, h1, h2, h3, blockquote)
  const currentHeadingValue = editor?.isActive('heading', { level: 1 })
    ? 'h1'
    : editor?.isActive('heading', { level: 2 })
    ? 'h2'
    : editor?.isActive('heading', { level: 3 })
    ? 'h3'
    : editor?.isActive('blockquote')
    ? 'blockquote'
    : 'p';

  return (
    <div className={`tiptap-editor-container ${className}`}>
      {/* 상단 서식 툴바 */}
      {showToolbar && (
        <div className="rich-toolbar">
          {/* 실행취소 & 다시실행 */}
          <div className="toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              title="실행 취소 (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              title="다시 실행 (Ctrl+Y / Ctrl+Shift+Z)"
            >
              ↷
            </button>
          </div>

          <div className="toolbar-divider" />
          {/* 단락 서식 선택 (H1, H2, H3, 인용문, 본문) */}
          <div className="toolbar-group">
            <select
              className="toolbar-select"
              value={currentHeadingValue}
              onChange={(e) => {
                const val = e.target.value;
                if (!editor) return;
                const isBlockquote = editor.isActive('blockquote');

                if (val === 'blockquote') {
                  if (!isBlockquote) {
                    editor.chain().focus().clearNodes().toggleBlockquote().run();
                  }
                } else if (val === 'h1' || val === 'h2' || val === 'h3') {
                  const level = val === 'h1' ? 1 : val === 'h2' ? 2 : 3;
                  if (isBlockquote) {
                    editor.chain().focus().toggleBlockquote().clearNodes().toggleHeading({ level }).run();
                  } else {
                    editor.chain().focus().clearNodes().toggleHeading({ level }).run();
                  }
                } else {
                  // 'p' (본문) 선택 시: 인용구 해제 및 일반 문단 복귀
                  if (isBlockquote) {
                    editor.chain().focus().toggleBlockquote().run();
                  } else {
                    editor.chain().focus().clearNodes().setParagraph().run();
                  }
                }
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

          {/* 인라인 서식 (굵게, 기울임, 밑줄, 취소선) */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              title="굵게 (Ctrl+B)"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              title="기울임 (Ctrl+I)"
            >
              <i>/</i>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('underline') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              title="밑줄 (Ctrl+U)"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              title="취소선"
            >
              <s>S</s>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* 블록 서식 (목록, 인용구, 코드블록, 서식 지우기) */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              title="글머리 기호 목록"
            >
              •≡
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              title="번호 매기기 목록"
            >
              1≡
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              title="인용 블록"
            >
              ❞
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              title="코드 블록"
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              title="서식 지우기"
            >
              T<sub>x</sub>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* 문단 정렬 (좌측, 가운데, 우측, 양쪽 정렬) */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
              title="왼쪽 정렬"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
              title="가운데 정렬"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('right').run()}
              title="오른쪽 정렬"
            >
              <AlignRight size={14} />
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
              title="양쪽 맞춤"
            >
              <AlignJustify size={14} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* 들여쓰기 / 내어쓰기 */}
          <div className="toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().outdent().run()}
              title="내어쓰기 (Shift+Tab)"
            >
              <OutdentIcon size={14} />
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().indent().run()}
              title="들여쓰기 (Tab)"
            >
              <IndentIcon size={14} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* 글자 색상 & 형광펜 하이라이트 (미니 팝오버 팔레트) */}
          <div className="toolbar-group">
            {/* 글자 색상 팔레트 */}
            <div className="toolbar-popover-wrap" ref={colorPickerRef}>
              <button
                type="button"
                className={`tool-btn ${isColorPickerOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsColorPickerOpen((prev) => !prev);
                  setIsHighlightPickerOpen(false);
                }}
                title="글자 색상"
              >
                <Palette size={14} />
              </button>
              {isColorPickerOpen && (
                <div className="toolbar-palette-popover">
                  {[
                    { label: '기본 먹색', color: 'inherit', bg: '#2b231d' },
                    { label: '챠콜', color: '#1f2937', bg: '#1f2937' },
                    { label: '고서적 브라운', color: '#8b5a2b', bg: '#8b5a2b' },
                    { label: '와인 버건디', color: '#991b1b', bg: '#991b1b' },
                    { label: '번트 오렌지', color: '#c2410c', bg: '#c2410c' },
                    { label: '딥 포레스트', color: '#15803d', bg: '#15803d' },
                    { label: '네이비 블루', color: '#1d4ed8', bg: '#1d4ed8' },
                    { label: '로열 퍼플', color: '#6b21a8', bg: '#6b21a8' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      className="palette-color-btn"
                      style={{ backgroundColor: item.bg }}
                      title={item.label}
                      onClick={() => {
                        if (item.color === 'inherit') {
                          editor?.chain().focus().unsetTextColor().run();
                        } else {
                          editor?.chain().focus().setTextColor(item.color).run();
                        }
                        setIsColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 형광펜 하이라이트 팔레트 */}
            <div className="toolbar-popover-wrap" ref={highlightPickerRef}>
              <button
                type="button"
                className={`tool-btn ${isHighlightPickerOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsHighlightPickerOpen((prev) => !prev);
                  setIsColorPickerOpen(false);
                }}
                title="형광펜 하이라이트"
              >
                <Highlighter size={14} />
              </button>
              {isHighlightPickerOpen && (
                <div className="toolbar-palette-popover">
                  {[
                    { label: '하이라이트 해제', color: null, bg: '#ffffff' },
                    { label: '레몬 옐로우', color: '#fef08a', bg: '#fef08a' },
                    { label: '페일 민트', color: '#bbf7d0', bg: '#bbf7d0' },
                    { label: '스카이 블루', color: '#bae6fd', bg: '#bae6fd' },
                    { label: '소프트 라벤더', color: '#e9d5ff', bg: '#e9d5ff' },
                    { label: '피치 로즈', color: '#fecdd3', bg: '#fecdd3' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="palette-color-btn"
                      style={{ backgroundColor: item.bg }}
                      title={item.label}
                      onClick={() => {
                        if (!item.color) {
                          editor?.chain().focus().unsetHighlight().run();
                        } else {
                          editor?.chain().focus().setHighlight(item.color).run();
                        }
                        setIsHighlightPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="toolbar-divider" />

          {/* 줄 간격 (행간 조절) */}
          <div className="toolbar-group">
            <select
              className="toolbar-select"
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'normal') {
                  editor?.chain().focus().unsetLineHeight().run();
                } else {
                  editor?.chain().focus().setLineHeight(val).run();
                }
              }}
              defaultValue="normal"
              title="줄 간격 (행간)"
            >
              <option value="normal">행간: 표준</option>
              <option value="1.4">행간: 140%</option>
              <option value="1.6">행간: 160%</option>
              <option value="1.8">행간: 180%</option>
              <option value="2.0">행간: 200%</option>
            </select>
          </div>

          {extraToolbarItems}
        </div>
      )}

      {/* 본문 에디터 뷰포트 (화이트 시트) */}
      <div className="rich-editor-viewport">
        <div className="rich-editor-body">
          {sectionTitle !== undefined && sectionTitle !== '' && (
            <div className="editor-doc-header">
              <div className="v4-sec-caption">
                CHAPTER {String((chapterIndex ?? 0) + 1).padStart(2, '0')} · SECTION {String((sectionIndex ?? 0) + 1).padStart(2, '0')}
              </div>
              {isEditingHeading ? (
                <input
                  type="text"
                  className="v4-heading-input"
                  value={tempHeading}
                  autoFocus
                  onChange={(e) => setTempHeading(e.target.value)}
                  onBlur={() => {
                    const trimmed = tempHeading.trim();
                    if (trimmed && trimmed !== sectionTitle) {
                      onUpdateSectionTitle?.(trimmed);
                    }
                    setIsEditingHeading(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = tempHeading.trim();
                      if (trimmed && trimmed !== sectionTitle) {
                        onUpdateSectionTitle?.(trimmed);
                      }
                      setIsEditingHeading(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingHeading(false);
                    }
                  }}
                />
              ) : (
                <h1
                  className="v4-heading-title"
                  title="더블클릭하여 소제목 수정"
                  onDoubleClick={() => {
                    setTempHeading(sectionTitle);
                    setIsEditingHeading(true);
                  }}
                >
                  {(chapterIndex ?? 0) + 1}.{(sectionIndex ?? 0) + 1} {sectionTitle}
                </h1>
              )}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* 하단 에디터 상태 바: 공백 포함 글자수 & 원고지 환산 매수 표기 */}
      <div className="editor-status-bar">
        <div className="status-bar-left">
          <div className="status-stat-item">
            <span>공백 포함</span>
            <span className="status-stat-strong">{liveCharCount.toLocaleString()}자</span>
          </div>
          <div className="status-manuscript-badge">
            <span>원고지 약 {(liveCharCount / 200).toFixed(1)}매</span>
          </div>
        </div>
        <div className="status-bar-right">
          <span>단축키: Ctrl+F 검색 · Ctrl+H 찾아바꾸기</span>
        </div>
      </div>
    </div>
  );
});

export default TiptapEditor;
