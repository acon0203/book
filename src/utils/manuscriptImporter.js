/**
 * 초경량 원고 가져오기 파서 (manuscriptImporter.js)
 * 외부 라이브러리 의존성 0: 브라우저 네이티브 API(DecompressionStream, FileReader) 기반
 * 지원 포맷: .txt, .md, .docx(네이티브 Zip/XML 파서), 클립보드 원고 텍스트
 */

// 1. 네이티브 .docx 텍스트 추출기 (PKZip + DecompressionStream)
export async function extractTextFromDocx(file) {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // ZIP Local File Header 시그니처: PK\x03\x04 (0x04034b50)
    let offset = 0;
    let documentXmlCompressed = null;
    let compressionMethod = 0;

    while (offset < bytes.length - 30) {
      if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4B && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
        const method = bytes[offset + 8] | (bytes[offset + 9] << 8);
        const compSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
        const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
        const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);

        const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
        const fileName = new TextDecoder().decode(nameBytes);

        const dataStart = offset + 30 + nameLen + extraLen;

        if (fileName === 'word/document.xml') {
          documentXmlCompressed = bytes.slice(dataStart, dataStart + compSize);
          compressionMethod = method;
          break;
        }

        offset = dataStart + compSize;
      } else {
        offset++;
      }
    }

    if (!documentXmlCompressed) {
      throw new Error('word/document.xml을 찾을 수 없습니다.');
    }

    let xmlText = '';
    if (compressionMethod === 8) {
      // Deflate 압축 해제 (네이티브 DecompressionStream)
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(documentXmlCompressed);
      writer.close();

      const decompressedArrayBuffer = await new Response(ds.readable).arrayBuffer();
      xmlText = new TextDecoder().decode(decompressedArrayBuffer);
    } else {
      // 비압축
      xmlText = new TextDecoder().decode(documentXmlCompressed);
    }

    // XML에서 문단(<w:p>) 및 텍스트(<w:t>) 추출
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const paragraphs = xmlDoc.getElementsByTagName('w:p');

    const lines = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const texts = paragraphs[i].getElementsByTagName('w:t');
      let pText = '';
      for (let j = 0; j < texts.length; j++) {
        pText += texts[j].textContent || '';
      }
      lines.push(pText);
    }

    return lines.join('\n');
  } catch (err) {
    console.warn('[DocxParser] 네이티브 파싱 실패, 텍스트 대체 시도:', err);
    // 대체: 일반 텍스트 읽기 시도
    return await file.text();
  }
}

// 2. 업로드 파일 텍스트 추출 통합 함수
export async function readManuscriptFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'docx') {
    return await extractTextFromDocx(file);
  }
  return await file.text();
}

// 3. 스마트 챕터 및 섹션 패턴 감지 & 분할 엔진
export function parseManuscript(rawText, defaultTitle = '새 도서 프로젝트') {
  if (!rawText || !rawText.trim()) {
    return {
      title: defaultTitle,
      subtitle: '',
      chapters: [],
      totalWords: 0
    };
  }

  // 줄바꿈 정규화 (\r\n -> \n)
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // 책 제목 추정: 첫 번째 비어있지 않은 줄
  let detectedTitle = defaultTitle;
  let detectedSubtitle = '';
  let startIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line) {
      // 마크다운 헤더 기호 제거 (# 책제목)
      const cleanLine = line.replace(/^#+\s*/, '').replace(/^\[(.*?)\]$/, '$1').trim();
      if (!detectedTitle || detectedTitle === defaultTitle) {
        detectedTitle = cleanLine;
        startIndex = i + 1;
        // 다음 줄이 인용구(>)나 부제목 형태인지 확인
        if (lines[startIndex]?.trim().startsWith('>')) {
          detectedSubtitle = lines[startIndex].trim().replace(/^>\s*/, '');
          startIndex++;
        }
        break;
      }
    }
  }

  // 챕터 분할 패턴 정규식 후보들
  const CHAPTER_PATTERNS = [
    // 1. 마크다운 헤더: # 제1장 or ## 제1장
    /^#{1,2}\s+(.+)$/,
    // 2. 한국어 표준: 제 1 장, 제1화, 1화, 1장. 제목
    /^(?:제\s*\d+\s*[장화회부편]|\d+\s*[장화회])\s*[:\.\-]?\s*(.*)$/i,
    // 3. 영문 표준: Chapter 1, Episode 1
    /^(?:chapter|episode|part|volume)\s*\d+[:\.\-]?\s*(.*)$/i,
    // 4. 대괄호 표기: [제 1 장. 제목] or [1화. 제목]
    /^\[\s*(?:제\s*\d+\s*[장화회]|\d+\s*[장화회]|chapter\s*\d+)[^\]]*\]$/i,
    // 5. 숫자 번호 매김: 1. 프롤로그 or 1) 시작하며
    /^\d+[\.\)]\s+([^\s].*)$/
  ];

  // 텍스트 전체에서 어떤 챕터 패턴이 가장 많이 쓰였는지 스코어링
  const patternMatches = [0, 0, 0, 0, 0];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    CHAPTER_PATTERNS.forEach((regex, idx) => {
      if (regex.test(trimmed)) patternMatches[idx]++;
    });
  });

  const bestPatternIdx = patternMatches.findIndex((count) => count >= 2);
  const activeChapterRegex = bestPatternIdx !== -1 ? CHAPTER_PATTERNS[bestPatternIdx] : null;

  // 챕터 분할 로직 실행
  const rawChapters = [];
  let currentChapter = null;
  let currentLines = [];

  const flushCurrentChapter = () => {
    if (currentChapter) {
      currentChapter.rawBody = currentLines.join('\n').trim();
      rawChapters.push(currentChapter);
    }
    currentLines = [];
  };

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 챕터 시작인지 판별
    let isChapterStart = false;
    let chapterTitle = '';

    if (activeChapterRegex && activeChapterRegex.test(trimmed)) {
      isChapterStart = true;
      chapterTitle = trimmed.replace(/^#+\s*/, '').replace(/^\[|\]$/g, '').trim();
    } else if (!activeChapterRegex) {
      // 챕터 패턴이 감지되지 않은 경우: 3줄 이상의 빈 줄 또는 구분선(---, ***) 기준 분할
      if (trimmed === '---' || trimmed === '***' || trimmed === '===') {
        isChapterStart = true;
        chapterTitle = `제 ${rawChapters.length + 1} 장`;
      }
    }

    if (isChapterStart) {
      flushCurrentChapter();
      currentChapter = {
        title: chapterTitle || `제 ${rawChapters.length + 1} 장`,
        rawBody: ''
      };
    } else {
      if (!currentChapter) {
        // 첫 번째 챕터 태그가 나오기 전의 서문/프롤로그 처리
        if (trimmed) {
          currentChapter = {
            title: '프롤로그 및 시작하며',
            rawBody: ''
          };
        }
      }
      if (currentChapter) {
        currentLines.push(line);
      }
    }
  }
  flushCurrentChapter();

  // 분할된 챕터가 0개인 경우 (단일 통원고)
  if (rawChapters.length === 0) {
    rawChapters.push({
      title: '본문 1장',
      rawBody: lines.slice(startIndex).join('\n').trim()
    });
  }

  // 각 챕터를 소목차(sections) 및 HTML 본문으로 변환
  const structuredChapters = rawChapters.map((ch, chIdx) => {
    const bodyLines = ch.rawBody.split('\n');
    const sections = [];
    let currentSec = null;
    let secLines = [];

    const flushSec = () => {
      if (currentSec) {
        const textContent = secLines.join('\n').trim();
        // 줄바꿈 문단을 HTML <p> 태그로 래핑 (Tiptap 호환)
        const htmlContent = textContent
          .split(/\n{2,}/)
          .filter(p => p.trim())
          .map(p => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
          .join('');

        currentSec.content = htmlContent || '<p></p>';
        currentSec.wordCount = textContent.replace(/<[^>]*>/g, '').length;
        sections.push(currentSec);
      }
      secLines = [];
    };

    // 소목차 패턴 (### 소제목 or 1.1 소제목 or (1) 소제목)
    const SECTION_REGEX = /^(?:#{3,4}\s+|(?:\d+\.\d+|\(\d+\))\s+)(.+)$/;

    bodyLines.forEach((l) => {
      const trimmed = l.trim();
      const match = trimmed.match(SECTION_REGEX);
      if (match) {
        flushSec();
        currentSec = {
          id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: match[1].trim(),
          status: 'draft'
        };
      } else {
        if (!currentSec) {
          currentSec = {
            id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `${chIdx + 1}.1 소목차`,
            status: 'draft'
          };
        }
        secLines.push(l);
      }
    });
    flushSec();

    if (sections.length === 0) {
      sections.push({
        id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: `${chIdx + 1}.1 시작`,
        content: '<p></p>',
        status: 'draft',
        wordCount: 0
      });
    }

    return {
      id: `chap_${Date.now()}_${chIdx + 1}_${Math.random().toString(36).substring(2, 5)}`,
      title: ch.title,
      status: 'draft',
      sections
    };
  });

  // 총 글자수 계산
  const totalWords = structuredChapters.reduce((acc, c) => {
    return acc + c.sections.reduce((sAcc, s) => sAcc + (s.wordCount || 0), 0);
  }, 0);

  return {
    title: detectedTitle || '가져온 도서 원고',
    subtitle: detectedSubtitle,
    chapters: structuredChapters,
    totalWords
  };
}
