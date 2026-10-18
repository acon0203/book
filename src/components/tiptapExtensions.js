import { Extension, Mark, mergeAttributes } from '@tiptap/react';

/**
 * 1. TextColor - 글자 색상 커스텀 마크
 */
export const TextColor = Mark.create({
  name: 'textColor',

  addOptions() {
    return {
      colors: [
        { label: '기본 먹색', value: 'inherit' },
        { label: '챠콜 블랙', value: '#1f2937' },
        { label: '고서적 브라운', value: '#8b5a2b' },
        { label: '와인 버건디', value: '#991b1b' },
        { label: '번트 오렌지', value: '#c2410c' },
        { label: '딥 포레스트', value: '#15803d' },
        { label: '네이비 블루', value: '#1d4ed8' },
        { label: '로열 퍼플', value: '#6b21a8' },
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
 * 3. TextAlign - 문단 정렬 (좌측, 가운데, 우측, 양쪽 정렬)
 */
export const TextAlign = Extension.create({
  name: 'textAlign',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'left',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => element.style.textAlign || this.options.defaultAlignment,
            renderHTML: (attributes) => {
              if (!attributes.textAlign || attributes.textAlign === this.options.defaultAlignment) {
                return {};
              }
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign: (alignment) => ({ commands }) => {
        if (!this.options.alignments.includes(alignment)) {
          return false;
        }
        return this.options.types.every((type) =>
          commands.updateAttributes(type, { textAlign: alignment })
        );
      },
      unsetTextAlign: () => ({ commands }) => {
        return this.options.types.every((type) =>
          commands.resetAttributes(type, 'textAlign')
        );
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
        { label: '기본 서체 (Pretendard)', value: 'inherit' },
        { label: '나눔명조 (소설·에세이)', value: '"Nanum Myeongjo", serif' },
        { label: '마루부리 (문학 서체)', value: '"MaruBuri", serif' },
        { label: '리디바탕 (전자책 최적)', value: '"KoPubWorld Batang", "Ridibatang", serif' },
        { label: '나눔고딕 (깔끔한 고딕)', value: '"Nanum Gothic", sans-serif' },
        { label: 'KoPub돋움 (가독성 본문)', value: '"KoPubWorld Dotum", sans-serif' },
        { label: 'D2Coding (코드·고정폭)', value: '"D2Coding", monospace' },
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
        { label: '크림 아이보리', value: '#fdfbf7', bg: '#fdfbf7' },
        { label: '웜 베이지', value: '#f5f0ea', bg: '#f5f0ea' },
        { label: '페일 그레이', value: '#f3f4f6', bg: '#f3f4f6' },
        { label: '소프트 레몬', value: '#fef9c3', bg: '#fef9c3' },
        { label: '민트 아이스', value: '#dcfce7', bg: '#dcfce7' },
        { label: '스카이 블러시', value: '#e0f2fe', bg: '#e0f2fe' },
        { label: '로즈 틴트', value: '#ffe4e6', bg: '#ffe4e6' },
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

