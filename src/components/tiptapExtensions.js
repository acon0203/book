import { Extension, Mark, Node, mergeAttributes } from '@tiptap/react';

/**
 * 1. TextColor - 글자 색상 커스텀 마크
 */
export const TextColor = Mark.create({
  name: 'textColor',

  addOptions() {
    return {
      colors: [
        { label: '검정', value: '#000000', bg: '#000000' },
        { label: '챠콜 회색', value: '#374151', bg: '#374151' },
        { label: '연회색', value: '#9ca3af', bg: '#9ca3af' },
        { label: '흰색', value: '#ffffff', bg: '#ffffff' },
        { label: '빨강', value: '#ef4444', bg: '#ef4444' },
        { label: '주황', value: '#f97316', bg: '#f97316' },
        { label: '노랑', value: '#eab308', bg: '#eab308' },
        { label: '초록', value: '#16a34a', bg: '#16a34a' },
        { label: '파랑', value: '#2563eb', bg: '#2563eb' },
        { label: '보라', value: '#9333ea', bg: '#9333ea' },
        { label: '가죽 브라운', value: '#8b5a2b', bg: '#8b5a2b' },
      ],
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color?.replace(/['"]+/g, ''),
        renderHTML: (attributes) => {
          if (!attributes.color || attributes.color === 'inherit') return {};
          return { style: `color: ${attributes.color}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=color]',
        getAttrs: (value) => {
          const hasColor = /(?:^|;)\s*color:/i.test(value);
          return hasColor ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor: (color) => ({ chain }) => {
        if (!color || color === 'inherit') {
          return chain().unsetMark(this.name).run();
        }
        return chain().setMark(this.name, { color }).run();
      },
      unsetTextColor: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },
});

/**
 * 2. Highlight - 형광펜 하이라이트 커스텀 마크
 */
export const Highlight = Mark.create({
  name: 'highlight',

  addOptions() {
    return {
      colors: [
        { label: '레몬 옐로우', value: '#fef08a' },
        { label: '페일 민트', value: '#bbf7d0' },
        { label: '스카이 블루', value: '#bae6fd' },
        { label: '소프트 라벤더', value: '#e9d5ff' },
        { label: '피치 로즈', value: '#fecdd3' },
      ],
    };
  },

  addAttributes() {
    return {
      color: {
        default: '#fef08a',
        parseHTML: (element) => element.style.backgroundColor?.replace(/['"]+/g, '') || element.getAttribute('data-color'),
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return {
            'data-color': attributes.color,
            style: `background-color: ${attributes.color}; padding: 0.1em 0.25em; border-radius: 3px;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'mark' },
      {
        tag: 'span[style*=background-color]',
        getAttrs: (value) => {
          const hasBg = /(?:^|;)\s*background-color:/i.test(value);
          return hasBg ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setHighlight: (color) => ({ chain }) => {
        return chain().setMark(this.name, { color: color || '#fef08a' }).run();
      },
      toggleHighlight: (color) => ({ chain }) => {
        return chain().toggleMark(this.name, { color: color || '#fef08a' }).run();
      },
      unsetHighlight: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },
});


/**
 * 4. Indent - 들여쓰기 / 내어쓰기 (24px 단위 margin-left)
 */
export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
      minLevel: 0,
      maxLevel: 6,
      step: 24, // px
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const ml = parseInt(element.style.marginLeft || '0', 10);
              return ml > 0 ? Math.round(ml / 24) : 0;
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent <= 0) return {};
              return {
                style: `margin-left: ${attributes.indent * 24}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const { from, to } = selection;
        let applicable = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            applicable = true;
            const currentIndent = node.attrs.indent || 0;
            if (currentIndent < this.options.maxLevel) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: currentIndent + 1,
              });
            }
          }
        });

        if (applicable && dispatch) dispatch(tr);
        return applicable;
      },
      outdent: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const { from, to } = selection;
        let applicable = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            applicable = true;
            const currentIndent = node.attrs.indent || 0;
            if (currentIndent > this.options.minLevel) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: currentIndent - 1,
              });
            }
          }
        });

        if (applicable && dispatch) dispatch(tr);
        return applicable;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    };
  },
});

/**
 * 5. LineHeight - 줄간격 조절
 */
export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
      defaultLineHeight: 'normal',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight || attributes.lineHeight === 'normal') {
                return {};
              }
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight: (lineHeight) => ({ commands }) => {
        return this.options.types.every((type) =>
          commands.updateAttributes(type, { lineHeight })
        );
      },
      unsetLineHeight: () => ({ commands }) => {
        return this.options.types.every((type) =>
          commands.resetAttributes(type, 'lineHeight')
        );
      },
    };
  },
});

/**
 * 6. FontFamily - 글자체 커스텀 마크
 */
export const FontFamily = Mark.create({
  name: 'fontFamily',

  addOptions() {
    return {
      fonts: [
        { label: '기본 서체 (시스템 기본)', value: 'inherit' },
        { label: '맑은 고딕 (Malgun Gothic)', value: '"Malgun Gothic", sans-serif' },
        { label: '바탕체 (Batang)', value: '"Batang", "BatangChe", serif' },
        { label: '돋움체 (Dotum)', value: '"Dotum", "DotumChe", sans-serif' },
        { label: '굴림체 (Gulim)', value: '"Gulim", "GulimChe", sans-serif' },
        { label: '궁서체 (Gungsuh)', value: '"Gungsuh", "GungsuhChe", serif' },
        { label: '나눔명조 (출판 명조)', value: '"Nanum Myeongjo", serif' },
        { label: '나눔고딕 (출판 고딕)', value: '"Nanum Gothic", sans-serif' },
      ],
    };
  },

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily?.replace(/['"]+/g, ''),
        renderHTML: (attributes) => {
          if (!attributes.fontFamily || attributes.fontFamily === 'inherit') return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=font-family]',
        getAttrs: (value) => {
          const hasFont = /(?:^|;)\s*font-family:/i.test(value);
          return hasFont ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontFamily: (fontFamily) => ({ chain }) => {
        if (!fontFamily || fontFamily === 'inherit') {
          return chain().unsetMark(this.name).run();
        }
        return chain().setMark(this.name, { fontFamily }).run();
      },
      unsetFontFamily: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },
});

/**
 * 7. BackgroundColor - 배경색 커스텀 마크
 */
export const BackgroundColor = Mark.create({
  name: 'backgroundColor',

  addOptions() {
    return {
      colors: [
        { label: '배경색 없음', value: 'transparent', bg: '#ffffff' },
        { label: '순백색', value: '#ffffff', bg: '#ffffff' },
        { label: '밝은 회색', value: '#f3f4f6', bg: '#f3f4f6' },
        { label: '어두운 회색', value: '#374151', bg: '#374151' },
        { label: '검정', value: '#000000', bg: '#000000' },
        { label: '연한 빨강', value: '#fee2e2', bg: '#fee2e2' },
        { label: '연한 주황', value: '#ffedd5', bg: '#ffedd5' },
        { label: '연한 노랑', value: '#fef9c3', bg: '#fef9c3' },
        { label: '연한 초록', value: '#dcfce7', bg: '#dcfce7' },
        { label: '연한 파랑', value: '#e0f2fe', bg: '#e0f2fe' },
        { label: '연한 보라', value: '#f3e8ff', bg: '#f3e8ff' },
      ],
    };
  },

  addAttributes() {
    return {
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor?.replace(/['"]+/g, ''),
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor || attributes.backgroundColor === 'transparent') return {};
          return {
            style: `background-color: ${attributes.backgroundColor}; padding: 0.15em 0.35em; border-radius: 4px;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*=background-color]',
        getAttrs: (value) => {
          const hasBg = /(?:^|;)\s*background-color:/i.test(value);
          return hasBg ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setBackgroundColor: (backgroundColor) => ({ chain }) => {
        if (!backgroundColor || backgroundColor === 'transparent') {
          return chain().unsetMark(this.name).run();
        }
        return chain().setMark(this.name, { backgroundColor }).run();
      },
      unsetBackgroundColor: () => ({ chain }) => {
        return chain().unsetMark(this.name).run();
      },
    };
  },
});

/**
 * 8. CustomBlockquote - 4대 인용문 스타일 지원 (classic, card, editorial, dashed)
 */
export const CustomBlockquote = Node.create({
  name: 'blockquote',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      quoteStyle: {
        default: 'classic',
        parseHTML: (element) => {
          if (element.classList.contains('quote-card')) return 'card';
          if (element.classList.contains('quote-editorial')) return 'editorial';
          if (element.classList.contains('quote-dashed')) return 'dashed';
          return element.getAttribute('data-quote-style') || 'classic';
        },
        renderHTML: (attributes) => {
          const style = attributes.quoteStyle || 'classic';
          return {
            'data-quote-style': style,
            class: `quote-${style}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'blockquote',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setBlockquote: (attrs) => ({ commands }) => {
        return commands.wrapIn(this.name, attrs);
      },
      toggleBlockquote: (attrs) => ({ commands }) => {
        return commands.toggleWrap(this.name, attrs);
      },
      setQuoteStyle: (quoteStyle) => ({ commands }) => {
        return commands.updateAttributes(this.name, { quoteStyle });
      },
      unsetBlockquote: () => ({ commands }) => {
        return commands.lift(this.name);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
    };
  },
});


