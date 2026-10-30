// Mission 스타일: 브라우저 로컬 저장소 서비스 (Zero-Latency, 100% 오프라인 지원)
const STORAGE_KEYS = {
  BOOKS: 'bookstudio_books',
  VAULT: 'bookstudio_vault',
  CONFIG: 'bookstudio_config',
  STATS: 'bookstudio_stats',
  AUTHOR_PERSONA: 'bookstudio_author_persona',
  READER_HISTORY: 'reader_history',
  READER_SHELF: 'reader_shelf',
  READER_SHELF_CATEGORIES: 'reader_shelf_categories'
};

export const DEFAULT_SHELF_CATEGORIES = ['읽고 싶은 책', '관심 있는 분야', '소장·재독'];

const DEFAULT_CONFIG = {
  selectedProvider: 'gemini',
  selectedModel: 'gemini-1.5-flash',
  geminiModel: 'smart_cascade',
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'gemma2:9b',
  defaultTone: 'professional',
  defaultLength: 'detailed',
  autoCloudSyncOnSave: false // 디폴트 방안 A: 로컬 전용 저장 (클라우드는 수동)
};

const DEFAULT_STATS = {
  totalWordsGenerated: 0,
  totalChaptersCompleted: 0,
  aiGenerationsCount: 0
};

export const storageService = {
  // --- 1. 도서 (Books) ---
  getBooks: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveBooks: (books) => {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
  },

  saveBook: (book) => {
    if (!book?.id) return null;
    return storageService.updateBook(book.id, book);
  },

  getBook: (id) => {
    const books = storageService.getBooks();
    const book = books.find(b => b.id === id);
    if (!book) throw new Error('도서를 찾을 수 없습니다.');
    return book;
  },

  createBook: (bookData) => {
    const books = storageService.getBooks();
    const newBook = {
      id: `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        {
          id: `chap_${Date.now()}_1`,
          title: '프롤로그 및 시작하며',
          sections: [
            {
              id: `sec_${Date.now()}_1`,
              title: '이 책을 읽어야 하는 이유',
              content: '',
              status: 'draft',
              wordCount: 0
            }
          ]
        }
      ],
      ...bookData
    };
    books.unshift(newBook);
    storageService.saveBooks(books);
    storageService.recordDailyWritingActivity();
    return newBook;
  },

  updateBook: (id, bookData) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === id);
    if (index === -1) throw new Error('도서를 찾을 수 없습니다.');
    const nowIso = new Date().toISOString();
    books[index] = { ...books[index], ...bookData, updatedAt: nowIso };
    storageService.saveBooks(books);
    storageService.recordDailyWritingActivity(nowIso);
    return books[index];
  },

  // 실제 일자별 집필 활동 자동 기록 (YYYY-MM-DD)
  recordDailyWritingActivity: (isoString = new Date().toISOString()) => {
    try {
      const dateKey = isoString.slice(0, 10);
      const raw = localStorage.getItem('daily_writing_logs') || '[]';
      const list = JSON.parse(raw);
      if (!list.includes(dateKey)) {
        list.push(dateKey);
        localStorage.setItem('daily_writing_logs', JSON.stringify(list));
      }
    } catch {}
  },

  deleteBook: (id) => {
    const books = storageService.getBooks();
    const filtered = books.filter(b => b.id !== id);
    storageService.saveBooks(filtered);
    storageService.markBookDeletedInReaderLists(id);
    return { success: true };
  },

  // 챕터 및 섹션 조작
  addChapter: (bookId, title) => {
    const book = storageService.getBook(bookId);
    if (!book.chapters) book.chapters = [];
    const newChap = {
      id: `chap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      status: 'draft', // 'draft' | 'published'
      deadline: null,   // 'YYYY-MM-DD'
      publishedAt: null,
      sections: [
        {
          id: `sec_${Date.now()}_1`,
          title: '소제목을 입력하세요',
          content: '',
          status: 'draft',
          wordCount: 0
        }
      ]
    };
    book.chapters.push(newChap);
    return storageService.updateBook(bookId, book);
  },

  updateChapter: (bookId, chapterId, data) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters?.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');
    Object.assign(chap, data);
    return storageService.updateBook(bookId, book);
  },

  deleteChapter: (bookId, chapterId) => {
    const book = storageService.getBook(bookId);
    book.chapters = book.chapters.filter(c => c.id !== chapterId);
    return storageService.updateBook(bookId, book);
  },

  setChapterDeadline: (bookId, chapterId, deadline) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters?.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');
    chap.deadline = deadline || null;
    return storageService.updateBook(bookId, book);
  },

  toggleChapterPublish: (bookId, chapterId) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters?.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');
    const nextStatus = chap.status === 'published' ? 'draft' : 'published';
    chap.status = nextStatus;
    chap.publishedAt = nextStatus === 'published' ? new Date().toISOString() : null;
    return storageService.updateBook(bookId, book);
  },

  // 소목차(에피소드/1화) 개별 연재 발행 토글
  toggleSectionPublish: (bookId, chapterId, sectionId) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters?.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');
    const sec = chap.sections?.find(s => s.id === sectionId);
    if (!sec) throw new Error('소목차를 찾을 수 없습니다.');

    const nextStatus = sec.status === 'published' ? 'draft' : 'published';
    sec.status = nextStatus;
    sec.publishedAt = nextStatus === 'published' ? new Date().toISOString() : null;

    // 소목차가 하나라도 발행되면 상위 챕터도 발행 상태로 연동
    if (nextStatus === 'published') {
      chap.status = 'published';
      if (!chap.publishedAt) chap.publishedAt = new Date().toISOString();
    } else {
      // 챕터 내 남은 발행 소목차가 없으면 챕터도 초고로 조정
      const hasOtherPublished = chap.sections.some(s => s.status === 'published');
      if (!hasOtherPublished) {
        chap.status = 'draft';
        chap.publishedAt = null;
      }
    }
    return storageService.updateBook(bookId, book);
  },

  // 챕터 전체 일괄 발행/취소 (하위 소목차 포함)
  toggleChapterPublishAll: (bookId, chapterId) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters?.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');

    const nextStatus = chap.status === 'published' ? 'draft' : 'published';
    const nowIso = new Date().toISOString();
    chap.status = nextStatus;
    chap.publishedAt = nextStatus === 'published' ? nowIso : null;

    if (Array.isArray(chap.sections)) {
      chap.sections.forEach(s => {
        s.status = nextStatus;
        s.publishedAt = nextStatus === 'published' ? (s.publishedAt || nowIso) : null;
      });
    }
    return storageService.updateBook(bookId, book);
  },

  // 도서 전체 완결 연재 발행/취소 (모든 챕터 & 소목차 일괄)
  toggleBookPublishAll: (bookId) => {
    const book = storageService.getBook(bookId);
    const isCurrentlyAllPublished = (book.chapters || []).every(c => c.status === 'published');
    const nextStatus = isCurrentlyAllPublished ? 'draft' : 'published';
    const nowIso = new Date().toISOString();

    book.status = nextStatus === 'published' ? 'completed' : 'draft';
    book.publishedAt = nextStatus === 'published' ? (book.publishedAt || nowIso) : null;

    (book.chapters || []).forEach(c => {
      c.status = nextStatus;
      c.publishedAt = nextStatus === 'published' ? (c.publishedAt || nowIso) : null;
      (c.sections || []).forEach(s => {
        s.status = nextStatus;
        s.publishedAt = nextStatus === 'published' ? (s.publishedAt || nowIso) : null;
      });
    });
    return storageService.updateBook(bookId, book);
  },

  // 목차 체크박스 기반 일괄 발행 상태 저장
  updateBatchPublishSections: (bookId, publishedSectionIds) => {
    const book = storageService.getBook(bookId);
    const idSet = new Set(publishedSectionIds);
    const nowIso = new Date().toISOString();

    (book.chapters || []).forEach(chap => {
      let chapHasPublished = false;
      (chap.sections || []).forEach(sec => {
        if (idSet.has(sec.id)) {
          sec.status = 'published';
          sec.publishedAt = sec.publishedAt || nowIso;
          chapHasPublished = true;
        } else {
          sec.status = 'draft';
          sec.publishedAt = null;
        }
      });
      chap.status = chapHasPublished ? 'published' : 'draft';
      chap.publishedAt = chapHasPublished ? (chap.publishedAt || nowIso) : null;
    });

    const isAllPublished = (book.chapters || []).length > 0 && (book.chapters || []).every(c => c.status === 'published' && (c.sections || []).every(s => s.status === 'published'));
    if (isAllPublished) {
      book.status = 'completed';
      book.publishedAt = book.publishedAt || nowIso;
    } else {
      book.status = (book.chapters || []).some(c => c.status === 'published') ? 'publishing' : 'draft';
    }

    return storageService.updateBook(bookId, book);
  },

  addSection: (bookId, chapterId, title, insertIndex = null) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');
    if (!chap.sections) chap.sections = [];
    const newSec = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      content: '',
      status: 'draft',
      wordCount: 0
    };
    if (insertIndex !== null && insertIndex !== undefined && insertIndex >= 0 && insertIndex <= chap.sections.length) {
      chap.sections.splice(insertIndex, 0, newSec);
    } else {
      chap.sections.push(newSec);
    }
    return storageService.updateBook(bookId, book);
  },

  updateSection: (bookId, chapterId, sectionId, data) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters.find(c => c.id === chapterId);
    if (!chap) throw new Error('챕터를 찾을 수 없습니다.');
    const sec = chap.sections.find(s => s.id === sectionId);
    if (!sec) throw new Error('소목차를 찾을 수 없습니다.');

    Object.assign(sec, data, { updatedAt: new Date().toISOString() });
    if (data.content !== undefined) {
      sec.wordCount = data.content.trim().length;
      sec.status = sec.wordCount > 0 ? 'completed' : 'draft';
    }

    return storageService.updateBook(bookId, book);
  },

  deleteSection: (bookId, chapterId, sectionId) => {
    const book = storageService.getBook(bookId);
    const chap = book.chapters.find(c => c.id === chapterId);
    if (chap) {
      chap.sections = chap.sections.filter(s => s.id !== sectionId);
    }
    return storageService.updateBook(bookId, book);
  },

  moveChapter: (bookId, chapterId, direction) => {
    const book = storageService.getBook(bookId);
    if (!book || !book.chapters) return book;
    const index = book.chapters.findIndex((c) => c.id === chapterId);
    if (index === -1) return book;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= book.chapters.length) return book;
    const temp = book.chapters[index];
    book.chapters[index] = book.chapters[targetIndex];
    book.chapters[targetIndex] = temp;
    return storageService.updateBook(bookId, book);
  },

  moveSection: (bookId, chapterId, sectionId, direction) => {
    const book = storageService.getBook(bookId);
    if (!book || !book.chapters) return book;
    const chap = book.chapters.find((c) => c.id === chapterId);
    if (!chap || !chap.sections) return book;
    const index = chap.sections.findIndex((s) => s.id === sectionId);
    if (index === -1) return book;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chap.sections.length) return book;
    const temp = chap.sections[index];
    chap.sections[index] = chap.sections[targetIndex];
    chap.sections[targetIndex] = temp;
    return storageService.updateBook(bookId, book);
  },

  reorderChapters: (bookId, sourceIndex, targetIndex) => {
    const book = storageService.getBook(bookId);
    if (!book || !book.chapters) return book;
    if (
      sourceIndex === targetIndex ||
      sourceIndex < 0 ||
      targetIndex < 0 ||
      sourceIndex >= book.chapters.length ||
      targetIndex >= book.chapters.length
    ) {
      return book;
    }
    const [moved] = book.chapters.splice(sourceIndex, 1);
    book.chapters.splice(targetIndex, 0, moved);
    return storageService.updateBook(bookId, book);
  },

  reorderSections: (bookId, sourceChapterId, targetChapterId, sourceIndex, targetIndex) => {
    const book = storageService.getBook(bookId);
    if (!book || !book.chapters) return book;
    const srcChap = book.chapters.find((c) => c.id === sourceChapterId);
    const tgtChap = book.chapters.find((c) => c.id === targetChapterId);
    if (!srcChap || !tgtChap || !srcChap.sections || !tgtChap.sections) return book;

    if (sourceChapterId === targetChapterId) {
      if (sourceIndex === targetIndex) return book;
      const [moved] = srcChap.sections.splice(sourceIndex, 1);
      srcChap.sections.splice(targetIndex, 0, moved);
    } else {
      const [moved] = srcChap.sections.splice(sourceIndex, 1);
      tgtChap.sections.splice(targetIndex, 0, moved);
    }
    return storageService.updateBook(bookId, book);
  },

  // --- 1-1. 도서 버전 관리 (스냅샷 및 히스토리) ---
  createBookVersion: (bookId, versionName) => {
    const book = storageService.getBook(bookId);
    if (!book) throw new Error('도서를 찾을 수 없습니다.');
    const existingVersions = Array.isArray(book.versions) ? [...book.versions] : [];
    
    // 현재 도서 전체 글자 수 계산
    const totalWords = (book.chapters || []).reduce((acc, c) =>
      acc + (c.sections || []).reduce((sAcc, s) => sAcc + (s.content ? s.content.replace(/<[^>]*>/g, '').trim().length : 0), 0), 0);

    const newVersion = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: versionName?.trim() || `v${existingVersions.length + 1}.0`,
      createdAt: new Date().toISOString(),
      chapterCount: book.chapters?.length || 0,
      totalWords,
      chapters: structuredClone(book.chapters || []),
      isAutoBackup: false
    };

    // 최대 15개 버전 보존 (Zero-Lag 및 용량 최적화)
    const updatedVersions = [newVersion, ...existingVersions].slice(0, 15);
    return storageService.updateBook(bookId, { versions: updatedVersions });
  },

  // 책 전체 저장 시 히스토리 자동 갱신: 첫 저장이면 v1.0 등록, 기존 버전 있으면 최신 버전 덮어쓰기
  saveOrUpdateLatestVersion: (bookId, defaultVersionName = 'v1.0') => {
    const book = storageService.getBook(bookId);
    if (!book) throw new Error('도서를 찾을 수 없습니다.');
    const existingVersions = Array.isArray(book.versions) ? [...book.versions] : [];

    const totalWords = (book.chapters || []).reduce((acc, c) =>
      acc + (c.sections || []).reduce((sAcc, s) => sAcc + (s.content ? s.content.replace(/<[^>]*>/g, '').trim().length : 0), 0), 0);

    if (existingVersions.length === 0) {
      const newVersion = {
        id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: defaultVersionName,
        createdAt: new Date().toISOString(),
        chapterCount: book.chapters?.length || 0,
        totalWords,
        chapters: structuredClone(book.chapters || []),
        isAutoBackup: false
      };
      return storageService.updateBook(bookId, { versions: [newVersion] });
    }

    // 이미 존재하는 경우 가장 최근 버전 덮어쓰기
    const latestVersion = existingVersions[0];
    const updatedLatest = {
      ...latestVersion,
      createdAt: new Date().toISOString(),
      chapterCount: book.chapters?.length || 0,
      totalWords,
      chapters: structuredClone(book.chapters || [])
    };
    existingVersions[0] = updatedLatest;

    return storageService.updateBook(bookId, { versions: existingVersions });
  },

  restoreBookVersion: (bookId, versionId) => {
    const book = storageService.getBook(bookId);
    if (!book) throw new Error('도서를 찾을 수 없습니다.');
    const versions = Array.isArray(book.versions) ? book.versions : [];
    const targetVersion = versions.find(v => v.id === versionId);
    if (!targetVersion) throw new Error('해당 버전을 찾을 수 없습니다.');

    // 복원 실행: 현재 챕터 목록을 해당 버전의 스냅샷으로 교체
    const restoredChapters = structuredClone(targetVersion.chapters || []);
    return storageService.updateBook(bookId, { chapters: restoredChapters });
  },

  deleteBookVersion: (bookId, versionId) => {
    const book = storageService.getBook(bookId);
    if (!book) throw new Error('도서를 찾을 수 없습니다.');
    const versions = Array.isArray(book.versions) ? book.versions : [];
    const updatedVersions = versions.filter(v => v.id !== versionId);
    return storageService.updateBook(bookId, { versions: updatedVersions });
  },

  // --- 1-2. 창작실 (아이디어 노트, 기획서, 인물 관계도, 스토리라인 뼈대) ---
  updateBookPlanning: (bookId, planningData) => {
    return storageService.updateBook(bookId, planningData);
  },

  updateBookCharacters: (bookId, characters) => {
    return storageService.updateBook(bookId, { characters });
  },

  updateBookPlotStages: (bookId, plotStages) => {
    return storageService.updateBook(bookId, { plotStages });
  },

  // --- 2. 자료 금고 (Vault) ---
  getVault: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VAULT);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveVault: (vault) => {
    localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(vault));
  },

  createVaultItem: (item) => {
    const vault = storageService.getVault();
    const newItem = {
      id: `vault_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...item
    };
    vault.unshift(newItem);
    storageService.saveVault(vault);
    return newItem;
  },

  updateVaultItem: (id, updates) => {
    const vault = storageService.getVault();
    const idx = vault.findIndex(v => v.id === id);
    if (idx === -1) {
      const newItem = {
        id: id || `vault_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        ...updates
      };
      vault.unshift(newItem);
      storageService.saveVault(vault);
      return newItem;
    }
    vault[idx] = { ...vault[idx], ...updates, updatedAt: new Date().toISOString() };
    storageService.saveVault(vault);
    return vault[idx];
  },

  deleteVaultItem: (id) => {
    const vault = storageService.getVault();
    const filtered = vault.filter(v => v.id !== id);
    storageService.saveVault(filtered);
    return { success: true };
  },

  // --- 3. 설정 (Config) ---
  getConfig: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (!data) return DEFAULT_CONFIG;
      const parsed = JSON.parse(data);
      // 구버전 Gemma 모델 ID 하위 호환 자동 마이그레이션
      if (parsed.geminiModel === 'gemma-4-31b') parsed.geminiModel = 'gemma-4-31b-it';
      if (parsed.geminiModel === 'gemma-4-26b') parsed.geminiModel = 'gemma-4-26b-a4b-it';
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  saveConfig: (cfg) => {
    const current = storageService.getConfig();
    const merged = { ...current, ...cfg };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(merged));
    return merged;
  },

  // --- 4. 통계 (Stats) ---
  getStats: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STATS);
      const stats = data ? { ...DEFAULT_STATS, ...JSON.parse(data) } : DEFAULT_STATS;

      // 실시간 집계 보정
      const books = storageService.getBooks();
      let totalWords = 0;
      let completedChaps = 0;
      books.forEach(b => {
        b.chapters?.forEach(c => {
          let allDone = c.sections?.length > 0;
          c.sections?.forEach(s => {
            if (s.content) totalWords += s.content.trim().length;
            if (!s.content || s.content.trim().length === 0) allDone = false;
          });
          if (allDone) completedChaps++;
        });
      });

      return {
        ...stats,
        totalWordsGenerated: Math.max(stats.totalWordsGenerated, totalWords),
        totalChaptersCompleted: completedChaps
      };
    } catch {
      return DEFAULT_STATS;
    }
  },

  incrementAiCount: () => {
    const stats = storageService.getStats();
    stats.aiGenerationsCount = (stats.aiGenerationsCount || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  },

  // --- 5. 작가 문체 페르소나 (Author Persona) ---
  getAuthorPersona: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTHOR_PERSONA);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveAuthorPersona: (persona) => {
    localStorage.setItem(STORAGE_KEYS.AUTHOR_PERSONA, JSON.stringify(persona));
    return persona;
  },

  // --- 5-1. 독서 기록(reader_history) & 담은 작품(reader_shelf) 일원화 ---
  getReadingHistory: () => {
    try {
      const rawHistory = localStorage.getItem(STORAGE_KEYS.READER_HISTORY) || '[]';
      const parsedHistory = JSON.parse(rawHistory);
      const historyList = Array.isArray(parsedHistory) ? parsedHistory : [];

      // 구버전에서 열람 없이 서재 담기만 했던 항목(wordsCount === undefined && !isCompleted) 자동 이관
      const bookmarkOnlyItems = historyList.filter(h => h.wordsCount === undefined && !h.isCompleted);
      if (bookmarkOnlyItems.length > 0) {
        const actualHistory = historyList.filter(h => !(h.wordsCount === undefined && !h.isCompleted));
        const currentShelf = storageService.getShelfItems();
        let shelfChanged = false;
        bookmarkOnlyItems.forEach(item => {
          if (!currentShelf.some(s => s.bookId === item.bookId)) {
            currentShelf.unshift({
              ...item,
              category: item.category || DEFAULT_SHELF_CATEGORIES[0],
              savedAt: item.savedAt || item.readAt || new Date().toISOString()
            });
            shelfChanged = true;
          }
        });
        localStorage.setItem(STORAGE_KEYS.READER_HISTORY, JSON.stringify(actualHistory));
        if (shelfChanged) {
          storageService.saveShelfItems(currentShelf);
        }
        return actualHistory;
      }

      return historyList;
    } catch {
      return [];
    }
  },

  saveReadingHistory: (list) => {
    const safeList = Array.isArray(list) ? list : [];
    localStorage.setItem(STORAGE_KEYS.READER_HISTORY, JSON.stringify(safeList));
    return safeList;
  },

  removeReadingHistoryItem: (bookId) => {
    const updated = storageService.getReadingHistory().filter(item => item.bookId !== bookId);
    return storageService.saveReadingHistory(updated);
  },

  getShelfItems: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.READER_SHELF) || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveShelfItems: (list) => {
    const safeList = Array.isArray(list) ? list : [];
    localStorage.setItem(STORAGE_KEYS.READER_SHELF, JSON.stringify(safeList));
    return safeList;
  },

  removeShelfItem: (bookId) => {
    const updated = storageService.getShelfItems().filter(item => item.bookId !== bookId);
    return storageService.saveShelfItems(updated);
  },

  updateShelfItemCategory: (bookId, newCategory) => {
    const updated = storageService.getShelfItems().map(item =>
      item.bookId === bookId ? { ...item, category: newCategory } : item
    );
    return storageService.saveShelfItems(updated);
  },

  toggleShelfItem: (book, defaultCategory = DEFAULT_SHELF_CATEGORIES[0]) => {
    const list = storageService.getShelfItems();
    const exists = list.some(item => item.bookId === book.id);
    if (exists) {
      const updated = list.filter(item => item.bookId !== book.id);
      storageService.saveShelfItems(updated);
      return { added: false, list: updated };
    }
    const firstChap = book.publishedChapters?.[0] || book.chapters?.[0];
    const newEntry = {
      bookId: book.id,
      bookTitle: book.title,
      subtitle: book.subtitle || '',
      author: book.author || '작가 미상',
      genre: book.genre || '소설',
      coverColor: book.coverColor || 'linear-gradient(135deg, #1b382b, #0d1e16)',
      chapterId: firstChap?.id || null,
      chapterTitle: firstChap?.title || '1화',
      category: defaultCategory,
      savedAt: new Date().toISOString()
    };
    const updated = [newEntry, ...list];
    storageService.saveShelfItems(updated);
    return { added: true, list: updated };
  },

  getShelfCategories: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.READER_SHELF_CATEGORIES);
      const parsed = raw ? JSON.parse(raw) : DEFAULT_SHELF_CATEGORIES;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SHELF_CATEGORIES;
    } catch {
      return DEFAULT_SHELF_CATEGORIES;
    }
  },

  saveShelfCategories: (categories) => {
    const safeList = Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_SHELF_CATEGORIES;
    localStorage.setItem(STORAGE_KEYS.READER_SHELF_CATEGORIES, JSON.stringify(safeList));
    return safeList;
  },

  markBookDeletedInReaderLists: (bookId) => {
    const updatedHistory = storageService.getReadingHistory().map(h =>
      h.bookId === bookId ? { ...h, isDeleted: true } : h
    );
    storageService.saveReadingHistory(updatedHistory);

    const updatedShelf = storageService.getShelfItems().map(s =>
      s.bookId === bookId ? { ...s, isDeleted: true } : s
    );
    storageService.saveShelfItems(updatedShelf);
  },

  // --- 6. 전체 로컬 백업 내보내기 & 복원 ---
  exportBackupData: () => {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      books: storageService.getBooks(),
      vault: storageService.getVault(),
      stats: storageService.getStats(),
      config: storageService.getConfig(),
      authorPersona: storageService.getAuthorPersona(),
      readingHistory: storageService.getReadingHistory(),
      shelfItems: storageService.getShelfItems(),
      shelfCategories: storageService.getShelfCategories()
    };
  },

  importBackupData: (backupObj) => {
    if (!backupObj || typeof backupObj !== 'object') {
      throw new Error('유효하지 않은 백업 데이터 형식입니다.');
    }
    if (Array.isArray(backupObj.books)) {
      storageService.saveBooks(backupObj.books);
    }
    if (Array.isArray(backupObj.vault)) {
      storageService.saveVault(backupObj.vault);
    }
    if (backupObj.config) {
      storageService.saveConfig(backupObj.config);
    }
    if (backupObj.authorPersona) {
      storageService.saveAuthorPersona(backupObj.authorPersona);
    }
    if (Array.isArray(backupObj.readingHistory)) {
      storageService.saveReadingHistory(backupObj.readingHistory);
    }
    if (Array.isArray(backupObj.shelfItems)) {
      storageService.saveShelfItems(backupObj.shelfItems);
    }
    if (Array.isArray(backupObj.shelfCategories)) {
      storageService.saveShelfCategories(backupObj.shelfCategories);
    }
    return true;
  }
};
