import { db } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import { storageService } from './storageService';

export const cloudSyncService = {
  /**
   * 로컬 데이터를 Firestore 클라우드로 분리 컬렉션 동기화
   * 경로: users/{email}/
   *   ├── books/{bookId}
   *   ├── vault/{vaultId}
   *   ├── stats/summary
   *   └── config/current
   * @param {string} uid 사용자 고유 식별자
   * @param {string} userEmail 사용자 구글 이메일 주소
   * @param {string} displayName 사용자 닉네임
   */
  backupToCloud: async (uid, userEmail = '', displayName = '') => {
    if (!uid) throw new Error('로그인이 필요합니다.');

    // 1. 사용자 문서 키는 콘솔에서 직관적인 이메일 우선 사용 (fallback: uid)
    const userKey = userEmail ? userEmail.trim().toLowerCase() : uid;
    const userDocRef = doc(db, 'users', userKey);

    const books = storageService.getBooks();
    const vault = storageService.getVault();
    const config = storageService.getConfig();
    const stats = storageService.getStats();

    console.log(`[CloudSync] 🚀 클라우드 동기화 시작 (사용자 키: ${userKey})`);

    const batch = writeBatch(db);

    // [1] users/{userKey} 사용자 메인 문서 (메타데이터 및 요약)
    const userMetadata = {
      uid,
      email: userEmail || '',
      displayName: displayName || '작가',
      totalBooks: books.length,
      totalVault: vault.length,
      appVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      clientTimestamp: new Date().toISOString()
    };
    batch.set(userDocRef, userMetadata, { merge: true });

    // [2] books 컬렉션 (users/{userKey}/books/{bookId})
    for (const book of books) {
      if (book.id) {
        const bookDocRef = doc(db, 'users', userKey, 'books', String(book.id));
        const cleanBook = JSON.parse(JSON.stringify(book));
        batch.set(bookDocRef, cleanBook, { merge: true });
      }
    }

    // [3] vault 컬렉션 (users/{userKey}/vault/{vaultId})
    for (const item of vault) {
      if (item.id) {
        const vaultDocRef = doc(db, 'users', userKey, 'vault', String(item.id));
        const cleanItem = JSON.parse(JSON.stringify(item));
        batch.set(vaultDocRef, cleanItem, { merge: true });
      }
    }

    // [4] stats 컬렉션 (users/{userKey}/stats/summary)
    if (stats) {
      const statsDocRef = doc(db, 'users', userKey, 'stats', 'summary');
      const cleanStats = JSON.parse(JSON.stringify(stats));
      batch.set(statsDocRef, { ...cleanStats, updatedAt: new Date().toISOString() }, { merge: true });
    }

    // [5] config 컬렉션 (users/{userKey}/config/current)
    // 보안 원칙: 사용자의 개인 API 키는 클라우드로 절대 전송하지 않고 브라우저 로컬(localStorage)에만 격리 보존
    if (config) {
      const configDocRef = doc(db, 'users', userKey, 'config', 'current');
      const cleanConfig = JSON.parse(JSON.stringify(config));
      delete cleanConfig.geminiApiKey;
      delete cleanConfig.openaiApiKey;
      delete cleanConfig.anthropicApiKey;
      batch.set(configDocRef, { ...cleanConfig, updatedAt: new Date().toISOString() }, { merge: true });
    }

    // 배치 커밋 실행
    await batch.commit();

    // 로컬에서 삭제된 책/자료를 Firestore에서도 정리 (비동기 정리)
    try {
      // 클라우드 기존 도서 목록 확인 후 삭제된 것 정리
      const cloudBooksSnap = await getDocs(collection(db, 'users', userKey, 'books'));
      const localBookIds = new Set(books.map(b => String(b.id)));
      const cleanupBatch = writeBatch(db);
      let needsCleanup = false;

      cloudBooksSnap.forEach((d) => {
        if (!localBookIds.has(d.id)) {
          cleanupBatch.delete(d.ref);
          needsCleanup = true;
        }
      });

      // 클라우드 기존 자료 목록 확인 후 삭제된 것 정리
      const cloudVaultSnap = await getDocs(collection(db, 'users', userKey, 'vault'));
      const localVaultIds = new Set(vault.map(v => String(v.id)));
      cloudVaultSnap.forEach((d) => {
        if (!localVaultIds.has(d.id)) {
          cleanupBatch.delete(d.ref);
          needsCleanup = true;
        }
      });

      if (needsCleanup) {
        await cleanupBatch.commit();
      }
    } catch (cleanupErr) {
      console.warn('[CloudSync] 삭제 항목 동기화 경고 (무시 가능):', cleanupErr);
    }

    console.log(`[CloudSync] ✅ Firestore 동기화 완료! (도서 ${books.length}권, 자료 ${vault.length}건)`);

    const syncedAt = new Date().toISOString();
    localStorage.setItem('bookstudio_last_synced', syncedAt);

    return {
      success: true,
      syncedAt,
      itemCounts: {
        books: books.length,
        vault: vault.length
      }
    };
  },

  /**
   * Firestore 클라우드에서 분리 컬렉션 데이터를 로컬로 복원
   * @param {string} uid 사용자 고유 식별자
   * @param {string} userEmail 사용자 구글 이메일 주소
   */
  restoreFromCloud: async (uid, userEmail = '') => {
    if (!uid) throw new Error('로그인이 필요합니다.');

    const userKey = userEmail ? userEmail.trim().toLowerCase() : uid;

    console.log(`[CloudSync] 📥 클라우드 복원 시도 (사용자 키: ${userKey})`);

    // 1. users/{userKey}/books 컬렉션 조회
    let books = [];
    const booksSnap = await getDocs(collection(db, 'users', userKey, 'books'));
    if (!booksSnap.empty) {
      booksSnap.forEach((d) => {
        books.push(d.data());
      });
    }

    // 2. users/{userKey}/vault 컬렉션 조회
    let vault = [];
    const vaultSnap = await getDocs(collection(db, 'users', userKey, 'vault'));
    if (!vaultSnap.empty) {
      vaultSnap.forEach((d) => {
        vault.push(d.data());
      });
    }

    // 3. users/{userKey}/config/current 문서 조회
    let config = null;
    const configSnap = await getDoc(doc(db, 'users', userKey, 'config', 'current'));
    if (configSnap.exists()) {
      config = configSnap.data();
    }

    // 4. 레거시(단일 문서 snapshot) fallback 검사
    // 만약 새 컬렉션에 도서가 없고 레거시 문서에 데이터가 남아있는 경우
    if (books.length === 0 && vault.length === 0) {
      console.log('[CloudSync] 신규 컬렉션 비어있음 ➔ 레거시 스냅샷 경로 탐색 중...');
      let legacyDocSnap = await getDoc(doc(db, 'users', uid));
      if (!legacyDocSnap.exists() || !legacyDocSnap.data()?.books) {
        legacyDocSnap = await getDoc(doc(db, 'users', uid, 'studio_data', 'current'));
      }

      if (legacyDocSnap.exists()) {
        const legacyData = legacyDocSnap.data();
        if (legacyData.books) books = legacyData.books;
        if (legacyData.vault) vault = legacyData.vault;
        if (legacyData.config) config = legacyData.config;
      }
    }

    if (books.length === 0 && vault.length === 0) {
      return {
        exists: false,
        message: '클라우드에 저장된 백업 데이터가 없습니다.'
      };
    }

    // 로컬스토리지에 반영 (로컬 원고 유실 방지: 클라우드 복원 전 로컬 원고를 자동 백업 버전으로 보존)
    if (books.length > 0) {
      const localBooks = storageService.getBooks();
      const preservedBooks = books.map((cloudBook) => {
        const localBook = localBooks.find((lb) => lb.id === cloudBook.id);
        if (localBook && Array.isArray(localBook.chapters) && localBook.chapters.length > 0) {
          const existingVersions = Array.isArray(localBook.versions) ? [...localBook.versions] : [];
          const totalWords = (localBook.chapters || []).reduce((acc, c) =>
            acc + (c.sections || []).reduce((sAcc, s) => sAcc + (s.content ? s.content.replace(/<[^>]*>/g, '').trim().length : 0), 0), 0);

          const autoBackupVersion = {
            id: `ver_autobackup_${Date.now()}`,
            name: `[클라우드 복원 전 로컬 백업]`,
            createdAt: new Date().toISOString(),
            chapterCount: localBook.chapters.length,
            totalWords,
            chapters: JSON.parse(JSON.stringify(localBook.chapters)),
            isAutoBackup: true
          };

          const mergedVersions = [autoBackupVersion, ...existingVersions].slice(0, 15);
          return {
            ...cloudBook,
            versions: mergedVersions
          };
        }
        return cloudBook;
      });

      // 클라우드에 아직 없는 로컬 전용 도서도 삭제되지 않도록 보존
      const cloudBookIds = new Set(books.map((b) => b.id));
      const localOnlyBooks = localBooks.filter((lb) => !cloudBookIds.has(lb.id));
      storageService.saveBooks([...preservedBooks, ...localOnlyBooks]);
    }
    if (vault.length > 0) storageService.saveVault(vault);
    if (config) {
      const localConfig = storageService.getConfig();
      const safeConfig = {
        ...config,
        geminiApiKey: localConfig.geminiApiKey || '',
        openaiApiKey: localConfig.openaiApiKey || '',
        anthropicApiKey: localConfig.anthropicApiKey || ''
      };
      storageService.saveConfig(safeConfig);
    }

    const syncedAt = new Date().toISOString();
    localStorage.setItem('bookstudio_last_synced', syncedAt);

    console.log(`[CloudSync] 🌟 클라우드 복원 성공! (도서: ${books.length}권, 자료: ${vault.length}건)`);

    return {
      exists: true,
      syncedAt,
      itemCounts: {
        books: books.length,
        vault: vault.length
      }
    };
  },

  /**
   * 마지막 동기화 일시 조회
   */
  getLastSyncedTime: () => {
    return localStorage.getItem('bookstudio_last_synced') || null;
  }
};
