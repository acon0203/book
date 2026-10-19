/**
 * 관리자 권한 및 보안 검증 유틸 (adminSecurity.js)
 * 
 * 1. 로컬 환경(localhost): 즉시 관리자 프리패스 승인 (개발 편의성)
 * 2. 배포 환경: 등록된 관리자 이메일 계정에 한해서만 인가
 */

export const ADMIN_EMAILS = [
  'acon0203@gmail.com', // 관리자 기본 이메일 (필요 시 추가 가능)
];

/**
 * 현재 접속자가 관리자인지 여부 판별
 * @param {object|null} user - Firebase 로그인 사용자 객체 { email, uid, ... }
 * @returns {boolean}
 */
export function checkIsAdmin(user) {
  // 1. [로컬 접속 환경]: window.location.hostname 이 'localhost'이면 무조건 관리자로 100% 인식
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return true;
  }

  // 2. [실제 배포 환경]: 로그인된 구글 계정의 이메일이 관리자 화이트리스트에 있는지 검증
  if (user && user.email) {
    const userEmail = user.email.toLowerCase().trim();
    return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase().trim() === userEmail);
  }

  return false;
}
