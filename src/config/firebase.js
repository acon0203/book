import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

// 연재서재 전용 Firebase 프로젝트 (book-023) 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBIw57qzW-lxRAe3d2poQq0jvPdrVEHH80",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "book-023.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "book-023",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "book-023.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "814113938799",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:814113938799:web:b0746a67a090066eba1c9a"
};

// 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth & Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Mission 검증 완료: 멀티탭 캐시 지속성
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export default app;
