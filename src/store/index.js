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

  const initialFontScale = localStorage.getItem('book_font_scale') || 'normal';
  document.documentElement.setAttribute('data-font-scale', initialFontScale);

  const validViews = ['library', 'studio', 'vault', 'stats', 'settings', 'reader'];
  const savedView = localStorage.getItem('book_current_view');
  const initialView = validViews.includes(savedView) ? savedView : 'library';

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
          setTimeout(() => {
            get().checkCloudOnStartup();
          }, 600);
        }
      });
    },

    loginWithGoogle: async () => {
      try {
        const user = await authService.signInWithGoogle();
        set({ user });
        get().showToast(`환영합니다, ${user.displayName} 작가님!`, 'success');
        setTimeout(() => {
          get().checkCloudOnStartup();
        }, 600);
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

    /**
     * 앱 시작 또는 로그인 시 클라우드의 최신 상태를 가볍게 점검
     * - 다른 PC에서 작업한 최신본이 있고 현재 PC에 변경사항이 없으면 자동으로 최신본 로드
     * - 충돌 상태이면 사용자에게 동기화 필요 알림
     */
    checkCloudOnStartup: async () => {
      const { user } = get();
      if (!user) return;
      try {
        const status = await cloudSyncService.checkSyncStatus(user.uid, user.email);
        if (status.direction === 'download') {
          console.log('[CloudSync] 📥 다른 PC에서 작업한 최신 원고 감지 ➔ 자동 최신화');
          set({ syncStatus: 'syncing' });
          const result = await cloudSyncService.restoreFromCloud(user.uid, user.email);
          await get().loadBooks();
          await get().loadVault();
          set({ syncStatus: 'synced', lastSyncedAt: result.syncedAt });
          get().showToast(`다른 기기에서 작성된 최신 원고를 안전하게 불러왔습니다! (${result.itemCounts.books}권)`, 'success');
        } else if (status.direction === 'conflict') {
          set({ syncStatus: 'idle' });
          get().showToast('다른 기기에서 수정한 최신 원고가 있습니다. 동기화 버튼을 확인해주세요.', 'info');
        } else if (status.direction === 'upToDate') {
          set({ syncStatus: 'synced', lastSyncedAt: status.cloudMeta?.updatedAt || get().lastSyncedAt });
        }
      } catch (e) {
        console.warn('[CloudSync] checkCloudOnStartup error:', e);
      }
    },

    /**
     * 드롭박스 방식의 양방향 스마트 동기화
     * - 클라우드가 더 최신: 클라우드에서 안전하게 다운로드(Pull)
     * - 로컬이 더 최신: 로컬 데이터를 클라우드에 안전하게 업로드(Push)
     * - 양쪽 모두 수정됨(충돌): 사용자에게 안내 다이얼로그 띄워 선택하게 함
     */
    syncToCloud: async (showNotification = true, forceDirection = null) => {
      const { user, syncStatus, openConfirm } = get();
      if (!user) {
        if (showNotification) get().showToast('클라우드 동기화를 위해 로그인이 필요합니다.', 'info');
        return;
      }
      if (syncStatus === 'syncing') return; // 이미 동기화 중이면 중복 실행 방지

      try {
        set({ syncStatus: 'syncing' });

        let direction = forceDirection;
        let checkResult = null;

        // 강제 방향 지정이 없으면 상태 분석
        if (!direction) {
          checkResult = await cloudSyncService.checkSyncStatus(user.uid, user.email);
          direction = checkResult.direction;
        }

        // 1. 클라우드 최신본 다운로드
        if (direction === 'download') {
          const result = await cloudSyncService.restoreFromCloud(user.uid, user.email);
          await get().loadBooks();
          await get().loadVault();
          set({ syncStatus: 'synced', lastSyncedAt: result.syncedAt });
          if (showNotification) {
            get().showToast(`다른 기기에서 작성된 최신 원고를 안전하게 불러왔습니다! (${result.itemCounts.books}권)`, 'success');
          }
          return;
        }

        // 2. 현재 PC 원고 업로드
        if (direction === 'upload') {
          const result = await cloudSyncService.backupToCloud(user.uid, user.email, user.displayName);
          set({ syncStatus: 'synced', lastSyncedAt: result.syncedAt });
          if (showNotification) {
            get().showToast('현재 원고가 클라우드에 안전하게 동기화(백업)되었습니다.', 'success');
          }
          return;
        }

        // 3. 이미 일치하는 경우
        if (direction === 'upToDate') {
          set({ syncStatus: 'synced' });
          if (showNotification) {
            get().showToast('클라우드와 현재 원고가 이미 최신 상태로 일치합니다.', 'info');
          }
          return;
        }

        // 4. 충돌(Conflict) 상황: 양쪽 모두 수정된 경우
        if (direction === 'conflict') {
          set({ syncStatus: 'idle' });
          const cloudDateStr = checkResult?.cloudMeta?.updatedAt
            ? new Date(checkResult.cloudMeta.updatedAt).toLocaleString('ko-KR')
            : '최근';

          const shouldRestore = await openConfirm({
            title: '원고 동기화 충돌 감지',
            message: `다른 기기에서 수정한 최신 원고(${cloudDateStr})와 현재 PC의 수정 내역이 모두 존재합니다.\n\n클라우드의 최신 원고를 불러오시겠습니까?\n(현재 PC 원고는 버전 기록에 안전하게 자동 보존됩니다.)`,
            confirmText: '클라우드 최신본 가져오기',
            cancelText: '현재 PC 원고로 덮어쓰기'
          });

          if (shouldRestore) {
            await get().syncToCloud(showNotification, 'download');
          } else {
            await get().syncToCloud(showNotification, 'upload');
          }
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

    // 로컬 데이터 수정 시 클라우드 동기화 상태를 'idle'(구름 아이콘)로 자동 리셋
    markUnsynced: () => {
      if (get().syncStatus === 'synced') {
        set({ syncStatus: 'idle' });
      }
    },

    // --- UI 상태 ---
    currentView: initialView, // 'library' | 'studio' | 'vault' | 'stats' | 'settings' | 'reader'
    previousView: 'library',
    theme: initialTheme,
    toast: null,

    setView: (view) => {
      const current = get().currentView;
      localStorage.setItem('book_current_view', view);
      set({
        previousView: (current && current !== view) ? current : get().previousView,
        currentView: view
      });
    },

    closeReader: () => {
      const { previousView } = get();
      const targetView = (previousView && previousView !== 'reader') ? previousView : 'library';
      localStorage.setItem('book_current_view', targetView);
      set({ currentView: targetView });
    },

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(nextTheme);
    },

    setTheme: (newTheme) => {
      if (newTheme === 'light') {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }
      localStorage.setItem('book_theme', newTheme);
      set({ theme: newTheme });
    },

    fontScale: localStorage.getItem('book_font_scale') || 'normal',
    setFontScale: (scale) => {
      document.documentElement.setAttribute('data-font-scale', scale);
      localStorage.setItem('book_font_scale', scale);
      set({ fontScale: scale });
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

    // --- 전역 커스텀 다이얼로그 (Confirm / Prompt) ---
    dialog: null, // { type: 'confirm'|'prompt', title, message, placeholder, defaultValue, confirmText, cancelText, danger, resolve }
    openConfirm: (options = {}) => {
      return new Promise((resolve) => {
        set({
          dialog: {
            type: 'confirm',
            title: options.title || '확인',
            message: options.message || '',
            confirmText: options.confirmText || '확인',
            cancelText: options.cancelText || '취소',
            danger: !!options.danger,
            resolve
          }
        });
      });
    },
    openPrompt: (options = {}) => {
      return new Promise((resolve) => {
        set({
          dialog: {
            type: 'prompt',
            title: options.title || '입력',
            message: options.message || '',
            placeholder: options.placeholder || '',
            defaultValue: options.defaultValue || '',
            confirmText: options.confirmText || '확인',
            cancelText: options.cancelText || '취소',
            danger: !!options.danger,
            resolve
          }
        });
      });
    },
    closeDialog: (result = null) => {
      const currentDialog = get().dialog;
      if (currentDialog?.resolve) {
        currentDialog.resolve(result);
      }
      set({ dialog: null });
    },

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

        const savedChapId = localStorage.getItem('last_active_chapter_id');
        const savedSecId = localStorage.getItem('last_active_section_id');

        let targetChap = targetBook?.chapters?.find(c => c.id === savedChapId);
        if (!targetChap && targetBook?.chapters?.length > 0) {
          targetChap = targetBook.chapters[0];
        }

        let targetSec = targetChap?.sections?.find(s => s.id === savedSecId);
        if (!targetSec && targetChap?.sections?.length > 0) {
          targetSec = targetChap.sections[0];
        }

        set({
          books,
          activeBook: targetBook || null,
          activeChapterId: targetChap?.id || null,
          activeSectionId: targetSec?.id || null,
          isBooksLoading: false
        });
      } catch (err) {
        set({ isBooksLoading: false });
      }
    },

    setActiveBook: (bookOrId) => {
      if (!bookOrId) {
        set({ activeBook: null });
        return;
      }
      const book = typeof bookOrId === 'object' ? bookOrId : get().books.find(b => b.id === bookOrId);
      if (book) {
        localStorage.setItem('last_active_book_id', book.id);
        const firstChapId = book.chapters?.[0]?.id || null;
        const firstSecId = book.chapters?.[0]?.sections?.[0]?.id || null;
        set({
          activeBook: book,
          activeChapterId: firstChapId,
          activeSectionId: firstSecId
        });
      }
    },

    openBook: async (bookId) => {
      try {
        set({ isBooksLoading: true });
        const book = await bookService.getBook(bookId);
        let firstChapId = book.chapters?.[0]?.id || null;
        let firstSecId = book.chapters?.[0]?.sections?.[0]?.id || null;

        localStorage.setItem('last_active_book_id', bookId);
        localStorage.setItem('book_current_view', 'studio');
        if (firstChapId) localStorage.setItem('last_active_chapter_id', firstChapId);
        if (firstSecId) localStorage.setItem('last_active_section_id', firstSecId);

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
        localStorage.setItem('book_current_view', 'reader');

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
            coverColor: book.coverColor || 'linear-gradient(135deg, #1b382b, #0d1e16)',
            readAt: new Date().toISOString()
          };
          const updatedHistory = [newEntry, ...prevHistory.filter(h => h.bookId !== book.id)].slice(0, 30);
          localStorage.setItem('reader_history', JSON.stringify(updatedHistory));
        } catch (e) {
          console.error('Failed to update reader_history:', e);
        }

        const current = get().currentView;
        set({
          activeBook: book,
          activeChapterId: targetChapId,
          activeSectionId: targetSecId,
          previousView: (current && current !== 'reader') ? current : (get().previousView || 'library'),
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

    toggleBookCompleted: async (bookId) => {
      const { books, activeBook } = get();
      const targetId = bookId || activeBook?.id;
      const target = books.find(b => b.id === targetId) || activeBook;
      if (!target) return;
      const nextCompleted = !target.isCompleted;
      const updatedBook = {
        ...target,
        isCompleted: nextCompleted,
        status: nextCompleted ? 'completed' : 'ongoing'
      };
      await bookService.saveBook(updatedBook);
      set((state) => ({
        activeBook: (state.activeBook?.id === targetId) ? updatedBook : state.activeBook,
        books: state.books.map(b => b.id === targetId ? updatedBook : b)
      }));
      get().markUnsynced();
      get().showToast(
        nextCompleted
          ? `'${target.title}' 도서가 완결(완성작)로 등록되었습니다.`
          : `'${target.title}' 도서가 연재중으로 전환되었습니다.`,
        'success'
      );
      return nextCompleted;
    },

    updateBookTitle: async (bookId, newTitle) => {
      const { books, activeBook } = get();
      const targetId = bookId || activeBook?.id;
      const target = books.find(b => b.id === targetId) || activeBook;
      if (!target || !newTitle?.trim()) return null;
      const trimmed = newTitle.trim();
      const updatedBook = { ...target, title: trimmed };
      await bookService.saveBook(updatedBook);
      set((state) => ({
        activeBook: (state.activeBook?.id === targetId) ? updatedBook : state.activeBook,
        books: state.books.map(b => b.id === targetId ? updatedBook : b)
      }));
      get().markUnsynced();
      get().showToast(`도서 제목이 '${trimmed}'(으)로 변경되었습니다.`, 'success');
      return updatedBook;
    },

    updateBookInfo: async (bookId, updateData) => {
      const { books, activeBook } = get();
      const targetId = bookId || activeBook?.id;
      const target = books.find(b => b.id === targetId) || activeBook;
      if (!target) return null;
      const updatedBook = {
        ...target,
        ...updateData,
        title: updateData.title ? updateData.title.trim() : target.title,
        updatedAt: new Date().toISOString()
      };
      await bookService.saveBook(updatedBook);
      set((state) => ({
        activeBook: (state.activeBook?.id === targetId) ? updatedBook : state.activeBook,
        books: state.books.map(b => b.id === targetId ? updatedBook : b)
      }));
      get().markUnsynced();
      get().showToast('도서 정보가 성공적으로 저장되었습니다.', 'success');
      return updatedBook;
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
      set((state) => ({
        activeBook: updatedBook,
        books: state.books.map(b => b.id === updatedBook.id ? updatedBook : b)
      }));
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
      set((state) => ({
        activeBook: updatedBook,
        books: state.books.map(b => b.id === updatedBook.id ? updatedBook : b)
      }));
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
      set((state) => ({
        activeBook: updatedBook,
        books: state.books.map(b => b.id === updatedBook.id ? updatedBook : b)
      }));
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
      set((state) => ({
        activeBook: updatedBook,
        books: state.books.map(b => b.id === updatedBook.id ? updatedBook : b)
      }));
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
      set((state) => ({
        activeBook: updatedBook,
        books: state.books.map(b => b.id === updatedBook.id ? updatedBook : b)
      }));
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
      set((state) => ({
        activeBook: updatedBook,
        books: state.books.map(b => b.id === updatedBook.id ? updatedBook : b)
      }));
      get().showToast('작가의 말이 업데이트되었습니다.', 'success');
    },

    // --- 버전 관리 액션 ---
    createBookVersion: async (versionName) => {
      const { activeBook } = get();
      if (!activeBook) return false;
      try {
        const updatedBook = await bookService.createBookVersion(activeBook.id, versionName);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        get().showToast(`새 버전 '${versionName}'이(가) 안전하게 보관되었습니다.`, 'success');
        return true;
      } catch (err) {
        get().showToast(`버전 저장 실패: ${err.message}`, 'error');
        return false;
      }
    },

    saveOrUpdateLatestVersion: async (defaultVersionName = 'v1.0') => {
      const { activeBook } = get();
      if (!activeBook) return false;
      try {
        const isFirst = !activeBook.versions || activeBook.versions.length === 0;
        const updatedBook = await bookService.saveOrUpdateLatestVersion(activeBook.id, defaultVersionName);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        if (isFirst) {
          get().showToast(`책 전체가 저장되어 히스토리에 '${defaultVersionName}'(으)로 등록되었습니다!`, 'success');
        } else {
          const latestVerName = updatedBook.versions?.[0]?.name || '최신본';
          get().showToast(`책 전체가 저장되었습니다. (히스토리 ${latestVerName} 갱신)`, 'success');
        }
        return true;
      } catch (err) {
        get().showToast(`책 전체 저장 실패: ${err.message}`, 'error');
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
        get().markUnsynced();
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
        get().markUnsynced();
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
        get().markUnsynced();
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
        get().markUnsynced();
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
        get().markUnsynced();
        get().loadBooks();
      } catch (err) {
        get().showToast(`플롯 저장 실패: ${err.message}`, 'error');
      }
    },

    setActiveChapterId: (chapterId) => {
      const book = get().activeBook;
      const chap = book?.chapters?.find(c => c.id === chapterId);
      const secId = chap?.sections?.[0]?.id || null;
      localStorage.setItem('last_active_chapter_id', chapterId);
      if (secId) localStorage.setItem('last_active_section_id', secId);
      set({ activeChapterId: chapterId, activeSectionId: secId });
    },

    setActiveSectionId: (sectionId) => {
      localStorage.setItem('last_active_section_id', sectionId);
      set({ activeSectionId: sectionId });
    },

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

      set({ 
        activeBook: { ...activeBook, chapters: updatedChapters },
        ...(get().syncStatus === 'synced' ? { syncStatus: 'idle' } : {})
      });
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

      set({ 
        activeBook: { ...activeBook, chapters: updatedChapters },
        ...(get().syncStatus === 'synced' ? { syncStatus: 'idle' } : {})
      });
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
        set({ 
          activeBook: updatedBook,
          ...(get().syncStatus === 'synced' ? { syncStatus: 'idle' } : {})
        });
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
        get().markUnsynced();
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
        get().markUnsynced();
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
        get().markUnsynced();
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
        get().markUnsynced();
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
        get().markUnsynced();
        get().loadBooks();
        if (chap?.status === 'published') {
          get().showToast(`'${chap.title}' 챕터가 연재 발행되었습니다.`, 'success');
        } else {
          get().showToast('챕터 연재 발행이 취소되고 초고 상태로 전환되었습니다.', 'info');
        }
      } catch (err) {
        get().showToast(`발행 상태 변경 실패: ${err.message}`, 'error');
      }
    },

    toggleSectionPublish: async (chapterId, sectionId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.toggleSectionPublish(activeBook.id, chapterId, sectionId);
        const chap = updatedBook.chapters?.find(c => c.id === chapterId);
        const sec = chap?.sections?.find(s => s.id === sectionId);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        if (sec?.status === 'published') {
          get().showToast(`'${sec.title}' 소목차가 연재 발행되었습니다.`, 'success');
        } else {
          get().showToast('소목차 연재 발행이 취소되었습니다.', 'info');
        }
      } catch (err) {
        get().showToast(`소목차 발행 변경 실패: ${err.message}`, 'error');
      }
    },

    toggleChapterPublishAll: async (chapterId) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.toggleChapterPublishAll(activeBook.id, chapterId);
        const chap = updatedBook.chapters?.find(c => c.id === chapterId);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        if (chap?.status === 'published') {
          get().showToast(`'${chap.title}' 챕터와 하위 소목차가 모두 연재 발행되었습니다.`, 'success');
        } else {
          get().showToast('챕터 및 하위 소목차 발행이 일괄 취소되었습니다.', 'info');
        }
      } catch (err) {
        get().showToast(`챕터 일괄 발행 변경 실패: ${err.message}`, 'error');
      }
    },

    toggleBookPublishAll: async () => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.toggleBookPublishAll(activeBook.id);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        if (updatedBook.status === 'completed') {
          get().showToast(`'${updatedBook.title}' 도서 전체가 완결 출간(발행)되었습니다.`, 'success');
        } else {
          get().showToast('도서 전체 연재 발행이 초고 상태로 일괄 전환되었습니다.', 'info');
        }
      } catch (err) {
        get().showToast(`도서 전체 발행 변경 실패: ${err.message}`, 'error');
      }
    },

    updateBatchPublishSections: async (publishedSectionIds) => {
      const { activeBook } = get();
      if (!activeBook) return;
      try {
        const updatedBook = await bookService.updateBatchPublishSections(activeBook.id, publishedSectionIds);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        get().showToast(`선택한 회차(${publishedSectionIds.length}개)의 연재 발행 상태가 저장되었습니다.`, 'success');
      } catch (err) {
        get().showToast(`선택 발행 저장 실패: ${err.message}`, 'error');
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
        get().markUnsynced();
        get().loadBooks();
      } catch (err) {
        get().showToast(`소목차 추가 실패: ${err.message}`, 'error');
      }
    },

    updateSectionTitle: async (chapterId, sectionId, title) => {
      const { activeBook } = get();
      if (!activeBook) return;
      const trimmed = title.trim();
      if (!trimmed) return;
      try {
        const updatedBook = await bookService.updateSection(activeBook.id, chapterId, sectionId, { title: trimmed });
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
      } catch (err) {
        get().showToast(`소목차명 수정 실패: ${err.message}`, 'error');
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
        get().markUnsynced();
        get().loadBooks();
        get().showToast('소목차가 삭제되었습니다.', 'info');
      } catch (err) {
        get().showToast(`소목차 삭제 실패: ${err.message}`, 'error');
      }
    },

    // --- 목차 구조 실행취소(Undo) 히스토리 스택 ---
    chapterHistoryStack: [],
    pushChapterHistory: (chapters) => {
      if (!chapters) return;
      const stack = get().chapterHistoryStack || [];
      const newStack = [...stack, JSON.parse(JSON.stringify(chapters))].slice(-20);
      set({ chapterHistoryStack: newStack });
    },
    undoChapterOrder: async () => {
      const { activeBook, chapterHistoryStack } = get();
      if (!activeBook || !chapterHistoryStack || chapterHistoryStack.length === 0) {
        get().showToast('되돌릴 목차 변경 이력이 없습니다.', 'info');
        return;
      }
      const previousChapters = chapterHistoryStack[chapterHistoryStack.length - 1];
      const newStack = chapterHistoryStack.slice(0, -1);
      try {
        const updatedBook = await bookService.updateBook(activeBook.id, { chapters: previousChapters });
        set({ activeBook: updatedBook, chapterHistoryStack: newStack });
        get().markUnsynced();
        get().loadBooks();
        get().showToast('목차 순서가 이전 상태로 되돌려졌습니다.', 'success');
      } catch (err) {
        get().showToast(`되돌리기 실패: ${err.message}`, 'error');
      }
    },

    moveChapter: async (chapterId, direction) => {
      const { activeBook, pushChapterHistory, undoChapterOrder } = get();
      if (!activeBook) return;
      try {
        pushChapterHistory(activeBook.chapters);
        const updatedBook = await bookService.moveChapter(activeBook.id, chapterId, direction);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        get().showActionToast('챕터 순서가 이동되었습니다.', () => undoChapterOrder(), null, { yesText: '되돌리기 (Undo)', noText: '닫기' });
      } catch (err) {
        get().showToast(`챕터 순서 이동 실패: ${err.message}`, 'error');
      }
    },

    moveSection: async (chapterId, sectionId, direction) => {
      const { activeBook, pushChapterHistory, undoChapterOrder } = get();
      if (!activeBook) return;
      try {
        pushChapterHistory(activeBook.chapters);
        const updatedBook = await bookService.moveSection(activeBook.id, chapterId, sectionId, direction);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        get().showActionToast('소목차 순서가 이동되었습니다.', () => undoChapterOrder(), null, { yesText: '되돌리기 (Undo)', noText: '닫기' });
      } catch (err) {
        get().showToast(`소목차 순서 이동 실패: ${err.message}`, 'error');
      }
    },

    reorderChapters: async (sourceIndex, targetIndex) => {
      const { activeBook, pushChapterHistory, undoChapterOrder } = get();
      if (!activeBook) return;
      try {
        pushChapterHistory(activeBook.chapters);
        const updatedBook = await bookService.reorderChapters(activeBook.id, sourceIndex, targetIndex);
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        get().showActionToast('챕터 순서가 변경되었습니다.', () => undoChapterOrder(), null, { yesText: '되돌리기 (Undo)', noText: '닫기' });
      } catch (err) {
        get().showToast(`챕터 순서 변경 실패: ${err.message}`, 'error');
      }
    },

    reorderSections: async (sourceChapterId, targetChapterId, sourceIndex, targetIndex) => {
      const { activeBook, pushChapterHistory, undoChapterOrder } = get();
      if (!activeBook) return;
      try {
        pushChapterHistory(activeBook.chapters);
        const updatedBook = await bookService.reorderSections(
          activeBook.id,
          sourceChapterId,
          targetChapterId,
          sourceIndex,
          targetIndex
        );
        set({ activeBook: updatedBook });
        get().markUnsynced();
        get().loadBooks();
        get().showActionToast('소목차 순서가 변경되었습니다.', () => undoChapterOrder(), null, { yesText: '되돌리기 (Undo)', noText: '닫기' });
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
        get().markUnsynced();
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
