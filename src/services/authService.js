import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export const authService = {
  /**
   * Google 계정으로 팝업 로그인
   */
  signInWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '작가',
        photoURL: user.photoURL
      };
    } catch (error) {
      console.error('[AuthService] Google 로그인 실패:', error);
      throw error;
    }
  },

  /**
   * 로그아웃
   */
  logout: async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('[AuthService] 로그아웃 실패:', error);
      throw error;
    }
  },

  /**
   * 인증 상태 변경 리스너 구독
   */
  onAuthChange: (callback) => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '작가',
          photoURL: user.photoURL
        });
      } else {
        callback(null);
      }
    });
  },

  /**
   * 현재 로그인 사용자 정보
   */
  getCurrentUser: () => {
    const user = auth.currentUser;
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '작가',
      photoURL: user.photoURL
    };
  }
};
