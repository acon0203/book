/**
 * paragraphParser.js
 * 본문 HTML 문자열과 문단(블록 모듈) 배열 간의 무손실 양방향 변환 유틸리티
 */

/**
 * 고유 문단 ID 생성기
 */
export const generateBlockId = () => {
  return `blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
};

/**
 * HTML 문자열을 문단 블록 배열로 파싱
 * @param {string} html Tiptap 등에서 생성된 원문 HTML
 * @returns {Array<{ id: string, text: string, html: string, role?: string }>}
 */
export const htmlToParagraphs = (html = '') => {
  if (!html || typeof html !== 'string' || !html.trim()) {
    return [
      {
        id: generateBlockId(),
        text: '',
        label: '',
        html: '<p></p>',
        tag: 'p'
      }
    ];
  }

  // 브라우저 DOMParser를 활용한 정확한 HTML 최상위 블록 추출
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    const blocks = [];
    const childNodes = Array.from(body.childNodes);

    for (const node of childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const outerHTML = node.outerHTML;
        const textContent = node.textContent || '';
        const tagName = node.tagName ? node.tagName.toLowerCase() : 'p';
        const label = node.getAttribute('data-label') || '';
        
        // 빈 문단이라도 구조 보존
        blocks.push({
          id: generateBlockId(),
          text: textContent.trim(),
          label,
          html: outerHTML,
          tag: tagName
        });
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ? node.textContent.trim() : '';
        if (text) {
          blocks.push({
            id: generateBlockId(),
            text,
            label: '',
            html: `<p>${text}</p>`,
            tag: 'p'
          });
        }
      }
    }

    if (blocks.length === 0) {
      return [
        {
          id: generateBlockId(),
          text: body.textContent ? body.textContent.trim() : '',
          label: '',
          html: html,
          tag: 'p'
        }
      ];
    }

    return blocks;
  } catch (err) {
    console.error('[paragraphParser] HTML 파싱 오류, 줄바꿈 fallback 적용:', err);
    // fallback: \n\n 줄바꿈 기준 분할
    const lines = html.split(/\n\n+/).filter(Boolean);
    return lines.map((line) => ({
      id: generateBlockId(),
      text: line.replace(/<[^>]*>/g, '').trim(),
      label: '',
      html: line.startsWith('<') ? line : `<p>${line}</p>`,
      tag: 'p'
    }));
  }
};

/**
 * 문단 블록 배열을 단일 본문 HTML 문자열로 결합
 * (data-label 속성으로 키워드 메모를 무손실 보존하되 본문 출력에는 영향 없음)
 * @param {Array<{ id: string, text: string, label?: string, tag?: string }>} paragraphs
 * @returns {string} 결합된 HTML 문자열
 */
export const paragraphsToHtml = (paragraphs = []) => {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return '<p></p>';
  }

  return paragraphs
    .filter(Boolean)
    .map((block) => {
      if (!block) return '';
      const tag = block.tag || 'p';
      const labelAttr = block.label && block.label.trim() 
        ? ` data-label="${block.label.trim().replace(/"/g, '&quot;')}"` 
        : '';
      const cleanText = block.text || '';
      return `<${tag}${labelAttr}>${cleanText}</${tag}>`;
    })
    .filter(Boolean)
    .join('');
};
