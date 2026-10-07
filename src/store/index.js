import { create } from 'zustand';
import { bookService } from '../services/bookService';
import { authService } from '../services/authService';
import { cloudSyncService } from '../services/cloudSyncService';

export const useStore = create((set, get) => {
  const initialTheme = localStorage.getItem('book_theme') || 'light';
  if (initialTheme === 'dark') {
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
  }

  return {
    // --- 인증 & 클라우드 동기화 상태 ---
    user: null,
    isAuthLoading: true,
    syncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error'
    lastSyncedAt: cloudSyncService.getLastSyncedTime(),

    initAuth: () => {
      authService.onAuthChange((user) => {
        set({ user, isAuthLoading: false });
        if (user) {
          // 인증 토큰 준비 완료 후 백그라운드 동기화
          setTimeout(() => {
            get().syncToCloud(false);
          }, 800);
        }
      });
    },

    loginWithGoogle: async () => {
      try {
        const user = await authService.signInWithGoogle();
        set({ user });
        get().showToast(`환영합니다, ${user.displayName} 작가님!`, 'success');
        setTimeout(() => {
          get().syncToCloud(false);
        }, 800);
      } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user') {
          get().showToast(`로그인 실패: ${err.message}`, 'error');
        }
      }
    },

    logout: async () => {
      try {
        await authService.logout();
        set({ user: null });
        get().showToast('로그아웃되었습니다.', 'info');
      } catch (err) {
        get().showToast(`로그아웃 실패: ${err.message}`, 'error');
      }
    },

    syncToCloud: async (showNotification = true) => {
      const { user, syncStatus } = get();
      if (!user) {
        if (showNotification) get().showToast('클라우드 동기화를 위해 로그인이 필요합니다.', 'info');
        return;
      }
      if (syncStatus === 'syncing') return; // 이미 동기화 중이면 중복 실행 방지

      try {
        set({ syncStatus: 'syncing' });
        const result = await cloudSyncService.backupToCloud(user.uid, user.email, user.displayName);
        set({ syncStatus: 'synced', lastSyncedAt: result.syncedAt });
        if (showNotification) {
          get().showToast('클라우드에 안전하게 동기화되었습니다! ☁️', 'success');
        }
      } catch (err) {
        console.error('[CloudSync Error]:', err);
        set({ syncStatus: 'error' });
        if (showNotification) {
          get().showToast(`동기화 실패: ${err.message}`, 'error');
        }
        // 4초 후 idle로 상태 복구
        setTimeout(() => {
          if (get().syncStatus === 'error') set({ syncStatus: 'idle' });
        }, 4000);
      }
    },

    restoreFromCloud: async () => {
      const { user } = get();
      if (!user) {
        get().showToast('클라우드 복원을 위해 로그인이 필요합니다.', 'error');
        return;
      }
      try {
        set({ syncStatus: 'syncing' });
        const result = await cloudSyncService.restoreFromCloud(user.uid, user.email);
        if (!result.exists) {
          set({ syncStatus: 'idle' });
          get().showToast(result.message, 'info');
          return;
        }
        await get().loadBooks();
        await get().loadVault();
        set({ syncStatus: 'synced', lastSyncedAt: result.syncedAt });
        get().showToast(`클라우드에서 ${result.itemCounts.books}권의 도서를 복원했습니다!`, 'success');
      } catch (err) {
        set({ syncStatus: 'error' });
        get().showToast(`복원 실패: ${err.message}`, 'error');
      }
    },

    // --- UI 상태 ---
    currentView: 'library', // 'library' | 'studio' | 'vault' | 'stats' | 'settings'
    theme: initialTheme,
    toast: null,

    setView: (view) => set({ currentView: view }),

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      if (nextTheme === 'light') {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }
      localStorage.setItem('book_theme', nextTheme);
      set({ theme: nextTheme });
    },

    isNewBookModalOpen: false,
    setNewBookModalOpen: (isOpen) => set({ isNewBookModalOpen: isOpen }),

    showToast: (message, type = 'info', duration = 3000) => {
      set({ toast: { message, type } });
      setTimeout(() => {
        if (get().toast?.message === message && !get().toast?.isAction) {
          set({ toast: null });
        }
      }, duration);
    },

    showActionToast: (message, onYes, onNo, options = {}) => {
      set({
        toast: {
          message,
          type: 'action',
          isAction: true,
          yesText: options.yesText || 'Yes',
          noText: options.noText || 'No',
          onYes: () => {
            set({ toast: null });
            if (onYes) onYes();
          },
          onNo: () => {
            set({ toast: null });
            if (onNo) onNo();
          }
        }
      });
    },

    hideToast: () => set({ toast: null }),

    // --- 도서 및 집필 상태 ---
    books: [],
    activeBook: null,
    activeChapterId: null,
    activeSectionId: null,
    isBooksLoading: false,

    loadBooks: async () => {
      try {
        set({ isBooksLoading: true });
        const books = await bookService.getBooks();
        const lastBookId = localStorage.getItem('last_active_book_id');
        let targetBook = null;
        if (lastBookId) {
          targetBook = books.find(b => b.id === lastBookId);
        }
        if (!targetBook && books.length > 0) {
          targetBook = books[0];
        }

        set({
          books,
          activeBook: targetBook || null,
          activeChapterId: targetBook?.chapters?.[0]?.id || null,
          activeSectionId: targetBook?.chapters?.[0]?.sections?.[0]?.id || null,
          isBooksLoading: false
        });
      } catch (err) {
        set({ isBooksLoading: false });
      }
    },

    openBook: async (bookId) => {
      try {
        set({ isBooksLoading: true });
        const book = await bookService.getBook(bookId);
        let firstChapId = book.chapters?.[0]?.id || null;
        let firstSecId = book.chapters?.[0]?.sections?.[0]?.id || null;

        localStorage.setItem('last_active_book_id', bookId);

        set({
          activeBook: book,
          activeChapterId: firstChapId,
          activeSectionId: firstSecId,
          currentView: 'studio',
          isBooksLoading: false
        });
      } catch (err) {
        get().showToast(`도서 로드 실패: ${err.message}`, 'error');
        set({ isBooksLoading: false });
      }
    },

    setActiveChapterId: (chapterId) => {
      const book = get().activeBook;
      const chap = book?.chapters?.find(c => c.id === chapterId);
      set({ activeChapterId: chapterId, activeSectionId: chap?.sections?.[0]?.id || null });
    },

    setActiveSectionId: (sectionId) => set({ activeSectionId: sectionId }),

    updateActiveSectionContent: (newContent) => {
      const { activeBook, activeChapterId, activeSectionId } = get();
      if (!activeBook || !activeChapterId || !activeSectionId) return;

      const updatedChapters = activeBook.chapters.map(chap => {
        if (chap.id !== activeChapterId) return chap;
        return {
          ...chap,
          sections: chap.sections.map(sec => {
            if (sec.id !== activeSectionId) return sec;
            return {
              ...sec,
              content: newContent,
              wordCount: newContent.trim().length,
              status: newContent.trim().length > 0 ? 'completed' : 'draft',
              updatedAt: new Date().toISOString()
            };
          })
        };
      });

      set({ activeBook: { ...activeBook, chapters: updatedChapters } });
    },

    updateActiveSectionTitle: (newTitle) => {
      const { activeBook, activeChapterId, activeSectionId } = get();
      if (!activeBook || !activeChapterId || !activeSectionId) return;

      const updatedChapters = activeBook.chapters.map(chap => {
        if (chap.id !== activeChapterId) return chap;
        return {
          ...chap,
          sections: chap.sections.map(sec => {
            if (sec.id !== activeSectionId) return sec;
            return { ...sec, title: newTitle };
          })
        };
      });

      set({ activeBook: { ...activeBook, chapters: updatedChapters } });
    },

    saveActiveSection: async () => {
      const { activeBook, activeChapterId, activeSectionId } = get();
      if (!activeBook || !activeChapterId || !activeSectionId) return false;

      const chap = activeBook.chapters.find(c => c.id === activeChapterId);
      const sec = chap?.sections.find(s => s.id === activeSectionId);
      if (!sec) return false;

      try {
        const updatedBook = await bookService.updateSection(activeBook.id, activeChapterId, activeSectionId, {
          title: sec.title,
          content: sec.content,
          status: sec.status
        });
        set({ activeBook: updatedBook });
        get().loadBooks();
        
        // 설정에 따라 자동 클라우드 백업 여부 결정 (디폴트: false 로컬 전용)
        const cfg = await bookService.getConfig();
        if (get().user && cfg?.autoCloudSyncOnSave) {
          get().syncToCloud(false);
          get().showToast('로컬에 저장되었습니다. (클라우드 백업 완료)', 'success');
        } else {
          get().showToast('로컬에 안전하게 저장되었습니다.', 'success');
        }
        return true;
      } catch (err) {
        get().showToast(`저장 실패: ${err.message}`, 'error');
        return false;
      }
    },

    addChapter: async (title) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.addChapter(activeBook.id, title);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`챕터 추가 실패: ${err.message}`, 'error');
      }
    },

    updateChapterTitle: async (chapterId, newTitle) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.updateChapter(activeBook.id, chapterId, { title: newTitle });
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`챕터명 수정 실패: ${err.message}`, 'error');
      }
    },

    deleteChapter: async (chapterId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.deleteChapter(activeBook.id, chapterId);
        const remainingChapters = updatedBook.chapters || [];
        const nextChap = remainingChapters[0];
        set({
          activeBook: updatedBook,
          activeChapterId: nextChap?.id || null,
          activeSectionId: nextChap?.sections?.[0]?.id || null
        });
        get().loadBooks();
        get().showToast('챕터가 삭제되었습니다.', 'info');
      } catch (err) {
        get().showToast(`챕터 삭제 실패: ${err.message}`, 'error');
      }
    },

    setChapterDeadline: async (chapterId, deadline) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.setChapterDeadline(activeBook.id, chapterId, deadline);
        set({ activeBook: updatedBook });
        get().loadBooks();
        get().showToast('마감일이 설정되었습니다.', 'success');
      } catch (err) {
        get().showToast(`마감일 설정 실패: ${err.message}`, 'error');
      }
    },

    toggleChapterPublish: async (chapterId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.toggleChapterPublish(activeBook.id, chapterId);
        const chap = updatedBook.chapters?.find(c => c.id === chapterId);
        set({ activeBook: updatedBook });
        get().loadBooks();
        if (chap?.status === 'published') {
          get().showToast(`🎉 제 ${chap.title} 챕터가 연재 발행되었습니다!`, 'success');
        } else {
          get().showToast('연재 발행이 취소되고 초고 상태로 전환되었습니다.', 'info');
        }
      } catch (err) {
        get().showToast(`발행 상태 변경 실패: ${err.message}`, 'error');
      }
    },

    addSection: async (chapterId, title) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.addSection(activeBook.id, chapterId, title);
        const targetChap = updatedBook.chapters.find(c => c.id === chapterId);
        const newSec = targetChap?.sections[targetChap.sections.length - 1];
        set({
          activeBook: updatedBook,
          activeChapterId: chapterId,
          activeSectionId: newSec?.id || null
        });
        get().loadBooks();
      } catch (err) {
        get().showToast(`소목차 추가 실패: ${err.message}`, 'error');
      }
    },

    deleteSection: async (chapterId, sectionId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.deleteSection(activeBook.id, chapterId, sectionId);
        const chap = updatedBook.chapters?.find(c => c.id === chapterId);
        const remainingSections = chap?.sections || [];
        set({
          activeBook: updatedBook,
          activeSectionId: remainingSections[0]?.id || null
        });
        get().loadBooks();
        get().showToast('소목차가 삭제되었습니다.', 'info');
      } catch (err) {
        get().showToast(`소목차 삭제 실패: ${err.message}`, 'error');
      }
    },

    deleteBook: async (bookId) => {
      try {
        await bookService.deleteBook(bookId);
        set(state => ({
          books: state.books.filter(b => b.id !== bookId),
          activeBook: state.activeBook?.id === bookId ? null : state.activeBook
        }));
        get().showToast('도서가 삭제되었습니다.', 'info');
      } catch (err) {
        get().showToast(`삭제 실패: ${err.message}`, 'error');
      }
    },

    // --- 자료 금고 (Vault) 상태 ---
    vault: [],
    selectedVaultIds: [],
    activeTagFilter: 'ALL',

    loadVault: async () => {
      try {
        const vault = await bookService.getVault();
        set({ vault });
      } catch (err) {
        console.error(err);
      }
    },

    setTagFilter: (tag) => set({ activeTagFilter: tag }),

    toggleSelectVaultId: (id) => {
      const { selectedVaultIds } = get();
      if (selectedVaultIds.includes(id)) {
        set({ selectedVaultIds: selectedVaultIds.filter(vId => vId !== id) });
      } else {
        set({ selectedVaultIds: [...selectedVaultIds, id] });
      }
    },

    clearSelectedVaultIds: () => set({ selectedVaultIds: [] }),

    deleteVaultItem: async (id) => {
      try {
        await bookService.deleteVaultItem(id);
        set(state => ({
          vault: state.vault.filter(v => v.id !== id),
          selectedVaultIds: state.selectedVaultIds.filter(vId => vId !== id)
        }));
        get().showToast('자료가 삭제되었습니다.', 'info');
      } catch (err) {
        get().showToast(`삭제 실패: ${err.message}`, 'error');
      }
    }
  };
});
