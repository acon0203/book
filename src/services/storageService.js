// Mission 스타일: 브라우저 로컬 저장소 서비스 (Zero-Latency, 100% 오프라인 지원)
const STORAGE_KEYS = {
  BOOKS: 'bookstudio_books',
  VAULT: 'bookstudio_vault',
  CONFIG: 'bookstudio_config',
  STATS: 'bookstudio_stats'
};

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
    return newBook;
  },

  updateBook: (id, bookData) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === id);
    if (index === -1) throw new Error('도서를 찾을 수 없습니다.');
    books[index] = { ...books[index], ...bookData, updatedAt: new Date().toISOString() };
    storageService.saveBooks(books);
    return books[index];
  },

  deleteBook: (id) => {
    const books = storageService.getBooks();
    const filtered = books.filter(b => b.id !== id);
    storageService.saveBooks(filtered);
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

  addSection: (bookId, chapterId, title) => {
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
    chap.sections.push(newSec);
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
  }
};
