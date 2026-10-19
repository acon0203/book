/**
 * genreConstants.js
 * 연재서재 공식 10대 출판·연재 표준 장르 정의
 * 
 * - UI 노출: 순수한 10대 장르명 (괄호 없이 단정하게 표기)
 * - 내부 관리: 검색 키워드 및 카테고리 매핑
 */

export const OFFICIAL_GENRES = [
  { id: 'novel', label: '소설', keywords: ['소설', '문학', '순문학', '장르소설'] },
  { id: 'webnovel', label: '웹소설', keywords: ['웹소설', '판타지', '무협', '로판', '현판', '회빙환', '헌터물'] },
  { id: 'essay', label: '시 / 에세이', keywords: ['시', '에세이', '산문', '수필', '자서전', '회고록'] },
  { id: 'economy', label: '경제 / 경영', keywords: ['경제', '경영', '비즈니스', '마케팅', '창업', '조직'] },
  { id: 'finance', label: '재테크 / 투자', keywords: ['재테크', '투자', '부동산', '주식', '가상자산', '부업', '파이프라인'] },
  { id: 'self', label: '자기계발', keywords: ['자기계발', '동기부여', '습관', '시간관리', '생산성', '멘탈'] },
  { id: 'humanities', label: '인문 / 사회', keywords: ['인문', '사회', '철학', '역사', '심리', '정치', '문화'] },
  { id: 'tech', label: 'IT / 과학', keywords: ['IT', '과학', '프로그래밍', '개발', 'AI', '인공지능', '데이터', '공학'] },
  { id: 'life', label: '라이프 / 실용', keywords: ['라이프', '실용', '건강', '운동', '요리', '취미', '여행', '육아'] },
  { id: 'art', label: '예술 / 문화', keywords: ['예술', '문화', '디자인', '음악', '영화', '미술', '대중문화'] }
];

/**
 * 도서 장르 라벨 또는 키로부터 공식 10대 장르 ID 반환 유틸
 */
export function getOfficialGenreId(genreText) {
  if (!genreText) return 'novel';
  const clean = genreText.toLowerCase().trim();

  if (clean.includes('웹소설')) return 'webnovel';
  if (clean.includes('소설')) return 'novel';
  if (clean.includes('시') || clean.includes('에세이') || clean.includes('수필')) return 'essay';
  if (clean.includes('재테크') || clean.includes('투자') || clean.includes('부동산')) return 'finance';
  if (clean.includes('경제') || clean.includes('경영')) return 'economy';
  if (clean.includes('자기계발') || clean.includes('성공')) return 'self';
  if (clean.includes('인문') || clean.includes('사회') || clean.includes('철학') || clean.includes('역사')) return 'humanities';
  if (clean.includes('it') || clean.includes('과학') || clean.includes('프로그래밍') || clean.includes('ai') || clean.includes('컴퓨터')) return 'tech';
  if (clean.includes('라이프') || clean.includes('실용') || clean.includes('건강') || clean.includes('요리')) return 'life';
  if (clean.includes('예술') || clean.includes('문화') || clean.includes('디자인') || clean.includes('음악')) return 'art';

  return 'novel';
}
