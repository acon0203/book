// Mission 방식: 로컬 스토리지 및 브라우저 AI 기반 단일 서비스 모듈 (server.js 의존성 0)
import { storageService } from './storageService';
import { aiService } from './aiService';

export const bookService = {
  // 1. 도서 (Books)
  getBooks: async () => storageService.getBooks(),
  getBook: async (id) => storageService.getBook(id),
  createBook: async (data) => storageService.createBook(data),
  updateBook: async (id, data) => storageService.updateBook(id, data),
  deleteBook: async (id) => storageService.deleteBook(id),

  // 1-1. 도서 버전 관리 (스냅샷 및 히스토리)
  createBookVersion: async (bookId, versionName) => storageService.createBookVersion(bookId, versionName),
  restoreBookVersion: async (bookId, versionId) => storageService.restoreBookVersion(bookId, versionId),
  deleteBookVersion: async (bookId, versionId) => storageService.deleteBookVersion(bookId, versionId),

  // 1-2. 창작실 (아이디어 노트, 기획서, 인물 관계도, 스토리라인 뼈대)
  updateBookPlanning: async (bookId, planningData) => storageService.updateBookPlanning(bookId, planningData),
  updateBookCharacters: async (bookId, characters) => storageService.updateBookCharacters(bookId, characters),
  updateBookPlotStages: async (bookId, plotStages) => storageService.updateBookPlotStages(bookId, plotStages),

  // 2. 챕터 & 소목차
  addChapter: async (bookId, title) => storageService.addChapter(bookId, title),
  updateChapter: async (bookId, chapterId, data) => storageService.updateChapter(bookId, chapterId, data),
  deleteChapter: async (bookId, chapterId) => storageService.deleteChapter(bookId, chapterId),
  setChapterDeadline: async (bookId, chapterId, deadline) => storageService.setChapterDeadline(bookId, chapterId, deadline),
  toggleChapterPublish: async (bookId, chapterId) => storageService.toggleChapterPublish(bookId, chapterId),
  addSection: async (bookId, chapterId, title) => storageService.addSection(bookId, chapterId, title),
  updateSection: async (bookId, chapterId, sectionId, data) =>
    storageService.updateSection(bookId, chapterId, sectionId, data),
  deleteSection: async (bookId, chapterId, sectionId) =>
    storageService.deleteSection(bookId, chapterId, sectionId),
  moveChapter: async (bookId, chapterId, direction) =>
    storageService.moveChapter(bookId, chapterId, direction),
  moveSection: async (bookId, chapterId, sectionId, direction) =>
    storageService.moveSection(bookId, chapterId, sectionId, direction),
  reorderChapters: async (bookId, sourceIndex, targetIndex) =>
    storageService.reorderChapters(bookId, sourceIndex, targetIndex),
  reorderSections: async (bookId, sourceChapterId, targetChapterId, sourceIndex, targetIndex) =>
    storageService.reorderSections(bookId, sourceChapterId, targetChapterId, sourceIndex, targetIndex),

  // 3. 자료 금고 (Vault)
  getVault: async () => storageService.getVault(),
  createVaultItem: async (item) => storageService.createVaultItem(item),
  deleteVaultItem: async (id) => storageService.deleteVaultItem(id),

  // 4. 통계 및 설정
  getConfig: async () => storageService.getConfig(),
  saveConfig: async (cfg) => storageService.saveConfig(cfg),
  getStats: async () => storageService.getStats(),
  exportBackupData: async () => storageService.exportBackupData(),
  importBackupData: async (data) => storageService.importBackupData(data),

  // 5. AI 자동화 (브라우저 직접 호출)
  generateOutline: async (promptData) => {
    const chapters = await aiService.generateOutline(promptData);
    // 생성된 목차를 해당 도서에 즉시 반영
    if (promptData.bookId) {
      const book = storageService.getBook(promptData.bookId);
      book.chapters = chapters.map((c, cIdx) => ({
        id: `chap_${Date.now()}_${cIdx}`,
        title: aiService.cleanOutlineTitle(c.title),
        sections: c.sections.map((s, sIdx) => ({
          id: `sec_${Date.now()}_${cIdx}_${sIdx}`,
          title: aiService.cleanOutlineTitle(s.title),
          content: '',
          status: 'draft',
          wordCount: 0
        }))
      }));
      storageService.updateBook(promptData.bookId, book);
    }
    return chapters;
  },

  // 6. AI 총괄 편집장 상담 & 목차 재구성
  consultEditorChief: async (data) => aiService.consultEditorChief(data),

  applyRestructuredOutline: async (bookId, newChapters) => {
    const book = storageService.getBook(bookId);
    if (!book) throw new Error('도서를 찾을 수 없습니다.');

    // 기존에 작성된 본문 콘텐츠 풀(Pool) 수집 (제목이나 내용 보존 매핑용)
    const existingContentMap = new Map();
    (book.chapters || []).forEach(ch => {
      (ch.sections || []).forEach(sec => {
        if (sec.content && sec.content.trim()) {
          const cleanKey = aiService.cleanOutlineTitle(sec.title).toLowerCase();
          existingContentMap.set(cleanKey, sec.content);
        }
      });
    });

    // 새 목차 트리 구조 적용
    const now = Date.now();
    book.chapters = newChapters.map((c, cIdx) => ({
      id: `chap_${now}_${cIdx}`,
      title: aiService.cleanOutlineTitle(c.title),
      sections: (c.sections || []).map((s, sIdx) => {
        const cleanTitle = aiService.cleanOutlineTitle(s.title);
        const cleanKey = cleanTitle.toLowerCase();
        // 기존 작성 본문이 있으면 유지, 없으면 빈 상태
        const preservedContent = existingContentMap.get(cleanKey) || '';
        return {
          id: `sec_${now}_${cIdx}_${sIdx}`,
          title: cleanTitle,
          content: preservedContent,
          status: preservedContent ? 'draft' : 'draft',
          wordCount: preservedContent ? preservedContent.replace(/<[^>]*>/g, '').trim().length : 0
        };
      })
    }));

    storageService.updateBook(bookId, book);
    return book;
  },

  generateSection: async (promptData) => aiService.generateSectionContent(promptData),
  polishContent: async (promptData) => aiService.polishContent(promptData),
};
