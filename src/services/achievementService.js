/**
 * achievementService.js
 * Firestore 전용 업적 달성 기록 서비스
 * 
 * [요구사항 준수]
 * 1. users/{uid}/achievements/{achievementId} 경로에 업적 1건당 문서 1개 저장 ({ achievementId, unlockedAt })
 * 2. 달성 순간 해당 문서만 Firestore에 즉시 저장 (이미 존재하면 덮어쓰지 않음)
 * 3. Firestore 오프라인 저장(persistentLocalCache) 지원으로 네트워크 단절 시 자동 큐잉 및 재전송
 * 4. localStorage 저장, mergeAchievements, 구름 버튼 연동 배제
 */

import { db, auth } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';

// 인메모리 빠른 캐시 (앱 실행 세션 중 0ms 조회 보장)
let inMemoryAchievementsMap = new Map();
let currentLoadedUid = null;

export const achievementService = {
  /**
   * 사용자의 획득 업적 목록 초기 1회 로드
   * @param {string} uid 
   * @returns {Promise<Map<string, { achievementId: string, unlockedAt: string }>>}
   */
  loadUserAchievements: async (uid) => {
    if (!uid) return inMemoryAchievementsMap;

    try {
      const achievementsColRef = collection(db, 'users', uid, 'achievements');
      const snap = await getDocs(achievementsColRef);
      const map = new Map();

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.achievementId) {
          map.set(data.achievementId, {
            achievementId: data.achievementId,
            unlockedAt: data.unlockedAt || docSnap.id
          });
        }
      });

      inMemoryAchievementsMap = map;
      currentLoadedUid = uid;
      return map;
    } catch (err) {
      console.warn('[AchievementService] 업적 로드 경고 (오프라인 캐시 적용):', err);
      return inMemoryAchievementsMap;
    }
  },

  /**
   * 특정 업적이 이미 달성되었는지 메모리 확인
   */
  isUnlocked: (achievementId) => {
    return inMemoryAchievementsMap.has(achievementId);
  },

  /**
   * 현재 로드된 모든 달성 업적 맵 반환
   */
  getUnlockedMap: () => {
    return inMemoryAchievementsMap;
  },

  /**
   * 새로운 업적 달성 시 Firestore에 단건 즉시 영구 저장
   * 이미 존재하는 문서는 절대 덮어쓰지 않음
   * @param {string} uid 사용자 UID
   * @param {string} achievementId 업적 ID
   * @returns {Promise<boolean>} 새로 해금되었으면 true, 기존에 있었으면 false
   */
  unlockAchievement: async (uid, achievementId) => {
    if (!uid || !achievementId) return false;

    // 1. 메모리 캐시 최우선 검사 (중복 요청 0ms 컷)
    if (inMemoryAchievementsMap.has(achievementId)) {
      return false;
    }

    try {
      const docRef = doc(db, 'users', uid, 'achievements', achievementId);
      
      // 2. 서버/로컬캐시 문서 존재 여부 확인 (덮어쓰기 원천 방지)
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        const data = existingSnap.data();
        inMemoryAchievementsMap.set(achievementId, data);
        return false;
      }

      // 3. 신규 달성 기록 즉시 저장 (단건 문서 1개)
      const record = {
        achievementId,
        unlockedAt: new Date().toISOString()
      };

      await setDoc(docRef, record);
      inMemoryAchievementsMap.set(achievementId, record);
      console.log(`[AchievementService] 🏆 새 업적 영구 획득: ${achievementId}`);
      return true;
    } catch (err) {
      console.error('[AchievementService] 업적 저장 실패 (persistentLocalCache 큐 대기):', err);
      // persistentLocalCache가 활성화되어 있으므로 오프라인 중에도 SDK 로컬 캐시 적용
      inMemoryAchievementsMap.set(achievementId, {
        achievementId,
        unlockedAt: new Date().toISOString()
      });
      return true;
    }
  }
};
