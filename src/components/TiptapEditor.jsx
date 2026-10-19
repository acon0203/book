import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent as IndentIcon,
  Outdent as OutdentIcon,
  PaintBucket,
  Highlighter,
  ChevronDown,
  MoreHorizontal,
  Table as TableIcon,
  Minus,
  Code,
  Omega,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  Merge,
  Split
} from 'lucide-react';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import { TextColor, Highlight, Indent, LineHeight, FontFamily, BackgroundColor, CustomBlockquote } from './tiptapExtensions';
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
  const [isBgColorPickerOpen, setIsBgColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const [isSpecialCharOpen, setIsSpecialCharOpen] = useState(false);
  const [isQuoteDropdownOpen, setIsQuoteDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableHoverSize, setTableHoverSize] = useState({ rows: 1, cols: 1 });

  // 문단 첫 글자 1칸 띄기 (소설/도서 표준 text-indent)
  const [isFirstLineIndent, setIsFirstLineIndent] = useState(() => {
    return localStorage.getItem('book_first_line_indent') === 'true';
  });

  const colorPickerRef = useRef(null);
  const bgColorPickerRef = useRef(null);
  const highlightPickerRef = useRef(null);
  const specialCharRef = useRef(null);
  const quoteDropdownRef = useRef(null);
  const moreMenuRef = useRef(null);
  const tablePickerRef = useRef(null);

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
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(e.target)) {
        setIsBgColorPickerOpen(false);
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target)) {
        setIsHighlightPickerOpen(false);
      }
      if (specialCharRef.current && !specialCharRef.current.contains(e.target)) {
        setIsSpecialCharOpen(false);
      }
      if (quoteDropdownRef.current && !quoteDropdownRef.current.contains(e.target)) {
        setIsQuoteDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target)) {
        setIsTablePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const closeOtherPopovers = (except) => {
    if (except !== 'color') setIsColorPickerOpen(false);
    if (except !== 'bg') setIsBgColorPickerOpen(false);
    if (except !== 'highlight') setIsHighlightPickerOpen(false);
    if (except !== 'special') setIsSpecialCharOpen(false);
    if (except !== 'quote') setIsQuoteDropdownOpen(false);
    if (except !== 'more') setIsMoreMenuOpen(false);
    if (except !== 'table') setIsTablePickerOpen(false);
  };

  // extensions 배열 (StarterKit + 커스텀 인용구 + 글자색 + 배경색 + 글자체 + 형광펜 + 정렬 + 들여쓰기 + 줄간격)
  const extensions = React.useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      },
      blockquote: false
    }),
    CustomBlockquote,
    Placeholder.configure({
      placeholder
    }),
    TextColor,
    BackgroundColor,
    FontFamily,
    Highlight,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'left',
    }),
    Indent,
    LineHeight,
    TableKit.configure({
      table: {
        resizable: false,
      },
    }),
  ], [placeholder]);

  const editor = useEditor(
    {
      editable,
      extensions,
      content: content || '',
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        if (html === lastHtmlRef.current) return;
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
      editor.commands.setContent(content || '', { emitUpdate: false });
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
    setContent: (newContent, options = { emitUpdate: false }) => {
      if (editor) {
        lastHtmlRef.current = newContent || '';
        editor.commands.setContent(newContent || '', options);
      }
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

  // 1. 글자체 목록 (사용자 지정 표준 8대 무료 서체)
  const fontFamilies = [
    { label: '기본 서체 (시스템 기본)', value: 'inherit' },
    { label: '맑은 고딕 (Malgun Gothic)', value: '"Malgun Gothic", sans-serif' },
    { label: '바탕체 (Batang)', value: '"Batang", "BatangChe", serif' },
    { label: '돋움체 (Dotum)', value: '"Dotum", "DotumChe", sans-serif' },
    { label: '굴림체 (Gulim)', value: '"Gulim", "GulimChe", sans-serif' },
    { label: '궁서체 (Gungsuh)', value: '"Gungsuh", "GungsuhChe", serif' },
    { label: '나눔명조 (출판 명조)', value: '"Nanum Myeongjo", serif' },
    { label: '나눔고딕 (출판 고딕)', value: '"Nanum Gothic", sans-serif' },
  ];

  // 2. 제목 순환 H 버튼 (본문 ➔ 소제목 H3 ➔ 중제목 H2 ➔ 대제목 H1 ➔ 본문)
  const currentHeadingLevel = editor?.isActive('heading', { level: 3 })
    ? 3
    : editor?.isActive('heading', { level: 2 })
    ? 2
    : editor?.isActive('heading', { level: 1 })
    ? 1
    : 0;

  const handleHeadingCycle = () => {
    if (!editor) return;
    const isBlockquote = editor.isActive('blockquote');
    if (isBlockquote) {
      editor.chain().focus().toggleBlockquote().run();
    }
    if (currentHeadingLevel === 0) {
      editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run();
    } else if (currentHeadingLevel === 3) {
      editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run();
    } else if (currentHeadingLevel === 2) {
      editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run();
    } else {
      editor.chain().focus().clearNodes().setParagraph().run();
    }
  };

  // 3. 정렬 순환 (좌 ➔ 가운데 ➔ 우 ➔ 양쪽 ➔ 좌)
  const currentAlign = editor?.isActive({ textAlign: 'center' })
    ? 'center'
    : editor?.isActive({ textAlign: 'right' })
    ? 'right'
    : editor?.isActive({ textAlign: 'justify' })
    ? 'justify'
    : 'left';

  const handleAlignCycle = () => {
    if (!editor) return;
    const alignOrder = {
      left: 'center',
      center: 'right',
      right: 'justify',
      justify: 'left',
    };
    const next = alignOrder[currentAlign] || 'left';
    if (next === 'left') {
      editor.chain().focus().unsetTextAlign().run();
    } else {
      editor.chain().focus().setTextAlign(next).run();
    }
  };

  // 4. 목록 순환 (글머리 기호 ➔ 번호 매기기 ➔ 해제)
  const isBulletList = editor?.isActive('bulletList');
  const isOrderedList = editor?.isActive('orderedList');

  const handleListCycle = () => {
    if (!editor) return;
    if (isBulletList) {
      editor.chain().focus().toggleOrderedList().run();
    } else if (isOrderedList) {
      editor.chain().focus().toggleOrderedList().run();
    } else {
      editor.chain().focus().toggleBulletList().run();
    }
  };

  // 5. 들여쓰기 / 내어쓰기 (mission 앱 방식: 목록일 때 기호 수준 한단계 조절)
  const handleIndent = () => {
    if (!editor) return;
    if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
      const ok = editor.chain().focus().sinkListItem('listItem').run();
      if (!ok && editor.view) {
        const { state, dispatch } = editor.view;
        if (state.schema.nodes.listItem) {
          sinkListItem(state.schema.nodes.listItem)(state, dispatch);
        }
      }
    } else {
      editor.chain().focus().indent().run();
    }
  };

  const handleOutdent = () => {
    if (!editor) return;
    if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
      const ok = editor.chain().focus().liftListItem('listItem').run();
      if (!ok && editor.view) {
        const { state, dispatch } = editor.view;
        if (state.schema.nodes.listItem) {
          liftListItem(state.schema.nodes.listItem)(state, dispatch);
        }
      }
    } else {
      editor.chain().focus().outdent().run();
    }
  };

  // 6. 특수문자 삽입
  const handleInsertChar = (char) => {
    if (!editor) return;
    editor.chain().focus().insertContent(char).run();
    setIsSpecialCharOpen(false);
  };

  // 7. 인용문 스타일 적용 (더미 텍스트 삽입 없이 깔끔하게 토글 & 스타일 즉시 전환)
  const handleApplyQuote = (styleType = 'classic') => {
    if (!editor) return;
    const isBlockquote = editor.isActive('blockquote');
    const currentStyle = editor.getAttributes('blockquote')?.quoteStyle || 'classic';

    if (isBlockquote) {
      if (currentStyle === styleType) {
        // 동일 스타일 한 번 더 클릭 시 인용구 해제 (순수 일반 문단으로 복귀)
        editor.chain().focus().toggleBlockquote().run();
      } else {
        // 다른 스타일 선택 시 인용문 스타일 즉시 전환
        editor.chain().focus().setQuoteStyle(styleType).run();
      }
    } else {
      // 신규 인용구 적용 (현재 문단 또는 선택 영역을 해당 스타일 인용구로 wrap)
      editor.chain().focus().toggleBlockquote({ quoteStyle: styleType }).run();
    }
    setIsQuoteDropdownOpen(false);
  };

  // 8. 인터랙티브 격자 선택 기반 테이블 생성 (기본은 헤더 없는 순수 일반 표 생성)
  const handleCreateTable = (rows, cols) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
    setIsTablePickerOpen(false);
  };

  // 글자색 인디케이터용 현재 색상 추출
  const currentTextColor = editor?.getAttributes('textColor')?.color || '#2b231d';

  return (
    <div className={`tiptap-editor-container ${className}`}>
      {/* 상단 서식 툴바 */}
      {showToolbar && (
        <div className="rich-toolbar">
          {/* 그룹 1: 글자체 & 제목 순환 */}
          <div className="toolbar-group">
            <select
              className="toolbar-select font-select"
              onChange={(e) => {
                const val = e.target.value;
                if (!editor) return;
                if (val === 'inherit') {
                  editor.chain().focus().unsetFontFamily().run();
                } else {
                  editor.chain().focus().setFontFamily(val).run();
                }
              }}
              defaultValue="inherit"
              title="글자체 (서체 변경)"
            >
              {fontFamilies.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`tool-btn heading-cycle-btn ${currentHeadingLevel > 0 ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleHeadingCycle}
              title={
                currentHeadingLevel === 3
                  ? '현재: 소제목(H3) ➔ 클릭 시 중제목(H2) 변경'
                  : currentHeadingLevel === 2
                  ? '현재: 중제목(H2) ➔ 클릭 시 대제목(H1) 변경'
                  : currentHeadingLevel === 1
                  ? '현재: 대제목(H1) ➔ 클릭 시 본문(P) 변경'
                  : '현재: 본문(P) ➔ 클릭 시 소제목(H3) 변경'
              }
            >
              <span className="heading-h-letter">H</span>
              {currentHeadingLevel > 0 && (
                <span className="heading-sub-badge">{currentHeadingLevel}</span>
              )}
            </button>
          </div>

          {/* 1번 구분선 */}
          <div className="toolbar-divider" />

          {/* 그룹 2: 볼드~취소선 & 글자색 & 배경색 & 형광펜 */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('bold') ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              title="굵게 (Ctrl+B)"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('italic') ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              title="기울임 (Ctrl+I)"
            >
              <i>/</i>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('underline') ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              title="밑줄 (Ctrl+U)"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('strike') ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              title="취소선"
            >
              <s>S</s>
            </button>

            {/* 글자색 (표준 A 밑줄 바 아이콘) */}
            <div className="toolbar-popover-wrap" ref={colorPickerRef}>
              <button
                type="button"
                className={`tool-btn ${isColorPickerOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsColorPickerOpen((prev) => !prev);
                  closeOtherPopovers('color');
                }}
                title="글자 색상"
              >
                <div className="tool-font-color-icon">
                  <span className="font-color-letter">A</span>
                  <span
                    className="font-color-indicator"
                    style={{ backgroundColor: currentTextColor }}
                  />
                </div>
              </button>
              {isColorPickerOpen && (
                <div className="toolbar-palette-popover">
                  {[
                    { label: '검정', color: '#000000', bg: '#000000' },
                    { label: '챠콜 회색', color: '#374151', bg: '#374151' },
                    { label: '연회색', color: '#9ca3af', bg: '#9ca3af' },
                    { label: '흰색', color: '#ffffff', bg: '#ffffff', border: '1px solid #d1d5db' },
                    { label: '빨강', color: '#ef4444', bg: '#ef4444' },
                    { label: '주황', color: '#f97316', bg: '#f97316' },
                    { label: '노랑', color: '#eab308', bg: '#eab308' },
                    { label: '초록', color: '#16a34a', bg: '#16a34a' },
                    { label: '파랑', color: '#2563eb', bg: '#2563eb' },
                    { label: '보라', color: '#9333ea', bg: '#9333ea' },
                    { label: '가죽 브라운', color: '#8b5a2b', bg: '#8b5a2b' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      className="palette-color-btn"
                      style={{ backgroundColor: item.bg, border: item.border || undefined }}
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

            {/* 배경색 (페인트통 아이콘) */}
            <div className="toolbar-popover-wrap" ref={bgColorPickerRef}>
              <button
                type="button"
                className={`tool-btn ${isBgColorPickerOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsBgColorPickerOpen((prev) => !prev);
                  closeOtherPopovers('bg');
                }}
                title="글자 배경색 채우기"
              >
                <PaintBucket size={14} />
              </button>
              {isBgColorPickerOpen && (
                <div className="toolbar-palette-popover">
                  {[
                    { label: '배경색 없음', color: 'transparent', bg: '#ffffff', border: '1px dashed #d1d5db' },
                    { label: '순백색', color: '#ffffff', bg: '#ffffff', border: '1px solid #d1d5db' },
                    { label: '밝은 회색', color: '#f3f4f6', bg: '#f3f4f6' },
                    { label: '어두운 회색', color: '#374151', bg: '#374151' },
                    { label: '검정', color: '#000000', bg: '#000000' },
                    { label: '연한 빨강', color: '#fee2e2', bg: '#fee2e2' },
                    { label: '연한 주황', color: '#ffedd5', bg: '#ffedd5' },
                    { label: '연한 노랑', color: '#fef9c3', bg: '#fef9c3' },
                    { label: '연한 초록', color: '#dcfce7', bg: '#dcfce7' },
                    { label: '연한 파랑', color: '#e0f2fe', bg: '#e0f2fe' },
                    { label: '연한 보라', color: '#f3e8ff', bg: '#f3e8ff' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="palette-color-btn"
                      style={{ backgroundColor: item.bg, border: item.border || undefined }}
                      title={item.label}
                      onClick={() => {
                        if (item.color === 'transparent') {
                          editor?.chain().focus().unsetBackgroundColor().run();
                        } else {
                          editor?.chain().focus().setBackgroundColor(item.color).run();
                        }
                        setIsBgColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 형광펜 (Highlighter) */}
            <div className="toolbar-popover-wrap" ref={highlightPickerRef}>
              <button
                type="button"
                className={`tool-btn ${isHighlightPickerOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsHighlightPickerOpen((prev) => !prev);
                  closeOtherPopovers('highlight');
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

          {/* 2번 구분선 */}
          <div className="toolbar-divider" />

          {/* 그룹 3: 통합 정렬 & 통합 목록 & 들여쓰기/내어쓰기 */}
          <div className="toolbar-group">
            {/* 통합 정렬 버튼 (좌 ➔ 가운데 ➔ 우 ➔ 양쪽 순환) */}
            <button
              type="button"
              className={`tool-btn ${currentAlign !== 'left' ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAlignCycle}
              title={`현재 정렬: ${
                currentAlign === 'center'
                  ? '가운데 정렬 (클릭 시 우측 정렬)'
                  : currentAlign === 'right'
                  ? '우측 정렬 (클릭 시 양쪽 맞춤)'
                  : currentAlign === 'justify'
                  ? '양쪽 맞춤 (클릭 시 좌측 정렬)'
                  : '좌측 정렬 (클릭 시 가운데 정렬)'
              }`}
            >
              {currentAlign === 'center' ? (
                <AlignCenter size={14} />
              ) : currentAlign === 'right' ? (
                <AlignRight size={14} />
              ) : currentAlign === 'justify' ? (
                <AlignJustify size={14} />
              ) : (
                <AlignLeft size={14} />
              )}
            </button>

            {/* 통합 목록 버튼 (글머리 기호 ➔ 번호 매기기 ➔ 해제 순환) */}
            <button
              type="button"
              className={`tool-btn ${isBulletList || isOrderedList ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleListCycle}
              title={
                isBulletList
                  ? '글머리 기호 목록 (클릭 시 번호 매기기로 변경)'
                  : isOrderedList
                  ? '번호 매기기 목록 (클릭 시 목록 해제)'
                  : '목록 (클릭 시 글머리 기호 목록 생성)'
              }
            >
              {isOrderedList ? <ListOrdered size={14} /> : <List size={14} />}
            </button>

            {/* 들여쓰기 (순서 1위) */}
            <button
              type="button"
              className="tool-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleIndent}
              title="들여쓰기 / 하위 목록 레벨로 낮춤 (Tab)"
            >
              <IndentIcon size={14} />
            </button>

            {/* 내어쓰기 (순서 2위) */}
            <button
              type="button"
              className="tool-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOutdent}
              title="내어쓰기 / 상위 목록 레벨 복귀 (Shift+Tab)"
            >
              <OutdentIcon size={14} />
            </button>

            {/* 문단 첫 글자 1칸 띄기 (소설/도서 표준 text-indent 토글) */}
            <button
              type="button"
              className={`tool-btn first-line-indent-btn ${isFirstLineIndent ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setIsFirstLineIndent((prev) => {
                  const next = !prev;
                  localStorage.setItem('book_first_line_indent', String(next));
                  return next;
                });
              }}
              title={
                isFirstLineIndent
                  ? '문단 첫 글자 1칸 들여쓰기 ON (클릭 시 해제)'
                  : '문단 첫 글자 1칸 들여쓰기 OFF (클릭 시 소설·출판 1자 들여쓰기 적용)'
              }
            >
              <span className="first-line-icon-badge">↳첫자</span>
            </button>
          </div>

          {/* 3번 구분선 */}
          <div className="toolbar-divider" />

          {/* 그룹 4: 특수문자, 서식지우기, 인용블록(드롭다운), 구분선, 테이블(그리드 팝오버), 더보기 */}
          <div className="toolbar-group">
            {/* 특수문자 팝오버 */}
            <div className="toolbar-popover-wrap" ref={specialCharRef}>
              <button
                type="button"
                className={`tool-btn ${isSpecialCharOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsSpecialCharOpen((prev) => !prev);
                  closeOtherPopovers('special');
                }}
                title="특수문자 입력"
              >
                <Omega size={14} />
              </button>
              {isSpecialCharOpen && (
                <div className="toolbar-special-popover">
                  <div className="special-char-section">
                    <div className="special-char-title">문장 부호</div>
                    <div className="special-char-grid">
                      {['“', '”', '‘', '’', '…', '—', '–', '·', '※', 'ㆍ'].map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          className="special-char-btn"
                          onClick={() => handleInsertChar(ch)}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="special-char-section">
                    <div className="special-char-title">문학·출판 기호</div>
                    <div className="special-char-grid">
                      {['《', '》', '〈', '〉', '「', '」', '『', '』', '★', '☆'].map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          className="special-char-btn"
                          onClick={() => handleInsertChar(ch)}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="special-char-section">
                    <div className="special-char-title">도형 및 화살표</div>
                    <div className="special-char-grid">
                      {['●', '○', '■', '□', '◆', '◇', '→', '←', '↔', '⇒'].map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          className="special-char-btn"
                          onClick={() => handleInsertChar(ch)}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="special-char-section">
                    <div className="special-char-title">단위 및 수학</div>
                    <div className="special-char-grid">
                      {['℃', '㎡', '℉', '±', '×', '÷', '≠', '≒', '§', '¶'].map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          className="special-char-btn"
                          onClick={() => handleInsertChar(ch)}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 서식 지우기 */}
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              title="서식 지우기 (모든 인라인 서식 초기화)"
            >
              T<sub>x</sub>
            </button>

            {/* 인용블록 + 형식 선택 드롭다운 */}
            <div className="toolbar-split-btn-wrap" ref={quoteDropdownRef}>
              <button
                type="button"
                className={`tool-btn split-main-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
                onClick={() => handleApplyQuote('classic')}
                title="인용 블록 토글"
              >
                ❞
              </button>
              <button
                type="button"
                className={`tool-btn split-arrow-btn ${isQuoteDropdownOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsQuoteDropdownOpen((prev) => !prev);
                  closeOtherPopovers('quote');
                }}
                title="인용문 형식 선택"
              >
                <ChevronDown size={11} />
              </button>
              {isQuoteDropdownOpen && (
                <div className="toolbar-dropdown-menu">
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleApplyQuote('classic')}
                  >
                    <span className="quote-preview-tag classic">│</span>
                    <span>클래식 라인 인용구</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleApplyQuote('card')}
                  >
                    <span className="quote-preview-tag card">▢</span>
                    <span>서재 카드 박스 인용구</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleApplyQuote('editorial')}
                  >
                    <span className="quote-preview-tag editorial">“”</span>
                    <span>에디토리얼 명조 인용구</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleApplyQuote('dashed')}
                  >
                    <span className="quote-preview-tag dashed">╌</span>
                    <span>점선 메모 인용구</span>
                  </button>
                </div>
              )}
            </div>

            {/* 구분선 (Horizontal Rule) */}
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              title="가로 구분선 삽입"
            >
              <Minus size={14} />
            </button>

            {/* 테이블 만들기 (10x10 인터랙티브 그리드 팝오버) */}
            <div className="toolbar-popover-wrap" ref={tablePickerRef}>
              <button
                type="button"
                className={`tool-btn ${isTablePickerOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsTablePickerOpen((prev) => !prev);
                  closeOtherPopovers('table');
                }}
                title="테이블(표) 만들기"
              >
                <TableIcon size={14} />
              </button>
              {isTablePickerOpen && (
                <div className="toolbar-table-grid-popover">
                  <div className="table-grid-matrix">
                    {Array.from({ length: 10 }).map((_, rIdx) => (
                      <div key={rIdx} className="table-grid-row">
                        {Array.from({ length: 10 }).map((_, cIdx) => {
                          const r = rIdx + 1;
                          const c = cIdx + 1;
                          const isHighlighted =
                            r <= tableHoverSize.rows && c <= tableHoverSize.cols;
                          return (
                            <div
                              key={cIdx}
                              className={`table-grid-cell ${isHighlighted ? 'highlighted' : ''}`}
                              onMouseEnter={() =>
                                setTableHoverSize({ rows: r, cols: c })
                              }
                              onClick={() => handleCreateTable(r, c)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="table-grid-footer">
                    <span>
                      {tableHoverSize.rows} × {tableHoverSize.cols}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 더보기 (...) 팝오버: 코드블록 및 행간 등 추가 설정 */}
            <div className="toolbar-popover-wrap" ref={moreMenuRef}>
              <button
                type="button"
                className={`tool-btn ${isMoreMenuOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMoreMenuOpen((prev) => !prev);
                  closeOtherPopovers('more');
                }}
                title="더보기 (코드 블록, 행간 설정)"
              >
                <MoreHorizontal size={14} />
              </button>
              {isMoreMenuOpen && (
                <div className="toolbar-dropdown-menu more-menu-dropdown">
                  <div className="more-menu-header">블록 도구</div>
                  <button
                    type="button"
                    className={`dropdown-item ${editor?.isActive('codeBlock') ? 'active' : ''}`}
                    onClick={() => {
                      editor?.chain().focus().toggleCodeBlock().run();
                      setIsMoreMenuOpen(false);
                    }}
                  >
                    <Code size={13} style={{ marginRight: 4 }} />
                    <span>코드 블록 삽입</span>
                  </button>

                  <div className="more-menu-header" style={{ marginTop: 6 }}>줄 간격 (행간)</div>
                  {[
                    { label: '표준 행간', val: 'normal' },
                    { label: '140% 행간', val: '1.4' },
                    { label: '160% 행간 (권장)', val: '1.6' },
                    { label: '180% 행간', val: '1.8' },
                    { label: '200% 행간', val: '2.0' },
                  ].map((lh) => (
                    <button
                      key={lh.val}
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        if (lh.val === 'normal') {
                          editor?.chain().focus().unsetLineHeight().run();
                        } else {
                          editor?.chain().focus().setLineHeight(lh.val).run();
                        }
                        setIsMoreMenuOpen(false);
                      }}
                    >
                      {lh.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {extraToolbarItems}
        </div>
      )}

      {/* 표(Table) 활성화 시 즉시 나타나는 정밀 표 편집 바 */}
      {showToolbar && editor?.isActive('table') && (
        <div className="table-controls-bar">
          <div className="table-controls-group">
            <span className="table-controls-tag">표 도구</span>
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().mergeCells().run()}
              disabled={!editor.can().mergeCells()}
              title="선택된 복수 셀 병합"
            >
              <Merge size={13} />
              <span>병합</span>
            </button>
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (editor.can().splitCell()) {
                  editor.chain().focus().splitCell().run();
                } else {
                  editor.chain().focus().addColumnAfter().run();
                }
              }}
              title="셀 분할"
            >
              <Split size={13} />
              <span>분할</span>
            </button>
          </div>

          <div className="table-controls-divider" />

          {/* 헤더 설정 */}
          <div className="table-controls-group">
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              title="첫 행을 제목(헤더)으로 지정/해제"
            >
              <span>행 헤더</span>
            </button>
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
              title="첫 열을 제목(헤더)으로 지정/해제"
            >
              <span>열 헤더</span>
            </button>
          </div>

          <div className="table-controls-divider" />

          {/* 행 조작 */}
          <div className="table-controls-group">
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().addRowBefore().run()}
              title="현재 행 위에 행 추가"
            >
              <ArrowUpToLine size={13} />
              <span>위 행 추가</span>
            </button>
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="현재 행 아래에 행 추가"
            >
              <ArrowDownToLine size={13} />
              <span>아래 행 추가</span>
            </button>
            <button
              type="button"
              className="table-action-btn danger-hover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().deleteRow().run()}
              title="현재 행 삭제"
            >
              <Trash2 size={13} />
              <span>행 삭제</span>
            </button>
          </div>

          <div className="table-controls-divider" />

          {/* 열 조작 */}
          <div className="table-controls-group">
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              title="현재 열 왼쪽에 열 추가"
            >
              <ArrowLeftToLine size={13} />
              <span>좌 열 추가</span>
            </button>
            <button
              type="button"
              className="table-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="현재 열 오른쪽에 열 추가"
            >
              <ArrowRightToLine size={13} />
              <span>우 열 추가</span>
            </button>
            <button
              type="button"
              className="table-action-btn danger-hover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().deleteColumn().run()}
              title="현재 열 삭제"
            >
              <Trash2 size={13} />
              <span>열 삭제</span>
            </button>
          </div>

          <div className="table-controls-divider" />

          {/* 표 전체 삭제 */}
          <div className="table-controls-group">
            <button
              type="button"
              className="table-action-btn danger-hover delete-table-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="표 전체 삭제"
            >
              <Trash2 size={13} />
              <span>표 삭제</span>
            </button>
          </div>
        </div>
      )}

      {/* 본문 에디터 뷰포트 (화이트 시트) */}
      <div className="rich-editor-viewport">
        <div className={`rich-editor-body ${isFirstLineIndent ? 'with-first-line-indent' : ''}`}>
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
