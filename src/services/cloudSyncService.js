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

const formatBackupDate = (date = new Date()) => {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
};

/**
 * 일자별 집필 기록 병합 헬퍼 (덮어쓰지 않고 날짜별로 합치며, 동일 날짜는 큰 값 유지)
 * @param {any} localLogs 
 * @param {any} cloudLogs 
 */
export const mergeDailyWritingLogs = (localLogs, cloudLogs) => {
  if (!localLogs && !cloudLogs) return [];

  // 1. 객체 맵 형태인 경우 ({ '2026-10-29': 1500 })
  if (
    localLogs && typeof localLogs === 'object' && !Array.isArray(localLogs) &&
    cloudLogs && typeof cloudLogs === 'object' && !Array.isArray(cloudLogs)
  ) {
    const merged = { ...cloudLogs, ...localLogs };
    const allKeys = new Set([...Object.keys(cloudLogs), ...Object.keys(localLogs)]);
    allKeys.forEach((key) => {
      const v1 = Number(localLogs[key]) || 0;
      const v2 = Number(cloudLogs[key]) || 0;
      merged[key] = Math.max(v1, v2);
    });
    return merged;
  }

  const listA = Array.isArray(localLogs) ? localLogs : [];
  const listB = Array.isArray(cloudLogs) ? cloudLogs : [];

  // 2. 단순 날짜 문자열 배열인 경우 (['2026-10-28', '2026-10-29'])
  const isAllString = listA.every((x) => typeof x === 'string') && listB.every((x) => typeof x === 'string');
  if (isAllString) {
    return Array.from(new Set([...listA, ...listB])).sort();
  }

  // 3. 일자별 객체 배열인 경우 ([{ date: '2026-10-29', words: 1500 }])
  const map = new Map();
  [...listB, ...listA].forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      if (!map.has(item)) map.set(item, item);
      return;
    }
    const dateKey = item.date || item.day || item.id;
    if (!dateKey) return;

    if (!map.has(dateKey)) {
      map.set(dateKey, item);
    } else {
      const existing = map.get(dateKey);
      const val1 = Number(item.words ?? item.count ?? item.value ?? 0);
      const val2 = Number(existing.words ?? existing.count ?? existing.value ?? 0);
      // 동일 날짜인 경우 더 큰 수치 기록을 유지
      if (val1 >= val2) {
        map.set(dateKey, item);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const ka = typeof a === 'string' ? a : (a.date || a.day || '');
    const kb = typeof b === 'string' ? b : (b.date || b.day || '');
    return ka.localeCompare(kb);
  });
};

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

    // 클라우드 기존 도서 목록을 먼저 가볍게 읽어와서 이전 버전 보존 및 버전 목록 병합
    let cloudBooksMap = new Map();
    try {
      const cloudBooksSnap = await getDocs(collection(db, 'users', userKey, 'books'));
      cloudBooksSnap.forEach(d => {
        cloudBooksMap.set(d.id, d.data());
      });
    } catch (e) {
      console.warn('[CloudSync] 기존 클라우드 도서 조회 경고:', e);
    }

    const timeLabel = formatBackupDate();

    // [2] books 컬렉션 (users/{userKey}/books/{bookId})
    for (const book of books) {
      if (book.id) {
        const bookDocRef = doc(db, 'users', userKey, 'books', String(book.id));
        const cleanBook = JSON.parse(JSON.stringify(book));

        const existingCloudBook = cloudBooksMap.get(String(book.id));
        if (existingCloudBook && Array.isArray(existingCloudBook.chapters) && existingCloudBook.chapters.length > 0) {
          // 클라우드에 있던 이전 버전들과 로컬 버전들 병합
          const cloudVersions = Array.isArray(existingCloudBook.versions) ? existingCloudBook.versions : [];
          const localVersions = Array.isArray(cleanBook.versions) ? cleanBook.versions : [];

          // 클라우드에 있던 이전 원고와 로컬 원고가 다르면 클라우드 이전 원고도 버전으로 보존
          const isContentDifferent = JSON.stringify(existingCloudBook.chapters) !== JSON.stringify(cleanBook.chapters);
          
          const versionMap = new Map();
          cloudVersions.forEach(v => { if (v?.id) versionMap.set(v.id, v); });
          localVersions.forEach(v => { if (v?.id) versionMap.set(v.id, v); });

          if (isContentDifferent) {
            const cloudTotalWords = (existingCloudBook.chapters || []).reduce((acc, c) =>
              acc + (c.sections || []).reduce((sAcc, s) => sAcc + (s.content ? s.content.replace(/<[^>]*>/g, '').trim().length : 0), 0), 0);

            const cloudPrevVersion = {
              id: `ver_cloud_backup_${Date.now()}`,
              name: `[동기화 이전 클라우드 원고 - ${timeLabel}]`,
              createdAt: existingCloudBook.updatedAt || new Date().toISOString(),
              chapterCount: existingCloudBook.chapters.length,
              totalWords: cloudTotalWords,
              chapters: JSON.parse(JSON.stringify(existingCloudBook.chapters)),
              isAutoBackup: true
            };
            versionMap.set(cloudPrevVersion.id, cloudPrevVersion);
          }

          const mergedVersions = Array.from(versionMap.values())
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 20);

          cleanBook.versions = mergedVersions;
        }

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

    // [4] stats 컬렉션 (users/{userKey}/stats/summary) 및 일자별 집필 기록 병합
    if (stats) {
      const statsDocRef = doc(db, 'users', userKey, 'stats', 'summary');
      const cleanStats = JSON.parse(JSON.stringify(stats));

      let mergedWritingLogs = [];
      try {
        const localLogsRaw = localStorage.getItem('daily_writing_logs') || '[]';
        const localLogs = JSON.parse(localLogsRaw);
        
        // 기존 클라우드 기록 조회 후 날짜별로 합치기 (같은 날짜는 큰 값 유지)
        const existingStatsSnap = await getDoc(statsDocRef);
        const cloudLogs = existingStatsSnap.exists() ? (existingStatsSnap.data()?.dailyWritingLogs || []) : [];
        
        mergedWritingLogs = mergeDailyWritingLogs(localLogs, cloudLogs);
        localStorage.setItem('daily_writing_logs', JSON.stringify(mergedWritingLogs));
      } catch (logErr) {
        console.warn('[CloudSync] 일자별 집필 로그 병합 경고:', logErr);
      }

      batch.set(statsDocRef, { 
        ...cleanStats, 
        dailyWritingLogs: mergedWritingLogs,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
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

    // [6] 작가 문체 페르소나 (users/{userKey}/config/persona)
    const authorPersona = storageService.getAuthorPersona();
    if (authorPersona) {
      const personaDocRef = doc(db, 'users', userKey, 'config', 'persona');
      const cleanPersona = JSON.parse(JSON.stringify(authorPersona));
      batch.set(personaDocRef, { ...cleanPersona, updatedAt: new Date().toISOString() }, { merge: true });
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
      const timeLabel = formatBackupDate();

      const preservedBooks = books.map((cloudBook) => {
        const localBook = localBooks.find((lb) => lb.id === cloudBook.id);
        if (localBook && Array.isArray(localBook.chapters) && localBook.chapters.length > 0) {
          const cloudVersions = Array.isArray(cloudBook.versions) ? cloudBook.versions : [];
          const localVersions = Array.isArray(localBook.versions) ? localBook.versions : [];

          // 1. 기존 로컬 원고를 자동 백업 버전으로 생성
          const totalWords = (localBook.chapters || []).reduce((acc, c) =>
            acc + (c.sections || []).reduce((sAcc, s) => sAcc + (s.content ? s.content.replace(/<[^>]*>/g, '').trim().length : 0), 0), 0);

          const autoBackupVersion = {
            id: `ver_autobackup_${Date.now()}`,
            name: `[동기화 이전 로컬 원고 - ${timeLabel}]`,
            createdAt: new Date().toISOString(),
            chapterCount: localBook.chapters.length,
            totalWords,
            chapters: JSON.parse(JSON.stringify(localBook.chapters)),
            isAutoBackup: true
          };

          // 2. 버전 히스토리 병합: 중복 ID 제거 및 최신순 정렬 (최대 20개 보존)
          const versionMap = new Map();
          localVersions.forEach(v => { if (v?.id) versionMap.set(v.id, v); });
          cloudVersions.forEach(v => { if (v?.id) versionMap.set(v.id, v); });
          versionMap.set(autoBackupVersion.id, autoBackupVersion);

          const mergedVersions = Array.from(versionMap.values())
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 20);

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

    // 작가 문체 페르소나 복원
    try {
      const personaSnap = await getDoc(doc(db, 'users', userKey, 'config', 'persona'));
      if (personaSnap.exists()) {
        storageService.saveAuthorPersona(personaSnap.data());
      }
    } catch (e) {
      console.warn('[CloudSync] 작가 페르소나 복원 경고:', e);
    }

    // 일자별 집필 기록(dailyWritingLogs) 복원 및 덮어쓰지 않고 날짜별 병합 (같은 날짜는 큰 값 유지)
    try {
      const statsSnap = await getDoc(doc(db, 'users', userKey, 'stats', 'summary'));
      if (statsSnap.exists()) {
        const cloudStatsData = statsSnap.data();
        if (cloudStatsData?.dailyWritingLogs) {
          const localLogsRaw = localStorage.getItem('daily_writing_logs') || '[]';
          let localLogs = [];
          try {
            localLogs = JSON.parse(localLogsRaw);
          } catch {}
          const mergedLogs = mergeDailyWritingLogs(localLogs, cloudStatsData.dailyWritingLogs);
          localStorage.setItem('daily_writing_logs', JSON.stringify(mergedLogs));
        }
      }
    } catch (e) {
      console.warn('[CloudSync] 일자별 집필 기록 복원 경고:', e);
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
   * 로컬의 모든 도서/소목차/자료 중 가장 최근 수정된 일시(ms) 반환
   */
  getLocalLatestModifiedTime: () => {
    let latest = 0;
    try {
      const books = storageService.getBooks();
      for (const b of books) {
        if (b.updatedAt) {
          const t = new Date(b.updatedAt).getTime();
          if (t > latest) latest = t;
        }
        if (Array.isArray(b.chapters)) {
          for (const c of b.chapters) {
            if (Array.isArray(c.sections)) {
              for (const s of c.sections) {
                if (s.updatedAt) {
                  const st = new Date(s.updatedAt).getTime();
                  if (st > latest) latest = st;
                }
              }
            }
          }
        }
      }
      const vault = storageService.getVault();
      for (const v of vault) {
        if (v.updatedAt || v.createdAt) {
          const vt = new Date(v.updatedAt || v.createdAt).getTime();
          if (vt > latest) latest = vt;
        }
      }
    } catch (e) {
      console.warn('[CloudSync] getLocalLatestModifiedTime error:', e);
    }
    return latest;
  },

  /**
   * 클라우드 사용자 메인 문서에서 메타데이터(수정일시, 도서수 등) 가볍게 1회 조회
   */
  getCloudMetadata: async (uid, userEmail = '') => {
    if (!uid) return null;
    const userKey = userEmail ? userEmail.trim().toLowerCase() : uid;
    try {
      const userDocRef = doc(db, 'users', userKey);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          exists: true,
          updatedAt: data.updatedAt || null,
          totalBooks: data.totalBooks || 0,
          totalVault: data.totalVault || 0,
          displayName: data.displayName || ''
        };
      }
      return { exists: false, updatedAt: null };
    } catch (e) {
      console.error('[CloudSync] getCloudMetadata error:', e);
      return null;
    }
  },

  /**
   * 로컬과 클라우드의 수정 시간을 비교하여 양방향 동기화 방향 자동 판별
   * @returns {Promise<{ direction: 'upload'|'download'|'conflict'|'upToDate', cloudMeta: object, lastSyncedTime: number, localModifiedTime: number }>}
   */
  checkSyncStatus: async (uid, userEmail = '') => {
    const cloudMeta = await cloudSyncService.getCloudMetadata(uid, userEmail);
    const lastSyncedStr = localStorage.getItem('bookstudio_last_synced');
    const lastSyncedTime = lastSyncedStr ? new Date(lastSyncedStr).getTime() : 0;
    const localModifiedTime = cloudSyncService.getLocalLatestModifiedTime();

    if (!cloudMeta || !cloudMeta.exists || !cloudMeta.updatedAt) {
      // 클라우드에 아직 데이터가 없는 경우 ➔ 로컬 데이터를 업로드
      return {
        direction: 'upload',
        reason: 'no_cloud_data',
        cloudMeta,
        lastSyncedTime,
        localModifiedTime
      };
    }

    const cloudTime = new Date(cloudMeta.updatedAt).getTime();

    // 2초 이내의 오차는 네트워크/클라이언트 동일 시점으로 간주
    const isCloudNewerThanLastSync = (cloudTime - lastSyncedTime) > 2000;
    const isLocalNewerThanLastSync = (localModifiedTime - lastSyncedTime) > 2000;

    // 상황 1. 양쪽 모두에서 서로 다른 수정이 발생한 경우 (충돌)
    if (isCloudNewerThanLastSync && isLocalNewerThanLastSync) {
      return {
        direction: 'conflict',
        reason: 'both_modified',
        cloudMeta,
        lastSyncedTime,
        localModifiedTime
      };
    }

    // 상황 2. 클라우드가 더 최신이고 로컬에는 변경사항이 없는 경우 (다운로드)
    if (isCloudNewerThanLastSync && !isLocalNewerThanLastSync) {
      return {
        direction: 'download',
        reason: 'cloud_newer',
        cloudMeta,
        lastSyncedTime,
        localModifiedTime
      };
    }

    // 상황 3. 현재 로컬에서 작업했고 클라우드는 이전 상태인 경우 (업로드)
    if (!isCloudNewerThanLastSync && isLocalNewerThanLastSync) {
      return {
        direction: 'upload',
        reason: 'local_newer',
        cloudMeta,
        lastSyncedTime,
        localModifiedTime
      };
    }

    // 상황 4. 클라우드와 로컬이 이미 일치하는 경우
    return {
      direction: 'upToDate',
      reason: 'in_sync',
      cloudMeta,
      lastSyncedTime,
      localModifiedTime
    };
  },

  /**
   * 마지막 동기화 일시 조회
   */
  getLastSyncedTime: () => {
    return localStorage.getItem('bookstudio_last_synced') || null;
  }
};
