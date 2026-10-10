import React, { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
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
    className = ''
  },
  ref
) {
  const debounceRef = useRef(null);
  const lastHtmlRef = useRef(content || '');

  // extensions 배열 (StarterKit v3에 Underline이 이미 기본 내장되어 있음)
  const extensions = React.useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),
    Placeholder.configure({
      placeholder
    })
  ], [placeholder]);

  const editor = useEditor(
    {
      editable,
      extensions,
      content: content || '',
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        lastHtmlRef.current = html;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (onChange) onChange(html);
        }, 300);
      },
      onSelectionUpdate: ({ editor }) => {
        if (onSelectText) {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, ' ').trim();
          onSelectText(text);
        }
      }
    },
    []
  );

  // 외부에서 content prop이 바뀔 때 (다른 섹션 선택 등)만 안전하게 동기화
  useEffect(() => {
    if (!editor) return;
    // 부모가 전달한 content가 에디터의 현재 내용과 다를 때만 setContent (내부 타이핑 루프 차단)
    if (content !== lastHtmlRef.current && content !== editor.getHTML()) {
      lastHtmlRef.current = content || '';
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  // 부모 컴포넌트에서 에디터 조작 명령을 직접 실행할 수 있도록 ref 노출
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    getHTML: () => editor?.getHTML() || '',
    getText: () => editor?.getText() || '',
    isEmpty: () => editor?.isEmpty ?? true,
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
          {/* 단락 서식 선택 (H1, H2, H3, 인용문, 본문) */}
          <div className="toolbar-group">
            <select
              className="toolbar-select"
              value={currentHeadingValue}
              onChange={(e) => {
                const val = e.target.value;
                if (!editor) return;
                if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                else if (val === 'blockquote') editor.chain().focus().toggleBlockquote().run();
                else editor.chain().focus().setParagraph().run();
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
              <i>I</i>
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

          {extraToolbarItems}
        </div>
      )}

      {/* 본문 에디터 뷰포트 (화이트 시트) */}
      <div className="rich-editor-viewport">
        <div className="rich-editor-body">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});

export default TiptapEditor;
