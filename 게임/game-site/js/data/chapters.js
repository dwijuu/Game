/**
 * 챕터 / 스테이지 구성
 * ─────────────────────────────────────────────────────────────
 * chapter: { id, no, title, available, requires, stages: [stageId...] }
 *   · available:false → 아직 제작되지 않은 챕터 (회색 · 클릭 불가)
 *   · requires: 선행 스테이지 id → 그 스테이지를 클리어해야 열림 (그 전에는 회색 · 클릭 불가)
 *   · title: 책 표지 · 책등 글씨 (아직 없는 챕터는 '...') · name: 책장 아래 가운데 글씨 (없으면 title)
 *
 * stage: {
 *   id, chapter, no, name, desc,
 *   requires: 선행 스테이지 id (클리어 전에는 맵에 표시되지 않음)
 *   story:    stories.js 의 키 (없으면 입장 즉시 편성 화면)
 *   storyOnly: true → 전투 없이 스토리만 진행, 끝나면 STAGE CLEAR
 *   subtitle: 스테이지 제목 (예: '실습은 계속된다')
 *   tutorial: true → 전투 튜토리얼 진행 (스테이지 1) · 'team' → 단체 전투 튜토리얼 (스테이지 4, 교사가 설명)
 *   formation: {
 *     fixed: ['Character_05'],  → 고정 편성 (변경 불가, 카드 위에 '스토리' 표기) · 4번째 = 대기석
 *     lockOthers: true          → 나머지 자리 편성 불가
 *   }
 *   enemies: [enemyId...], objectives: ['모든 적 처치']
 *   reserve: [enemyId...] → 증원 대기열: 필드의 적이 쓰러질 때마다 그 자리에 한 명씩 채워짐 (STAGE 05)
 *   battleHint: 전투 시작 시 잠깐 표시되는 안내 문구 (선택)
 *   finale: { unit: 적 id, hpRatio } → 연출된 결말: 그 적의 체력이 hpRatio 아래로 내려가면 결말 공격으로 아군 전원이 쓰러지고 클리어
 *   · 고정 편성(formation.fixed) 스테이지는 처음에는 스토리 편성으로만 플레이하고,
 *     클리어한 뒤 다시 하면 편성을 바꿀 수 있음 ('스토리 덱으로 플레이' 버튼으로 스토리 편성 자동 채우기)
 *   afterStory: 전투 승리 후 이어지는 스토리 (stories.js 키). 끝까지 보면 '<stageId>:after' 가 클리어 처리됨
 *               → 다음 스테이지의 requires 에 'ch1-s4:after' 처럼 적으면 스토리를 본 뒤에 열림
 * }
 */
window.G = window.G || {};
G.DATA = G.DATA || {};

G.DATA.chapters = [
  { id: 'ch1', no: 1, title: 'CHAPTER 01', name: '여정의 시작', available: true, requires: null, stages: ['ch1-s1', 'ch1-s2', 'ch1-s3', 'ch1-s4', 'ch1-s5', 'ch1-s6', 'ch1-s7', 'ch1-s8', 'ch1-s9', 'ch1-s10'] },
  { id: 'ch2', no: 2, title: '...', available: false, requires: null, stages: [] },
  { id: 'ch3', no: 3, title: '...', available: false, requires: null, stages: [] },
  { id: 'ch4', no: 4, title: '...', available: false, requires: null, stages: [] },
  { id: 'ch5', no: 5, title: '...', available: false, requires: null, stages: [] }
];

G.DATA.stages = {
  /* STAGE 01 — 튜토리얼 전투 */
  'ch1-s1': {
    id: 'ch1-s1', chapter: 'ch1', no: 1,
    name: 'STAGE 01', subtitle: '기이한 꿈자리',
    desc: '전투 방식을 익히는 튜토리얼 스테이지.',
    requires: null,
    story: 'ch1-s1',
    tutorial: true,
    formation: { fixed: ['Character_05'], lockOthers: true },
    enemies: ['shade', 'shade'],   // 튜토리얼 '공격 대상' 단계에서 실제로 고를 수 있게 2마리
    objectives: ['모든 적 처치']
  },
  /* STAGE 02 — 스토리 전용 */
  'ch1-s2': {
    id: 'ch1-s2', chapter: 'ch1', no: 2,
    name: 'STAGE 02', subtitle: '일류의 명성',
    desc: '대륙 최대의 마법 학교',
    requires: 'ch1-s1',
    story: 'ch1-s2',
    storyOnly: true
  },
  /* STAGE 03 — 스토리 전용 */
  'ch1-s3': {
    id: 'ch1-s3', chapter: 'ch1', no: 3,
    name: 'STAGE 03', subtitle: '교내 대회',
    desc: '낙제를 모면하기 위한 대회 출전',
    requires: 'ch1-s2',
    story: 'ch1-s3',
    storyOnly: true
  },
  /* STAGE 04 — 실력 검증 : 스토리 + 전투 (4명 고정 편성 · 아르덴은 대기석) */
  'ch1-s4': {
    id: 'ch1-s4', chapter: 'ch1', no: 4,
    battleBg: 'assets/bg/training.webp', battleBgDim: 0.4,   // 전투 배경: 훈련장 (밝은 그림이라 조금 어둡게 깔아 글씨가 잘 보이게)
    name: 'STAGE 04', subtitle: '증명의 시간',
    desc: '지도 교수와의 훈련',
    requires: 'ch1-s3',
    story: 'ch1-s4',
    tutorial: 'team',   // 단체 전투 튜토리얼 (교사가 설명 · 캐릭터 변경 연습 · 덱 구성 · [연소])
    formation: { fixed: ['Character_12', 'Character_11', 'Character_10', 'Character_05'], lockOthers: true },
    enemies: ['shamer'],   // 지도교수 샤머 (예전 STAGE 05 임시 캐릭터의 모습 · 스킬)
    objectives: ['지도교수 샤머 쓰러뜨리기'],
    battleHint: '왼쪽 아래 [캐릭터 변경]으로 대기 중인 아르덴과 교체할 수 있습니다. (한 턴 소모)',
    afterStory: 'ch1-s4-after'
  },
  /* STAGE 05 — 합을 맞추는 시간 : 스토리 + 전투 (훈련용 마법 더미 · 증원)
   *  필드에 더미 3개, 쓰러질 때마다 1개씩 다시 채워져 총 5개 → 모두 쓰러뜨리면 클리어 (3턴 안에 끝나도록 맞춘 체력) */
  'ch1-s5': {
    id: 'ch1-s5', chapter: 'ch1', no: 5,
    battleBg: 'assets/bg/training.webp', battleBgDim: 0.4,
    name: 'STAGE 05', subtitle: '불협화음 조율',
    desc: '조금 더 연습을 하고자 한다',
    requires: 'ch1-s4:after',
    story: 'ch1-s5',
    formation: { fixed: ['Character_12', 'Character_05', 'Character_10', 'Character_11'], lockOthers: true },   // 첫 플레이: 알리제 · 아르덴 · 샤린 · (대기) 나즈나
    enemies: ['dummy', 'dummy', 'dummy'],
    reserve: ['dummy', 'dummy'],
    objectives: ['훈련용 마법 더미 5개 쓰러뜨리기'],
    battleHint: '더미는 쓰러질 때마다 한 개씩 다시 채워집니다. (총 5개)'
  },
  /* STAGE 06 — 스토리 전용
   *  ⚠ 게임 설명/스테이지.txt 에 STAGE 06 원고가 없어(05가 두 번 들어 있음) 05 → 07 을 잇는 임시 원고를 넣어 둠.
   *    원고를 받으면 stories.js 의 'ch1-s6' 만 바꾸면 됩니다. */
  'ch1-s6': {
    id: 'ch1-s6', chapter: 'ch1', no: 6,
    name: 'STAGE 06', subtitle: '산책의 궤적',
    desc: '약간의 숨돌리기',
    requires: 'ch1-s5',
    story: 'ch1-s6',
    storyOnly: true
  },
  /* STAGE 07 — 익숙한 거리의 낯선 손님 : 스토리 → 전투(숲속의 마물) → 후속 스토리 */
  'ch1-s7': {
    id: 'ch1-s7', chapter: 'ch1', no: 7,
    battleBg: 'assets/bg/forest.webp',
    name: 'STAGE 07', subtitle: '익숙한 거리의 낯선 손님',
    desc: '시내로 향하는 숲길에서',
    requires: 'ch1-s6',
    story: 'ch1-s7',
    formation: { fixed: ['Character_12', 'Character_05', 'Character_10', 'Character_11'], lockOthers: true },   // 첫 플레이: 알리제 · 아르덴 · 샤린 · (대기) 나즈나
    enemies: ['forest_beast', 'forest_beast'],
    objectives: ['숲속의 마물 처치'],
    afterStory: 'ch1-s7-after'
  },
  /* STAGE 08 — 불청객 : 스토리 전용 */
  'ch1-s8': {
    id: 'ch1-s8', chapter: 'ch1', no: 8,
    name: 'STAGE 08', subtitle: '불청객',
    desc: '숲속에서 만난 정체불명의 소녀',
    requires: 'ch1-s7:after',
    story: 'ch1-s8',
    storyOnly: true
  },
  /* STAGE 09 — 검은 손님 : 메인 보스전 (적: 코루스코 · 예전 STAGE 08) · 스토리 편성 고정 · 연출된 결말 */
  'ch1-s9': {
    id: 'ch1-s9', chapter: 'ch1', no: 9,
    battleBg: 'assets/bg/forest.webp',   // 전투 배경: 어두운 숲
    name: 'STAGE 09', subtitle: '검은 손님',
    desc: '블랙과의 전투',
    requires: 'ch1-s8',
    story: 'ch1-s9',
    boss: true,
    formation: { fixed: ['Character_12', 'Character_05', 'Character_10', 'Character_11'], lockOthers: true },   // 첫 플레이: 알리제 · 아르덴 · 샤린 · (대기) 나즈나
    enemies: ['corusco_boss'],
    objectives: ['코루스코와의 전투'],
    finale: {
      unit: 'corusco_boss', hpRatio: 0.05,
      before: { speaker: '코루스코', text: '헛수고하지 말고 가만히 있어.', portrait: 'Character_14', enemy: true },
      after: { speaker: '아르덴', text: '으윽...', portrait: 'Character_05' }
    },
    afterStory: 'ch1-s9-after'
  },
  /* STAGE 10 — 돌아온 불청객 : 스토리 전용 */
  'ch1-s10': {
    id: 'ch1-s10', chapter: 'ch1', no: 10,
    name: 'STAGE 10', subtitle: '돌아가자',
    desc: '겨우 공격을 버텨낸 아이들',
    requires: 'ch1-s9:after',
    story: 'ch1-s10',
    storyOnly: true
  }
};
