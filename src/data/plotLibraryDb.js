/**
 * plotLibraryDb.js
 * 
 * 7대 대분류 44종 표준 공통 서사 뼈대 라이브러리 마스터 DB
 * - 각 뼈대별 플롯 단계(stages) 및 세부 꼭지(subplots) 내장
 * - 10대 장르별 '추천 뼈대' 목록 및 '전체 뼈대' 호출 지원
 */

export const PLOT_CATEGORIES = [
  { id: 'fiction', name: '① 소설 (일반·장르)' },
  { id: 'webnovel', name: '② 웹소설 (회차 연재)' },
  { id: 'essay', name: '③ 에세이·산문' },
  { id: 'poetry', name: '④ 시' },
  { id: 'practical', name: '⑤ 정보·실용' },
  { id: 'analytical', name: '⑥ 분석·사유' },
  { id: 'biographical', name: '⑦ 인물·기록' }
];

export const PLOT_LIBRARY = [
  // ─────────────────────────────────────────────────────────────
  // ① 소설 (일반 소설·장르 소설) - 13종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'fic_classic_5',
    category: 'fiction',
    name: '5단 구성',
    flow: '발단 → 전개 → 위기 → 절정 → 결말',
    fitFor: '정통 장편',
    stages: [
      { title: '1. 발단 (일상과 결핍, 사건의 촉발)', desc: '주인공의 세계관 소개 및 일상을 뒤흔드는 촉발 사건', subplots: [{ title: '1.1 주인공의 결핍된 일상과 환경' }, { title: '1.2 평화를 깨뜨리는 사건의 발생' }] },
      { title: '2. 전개 (모험의 수락과 갈등 상승)', desc: '새로운 세계 진입, 조력자 만남, 시험과 장애물 고조', subplots: [{ title: '2.1 모험의 시작과 첫 번째 시련' }, { title: '2.2 조력자/라이벌의 등장과 갈등의 심화' }] },
      { title: '3. 위기 (미드포인트와 치명적 암흑)', desc: '기존 방식의 처참한 패배와 치명적 비밀의 폭로', subplots: [{ title: '3.1 돌이킬 수 없는 전환점(Midpoint)' }, { title: '3.2 모든 희망이 사라진 절망의 순간' }] },
      { title: '4. 절정 (최후의 결전과 내적 각성)', desc: '결핍을 극복하고 치르는 정면 대결과 카타르시스', subplots: [{ title: '4.1 최후의 결전과 운명의 승부' }, { title: '4.2 승리와 내면의 완전한 각성' }] },
      { title: '5. 결말 (새로운 질서와 일상 복귀)', desc: '사건 종결, 변화된 새로운 차원의 일상과 깊은 여운', subplots: [{ title: '5.1 사건의 종결과 질서의 회복' }, { title: '5.2 후일담과 가슴에 남는 긴 여운' }] }
    ]
  },
  {
    id: 'fic_giseung_4',
    category: 'fiction',
    name: '기승전결',
    flow: '도입 → 전개 → 전환 → 마무리',
    fitFor: '단편, 짧은 서사',
    stages: [
      { title: '1. 기(起) - 상황 제시와 도입', desc: '인물과 기본 배경 소개', subplots: [{ title: '1.1 주인공의 상태와 배경' }] },
      { title: '2. 승(承) - 사건의 발전과 심화', desc: '상황이 본격적으로 펼쳐지며 호기심 유발', subplots: [{ title: '2.1 사건의 점진적 심화' }] },
      { title: '3. 전(轉) - 극적인 전환과 반전', desc: '예기치 못한 상황의 급변과 절정', subplots: [{ title: '3.1 예상치 못한 전환점' }] },
      { title: '4. 결(結) - 매듭과 결말', desc: '사건의 마무리와 남겨진 정서', subplots: [{ title: '4.1 결과와 긴 여운' }] }
    ]
  },
  {
    id: 'fic_3act',
    category: 'fiction',
    name: '3막 구조',
    flow: '설정 → 대립(중간 반전) → 해결',
    fitFor: '장르 소설, 영상화 고려 작품',
    stages: [
      { title: '1막. 설정 (Setup)', desc: '일상의 세계, 도화선 사건, 첫 번째 플롯 포인트', subplots: [{ title: '1.1 일상 세계와 흠집' }, { title: '1.2 모험으로의 부름과 도약' }] },
      { title: '2막. 대립과 충돌 (Confrontation)', desc: '새로운 룰, 미드포인트의 반전, 영혼의 어두운 밤', subplots: [{ title: '2.1 적응과 미드포인트 반전' }, { title: '2.2 가장 큰 패배와 암흑' }] },
      { title: '3막. 해결 (Resolution)', desc: '클라이맥스 대결, 대단원, 변화된 세계', subplots: [{ title: '3.1 클라이맥스 돌파' }, { title: '3.2 새로운 일상의 안착' }] }
    ]
  },
  {
    id: 'fic_heros_journey',
    category: 'fiction',
    name: '영웅의 여정',
    flow: '일상 → 모험의 부름 → 거부 → 조력자 → 시련 → 보상 → 귀환',
    fitFor: '판타지, 모험, 성장물',
    stages: [
      { title: '1. 일상과 모험의 부름', desc: '안락한 고향과 불가피한 부름', subplots: [{ title: '1.1 평화롭지만 결핍된 고향' }, { title: '1.2 부름과 망설임, 조력자의 조언' }] },
      { title: '2. 낯선 세계와 시련', desc: '문턱을 넘어 도달한 미지의 영역', subplots: [{ title: '2.1 관문의 통과와 동료의 합류' }, { title: '2.2 심장부로의 접근과 첫 위기' }] },
      { title: '3. 최대의 시련과 보상', desc: '죽음과 부활의 은유, 결정적 열쇠 획득', subplots: [{ title: '3.1 가장 어두운 동굴에서의 대결' }, { title: '3.2 보상의 획득과 각성' }] },
      { title: '4. 귀환과 일상의 수호', desc: '변화된 영웅의 귀환과 지혜의 공유', subplots: [{ title: '4.1 귀환길의 추격과 최종 부활' }, { title: '4.2 영약을 품은 일상으로의 귀환' }] }
    ]
  },
  {
    id: 'fic_beat_sheet',
    category: 'fiction',
    name: '비트 시트형 (Save the Cat)',
    flow: '15개 장면 비트로 세분화된 3막',
    fitFor: '상업 장르물, 플롯 설계 초보자',
    stages: [
      { title: '1단계. 오프닝과 테마 제시', desc: '오프닝 이미지, 테마 암시, 셋업', subplots: [{ title: '1.1 오프닝 이미지와 현주소' }, { title: '1.2 테마의 진술과 기폭제' }] },
      { title: '2단계. 토론과 2막 진입', desc: '갈등과 선택, B스토리 시작', subplots: [{ title: '2.1 갈등 후 2막 진입' }, { title: '2.2 재미와 게임(Fun & Games)' }] },
      { title: '3단계. 미드포인트와 악당의 압박', desc: '가짜 승리 혹은 가짜 패배, 악당의 조여옴', subplots: [{ title: '3.1 미드포인트 반전' }, { title: '3.2 악당의 반격과 모든 것을 잃은 순간' }] },
      { title: '4단계. 영혼의 어두운 밤과 3막 결전', desc: '새로운 각성, 피날레 대결, 파이널 이미지', subplots: [{ title: '4.1 새로운 아이디어와 3막 돌입' }, { title: '4.2 피날레와 파이널 이미지' }] }
    ]
  },
  {
    id: 'fic_fichtean',
    category: 'fiction',
    name: '피히텐 곡선',
    flow: '도입 짧게 → 위기 연속 상승 → 절정 → 짧은 결말',
    fitFor: '스릴러, 서스펜스',
    stages: [
      { title: '1. 즉각적인 사건 도입', desc: '설명 없이 사건의 도화선으로 직행', subplots: [{ title: '1.1 발화점과 숨 막히는 첫 위기' }] },
      { title: '2. 제1차 위기와 수습 실패', desc: '해결하려 할수록 꼬여가는 첫 번째 덫', subplots: [{ title: '2.1 예상 밖의 걸림돌과 추격' }] },
      { title: '3. 제2차 위기와 시간제한', desc: '더 큰 파국과 조여오는 마감시간', subplots: [{ title: '3.1 막다른 골목과 조력자의 위기' }] },
      { title: '4. 절정과 폭발', desc: '모든 갈등이 한곳에서 폭발하는 총력전', subplots: [{ title: '4.1 진실의 직면과 최후의 탈출' }] },
      { title: '5. 잔혹한 여운의 결말', desc: '살아남았으나 남겨진 상처', subplots: [{ title: '5.1 숨을 고르는 찰나의 침묵' }] }
    ]
  },
  {
    id: 'fic_mystery',
    category: 'fiction',
    name: '미스터리 구조',
    flow: '사건 발생 → 수사·단서 → 오도·반전 → 진상 해결',
    fitFor: '추리, 미스터리',
    stages: [
      { title: '1. 밀실 혹은 불가해한 사건 발생', desc: '비일상적 범죄와 탐정/주인공의 착수', subplots: [{ title: '1.1 기괴한 범죄 현장과 첫 목격' }, { title: '1.2 사건을 맡게 된 동기' }] },
      { title: '2. 단서 수집과 용의자 심문', desc: '물증과 증언 속에 숨겨진 모순들', subplots: [{ title: '2.1 엇갈리는 알리바이' }, { title: '2.2 제2의 희생자 혹은 단서의 도난' }] },
      { title: '3. 교묘한 오도(Red Herring)와 반전', desc: '진짜 범인이 파놓은 함정에 빠짐', subplots: [{ title: '3.1 잘못된 확신과 극적 반전' }] },
      { title: '4. 진상 규명과 동기의 폭로', desc: '모든 퍼즐이 맞춰지는 대단원', subplots: [{ title: '4.1 진범의 트릭 해체' }, { title: '4.2 비극적 동기와 법/운명의 심판' }] }
    ]
  },
  {
    id: 'fic_romance',
    category: 'fiction',
    name: '로맨스 구조',
    flow: '만남 → 끌림 → 장애물 → 위기·이별 → 재회·결합',
    fitFor: '로맨스, 멜로',
    stages: [
      { title: '1. 우연하고 강렬한 첫 만남', desc: '첫눈에 끌리거나 최악의 인상으로 시작', subplots: [{ title: '1.1 마주침과 지울 수 없는 잔상' }] },
      { title: '2. 좁혀지는 거리와 감정의 싹틈', desc: '피치 못할 상황으로 얽히며 서로를 알아감', subplots: [{ title: '2.1 뜻밖의 다정함과 심장의 박동' }, { title: '2.2 첫 번째 교감의 순간' }] },
      { title: '3. 내외적 장애물과 오해', desc: '신분, 과거의 트라우마, 제3자의 개입', subplots: [{ title: '3.1 말하지 못한 진실과 오해의 싹' }] },
      { title: '4. 이별의 아픔과 뼈아픈 자각', desc: '헤어진 뒤에야 깨닫는 상대의 존재감', subplots: [{ title: '4.1 돌아서는 발걸음과 텅 빈 일상' }] },
      { title: '5. 재회와 영원한 결합', desc: '장애물을 부수고 달려가는 진심', subplots: [{ title: '5.1 망설임 없는 고백과 온전한 결합' }] }
    ]
  },
  {
    id: 'fic_growth',
    category: 'fiction',
    name: '성장 서사',
    flow: '결핍 → 시련과 배움 → 내적 변화 → 자립',
    fitFor: '성장소설, 청춘물',
    stages: [
      { title: '1. 보호막 안의 미성숙과 결핍', desc: '세상을 모르는 주인공과 은밀한 결핍', subplots: [{ title: '1.1 좁은 울타리와 꿈' }] },
      { title: '2. 보호막의 균열과 낯선 시련', desc: '첫 실패, 배신, 세상의 냉혹함 경험', subplots: [{ title: '2.1 세상과의 첫 불협화음' }, { title: '2.2 멘토의 만남과 쓰라린 배움' }] },
      { title: '3. 스스로 내리는 첫 번째 결정', desc: '타인의 지시가 아닌 나의 의지로 선택', subplots: [{ title: '3.1 뼈아픈 대가를 치르는 용기' }] },
      { title: '4. 홀로서기와 새로운 내일', desc: '결핍을 품고 당당히 세상으로 나아감', subplots: [{ title: '4.1 어른이 된 주인공의 담담한 걸음' }] }
    ]
  },
  {
    id: 'fic_frame',
    category: 'fiction',
    name: '액자식 구성',
    flow: '바깥 이야기 → 안쪽 이야기 → 바깥으로 귀환',
    fitFor: '회상·전달 구조',
    stages: [
      { title: '1. 외부 액자: 화자의 현실과 계기', desc: '기이한 기록이나 노인을 만나게 된 현재', subplots: [{ title: '1.1 오래된 일기장의 발견과 호기심' }] },
      { title: '2. 내부 액자: 과거의 격동적 이야기', desc: '기록 속 주인공의 파란만장한 본 서사', subplots: [{ title: '2.1 과거 사건의 발단과 전개' }, { title: '2.2 과거 사건의 비극적 절정' }] },
      { title: '3. 외부 액자 귀환: 현재 화자의 깨달음', desc: '이야기를 듣고 난 현재 화자의 삶의 변화', subplots: [{ title: '3.1 책장을 덮으며 바라보는 창밖 풍경' }] }
    ]
  },
  {
    id: 'fic_flashback',
    category: 'fiction',
    name: '역순행·플래시백',
    flow: '사건 한가운데서 시작 → 과거 교차 → 현재 결말',
    fitFor: '몰입형 도입, 누아르',
    stages: [
      { title: '1. 파국의 한가운데 (인 미디어스 레스)', desc: '총성이 울리거나 피투성이가 된 현재 장면', subplots: [{ title: '1.1 어쩌다 이 지경이 되었을까' }] },
      { title: '2. 모든 것이 시작된 과거 시점', desc: '평범했던 그날, 첫 단추의 어긋남', subplots: [{ title: '2.1 평온했던 시작과 은밀한 유혹' }] },
      { title: '3. 현재와 과거의 교차 전개', desc: '과거의 선택들이 도미노처럼 현재로 질주', subplots: [{ title: '3.1 좁혀지는 시간의 간격' }] },
      { title: '4. 오프닝 순간과의 조우 및 결말', desc: '1장의 파국을 지나 진짜 최종 결말로 도달', subplots: [{ title: '4.1 마지막 방아쇠와 남겨진 진실' }] }
    ]
  },
  {
    id: 'fic_multi_view',
    category: 'fiction',
    name: '다중 시점·교차 서사',
    flow: '인물별 시점 교차 → 이야기 합류 → 결말',
    fitFor: '군상극, 스릴러',
    stages: [
      { title: '1. A인물의 하루와 결핍', desc: '사건의 한쪽 면을 바라보는 첫 번째 눈', subplots: [{ title: '1.1 A의 동선과 시선' }] },
      { title: '2. B인물의 반대 시선', desc: 'A가 보지 못한 이면과 상반된 이해관계', subplots: [{ title: '2.1 B의 은밀한 계획' }] },
      { title: '3. 시점들의 충돌과 하나의 사건', desc: '각자의 사정으로 같은 장소에 모여드는 인물들', subplots: [{ title: '3.1 충돌하는 동기와 오해' }] },
      { title: '4. 다중 모자이크의 완성과 진실', desc: '시점들이 합쳐지며 드러나는 거대한 전체상', subplots: [{ title: '4.1 흩어진 조각들의 폭발' }] }
    ]
  },
  {
    id: 'fic_omnibus',
    category: 'fiction',
    name: '연작 단편',
    flow: '독립 단편들 → 공통 인물·공간으로 연결',
    fitFor: '옴니버스, 힐링물',
    stages: [
      { title: '1편. 첫 번째 손님의 이야기', desc: '특정 공간에 찾아온 인물의 아픔과 치유', subplots: [{ title: '1.1 방문과 사연의 고백' }, { title: '1.2 작은 위로와 떠남' }] },
      { title: '2편. 두 번째 손님의 엇갈림', desc: '1편의 인물과 스치듯 연결되는 다른 사건', subplots: [{ title: '2.1 또 다른 각도의 사연' }] },
      { title: '3편. 공간 주인의 비밀과 전체 연결', desc: '그들을 지켜보던 공간 주인의 내막', subplots: [{ title: '3.1 모든 인물이 이어지는 따뜻한 연대' }] }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ② 웹소설 (회차 연재) - 5종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'web_episode',
    category: 'webnovel',
    name: '회차 연재형',
    flow: '회차마다 도입 훅 → 전개 → 끝에서 끊기(절단신공)',
    fitFor: '모든 웹소설의 기본 단위',
    stages: [
      { title: '1화~5화. 도입부 압도적 훅과 각성', desc: '1화 첫 줄부터 시선 강탈, 바닥에서 솟구치는 반전', subplots: [{ title: '1화. 벼랑 끝의 밑바닥과 갑작스러운 각성' }, { title: '2~3화. 새로운 힘의 확인과 첫 쾌감' }, { title: '4~5화. 첫 번째 장애물 돌파와 연재 훅' }] },
      { title: '6화~15화. 쾌속 성장과 주변의 경악', desc: '무시하던 자들의 코를 납작하게 만드는 실력 증명', subplots: [{ title: '첫 번째 무대 장악과 명성 획득' }, { title: '다음 단계 던전/에피소드로의 질주' }] },
      { title: '16화~25화. 첫 번째 거대 세력과의 대립', desc: '점점 스케일이 커지는 대결 구도', subplots: [{ title: '거대 세력의 방해와 사이다 파훼' }, { title: '독점 보상 획득과 다음 에피소드 절단' }] }
    ]
  },
  {
    id: 'web_reincarnation',
    category: 'webnovel',
    name: '회귀·빙의·환생형',
    flow: '각성 → 미래 정보 우위 → 성장 → 복수·성취',
    fitFor: '현대판타지, 로판, 아카데미물',
    stages: [
      { title: '1. 억울한 파멸과 10년 전 눈뜸', desc: '배신과 죽음 직후, 모든 것이 시작되기 전으로 회귀', subplots: [{ title: '1.1 처참했던 전생의 기억과 각오' }, { title: '1.2 달력을 확인하며 터져 나오는 미소' }] },
      { title: '2. 미래 지식을 통한 기연 독점', desc: '남들은 모르는 대박 주식/던전/기연 선점', subplots: [{ title: '2.1 최초의 기연 회수와 벼락 성장' }, { title: '2.2 전생의 은인을 향한 선제적 구원' }] },
      { title: '3. 전생의 원수들을 향한 빌드업', desc: '아직 힘을 모으기 전인 원수들의 싹을 자름', subplots: [{ title: '3.1 철저하게 설계된 함정' }, { title: '3.2 숨 막히는 인과응보의 실현' }] },
      { title: '4. 전생을 뛰어넘는 절대자의 등극', desc: '전생의 한계를 넘어선 새로운 영역 개척', subplots: [{ title: '4.1 최후의 재앙에 맞서는 영웅' }] }
    ]
  },
  {
    id: 'web_cider_growth',
    category: 'webnovel',
    name: '성장 사이다형',
    flow: '압박(고구마) → 해소(사이다) 사이클 반복, 단계적 레벨업',
    fitFor: '무협, 헌터물, 현판',
    stages: [
      { title: '1. 짧은 압박과 즉각적 반격', desc: '불합리한 탄압에 망설임 없이 일격 필살', subplots: [{ title: '1.1 불합리한 시비와 무자비한 응징' }] },
      { title: '2. 더 높은 무대로의 진입과 레벨업', desc: '새로운 던전/문파 입문과 빠른 승급', subplots: [{ title: '2.1 기량을 입증하는 시험' }, { title: '2.2 남들의 한계를 비웃는 속도전' }] },
      { title: '3. 압도적인 무력 과시와 권선징악', desc: '거침없는 파죽지세의 승리 행진', subplots: [{ title: '3.1 방해자들을 압살하는 통쾌함' }] }
    ]
  },
  {
    id: 'web_ropan_destiny',
    category: 'webnovel',
    name: '로판 운명 개척형',
    flow: '원작 속 악녀/시한부 빙의 → 파멸 회피 → 관계 재편 → 새 결말',
    fitFor: '로맨스판타지',
    stages: [
      { title: '1. 사형대 직전의 악녀로 빙의', desc: '원작의 결말을 알기에 오늘부터 착하게 살기로 결심', subplots: [{ title: '1.1 거울을 보며 경악하는 새 영혼' }, { title: '1.2 파혼/가문 탈출을 위한 초기 자금 마련' }] },
      { title: '2. 냉혈 남주/가족들의 당혹과 집착', desc: '태도가 바뀐 여주에게 시선을 떼지 못하는 주변인들', subplots: [{ title: '2.1 왜 이전처럼 매달리지 않지?' }, { title: '2.2 숨겨진 능력 발휘와 뜻밖의 호감' }] },
      { title: '3. 원작 여주의 등장과 진실 폭로', desc: '원작의 순결한 여주가 사실은 흑막이었다는 반전', subplots: [{ title: '3.1 음모를 꿰뚫어 보는 여주의 기지' }] },
      { title: '4. 남주의 완전한 굴복과 행복한 엔딩', desc: '나만의 사랑과 제국 최고의 권력 쟁취', subplots: [{ title: '4.1 무릎 꿇는 남주와 운명의 완성' }] }
    ]
  },
  {
    id: 'web_season',
    category: 'webnovel',
    name: '시즌제 구성',
    flow: '시즌별 목표·적 → 시즌 절정 → 다음 시즌 떡밥',
    fitFor: '장기 연재, 레이드물',
    stages: [
      { title: '시즌 1. 국내 리그 제패와 각성', desc: '소규모 위기를 해결하며 전국 랭커 등극', subplots: [{ title: '초보자 구역 탈출과 랭킹 1위' }] },
      { title: '시즌 2. 세계 무대와 숨겨진 흑막', desc: '글로벌 길드 대전과 시스템의 비밀 규명', subplots: [{ title: '국가 대항전 승리와 시스템 경고' }] },
      { title: '시즌 3. 차원 너머의 신들과의 결전', desc: '세계의 멸망을 막아서는 최종 신화', subplots: [{ title: '창조주와의 담판과 엔딩' }] }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ③ 에세이·산문 - 7종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'ess_theme',
    category: 'essay',
    name: '테마 산문형',
    flow: '주제별 묶음, 느슨한 흐름',
    fitFor: '일반 에세이집, 감성 산문',
    stages: [
      { title: '1부. 나를 마주하는 조용한 시간', desc: '혼자만의 고독, 방, 사소한 습관 관찰', subplots: [{ title: '1.1 새벽 2시의 불 켜진 방' }, { title: '1.2 서랍 속에 넣어둔 오래된 후회' }] },
      { title: '2부. 타인과의 서투른 거리', desc: '관계의 피로와 다정함의 온기', subplots: [{ title: '2.1 적당한 무관심이 주는 안도' }, { title: '2.2 밥 한 끼 나누는 일의 무게' }] },
      { title: '3부. 비로소 살아가는 일', desc: '완벽하지 않은 삶을 긍정하는 태도', subplots: [{ title: '3.1 무너지지 않는 마음의 근육' }, { title: '3.2 내일도 담담하게 걸어가기' }] }
    ]
  },
  {
    id: 'ess_chrono_memoir',
    category: 'essay',
    name: '시간순 회고형',
    flow: '시기별 에피소드 → 전환점 → 현재의 시선',
    fitFor: '회고, 자전 에세이',
    stages: [
      { title: '1장. 그 시절의 유년과 풋내', desc: '기억의 원점이 되는 어린 날의 풍경', subplots: [{ title: '1.1 골목길의 흙냄새와 유년의 결핍' }] },
      { title: '2장. 방황과 부딪침의 청춘', desc: '세상에 깨지고 넘어지던 20대의 초상', subplots: [{ title: '2.1 차가운 서울의 월세방' }, { title: '2.2 첫 직장, 쓰라린 현실과의 충돌' }] },
      { title: '3장. 삶을 바꾼 결정적 전환점', desc: '포기와 시작 사이에서 내린 선택', subplots: [{ title: '3.1 모든 것을 내려놓았던 날' }] },
      { title: '4장. 오늘, 창가에 서서', desc: '과거를 용서하고 현재를 긍정하는 시선', subplots: [{ title: '4.1 상처가 굳은살이 되기까지' }] }
    ]
  },
  {
    id: 'ess_travel',
    category: 'essay',
    name: '장소·여행 기록형',
    flow: '장소별 장 → 경험 → 사유',
    fitFor: '여행 에세이, 공간 인문학',
    stages: [
      { title: '1. 낯선 도시에 첫발을 딛다', desc: '낯선 언어와 공항의 서늘한 공기', subplots: [{ title: '1.1 지도 없이 걷는 뒷골목' }] },
      { title: '2. 그곳에 사는 사람들의 표정', desc: '관광지가 아닌 현지인의 시장과 일상', subplots: [{ title: '2.1 따뜻한 차 한 잔을 건네던 눈빛' }] },
      { title: '3. 공간이 일깨워준 내면의 질문', desc: '익숙한 집을 떠나와서야 비로소 보이는 것들', subplots: [{ title: '3.1 짐가방의 무게와 비움' }] },
      { title: '4. 돌아오는 비행기 안에서', desc: '다시 일상으로 돌아가는 나의 변화', subplots: [{ title: '4.1 여행은 끝났지만 삶은 계속된다' }] }
    ]
  },
  {
    id: 'ess_keyword',
    category: 'essay',
    name: '키워드 에세이',
    flow: '단어·사물 하나당 한 편',
    fitFor: '짧은 호흡의 산문집',
    stages: [
      { title: '1부. 물질의 온기 (사물 키워드)', desc: '안경, 연필, 낡은 코트, 머그잔', subplots: [{ title: '1.1 닳고 닳은 몽당연필의 윤리' }, { title: '1.2 온기를 품어주는 따뜻한 잔' }] },
      { title: '2부. 마음의 상태 (감정 키워드)', desc: '체념, 설렘, 수치심, 다정', subplots: [{ title: '2.1 잘 체념하는 일의 아름다움' }, { title: '2.2 어른의 다정함이란' }] },
      { title: '3부. 시간의 결 (순간 키워드)', desc: '황혼, 정적, 폭우, 여백', subplots: [{ title: '3.1 소나기가 지나간 뒤의 냄새' }] }
    ]
  },
  {
    id: 'ess_epistle',
    category: 'essay',
    name: '서간체',
    flow: '특정 대상에게 보내는 편지 형식',
    fitFor: '고백적, 정서적 글',
    stages: [
      { title: '1. 부치지 못한 첫 번째 편지 (어머니/아버지에게)', desc: '차마 말로 전하지 못했던 죄송함과 감사', subplots: [{ title: '1.1 부모의 굽은 등 뒤에서' }] },
      { title: '2. 떠나간 친구에게 보내는 편지', desc: '시간의 흐름 속에 멀어진 벗에게', subplots: [{ title: '2.1 우리의 서툴렀던 청춘을 기억하며' }] },
      { title: '3. 10년 전/후의 나에게 보내는 편지', desc: '과거의 나를 위로하고 미래의 나를 응원', subplots: [{ title: '3.1 그때의 너는 충분히 최선을 다했다' }] }
    ]
  },
  {
    id: 'ess_journal',
    category: 'essay',
    name: '일기·저널형',
    flow: '날짜별 기록 → 누적되는 변화',
    fitFor: '기록형 에세이, 관찰기',
    stages: [
      { title: '봄의 기록. 싹을 틔우는 인내', desc: '3월~5월의 일상과 작고 미세한 변화들', subplots: [{ title: '3월 12일. 차가운 바람 속 목련 꽃봉오리' }] },
      { title: '여름의 기록. 무성해지는 고민', desc: '6월~8월의 뙤약볕과 치열한 노동', subplots: [{ title: '7월 24일. 땀방울 뒤에 찾아온 정적' }] },
      { title: '가을의 기록. 덜어내는 홀가분함', desc: '9월~11월의 결실과 서글픔', subplots: [{ title: '10월 30일. 낙엽을 밟으며 털어낸 미련' }] }
    ]
  },
  {
    id: 'ess_column',
    category: 'essay',
    name: '칼럼 모음형',
    flow: '독립 칼럼들 → 주제별 부 구성',
    fitFor: '연재 칼럼 엮음, 비평 에세이',
    stages: [
      { title: '1부. 시대를 읽는 날카로운 시선', desc: '사회적 현상과 트렌드에 대한 지성적 통찰', subplots: [{ title: '1.1 우리는 왜 분노에 중독되었는가' }] },
      { title: '2부. 문화와 예술의 안쪽 들여다보기', desc: '영화, 책, 음악을 매개로 한 인간 탐구', subplots: [{ title: '2.1 고전 영화가 지금 우리에게 묻는 질문' }] },
      { title: '3부. 공동체의 회복을 위한 제언', desc: '갈등을 넘어 연대로 향하는 성찰', subplots: [{ title: '3.1 작은 식탁에서 시작되는 대화' }] }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ④ 시 - 3종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'poet_emotion',
    category: 'poetry',
    name: '부 단위 정서 흐름',
    flow: '부(部)마다 정서·주제 묶음',
    fitFor: '일반 시집',
    stages: [
      { title: '제1부. 서러움과 상실의 노래', desc: '결핍과 눈물의 정서', subplots: [{ title: '슬픔의 표정' }, { title: '지워진 이름' }] },
      { title: '제2부. 침묵 속에서 길어 올린 말', desc: '고독과 사색의 심화', subplots: [{ title: '깊은 밤의 우물' }, { title: '벽에 기댄 그림자' }] },
      { title: '제3부. 작은 빛과 다정한 손길', desc: '치유와 회복의 희망', subplots: [{ title: '창턱에 내린 볕' }, { title: '다시 봄' }] }
    ]
  },
  {
    id: 'poet_seasons',
    category: 'poetry',
    name: '계절·시간 순환형',
    flow: '봄 → 여름 → 가을 → 겨울 또는 하루의 흐름',
    fitFor: '서정 시집, 자연시',
    stages: [
      { title: '봄. 눈 트는 소리', desc: '탄생과 연한 생명력', subplots: [{ title: '얼음 풀리는 내' }] },
      { title: '여름. 울창한 그늘', desc: '정열과 푸른 생명', subplots: [{ title: '소나기 지난 숲' }] },
      { title: '가을. 비워내는 잎', desc: '낙화와 완숙', subplots: [{ title: '익어가는 저녁' }] },
      { title: '겨울. 하얀 침묵', desc: '고요와 기다림', subplots: [{ title: '첫눈의 언어' }] }
    ]
  },
  {
    id: 'poet_series',
    category: 'poetry',
    name: '연작시형',
    flow: '하나의 주제·인물로 이어지는 시편들',
    fitFor: '주제 시집, 서사시',
    stages: [
      { title: '연작 1. 그 사람의 초상', desc: '인물의 등장과 숙명', subplots: [{ title: '그 사람의 신발' }] },
      { title: '연작 2. 거친 바다를 건너', desc: '인물이 겪는 풍파', subplots: [{ title: '파도의 문장' }] },
      { title: '연작 3. 언덕 위의 묘비', desc: '역사와 삶의 마무리', subplots: [{ title: '바람이 머무는 곳' }] }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ⑤ 정보·실용 - 12종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'prac_problem_solve',
    category: 'practical',
    name: '문제-해결형',
    flow: '문제 제기 → 원인 분석 → 해결책 → 실행 가이드',
    fitFor: '자기계발, 실용, 경영',
    stages: [
      { title: '1장. 왜 우리는 항상 실패하는가 (문제 제기)', desc: '독자가 겪고 있는 고통과 결핍의 실체 규명', subplots: [{ title: '1.1 노력해도 제자리인 이유' }, { title: '1.2 기존 방식의 치명적 한계' }] },
      { title: '2장. 문제의 진짜 근본 원인 (원인 분석)', desc: '표면적 핑계 뒤에 숨겨진 구조적 메커니즘', subplots: [{ title: '2.1 뇌과학과 심리학이 밝혀낸 원인' }] },
      { title: '3장. 새로운 프레임워크와 해결 공식 (해결책)', desc: '검증된 혁신적 솔루션과 작동 원리', subplots: [{ title: '3.1 3단계 해결 마스터 공식' }] },
      { title: '4장. 오늘 당장 시작하는 실전 가이드 (실행)', desc: '체크리스트와 주간 실천 플랜', subplots: [{ title: '4.1 7일 완성 액션 플랜' }] }
    ]
  },
  {
    id: 'prac_framework',
    category: 'practical',
    name: '방법론·프레임워크형',
    flow: '핵심 개념 → 기본 원리 → 적용 단계 → 실전 사례',
    fitFor: '경영, IT, 비즈니스',
    stages: [
      { title: '1장. 패러다임의 전환과 핵심 프레임워크', desc: '왜 이 방법론이 지금 시장을 뒤흔드는가', subplots: [{ title: '1.1 새로운 표준의 등장' }] },
      { title: '2장. 프레임워크를 지탱하는 3대 핵심 원리', desc: '성공률을 10배 끌어올리는 메커니즘', subplots: [{ title: '2.1 제1원칙: 데이터 기반 의사결정' }, { title: '2.2 제2원칙: 초고속 반복 피드백' }] },
      { title: '3장. 실전 비즈니스 적용 4단계 로드맵', desc: '조직과 업무에 프레임워크를 이식하는 법', subplots: [{ title: '3.1 도입부터 스케일업까지 단계별 가이드' }] },
      { title: '4장. 성공과 실패의 갈림길: 실제 기업 사례', desc: '글로벌 유니콘과 국내 탑티어의 케이스 스터디', subplots: [{ title: '4.1 실패 기업의 맹점 분석' }] }
    ]
  },
  {
    id: 'prac_roadmap',
    category: 'practical',
    name: '단계별 로드맵형',
    flow: '1단계 → 2단계 → … → 완성',
    fitFor: '입문 실용서, 초보자 가이드',
    stages: [
      { title: 'Step 1. 준비와 마인드셋 (기초 세팅)', desc: '시작 전 반드시 갖춰야 할 기본 도구', subplots: [{ title: '1.1 실패 없는 환경 세팅법' }] },
      { title: 'Step 2. 첫걸음 떼기 (기본기 마스터)', desc: '가장 쉬운 성공 경험 만들기', subplots: [{ title: '2.1 80%를 결정하는 20%의 핵심' }] },
      { title: 'Step 3. 중급 도약 (응용과 디테일)', desc: '실전에서 부딪히는 변수 제어', subplots: [{ title: '3.1 흔한 실수 피하기' }] },
      { title: 'Step 4. 마스터와 독립 (지속 가능한 시스템)', desc: '스스로 문제를 해결하는 전문가의 경지', subplots: [{ title: '4.1 자동화와 확장' }] }
    ]
  },
  {
    id: 'prac_challenge',
    category: 'practical',
    name: '챌린지형',
    flow: '30일, 12주 등 기간별 과제 수행',
    fitFor: '습관, 다이어트, 학습, 재테크',
    stages: [
      { title: '1주차. 저항을 뚫는 워밍업 7일', desc: '가장 작은 행동으로 뇌를 속이는 주간', subplots: [{ title: 'Day 1~7: 하루 5분 실천' }] },
      { title: '2주차. 가속도를 붙이는 적응기', desc: '피로감을 넘어서는 피드백 시스템', subplots: [{ title: 'Day 8~14: 강도 살짝 높이기' }] },
      { title: '3주차. 정체기를 깨부수는 도약기', desc: '첫 번째 포기 유혹을 이겨내는 법', subplots: [{ title: 'Day 15~21: 위기 돌파 팁' }] },
      { title: '4주차. 평생 습관으로 굳히는 완성기', desc: '의지력 없이 자동으로 돌아가는 일상', subplots: [{ title: 'Day 22~30: 정착과 보상' }] }
    ]
  },
  {
    id: 'prac_listicle',
    category: 'practical',
    name: '리스트형',
    flow: '“○○하는 50가지” 독립 항목 나열',
    fitFor: '가볍게 읽는 실용서, 팁 모음',
    stages: [
      { title: '1부. 반드시 버려야 할 나쁜 습관 10가지', desc: '에너지를 갉아먹는 습관 제거', subplots: [{ title: '1. 미루기 습관의 고리 끊기' }, { title: '2. 완벽주의라는 덫' }] },
      { title: '2부. 즉시 생산성을 2배 높이는 치트키 15가지', desc: '당장 오늘 적용 가능한 팁', subplots: [{ title: '11. 2분 법칙의 기적' }, { title: '12. 알림 끄기의 힘' }] },
      { title: '3부. 최고의 효율을 만드는 루틴 10가지', desc: '아침과 저녁을 장악하는 법', subplots: [{ title: '26. 모닝 페이지 작성법' }] }
    ]
  },
  {
    id: 'prac_qna',
    category: 'practical',
    name: 'Q&A형',
    flow: '독자 단골 질문 → 심층 명쾌 답변',
    fitFor: '상담형, 육아, 입문자 FAQ',
    stages: [
      { title: '1장. 입문자가 가장 많이 하는 질문 TOP 5', desc: '초보자들의 막막함을 뚫어주는 답변', subplots: [{ title: 'Q1. 돈이 없어도 시작할 수 있나요?' }] },
      { title: '2장. 실전에서 멘붕 올 때 찾는 응급 Q&A', desc: '돌발 상황 대처법', subplots: [{ title: 'Q6. 계약서 쓸 때 이건 어떻게 하나요?' }] },
      { title: '3장. 더 높은 수익을 위한 심화 질문', desc: '프로들이 묻는 한 끗 차이', subplots: [{ title: 'Q12. 절세와 리스크 관리법은?' }] }
    ]
  },
  {
    id: 'prac_myth_bust',
    category: 'practical',
    name: '오해 바로잡기형',
    flow: '흔한 상식·오해 → 팩트 폭격 → 올바른 대안',
    fitFor: '재테크, 건강, 부동산',
    stages: [
      { title: '1장. 대중이 믿고 있는 거짓 상식들', desc: '우리가 잘못 알고 있던 통념 뒤집기', subplots: [{ title: '오해 1: 아끼기만 하면 부자가 된다?' }] },
      { title: '2장. 데이터가 증명하는 진짜 팩트', desc: '통계와 역사가 말해주는 시장의 진실', subplots: [{ title: '팩트: 인플레이션을 이기는 유일한 자산' }] },
      { title: '3장. 속지 않는 1%의 올바른 실천법', desc: '진짜 전문가들의 포트폴리오 원칙', subplots: [{ title: '잃지 않는 원칙 세우기' }] }
    ]
  },
  {
    id: 'prac_intro_guide',
    category: 'practical',
    name: '입문·개론형',
    flow: '기초 개념 → 단계별 심화 → 실무 응용',
    fitFor: 'IT, 과학, 인공지능 입문',
    stages: [
      { title: '1장. 지도 한 장으로 보는 전체 숲', desc: '기초 개념과 역사, 왜 중요한가', subplots: [{ title: '1.1 용어의 명쾌한 정리' }] },
      { title: '2장. 필수 핵심 원리 파헤치기', desc: '초보자도 이해하는 쉬운 비유와 메커니즘', subplots: [{ title: '2.1 작동 방식의 3요소' }] },
      { title: '3장. 실전 응용과 미래 전망', desc: '내 커리어와 일상에 접목하는 법', subplots: [{ title: '3.1 실생활 적용 예시' }] }
    ]
  },
  {
    id: 'prac_project_based',
    category: 'practical',
    name: '실습·프로젝트형',
    flow: '예제 따라 만들기 → 변형 → 확장 과제',
    fitFor: '프로그래밍, 요리, 공예',
    stages: [
      { title: 'Project 1. 1시간 만에 완성하는 미니 실습', desc: '성공의 짜릿함을 맛보는 초간단 예제', subplots: [{ title: '1.1 단계별 따라 하기' }, { title: '1.2 결과물 확인과 보완' }] },
      { title: 'Project 2. 실무 수준의 메인 프로젝트', desc: '기능을 결합하여 진짜 쓸모 있는 것 만들기', subplots: [{ title: '2.1 기획부터 배포까지' }] },
      { title: 'Project 3. 나만의 포트폴리오로 확장하기', desc: '나만의 아이디어를 얹어 완성하는 과제', subplots: [{ title: '3.1 커스터마이징 가이드' }] }
    ]
  },
  {
    id: 'prac_reference',
    category: 'practical',
    name: '가이드·레퍼런스형',
    flow: '주제별 사전식 독립 챕터, 필요한 곳 찾아 읽기',
    fitFor: '라이프, 사전, 테크 핸드북',
    stages: [
      { title: 'Part 1. 필수 기본 도구 및 환경 세팅', desc: '언제든 찾아보는 기초 레퍼런스', subplots: [{ title: 'A. 환경설정 핸드북' }] },
      { title: 'Part 2. 기능별 상세 레시피 & 치트시트', desc: '상황별 즉문즉답 코드/노하우', subplots: [{ title: 'B. 상황별 문제해결 치트시트' }] },
      { title: 'Part 3. 부록: 오류 코드 및 트러블슈팅', desc: '에러 났을 때 찾는 비상 매뉴얼', subplots: [{ title: 'C. 에러 대응 가이드' }] }
    ]
  },
  {
    id: 'prac_compare',
    category: 'practical',
    name: '비교·대조형',
    flow: '선택지 A vs B → 평가 기준 → 상황별 맞춤 추천',
    fitFor: '투자 상품 비교, 진로 선택, 소비',
    stages: [
      { title: '1장. 왜 우리는 선택의 딜레마에 빠지는가', desc: 'A와 B의 매력과 결정 장애의 이유', subplots: [{ title: '1.1 상반된 두 갈래 길' }] },
      { title: '2장. 5가지 핵심 잣대로 낱낱이 뜯어보기', desc: '수익성, 안정성, 비용, 난이도 비교', subplots: [{ title: '2.1 심층 비교 분석표' }] },
      { title: '3장. 당신의 상황에 맞는 최선의 선택지', desc: '자본금/성향별 맞춤형 추천', subplots: [{ title: '3.1 맞춤형 선택 가이드' }] }
    ]
  },
  {
    id: 'prac_change_story',
    category: 'practical',
    name: '변화 스토리형',
    flow: '저자 경험담 → 깨달은 원칙 → 독자 적용법',
    fitFor: '자기계발, 성공학, 머니 트레이너',
    stages: [
      { title: '1장. 빚더미 밑바닥에서 피눈물 흘리던 시절', desc: '누구나 공감할 수 있는 절망적 출발점', subplots: [{ title: '1.1 통장 잔고 0원의 절망' }] },
      { title: '2장. 삶을 송두리째 바꾼 단 하나의 깨달음', desc: '인생을 바꾼 멘토와의 만남 혹은 사건', subplots: [{ title: '2.1 부의 추월차선을 발견한 날' }] },
      { title: '3장. 내가 증명해낸 5가지 부의 법칙', desc: '실제로 10억을 벌게 해준 절대 원칙', subplots: [{ title: '3.1 수익 파이프라인의 구축' }] },
      { title: '4장. 이제 당신이 인생을 역전시킬 차례다', desc: '독자의 등을 밀어주는 강력한 동기부여', subplots: [{ title: '4.1 지금 당장 통장을 열어라' }] }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ⑥ 분석·사유 - 6종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'ana_case_study',
    category: 'analytical',
    name: '사례 연구형',
    flow: '사례들 → 공통 패턴 발견 → 교훈 도출',
    fitFor: '경영, 사회, 비즈니스',
    stages: [
      { title: '1장. 성공한 3대 혁신 기업의 현주소', desc: '시장을 뒤흔든 실제 케이스 제시', subplots: [{ title: '1.1 기업 A의 파격적 실험' }] },
      { title: '2장. 그들의 이면을 관통하는 공통 패턴', desc: '겉모습은 달라도 내부 메커니즘은 같다', subplots: [{ title: '2.1 보이지 않는 승리의 공식' }] },
      { title: '3장. 우리 비즈니스에 던지는 냉혹한 시사점', desc: '적용할 수 있는 전략적 레슨', subplots: [{ title: '3.1 내일의 생존을 위한 제언' }] }
    ]
  },
  {
    id: 'ana_trend',
    category: 'analytical',
    name: '트렌드 전망형',
    flow: '현재 진단 → 변화 요인(Driver) → 시나리오 → 대응책',
    fitFor: '트렌드, IT, 미래학',
    stages: [
      { title: '1장. 소리 없이 시작된 거대한 균열 (현재 진단)', desc: '일상 속에 스며든 이상 징후들', subplots: [{ title: '1.1 통계가 가리키는 지각변동' }] },
      { title: '2장. 변화를 촉발하는 3대 트리거 (동인 분석)', desc: '기술, 인구, 기후의 메가트렌드', subplots: [{ title: '2.1 AI와 인구 절벽의 결합' }] },
      { title: '3장. 다가올 3가지 미래 시나리오', desc: '낙관, 비관, 중립적 시나리오별 모습', subplots: [{ title: '3.1 승자와 패자가 갈리는 지점' }] },
      { title: '4장. 새로운 세계에서 부를 거머쥘 전략', desc: '개인과 기업의 포지셔닝', subplots: [{ title: '4.1 살아남는 자들의 포트폴리오' }] }
    ]
  },
  {
    id: 'ana_argument',
    category: 'analytical',
    name: '논증형',
    flow: '주장 제시 → 논리적 근거 → 반론 검토 → 재반박 → 결론',
    fitFor: '인문, 사회비평, 칼럼',
    stages: [
      { title: '1장. 우리가 침묵해온 불편한 진실 (주장)', desc: '통념을 깨뜨리는 대담한 명제', subplots: [{ title: '1.1 시대의 왜곡된 상식 고발' }] },
      { title: '2장. 주장을 뒷받침하는 3가지 철옹성 근거', desc: '철학, 역사, 통계적 논증', subplots: [{ title: '2.1 제1근거: 역사적 필연성' }, { title: '2.2 제2근거: 경제적 불평등' }] },
      { title: '3장. 예상되는 반론과 그 허점 (재반박)', desc: '비판자들의 논리를 논리적으로 해체', subplots: [{ title: '3.1 기득권 논리의 맹점' }] },
      { title: '4장. 우리가 나아가야 할 새로운 합의 (결론)', desc: '사회의 건강한 진보를 위한 제언', subplots: [{ title: '4.1 대안적 사회 계약' }] }
    ]
  },
  {
    id: 'ana_question_insight',
    category: 'analytical',
    name: '질문-사유형',
    flow: '근본적 질문 던지기 → 여러 관점 교차 → 사유와 통찰',
    fitFor: '철학, 인문학, 심리학',
    stages: [
      { title: '1장. 당연하다고 믿었던 것들에 대한 의문', desc: '‘행복이란 무엇인가’ 근본적 질문', subplots: [{ title: '1.1 우리는 왜 쉴 때조차 불안한가' }] },
      { title: '2장. 고전 철학자들의 엇갈리는 대답들', desc: '스토아학파부터 현대 실존주의까지', subplots: [{ title: '2.1 아리스토텔레스의 중용과 니체의 춤' }] },
      { title: '3장. 나만의 답을 찾아가는 사유의 여정', desc: '정답이 없는 시대를 살아가는 지혜', subplots: [{ title: '3.1 불완전함을 껴안는 태도' }] }
    ]
  },
  {
    id: 'ana_commentary',
    category: 'analytical',
    name: '해설형',
    flow: '시대적 배경 → 작품·사건 분석 → 현대적 의미',
    fitFor: '예술, 문화, 고전 해설',
    stages: [
      { title: '1장. 그 시대는 왜 그 작품을 낳았는가', desc: '역사적 맥락과 창작자의 삶', subplots: [{ title: '1.1 세기말의 우울과 천재의 탄생' }] },
      { title: '2장. 작품 속에 숨겨진 디테일과 상징들', desc: '아는 만큼 보이는 미학적 장치들', subplots: [{ title: '2.1 붓질 하나에 담긴 저항' }] },
      { title: '3장. 100년이 지난 오늘, 우리에게 남긴 것', desc: '현재의 삶과 공명하는 영원한 가치', subplots: [{ title: '3.1 불멸의 메시지' }] }
    ]
  },
  {
    id: 'ana_investigative',
    category: 'analytical',
    name: '탐사·르포형',
    flow: '충격적 현장 취재 → 증언 → 구조적 원인 → 사회적 제언',
    fitFor: '사회, 시사 르포, 저널리즘',
    stages: [
      { title: '1장. 그늘진 현장의 생생한 목소리', desc: '카메라가 비추지 않는 골목과 사람들', subplots: [{ title: '1.1 새벽 인력시장과 쪽방촌 취재' }] },
      { title: '2장. 제도의 허점과 방치된 시스템', desc: '개인의 게으름이 아닌 법과 제도의 구멍', subplots: [{ title: '2.1 침묵하는 관료제와 법의 사각지대' }] },
      { title: '3장. 인간다운 삶을 회복하기 위한 질문', desc: '공동체가 함께 짊어져야 할 대안', subplots: [{ title: '3.1 연대의 불씨를 지피다' }] }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ⑦ 인물·기록 - 4종
  // ─────────────────────────────────────────────────────────────
  {
    id: 'bio_memoir',
    category: 'biographical',
    name: '회고록형',
    flow: '출발 → 시련과 전환점 → 성취·실패 → 인생의 교훈',
    fitFor: '창업기, 직업 회고 (사모펀드 생존기 등)',
    stages: [
      { title: '1장. 정글로 뛰어들던 첫날 (출발)', desc: '아무것도 모르고 뛰어든 최전선의 민낯', subplots: [{ title: '1.1 여의도 입성과 첫 명함의 무게' }, { title: '1.2 살벌한 자본 시장의 첫인상' }] },
      { title: '2장. 피할 수 없었던 핏빛 시련들 (위기와 시험)', desc: '사기, 실패, 밤샘 딜 검토, 배신의 순간들', subplots: [{ title: '2.1 수백억 딜이 어그러지던 밤' }, { title: '2.2 숫자가 인간을 집어삼킬 때' }] },
      { title: '3장. 마침내 판을 짜는 자가 되다 (성취와 대가)', desc: '최고의 딜을 성사시키고 얻은 것과 잃은 것', subplots: [{ title: '3.1 승리의 축배와 공허함' }, { title: '3.2 돈의 크기보다 중요한 사람의 온기' }] },
      { title: '4장. 후배들에게 전하는 생존의 원칙 (교훈)', desc: '정글을 떠나며 남기는 진짜 실전 지혜', subplots: [{ title: '4.1 숫자는 거짓말을 하지 않지만 인간은 한다' }] }
    ]
  },
  {
    id: 'bio_biography',
    category: 'biographical',
    name: '평전형',
    flow: '인물의 생애 순 → 업적의 명암 → 역사적 평가',
    fitFor: '위인 전기, 인물 탐구',
    stages: [
      { title: '1장. 거인의 탄생과 탯줄', desc: '어린 시절 환경과 기질 형성', subplots: [{ title: '1.1 결핍 속에서 싹튼 비범함' }] },
      { title: '2장. 격동의 시대를 돌파한 업적', desc: '시대와의 불화, 그리고 혁신의 기록', subplots: [{ title: '2.1 세상을 바꾼 결정적 결단' }] },
      { title: '3장. 가려진 그림자와 인간적 고뇌', desc: '위인 뒤에 숨겨진 잔혹함과 고독', subplots: [{ title: '3.1 빛이 강할수록 짙었던 어둠' }] },
      { title: '4장. 그가 남긴 유산과 현대의 질문', desc: '우리는 그에게서 무엇을 배울 것인가', subplots: [{ title: '4.1 역사의 법정에 선 거인' }] }
    ]
  },
  {
    id: 'bio_interview',
    category: 'biographical',
    name: '인터뷰 모음형',
    flow: '인물별 심층 인터뷰 → 공통 메시지 엮기',
    fitFor: '직업 탐구, 대담집',
    stages: [
      { title: '1. 장인의 손끝을 만나다 (인터뷰 1)', desc: '50년 외길을 걸어온 사람의 침묵과 지혜', subplots: [{ title: '질문과 고백: 흔들리지 않는 중심' }] },
      { title: '2. 반역자의 눈빛을 만나다 (인터뷰 2)', desc: '기존 룰을 파괴하고 새로운 판을 짠 개척자', subplots: [{ title: '질문과 고백: 두려움을 넘어서는 호기심' }] },
      { title: '3. 그들의 삶이 건네는 공통의 화두', desc: '서로 다른 길을 걸었으나 마주한 정상', subplots: [{ title: '삶의 주인이 되는 단 하나의 태도' }] }
    ]
  },
  {
    id: 'bio_chronicle',
    category: 'biographical',
    name: '연대기형',
    flow: '시대순 사건 전개 → 인과관계 추적 → 역사의 교훈',
    fitFor: '역사, 기업사, 조직 발전사',
    stages: [
      { title: '1장. 태동기: 작은 불씨의 점화', desc: '미미했던 첫걸음과 시대적 배경', subplots: [{ title: '1.1 아무도 주목하지 않았던 시작' }] },
      { title: '2장. 도약기: 폭풍 속의 스케일업', desc: '위기를 기회로 바꾼 성장 곡선', subplots: [{ title: '2.1 첫 번째 국가적 도약' }] },
      { title: '3장. 위기와 전환: 생사의 갈림길', desc: '존폐를 건 구조조정과 혁신', subplots: [{ title: '3.1 뼈를 깎는 혁신의 대가' }] },
      { title: '4장. 오늘과 내일: 역사가 건네는 교훈', desc: '지난 세월의 발자취가 가리키는 미래', subplots: [{ title: '4.1 100년을 향한 나침반' }] }
    ]
  }
];

/**
 * 공식 10대 장르별 '추천 뼈대 ID' 매핑 테이블
 */
export const GENRE_RECOMMENDED_PLOTS = {
  novel: ['fic_classic_5', 'fic_3act', 'fic_heros_journey', 'fic_beat_sheet'],
  webnovel: ['web_episode', 'web_reincarnation', 'web_cider_growth', 'web_ropan_destiny'],
  essay: ['ess_theme', 'ess_chrono_memoir', 'ess_keyword', 'ess_journal'],
  economy: ['prac_framework', 'ana_case_study', 'ana_trend', 'prac_problem_solve'],
  finance: ['prac_problem_solve', 'prac_myth_bust', 'prac_compare', 'prac_change_story'],
  self: ['prac_change_story', 'prac_challenge', 'prac_roadmap', 'fic_growth'],
  humanities: ['ana_question_insight', 'ana_argument', 'bio_biography', 'ana_commentary'],
  tech: ['prac_intro_guide', 'prac_project_based', 'prac_reference', 'ana_trend'],
  life: ['prac_roadmap', 'prac_listicle', 'ess_travel', 'prac_qna'],
  art: ['ana_commentary', 'ess_theme', 'poet_emotion', 'bio_interview']
};
