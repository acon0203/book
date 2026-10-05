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

  // 2. 챕터 & 소목차
  addChapter: async (bookId, title) => storageService.addChapter(bookId, title),
  deleteChapter: async (bookId, chapterId) => storageService.deleteChapter(bookId, chapterId),
  setChapterDeadline: async (bookId, chapterId, deadline) => storageService.setChapterDeadline(bookId, chapterId, deadline),
  toggleChapterPublish: async (bookId, chapterId) => storageService.toggleChapterPublish(bookId, chapterId),
  addSection: async (bookId, chapterId, title) => storageService.addSection(bookId, chapterId, title),
  updateSection: async (bookId, chapterId, sectionId, data) =>
    storageService.updateSection(bookId, chapterId, sectionId, data),
  deleteSection: async (bookId, chapterId, sectionId) =>
    storageService.deleteSection(bookId, chapterId, sectionId),

  // 3. 자료 금고 (Vault)
  getVault: async () => storageService.getVault(),
  createVaultItem: async (item) => storageService.createVaultItem(item),
  deleteVaultItem: async (id) => storageService.deleteVaultItem(id),

  // 4. 통계 및 설정
  getConfig: async () => storageService.getConfig(),
  saveConfig: async (cfg) => storageService.saveConfig(cfg),
  getStats: async () => storageService.getStats(),

  // 5. AI 자동화 (브라우저 직접 호출)
  generateOutline: async (promptData) => {
    const chapters = await aiService.generateOutline(promptData);
    // 생성된 목차를 해당 도서에 즉시 반영
    if (promptData.bookId) {
      const book = storageService.getBook(promptData.bookId);
      book.chapters = chapters.map((c, cIdx) => ({
        id: `chap_${Date.now()}_${cIdx}`,
        title: c.title,
        sections: c.sections.map((s, sIdx) => ({
          id: `sec_${Date.now()}_${cIdx}_${sIdx}`,
          title: s.title,
          content: '',
          status: 'draft',
          wordCount: 0
        }))
      }));
      storageService.updateBook(promptData.bookId, book);
    }
    return chapters;
  },

  generateSection: async (promptData) => aiService.generateSectionContent(promptData),
  polishContent: async (promptData) => aiService.polishContent(promptData),
};
