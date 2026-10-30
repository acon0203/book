import {
  Lightbulb, PenTool, Bookmark, Layers, Compass
} from 'lucide-react';

// 5대 창작 파이프라인 단계 정의 (아이디어 노트는 공용, 출간 기획서부터 01~04 단계)
export const PIPELINE_STEPS = [
  { id: 'ideas', stepNum: 0, badgeLabel: '공용', isShared: true, title: '아이디어 노트', icon: Lightbulb, desc: '자유로운 발상과 낙서' },
  { id: 'proposal', stepNum: 1, badgeLabel: '01', title: '출간 기획서', icon: PenTool, desc: '로그라인 & 타깃 독자' },
  { id: 'materials', stepNum: 2, badgeLabel: '02', title: '글감·취재창고', icon: Bookmark, desc: '팩트/통계/인용구 보관' },
  { id: 'story', stepNum: 3, badgeLabel: '03', title: '작품 설정 & 인물', icon: Layers, desc: '화자·청자·어투 & 인물' },
  { id: 'outline', stepNum: 4, badgeLabel: '04', title: '서사 뼈대 & 목차 조립', icon: Compass, desc: '44종 뼈대 대조 & 목차 조립' }
];

// 자료 금고 8대 확장 카테고리 프리셋 (이모티콘 일체 배제, 단정하고 전문적인 분류)
export const VAULT_CATEGORIES = [
  { id: 'ALL', label: '전체 자료' },
  { id: 'idea', label: '아이디어 발상' },
  { id: 'quote', label: '인용구·명언' },
  { id: 'data', label: '통계·팩트' },
  { id: 'ref', label: '문헌·발췌' },
  { id: 'reference', label: '참고자료' },
  { id: 'case', label: '사례·인터뷰' },
  { id: 'etc', label: '기타' }
];
