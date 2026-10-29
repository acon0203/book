/**
 * achievementsDb.js
 * 연재서재 5대 롱테일 마일스톤 체인 및 히든 업적 마스터 데이터 정의
 * 
 * [설계 원칙]
 * 1. 선언적 메타데이터 구조: 판정 로직(함수)을 배제하고 type과 threshold 수치만 정의
 * 2. 7~8단계 롱테일 체인: 웹소설/출판 현업 기준(100만자, 20작품 완간, 365일 무휴)을 포괄
 * 3. 6대 슬롯 1:1 매핑: 루틴, 완결, 분량, 기획, 연재 + 히든 컬렉션
 */

// 1. 5대 핵심 롱테일 체인 정의
export const ACHIEVEMENT_CHAINS = [
  {
    id: 'routine',
    name: '집필 루틴 체인',
    subtitle: '성실한 작가의 불꽃',
    reqType: 'streak_days', // 연속 집필 일수
    steps: [
      { step: 1, id: 'routine_1', title: '작심삼일 극복', threshold: 3, desc: '3일 연속 집필 성공' },
      { step: 2, id: 'routine_2', title: '7일간의 몰입', threshold: 7, desc: '7일 연속 집필 성공' },
      { step: 3, id: 'routine_3', title: '2주의 리듬', threshold: 14, desc: '14일 연속 집필 성공' },
      { step: 4, id: 'routine_4', title: '한 달의 기적', threshold: 30, desc: '30일 연속 집필 성공' },
      { step: 5, id: 'routine_5', title: '두 달의 결실', threshold: 60, desc: '60일 연속 집필 성공' },
      { step: 6, id: 'routine_6', title: '백일의 대작', threshold: 100, desc: '100일 연속 집필 달성' },
      { step: 7, id: 'routine_7', title: '반년의 침묵과 집필', threshold: 180, desc: '180일 연속 집필 달성' },
      { step: 8, id: 'routine_8', title: '365일 집필혼', threshold: 365, desc: '1년(365일) 무휴 연속 집필 달성' }
    ]
  },
  {
    id: 'completion',
    name: '완결 체인',
    subtitle: '책의 탄생',
    reqType: 'completed_books', // 완결(완성작) 등록 작품 수
    steps: [
      { step: 1, id: 'comp_1', title: '첫 단행본 완결', threshold: 1, desc: '첫 번째 완성작 등록' },
      { step: 2, id: 'comp_2', title: '후속작의 결실', threshold: 2, desc: '2작품 완간 달성' },
      { step: 3, id: 'comp_3', title: '삼국지급 다작', threshold: 3, desc: '3작품 완간 달성' },
      { step: 4, id: 'comp_4', title: '시리즈의 마스터', threshold: 5, desc: '5작품 완간 달성' },
      { step: 5, id: 'comp_5', title: '전업 작가의 서재', threshold: 7, desc: '7작품 완간 달성' },
      { step: 6, id: 'comp_6', title: '서재의 거장', threshold: 10, desc: '10작품 완간 달성' },
      { step: 7, id: 'comp_7', title: '다작의 신화', threshold: 15, desc: '15작품 완간 달성' },
      { step: 8, id: 'comp_8', title: '살아있는 도서관', threshold: 20, desc: '20작품 완간 달성 (이후 ★ 프레스티지)' }
    ]
  },
  {
    id: 'words',
    name: '분량 체인',
    subtitle: '마르지 않는 잉크',
    reqType: 'total_words', // 누적 총 글자 수
    steps: [
      { step: 1, id: 'words_1', title: '첫 문장의 용기', threshold: 1, desc: '원고 첫 1자 기록' },
      { step: 2, id: 'words_2', title: '단편 칼럼 돌파', threshold: 10000, desc: '누적 1만 자 (원고지 50매)' },
      { step: 3, id: 'words_3', title: '중편의 깊이', threshold: 40000, desc: '누적 4만 자 (원고지 200매)' },
      { step: 4, id: 'words_4', title: '표준 단행본 1권', threshold: 100000, desc: '누적 10만 자 (원고지 500매)' },
      { step: 5, id: 'words_5', title: '장편 시리즈 돌파', threshold: 250000, desc: '누적 25만 자 (원고지 1,250매)' },
      { step: 6, id: 'words_6', title: '대하소설의 무게', threshold: 500000, desc: '누적 50만 자 (원고지 2,500매)' },
      { step: 7, id: 'words_7', title: '밀리언 클럽', threshold: 1000000, desc: '누적 100만 자 (웹소설 200화 분량)' },
      { step: 8, id: 'words_8', title: '문학의 대성당', threshold: 3000000, desc: '누적 300만 자 (평생의 역작)' }
    ]
  },
  {
    id: 'planning',
    name: '기획 체인',
    subtitle: '세계의 설계자',
    reqType: 'planning_milestone', // 기획 마일스톤 복합 판정
    steps: [
      { step: 1, id: 'plan_1', title: '출간 기획자', threshold: 1, desc: '출간 기획서 1건 작성 완료' },
      { step: 2, id: 'plan_2', title: '서사 건축가', threshold: 2, desc: '44종 표준 서사 뼈대 적용 및 목차 조립' },
      { step: 3, id: 'plan_3', title: '인물 조각가', threshold: 3, desc: '등장인물 프로필 3명 이상 구축' },
      { step: 4, id: 'plan_4', title: '살아 숨쉬는 세계', threshold: 5, desc: '등장인물 프로필 5명 및 서사 설정 완성' },
      { step: 5, id: 'plan_5', title: '철저한 취재자', threshold: 7, desc: '창작실 글감/취재 자료 10건 이상 보관' },
      { step: 6, id: 'plan_6', title: '마스터 플롯터', threshold: 10, desc: '3개 이상 작품의 기획·뼈대 완성' }
    ]
  },
  {
    id: 'publishing',
    name: '연재 체인',
    subtitle: '독자와의 약속',
    reqType: 'published_sections', // 독자 공간 발행 소목차(회차) 수
    steps: [
      { step: 1, id: 'pub_1', title: '첫 연재의 설렘', threshold: 1, desc: '첫 1회차 연재 발행' },
      { step: 2, id: 'pub_2', title: '주간 연재 작가', threshold: 5, desc: '누적 5회차 연재 발행' },
      { step: 3, id: 'pub_3', title: '성실한 연재가', threshold: 15, desc: '누적 15회차 연재 발행' },
      { step: 4, id: 'pub_4', title: '중편 연재 돌파', threshold: 30, desc: '누적 30회차 연재 발행' },
      { step: 5, id: 'pub_5', title: '시즌 1 완결', threshold: 50, desc: '누적 50회차 연재 발행' },
      { step: 6, id: 'pub_6', title: '100화 고지 점령', threshold: 100, desc: '누적 100회차 연재 발행' },
      { step: 7, id: 'pub_7', title: '장편 대작 연재', threshold: 150, desc: '누적 150회차 연재 발행' },
      { step: 8, id: 'pub_8', title: '대작 연재 완결', threshold: 200, desc: '누적 200회차 연재 완결' }
    ]
  }
];

// 2. 히든 업적 컬렉션 (특수 창작 행동)
export const HIDDEN_ACHIEVEMENTS = [
  {
    id: 'hidden_midnight',
    title: '새벽을 여는 잉크',
    desc: '모두가 잠든 새벽 3시~5시에 원고를 집필하여 저장했습니다.',
    conditionType: 'time_range',
    startHour: 3,
    endHour: 5,
    hint: '깊은 밤, 고요한 어둠 속에서 창작의 불꽃을 피워보세요.'
  },
  {
    id: 'hidden_burst',
    title: '단숨에 써내려간 밤',
    desc: '하루 동안 10,000자 이상의 폭풍 집필을 달성했습니다.',
    conditionType: 'daily_words',
    threshold: 10000,
    hint: '하루 동안 단편 1편 분량의 영감을 한 번에 쏟아내보세요.'
  },
  {
    id: 'hidden_perfectionist',
    title: '완벽주의자의 퇴고',
    desc: '단일 챕터를 10회 이상 정성스럽게 다듬고 수정했습니다.',
    conditionType: 'chapter_edits',
    threshold: 10,
    hint: '한 문장, 한 단어를 장인처럼 끊임없이 퇴고해보세요.'
  },
  {
    id: 'hidden_ai_partner',
    title: 'AI 총괄 편집장과의 독대',
    desc: 'AI 편집장 상담을 10회 이상 진행하며 작품을 심층 개선했습니다.',
    conditionType: 'ai_consultations',
    threshold: 10,
    hint: 'AI 총괄 편집장과 깊이 있는 출간 상담을 거듭해보세요.'
  }
];
