// 시작하는 작가를 위한 웰컴 스타터 가이드북 샘플 데이터

export const STARTER_BOOK = {
  id: 'book_starter_guide',
  title: '시작하는 작가를 위한 연재서재 완벽 가이드',
  subtitle: '기획부터 서사 뼈대, 블록 집필, 표준 웹 뷰어까지 3분 완성',
  author: '연재서재 편집부',
  genre: '에세이',
  coverColor: 'linear-gradient(135deg, #2b231d, #140f0c)',
  status: 'ongoing',
  isCompleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  planning: {
    logline: '글쓰기의 두려움을 지우고, 0ms 즉각 저장과 44종 플롯 뼈대로 끝까지 완주하는 전자책 창작의 여정.',
    targetAudience: '자신만의 책을 한 권 출간하고 싶은 예비 작가 및 쾌적한 집필 환경을 원하는 프로 창작자',
    intent: '데이터 유출 걱정 없는 로컬 우선 환경에서 누구나 손쉽게 한 권의 책을 기획하고 탈고할 수 있도록 돕는다.',
    difference: '타이핑 버벅임 0ms, AI 4중 합성 엔진, 44종 서사 뼈대 및 실제 책 규격 웹 뷰어 일체형 제공'
  },
  narrativeSettings: {
    speaker: '1인칭 (나/저)',
    listener: '새로운 글을 시작하려는 독자 여러분',
    tone: '~합니다 / ~해요 (친근하고 정중한 설명체)'
  },
  characters: [
    {
      id: 'char_starter_1',
      name: '나(창작자)',
      role: '화자 / 주인공',
      desire: '머릿속에 맴도는 영감을 온전한 한 권의 책으로 엮어내기',
      flaw: '시작은 거창하나 마무리를 짓지 못하고 서랍에 묻어두는 습관',
      traits: '관찰력이 뛰어나며 담백한 문장을 사랑함'
    }
  ],
  chapters: [
    {
      id: 'chap_starter_1',
      title: '제1장. 로컬 우선(Local-First) 집필의 힘',
      status: 'published',
      publishedAt: new Date().toISOString(),
      views: 12,
      likes: 3,
      comments: [
        {
          id: 'cmt_starter_1',
          author: '독자 A',
          text: '타이핑 랙이 전혀 없어서 글쓰기에만 온전히 몰입할 수 있네요!',
          createdAt: '2026.10.27'
        }
      ],
      authorNote: '글을 쓸 때 가장 중요한 것은 도구가 생각을 방해하지 않는 것입니다.',
      sections: [
        {
          id: 'sec_starter_1_1',
          title: '1. 버벅임 없는 0ms 즉각 저장',
          status: 'completed',
          wordCount: 380,
          updatedAt: new Date().toISOString(),
          content: `<p>우리가 글을 쓸 때 가장 큰 방해 요인은 무엇일까요? 바로 '도구의 지연'입니다.</p><p>연재서재(Book Studio)는 사용자가 한 글자 한 글자 타이핑할 때마다 서버와의 네트워크 통신을 기다리지 않습니다. 모든 글자는 브라우저 로컬 저장소(localStorage)에 <strong>0ms 즉각 저장</strong>되며, 인터넷 연결이 완전히 끊긴 비행기나 지하철 안에서도 100% 정상 작동합니다.</p><p>클라우드 동기화는 작가가 원할 때 백그라운드 스냅샷으로 안전하게 보존되므로, 데이터 유출이나 서버 장애 걱정 없이 오직 문장에만 몰입할 수 있습니다.</p>`
        },
        {
          id: 'sec_starter_1_2',
          title: '2. 창작실 5대 파이프라인의 마법',
          status: 'completed',
          wordCount: 420,
          updatedAt: new Date().toISOString(),
          content: `<p>책 한 권을 기획하는 것은 마라톤과 같습니다. 연재서재 좌측 메뉴의 <strong>창작실</strong>을 열어보세요.</p><p>아이디어 노트(1단계)에서 스친 단상을 기록하고, 출간 기획서(2단계)와 글감 취재창고(3단계)를 거쳐, 작품 서사 설정(4단계)과 44종 뼈대 조립대(5단계)로 이어집니다.</p><p>영웅의 여정, 픽사 6단계 플롯, 설득의 5단계 등 검증된 44종 서사 구조를 선택하면, AI가 당신의 기획에 맞춘 챕터 목차를 1초 만에 설계해 줍니다.</p>`
        }
      ]
    },
    {
      id: 'chap_starter_2',
      title: '제2장. 집필과 표준 웹 뷰어',
      status: 'draft',
      views: 0,
      likes: 0,
      comments: [],
      sections: [
        {
          id: 'sec_starter_2_1',
          title: '1. 본문 모드와 문단 모듈(블록) 에디터',
          status: 'completed',
          wordCount: 350,
          updatedAt: new Date().toISOString(),
          content: `<p>집필 스튜디오 상단의 에디터 툴바를 살펴보세요. 일반 워드프로세서처럼 자유롭게 서식을 적용할 수 있는 것은 물론, <strong>문단 모듈(블록) 에디터</strong>로 전환하여 문단의 순서를 드래그 앤 드롭으로 재배치할 수 있습니다.</p><p>글이 막힐 때는 우측의 AI 초고 도우미나 총괄 수석 편집장을 호출해 문장 윤문과 교정을 받아보세요.</p>`
        },
        {
          id: 'sec_starter_2_2',
          title: '2. 종이책의 감동을 전하는 독자 뷰어',
          status: 'completed',
          wordCount: 290,
          updatedAt: new Date().toISOString(),
          content: `<p>서재에서 도서 카드의 <strong>읽기</strong> 버튼을 누르면, 양면 펼침과 가로/세로 넘김을 지원하는 표준 웹 뷰어로 즉시 연결됩니다.</p><p>독자는 폰트 크기, 행간, 여백, 세피아/다크 모드를 취향에 맞게 조정하며 당신의 이야기를 읽어 내려갈 것입니다. 이제 여러분만의 이야기를 써내려갈 차례입니다.</p>`
        }
      ]
    }
  ]
};

export const STARTER_VAULT_ITEMS = [
  {
    id: 'vault_starter_1',
    category: 'idea',
    title: '글쓰기 루틴: 매일 아침 30분의 기적',
    content: '영감이 떠오르기를 기다리지 말고, 정해진 시간에 책상에 앉아 300자라도 쓰는 습관이 한 권의 책을 만든다.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'vault_starter_2',
    category: 'quote',
    title: '어니스트 헤밍웨이의 글쓰기 명언',
    content: '모든 초고는 끔찍하다. 중요한 것은 다시 읽고 고쳐 쓰는 용기다.',
    createdAt: new Date().toISOString()
  }
];
