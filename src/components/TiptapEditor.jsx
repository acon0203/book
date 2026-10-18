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
  Table,
  Minus,
  Code,
  Omega
} from 'lucide-react';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import { TextColor, Highlight, TextAlign, Indent, LineHeight, FontFamily, BackgroundColor } from './tiptapExtensions';
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

  const colorPickerRef = useRef(null);
  const bgColorPickerRef = useRef(null);
  const highlightPickerRef = useRef(null);
  const specialCharRef = useRef(null);
  const quoteDropdownRef = useRef(null);
  const moreMenuRef = useRef(null);

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
  };

  // extensions 배열 (StarterKit + 글자색 + 배경색 + 글자체 + 형광펜 + 정렬 + 들여쓰기 + 줄간격)
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
    BackgroundColor,
    FontFamily,
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

  // 1. 글자체 목록
  const fontFamilies = [
    { label: '기본 서체 (Pretendard)', value: 'inherit' },
    { label: '나눔명조 (소설·에세이)', value: '"Nanum Myeongjo", serif' },
    { label: '마루부리 (문학 서체)', value: '"MaruBuri", serif' },
    { label: '리디바탕 (전자책 최적)', value: '"KoPubWorld Batang", "Ridibatang", serif' },
    { label: '나눔고딕 (깔끔한 고딕)', value: '"Nanum Gothic", sans-serif' },
    { label: 'KoPub돋움 (가독성 본문)', value: '"KoPubWorld Dotum", sans-serif' },
    { label: 'D2Coding (코드·고정폭)', value: '"D2Coding", monospace' },
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
    editor.chain().focus().setTextAlign(next).run();
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

  // 7. 인용문 스타일 적용
  const handleApplyQuote = (styleType = 'classic') => {
    if (!editor) return;
    const isBlockquote = editor.isActive('blockquote');
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    const textToInsert = selectedText || '인용할 문장 또는 핵심 발췌문을 입력하세요.';

    if (styleType === 'classic') {
      if (isBlockquote && !selectedText) {
        editor.chain().focus().toggleBlockquote().run();
      } else {
        editor.chain().focus().insertContent(`<blockquote><p>${textToInsert}</p></blockquote>`).run();
      }
    } else if (styleType === 'card') {
      editor.chain().focus().insertContent(`<blockquote class="quote-card"><p>${textToInsert}</p></blockquote>`).run();
    } else if (styleType === 'editorial') {
      editor.chain().focus().insertContent(`<blockquote class="quote-editorial"><p>${textToInsert}</p></blockquote>`).run();
    } else if (styleType === 'dashed') {
      editor.chain().focus().insertContent(`<blockquote class="quote-dashed"><p>${textToInsert}</p></blockquote>`).run();
    }
    setIsQuoteDropdownOpen(false);
  };

  // 8. 테이블 삽입
  const handleInsertTable = () => {
    if (!editor) return;
    const tableHtml = `
      <table class="editor-user-table" style="width: 100%; border-collapse: collapse; margin: 1.25rem 0; border: 1px solid rgba(139, 90, 43, 0.2);">
        <thead>
          <tr style="background: rgba(139, 90, 43, 0.08);">
            <th style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px; text-align: left; font-weight: 600;">구분</th>
            <th style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px; text-align: left; font-weight: 600;">내용 및 상세</th>
            <th style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px; text-align: left; font-weight: 600;">비고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px;">항목 1</td>
            <td style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px;">상세 설명 1</td>
            <td style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px;">참조</td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px;">항목 2</td>
            <td style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px;">상세 설명 2</td>
            <td style="border: 1px solid rgba(139, 90, 43, 0.2); padding: 8px 12px;">참조</td>
          </tr>
        </tbody>
      </table>
    `;
    editor.chain().focus().insertContent(tableHtml).run();
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
                    { label: '배경색 없음', color: 'transparent', bg: '#ffffff' },
                    { label: '크림 아이보리', color: '#fdfbf7', bg: '#fdfbf7' },
                    { label: '웜 베이지', color: '#f5f0ea', bg: '#f5f0ea' },
                    { label: '페일 그레이', color: '#f3f4f6', bg: '#f3f4f6' },
                    { label: '소프트 레몬', color: '#fef9c3', bg: '#fef9c3' },
                    { label: '민트 아이스', color: '#dcfce7', bg: '#dcfce7' },
                    { label: '스카이 블러시', color: '#e0f2fe', bg: '#e0f2fe' },
                    { label: '로즈 틴트', color: '#ffe4e6', bg: '#ffe4e6' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="palette-color-btn"
                      style={{ backgroundColor: item.bg }}
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

            {/* 내어쓰기 */}
            <button
              type="button"
              className="tool-btn"
              onClick={handleOutdent}
              title="내어쓰기 / 상위 목록 레벨 복귀 (Shift+Tab)"
            >
              <OutdentIcon size={14} />
            </button>

            {/* 들여쓰기 */}
            <button
              type="button"
              className="tool-btn"
              onClick={handleIndent}
              title="들여쓰기 / 하위 목록 레벨로 낮춤 (Tab)"
            >
              <IndentIcon size={14} />
            </button>
          </div>

          {/* 3번 구분선 */}
          <div className="toolbar-divider" />

          {/* 그룹 4: 특수문자, 서식지우기, 인용블록(드롭다운), 구분선, 코드블록, 테이블, 더보기 */}
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

            {/* 코드 블록 */}
            <button
              type="button"
              className={`tool-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              title="코드 블록"
            >
              <Code size={14} />
            </button>

            {/* 테이블 만들기 */}
            <button
              type="button"
              className="tool-btn"
              onClick={handleInsertTable}
              title="테이블(표) 삽입"
            >
              <Table size={14} />
            </button>

            {/* 더보기 (...) 팝오버: 행간 등 추가 설정 */}
            <div className="toolbar-popover-wrap" ref={moreMenuRef}>
              <button
                type="button"
                className={`tool-btn ${isMoreMenuOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMoreMenuOpen((prev) => !prev);
                  closeOtherPopovers('more');
                }}
                title="더보기 (행간 및 추가 설정)"
              >
                <MoreHorizontal size={14} />
              </button>
              {isMoreMenuOpen && (
                <div className="toolbar-dropdown-menu more-menu-dropdown">
                  <div className="more-menu-header">줄 간격 (행간)</div>
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
