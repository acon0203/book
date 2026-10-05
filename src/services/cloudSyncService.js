import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storageService } from './storageService';

export const cloudSyncService = {
  /**
   * 로컬 데이터를 Firestore 클라우드로 즉시 백업
   * @param {string} uid 사용자 고유 식별자
   */
  backupToCloud: async (uid) => {
    if (!uid) throw new Error('로그인이 필요합니다.');

    const books = storageService.getBooks();
    const vault = storageService.getVault();
    const config = storageService.getConfig();
    const stats = storageService.getStats();

    // book-023 전용 studio_data 경로
    const backupDocRef = doc(db, 'users', uid, 'studio_data', 'current');
    console.log('[CloudSync] 🚀 클라우드 동기화 시작. UID:', uid);
    
    // Firestore는 undefined 필드가 있으면 저장을 거부하므로 안전하게 직렬화 정제
    const sanitizedData = JSON.parse(JSON.stringify({
      books,
      vault,
      config,
      stats,
      appVersion: '1.0.0'
    }));

    const backupPayload = {
      ...sanitizedData,
      updatedAt: new Date().toISOString(),
      clientTimestamp: new Date().toISOString()
    };

    console.log('[CloudSync] 📦 페이로드 준비 완료. 전송할 도서 수:', books.length, '자료 수:', vault.length);
    console.log('[CloudSync] ⏳ Firestore 서버로 스냅샷 저장 중...');

    await setDoc(backupDocRef, backupPayload, { merge: true });
    console.log('[CloudSync] ✅ Firestore 스냅샷 백업 성공!');

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
   * Firestore 클라우드에서 데이터를 가져와 로컬 저장소로 복원
   * @param {string} uid 사용자 고유 식별자
   */
  restoreFromCloud: async (uid) => {
    if (!uid) throw new Error('로그인이 필요합니다.');

    const backupDocRef = doc(db, 'users', uid, 'studio_data', 'current');
    const docSnap = await getDoc(backupDocRef);

    if (!docSnap.exists()) {
      return {
        exists: false,
        message: '클라우드에 저장된 백업 데이터가 없습니다.'
      };
    }

    const cloudData = docSnap.data();

    // 로컬스토리지에 반영
    if (cloudData.books) storageService.saveBooks(cloudData.books);
    if (cloudData.vault) storageService.saveVault(cloudData.vault);
    if (cloudData.config) storageService.saveConfig(cloudData.config);

    const syncedAt = new Date().toISOString();
    localStorage.setItem('bookstudio_last_synced', syncedAt);

    return {
      exists: true,
      syncedAt,
      itemCounts: {
        books: cloudData.books?.length || 0,
        vault: cloudData.vault?.length || 0
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
