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

    openReader: async (bookId, chapterId = null) => {
      try {
        set({ isBooksLoading: true });
        let book = get().books.find(b => b.id === bookId);
        if (!book) {
          book = await bookService.getBook(bookId);
        }
        const targetChapId = chapterId || book?.chapters?.[0]?.id || null;
        const targetSecId = book?.chapters?.find(c => c.id === targetChapId)?.sections?.[0]?.id || null;

        localStorage.setItem('last_active_book_id', bookId);

        // 독서 이력(reader_history) 실시간 갱신
        try {
          const targetChap = book?.chapters?.find(c => c.id === targetChapId);
          const historyRaw = localStorage.getItem('reader_history') || '[]';
          const prevHistory = JSON.parse(historyRaw);
          
          // 작성자/필명 안전 매핑 (단순 '작가' 방지)
          const cfgRaw = localStorage.getItem('bookstudio_config');
          let cfgAuthor = '';
          try { if (cfgRaw) cfgAuthor = JSON.parse(cfgRaw).defaultAuthor; } catch {}
          const userAuthor = get().user?.displayName || cfgAuthor || '김연재';
          const resolvedAuthor = book?.author && book.author !== '작가' ? book.author : userAuthor;

          const newEntry = {
            bookId: book.id,
            bookTitle: book.title,
            subtitle: book.subtitle || '',
            author: resolvedAuthor,
            genre: book.genre || '소설',
            chapterId: targetChapId,
            chapterTitle: targetChap?.title || '1화',
            coverColor: book.coverColor || '#2563eb',
            readAt: new Date().toISOString()
          };
          const updatedHistory = [newEntry, ...prevHistory.filter(h => h.bookId !== book.id)].slice(0, 30);
          localStorage.setItem('reader_history', JSON.stringify(updatedHistory));
        } catch (e) {
          console.error('Failed to update reader_history:', e);
        }

        set({
          activeBook: book,
          activeChapterId: targetChapId,
          activeSectionId: targetSecId,
          currentView: 'reader',
          isBooksLoading: false
        });
      } catch (err) {
        get().showToast(`뷰어 열기 실패: ${err.message}`, 'error');
        set({ isBooksLoading: false });
      }
    },

    setReaderChapter: (chapterId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      const targetChap = activeBook.chapters?.find(c => c.id === chapterId);
      const targetSecId = targetChap?.sections?.[0]?.id || null;
      set({
        activeChapterId: chapterId,
        activeSectionId: targetSecId
      });
    },

    toggleChapterLike: async (chapterId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      const updatedChapters = (activeBook.chapters || []).map((ch) => {
        if (ch.id === chapterId) {
          const currentLikes = ch.likes || 0;
          const isLiked = ch.isUserLiked || false;
          return {
            ...ch,
            likes: isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
            isUserLiked: !isLiked
          };
        }
        return ch;
      });
      const updatedBook = { ...activeBook, chapters: updatedChapters };
      await bookService.saveBook(updatedBook);
      set({ activeBook: updatedBook });
    },

    addChapterComment: async (chapterId, text, author = '익명 독자') => {
      if (!text || !text.trim()) return;
      const { activeBook, user } = get();
      if (!activeBook) return;
      const authorName = user?.displayName || author || '익명 독자';
      const newComment = {
        id: 'cmt_' + Date.now(),
        author: authorName,
        text: text.trim(),
        createdAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      };
      const updatedChapters = (activeBook.chapters || []).map((ch) => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            comments: [newComment, ...(ch.comments || [])]
          };
        }
        return ch;
      });
      const updatedBook = { ...activeBook, chapters: updatedChapters };
      await bookService.saveBook(updatedBook);
      set({ activeBook: updatedBook });
      get().showToast('소중한 독자 댓글이 등록되었습니다! 💬', 'success');
    },

    editChapterComment: async (chapterId, commentId, newText) => {
      if (!newText || !newText.trim()) return;
      const { activeBook } = get();
      if (!activeBook) return;
      const updatedChapters = (activeBook.chapters || []).map((ch) => {
        if (ch.id === chapterId) {
          const updatedComments = (ch.comments || []).map((cmt) => {
            if (cmt.id === commentId) {
              return { ...cmt, text: newText.trim(), editedAt: ' (수정됨)' };
            }
            return cmt;
          });
          return { ...ch, comments: updatedComments };
        }
        return ch;
      });
      const updatedBook = { ...activeBook, chapters: updatedChapters };
      await bookService.saveBook(updatedBook);
      set({ activeBook: updatedBook });
      get().showToast('댓글이 수정되었습니다.', 'success');
    },

    deleteChapterComment: async (chapterId, commentId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      const updatedChapters = (activeBook.chapters || []).map((ch) => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            comments: (ch.comments || []).filter((cmt) => cmt.id !== commentId)
          };
        }
        return ch;
      });
      const updatedBook = { ...activeBook, chapters: updatedChapters };
      await bookService.saveBook(updatedBook);
      set({ activeBook: updatedBook });
      get().showToast('댓글이 삭제되었습니다.', 'info');
    },

    incrementChapterViews: async (chapterId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      const updatedChapters = (activeBook.chapters || []).map((ch) => {
        if (ch.id === chapterId) {
          return { ...ch, views: (ch.views || 0) + 1 };
        }
        return ch;
      });
      const updatedBook = { ...activeBook, chapters: updatedChapters };
      await bookService.saveBook(updatedBook);
      set({ activeBook: updatedBook });
    },

    updateChapterAuthorNote: async (chapterId, note) => {
      const { activeBook } = get();
      if (!activeBook) return;
      const updatedChapters = (activeBook.chapters || []).map((ch) => {
        if (ch.id === chapterId) {
          return { ...ch, authorNote: note };
        }
        return ch;
      });
      const updatedBook = { ...activeBook, chapters: updatedChapters };
      await bookService.saveBook(updatedBook);
      set({ activeBook: updatedBook });
      get().showToast('작가의 말이 업데이트되었습니다.', 'success');
    },

    // --- 버전 관리 액션 ---
    createBookVersion: async (versionName) => {
      const { activeBook } = get();
      if (!activeBook) return false;
      try {
        const updatedBook = await bookService.createBookVersion(activeBook.id, versionName);
        set({ activeBook: updatedBook });
        get().loadBooks();
        get().showToast(`새 버전 '${versionName}'이(가) 안전하게 보관되었습니다.`, 'success');
        return true;
      } catch (err) {
        get().showToast(`버전 저장 실패: ${err.message}`, 'error');
        return false;
      }
    },

    restoreBookVersion: async (versionId) => {
      const { activeBook } = get();
      if (!activeBook) return false;
      try {
        const updatedBook = await bookService.restoreBookVersion(activeBook.id, versionId);
        const firstChapId = updatedBook.chapters?.[0]?.id || null;
        const firstSecId = updatedBook.chapters?.[0]?.sections?.[0]?.id || null;
        set({
          activeBook: updatedBook,
          activeChapterId: firstChapId,
          activeSectionId: firstSecId
        });
        get().loadBooks();
        get().showToast('선택한 버전으로 원고가 복원되었습니다!', 'success');
        return true;
      } catch (err) {
        get().showToast(`버전 복원 실패: ${err.message}`, 'error');
        return false;
      }
    },

    deleteBookVersion: async (versionId) => {
      const { activeBook } = get();
      if (!activeBook) return false;
      try {
        const updatedBook = await bookService.deleteBookVersion(activeBook.id, versionId);
        set({ activeBook: updatedBook });
        get().loadBooks();
        get().showToast('버전 기록이 삭제되었습니다.', 'info');
        return true;
      } catch (err) {
        get().showToast(`버전 삭제 실패: ${err.message}`, 'error');
        return false;
      }
    },

    // --- 창작실 액션 (아이디어 노트, 기획서, 인물 & 플롯) ---
    updateActiveBookPlanning: async (planningData) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.updateBookPlanning(activeBook.id, planningData);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`창작 기획 저장 실패: ${err.message}`, 'error');
      }
    },

    updateActiveBookCharacters: async (characters) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.updateBookCharacters(activeBook.id, characters);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`인물 저장 실패: ${err.message}`, 'error');
      }
    },

    updateActiveBookPlotStages: async (plotStages) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.updateBookPlotStages(activeBook.id, plotStages);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`플롯 저장 실패: ${err.message}`, 'error');
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

    moveChapter: async (chapterId, direction) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.moveChapter(activeBook.id, chapterId, direction);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`챕터 순서 이동 실패: ${err.message}`, 'error');
      }
    },

    moveSection: async (chapterId, sectionId, direction) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.moveSection(activeBook.id, chapterId, sectionId, direction);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`소목차 순서 이동 실패: ${err.message}`, 'error');
      }
    },

    reorderChapters: async (sourceIndex, targetIndex) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.reorderChapters(activeBook.id, sourceIndex, targetIndex);
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`챕터 순서 변경 실패: ${err.message}`, 'error');
      }
    },

    reorderSections: async (sourceChapterId, targetChapterId, sourceIndex, targetIndex) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.reorderSections(
          activeBook.id,
          sourceChapterId,
          targetChapterId,
          sourceIndex,
          targetIndex
        );
        set({ activeBook: updatedBook });
        get().loadBooks();
      } catch (err) {
        get().showToast(`소목차 순서 변경 실패: ${err.message}`, 'error');
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
