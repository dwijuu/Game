/**
 * 챕터 / 스테이지 구성
 * ─────────────────────────────────────────────────────────────
 * chapter: { id, no, title, available, requires, stages: [stageId...] }
 *   · available:false → 아직 제작되지 않은 챕터 (회색 · 클릭 불가)
 *   · requires: 선행 스테이지 id → 그 스테이지를 클리어해야 열림 (그 전에는 회색 · 클릭 불가)
 *   · title 은 임시 표기입니다. (확정되면 이름만 바꾸면 됩니다)
 *
 * stage: {
 *   id, chapter, no, name, desc,
 *   requires: 선행 스테이지 id (클리어 전에는 맵에 표시되지 않음)
 *   story:    stories.js 의 키 (없으면 입장 즉시 편성 화면)
 *   storyOnly: true → 전투 없이 스토리만 진행, 끝나면 STAGE CLEAR
 *   subtitle: 스테이지 제목 (예: '실습은 계속된다')
 *   tutorial: true → 전투 튜토리얼 진행
 *   formation: {
 *     fixed: ['Character_05'],  → 고정 편성 (변경 불가, 카드 위에 '스토리' 표기) · 4번째 = 대기석
 *     lockOthers: true          → 나머지 자리 편성 불가
 *   }
 *   enemies: [enemyId...], objectives: ['모든 적 처치']
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
  { id: 'ch1', no: 1, title: 'CHAPTER 01', available: true, requires: null, stages: ['ch1-s1', 'ch1-s2', 'ch1-s3', 'ch1-s4', 'ch1-s5', 'ch1-s6', 'ch1-s7', 'ch1-s8'] },
  { id: 'ch2', no: 2, title: 'CHAPTER 02', available: false, requires: null, stages: [] },
  { id: 'ch3', no: 3, title: 'CHAPTER 03', available: false, requires: null, stages: [] },
  { id: 'ch4', no: 4, title: 'CHAPTER 04', available: false, requires: null, stages: [] },
  { id: 'ch5', no: 5, title: 'CHAPTER 05', available: false, requires: null, stages: [] }
];

G.DATA.stages = {
  /* STAGE 01 — 튜토리얼 전투 */
  'ch1-s1': {
    id: 'ch1-s1', chapter: 'ch1', no: 1,
    name: 'STAGE 01',
    desc: '전투 방식을 익히는 튜토리얼 스테이지.',
    requires: null,
    story: 'ch1-s1',
    tutorial: true,
    formation: { fixed: ['Character_05'], lockOthers: true },
    enemies: ['shade'],
    objectives: ['모든 적 처치']
  },
  /* STAGE 02 — 스토리 전용 */
  'ch1-s2': {
    id: 'ch1-s2', chapter: 'ch1', no: 2,
    name: 'STAGE 02', subtitle: '실습은 계속된다',
    desc: '전투 없이 이야기만 진행되는 스토리 스테이지.',
    requires: 'ch1-s1',
    story: 'ch1-s2',
    storyOnly: true
  },
  /* STAGE 03 — 스토리 전용 */
  'ch1-s3': {
    id: 'ch1-s3', chapter: 'ch1', no: 3,
    name: 'STAGE 03',
    desc: '전투 없이 이야기만 진행되는 스토리 스테이지.',
    requires: 'ch1-s2',
    story: 'ch1-s3',
    storyOnly: true
  },
  /* STAGE 04 — 실력 검증 : 스토리 + 전투 (4명 고정 편성 · 아르덴은 대기석) */
  'ch1-s4': {
    id: 'ch1-s4', chapter: 'ch1', no: 4,
    battleBg: 'assets/bg/training.webp', battleBgDim: 0.4,   // 전투 배경: 훈련장 (밝은 그림이라 조금 어둡게 깔아 글씨가 잘 보이게)
    name: 'STAGE 04', subtitle: '실력 검증',
    desc: '담당 교사와의 임시 대련. 팀의 실력과 협동 능력을 확인한다.',
    requires: 'ch1-s3',
    story: 'ch1-s4',
    formation: { fixed: ['Character_12', 'Character_11', 'Character_10', 'Character_05'], lockOthers: true },
    enemies: ['teacher'],
    objectives: ['교사 쓰러뜨리기'],
    battleHint: '왼쪽 아래 [캐릭터 변경]으로 대기 중인 아르덴과 교체할 수 있습니다. (한 턴 소모)',
    afterStory: 'ch1-s4-after'
  },
  /* STAGE 05 — 임시 전투 스테이지 (STAGE 04 전투 후 스토리를 끝까지 보면 열림) */
  'ch1-s5': {
    id: 'ch1-s5', chapter: 'ch1', no: 5,
    name: 'STAGE 05',
    desc: '임시 스테이지 — 캐릭터 성능을 확인하기 위한 중간 보스전. 체력이 크고 공격이 강하며, 궁극기로 필드에 [비]를 내립니다.',
    requires: 'ch1-s4:after',
    story: null,
    temporary: true,
    formation: null,
    enemies: ['midboss'],
    objectives: ['중간 보스 쓰러뜨리기']
  },
  /* STAGE 06 · 07 — 임시 스테이지 (아직 구상되지 않음) */
  'ch1-s6': {
    id: 'ch1-s6', chapter: 'ch1', no: 6,
    name: 'STAGE 06',
    desc: '임시 스테이지 — 아직 구상되지 않은 스테이지입니다.',
    requires: 'ch1-s5',
    story: null,
    temporary: true,
    formation: null,
    enemies: ['shade_temp', 'shade_temp'],
    objectives: ['모든 적 처치']
  },
  'ch1-s7': {
    id: 'ch1-s7', chapter: 'ch1', no: 7,
    name: 'STAGE 07',
    desc: '임시 스테이지 — 아직 구상되지 않은 스테이지입니다.',
    requires: 'ch1-s6',
    story: null,
    temporary: true,
    formation: null,
    enemies: ['shade_temp', 'shade_temp', 'shade_temp'],
    objectives: ['모든 적 처치']
  },
  /* STAGE 08 — 메인 보스전 (적: 코루스코) · 스토리 편성 고정 · 연출된 결말
   *  스토리 텍스트는 아직 없음 (받으면 story / afterStory 에 연결) */
  'ch1-s8': {
    id: 'ch1-s8', chapter: 'ch1', no: 8,
    battleBg: 'assets/bg/forest.webp',   // 전투 배경: 어두운 숲
    name: 'STAGE 08', subtitle: '메인 보스전',
    desc: '메인 보스 코루스코와의 전투. (스토리 텍스트 · 스테이지 이름은 임시)',
    requires: 'ch1-s7',
    story: null,
    boss: true,
    formation: { fixed: ['Character_12', 'Character_11', 'Character_10', 'Character_05'], lockOthers: true },
    enemies: ['corusco_boss'],
    objectives: ['코루스코와의 전투'],
    finale: {
      unit: 'corusco_boss', hpRatio: 0.05,
      before: { speaker: '코루스코', text: '헛수고하지 말고 가만히 있어.', portrait: 'Character_14', enemy: true },
      after: { speaker: '아르덴', text: '으윽...', portrait: 'Character_05' }
    }
  }
};
