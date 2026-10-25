/**
 * 게임용 캐릭터 데이터
 * ─────────────────────────────────────────────────────────────
 * [공유 데이터 규격]
 *  · id / name / nameEn / themeColor / role / element / mechanics / skills 설명은
 *    기존 사이트(20241754_김민솔/js/data.js)의 CHARACTER_DATABASE 와 같습니다.
 *  · 목록 순서도 기존 사이트와 같습니다: 아르덴 · 샤린 · 나즈나 · 알리제
 *  · images 는 게임 폴더(assets/characters/<id>/)에 최적화해 복사한 이미지입니다.
 *    (샤린 · 나즈나 · 알리제는 기존 사이트의 임시 실루엣 SVG — 그림이 준비되면 경로만 바꾸면 됩니다)
 *  · combat / mp / actions 는 게임에서만 쓰는 전투 데이터입니다.
 *
 * [스킬 규격] skills 는 궁극기를 제외한 3개, ultimate 는 1개
 *  {
 *    id, name, nameEn, category, type: 'attack' | 'buff' | 'debuff',
 *    element, icon(G.icons 키), anim(js/screens/battle-fx.js), desc, note,
 *    mp: 마력 소모량 (궁극기는 0) — 마력이 모자라면 부족분 × 2 만큼 체력 소모
 *    art: 스킬 카드 그림 (모든 캐릭터 · 편성 화면 SKILL 칸에도 같은 그림)
 *    actions: 순서대로 실행되는 효과
 *      { do: 'damage', target: 'single' | 'two' | 'all', power: 2.2,
 *        burnBonus: { per, max },                          연소 스택당 피해 증가
 *        bonusIfTarget: { status: 'bind', bonus: 0.2 },   대상이 상태이상이면 피해 증가
 *        bonusIfSelf:   { status: 'haste', bonus: 0.2 } } 자신이 상태이상이면 피해 증가
 *      { do: 'status', to: 'hit' | 'self' | 'allies', status, turns, stacks }
 *      { do: 'shield', to: 'allies', ratio, turns }        자신 공격력 × ratio
 *      { do: 'heal',   to: 'allies', ratio }               자신 공격력 × ratio 회복
 *      { do: 'cleanse', to: 'allies', count: 1 }           디버프 해제
 *      { do: 'mp',     to: 'self' | 'allies', amount }     마력 회복
 *      { do: 'field',  field, turns }
 *  }
 *  · 피해는 모두 '공격 피해'로 표기합니다. (현실/정신 구분 없음)
 *  · 레이 · 코루스코는 게임에서만 쓰는 캐릭터입니다 (기존 사이트 목록에는 없음).
 *  · draft: true → 기존 사이트에서도 '임시 데이터'로 표시된 캐릭터
 *
 * 최대 마력: 알리제 4 · 샤린 2 · 나즈나 7 · 아르덴 6 (10 기준) → × 10 = 40 · 20 · 70 · 60
 * 스킬 마력 소모량은 캐릭터 최대 마력에 비례해 정했습니다 (한 캐릭터가 3~5장 쓰면 마력 회복이 필요한 정도)
 * 마력 회복 스킬: 아르덴 '과열 과충전'(자신) · 샤린 '맑은 흐름'(아군 전체) · 나즈나 '뿌리 결계'(아군 전체)
 * ⚠ 임시 값: 체력 · 공격력 · 방어력 · 마력 소모량 · 마력 회복 효과는 문서에 수치가 없어 정한 값입니다.
 */
window.G = window.G || {};
G.DATA = G.DATA || {};

G.DATA.characters = {

  /* ── 아르덴 ─────────────────────────────────────────── */
  Character_05: {
    id: 'Character_05',
    name: '아르덴',
    nameEn: 'Arden Cavendish',
    themeColor: '#89CBDD',
    role: '화력 보조 & 디버프형 딜서폿 (화염 중심 / 범용 보호막·방깎 기용 가능)',
    element: 'fire',
    subElement: 'earth',
    images: {
      full: 'assets/characters/Character_05/full.webp',
      face: 'assets/characters/Character_05/face.webp',
      cd: 'assets/characters/Character_05/cd.webp'
    },
    combat: { hp: 520, atk: 100, def: 40, crit: 0.05, mp: 60 },
    mechanics: [
      { name: '연소 공급 & 스택 보존', icon: 'flame', desc: '스킬과 궁극기로 적에게 [연소]를 대량 공급하고, [열염 지대]로 [연소]가 사라지지 않게 유지해 연소 메인 딜러(알리제 등)의 기폭 · 추가공격 조건(3스택 이상)을 보조합니다.' },
      { name: '범용 대지 방어 유틸', icon: 'shield', desc: '[보호막]과 [방어력 감소]는 특정 캐릭터에 귀속되지 않아, 자해 딜러 케어는 물론 일반적인 방어 / 공격 지원 서브 딜러로도 폭넓게 활약합니다.' }
    ],
    skills: [
      {
        id: 'arden_s1', art: 'assets/characters/Character_05/skill_arden_s1.svg', name: '화염 탄환', nameEn: 'Pyro Shell',
        category: '단일 공격 / 화염 디버프', type: 'attack', element: 'fire', anim: 'pyro_shell', icon: 'pyro', mp: 10,
        desc: '마법 총으로 화염 탄환을 발사하여 적 1명에게 220%의 공격 피해를 입히고, 2턴간 [연소] 3스택을 부여합니다. 대상이 이미 [연소] 상태라면 [연소] 1스택을 추가로 누적시키고 지속 시간을 1턴 연장합니다.',
        note: '[연소]: 턴 종료 시 보유 스택에 비례하여 지속 피해를 입습니다. (스택 제한 없음)',
        actions: [
          { do: 'damage', target: 'single', power: 2.2 },
          { do: 'status', to: 'hit', status: 'burn', stacks: 1, turns: 2, ifTarget: 'burn', extend: 1 },
          { do: 'status', to: 'hit', status: 'burn', stacks: 3, turns: 2 }
        ]
      },
      {
        id: 'arden_s2', art: 'assets/characters/Character_05/skill_arden_s2.svg', name: '대지 장벽', nameEn: 'Earth Shell Guard',
        category: '범위 공격 / 범용 보호막 & 방어력 감소', type: 'attack', element: 'earth', anim: 'earth_guard', icon: 'earth', mp: 14,
        desc: '대지 마법으로 적 2명에게 150%의 공격 피해를 입히고, 2턴간 대상의 방어력을 15% 감소시킵니다. 동시에 랜덤한 아군 1명에게 자신 공격력의 80%에 해당하는 [보호막]을 2턴간 부여합니다.',
        actions: [
          { do: 'damage', target: 'two', power: 1.5 },
          { do: 'status', to: 'hit', status: 'def_down', turns: 2 },
          { do: 'shield', to: 'randomAlly', ratio: 0.8, turns: 2 }
        ]
      },
      {
        id: 'arden_s3', art: 'assets/characters/Character_05/skill_arden_s3.svg', name: '과열 과충전', nameEn: 'Overheat Magazine',
        category: '자신 및 아군 버프 / 속성 & 관통 강화', type: 'buff', element: 'fire', anim: 'overheat', icon: 'heatUp', mp: 4,
        desc: '마법 총의 탄창에 가열된 마력을 충전합니다. 2턴간 아군 전체의 화염 속성 피해를 20%, 치명타율을 10% 증가시키며, 자신의 다음 공격 스킬에 [방어 무시 30%] 효과를 부여합니다.',
        note: '마력 회복: 열기를 충전하며 자신의 마력을 15 회복합니다. (임시 효과)',
        actions: [
          { do: 'status', to: 'allies', status: 'overheat', turns: 2 },
          { do: 'status', to: 'self', status: 'pierce', turns: null },
          { do: 'mp', to: 'self', amount: 15 }
        ]
      }
    ],
    ultimate: {
      id: 'arden_ult', art: 'assets/characters/Character_05/skill_arden_ult.svg', name: '종말의 메테오', nameEn: 'Doomsday Meteor',
      category: '적 전체 공격 / [연소] 스택 부여 & [열염 지대] 전개', type: 'attack', element: 'fire', anim: 'meteor', icon: 'meteor', mp: 0,
      desc: '하늘로 신호탄을 쏘아 올려 대지와 화염의 메테오를 떨구고 전장을 화염 지대로 만듭니다. 적 전체에게 380%의 공격 피해를 입히고(기존 [연소] 1스택당 피해량 +5%, 최대 30%), 모든 적에게 [연소] 3스택을 부여합니다. 2턴간 필드에 [열염 지대]를 형성합니다.',
      note: '[열염 지대]: 적이 행동할 때마다 아르덴 공격력의 30%만큼 지속 피해를 입고, 화염 속성 아군이 공격 시 피해량이 15% 추가 적용됩니다. 턴 종료 시 [연소] 상태인 적의 [연소]가 사라지지 않고 최소 1스택이 유지됩니다.',
      actions: [
        { do: 'damage', target: 'all', power: 3.8, burnBonus: { per: 0.05, max: 0.3 } },
        { do: 'status', to: 'hit', status: 'burn', stacks: 3, turns: 2 },
        { do: 'field', field: 'blaze_zone', turns: 2 }
      ]
    }
  },

  /* ── 샤린 (기존 사이트: 임시 데이터) ─────────────────── */
  Character_10: {
    id: 'Character_10', draft: true,
    name: '샤린',
    nameEn: 'Sharin',
    themeColor: '#5E8C9A',
    role: '분석형 서포터 — 물의 흐름을 조절해 적을 늦추고 아군을 돕습니다.',
    element: 'water',
    images: { full: 'assets/characters/Character_10/full.svg', battle: 'assets/characters/Character_10/battle.webp' },
    combat: { hp: 460, atk: 90, def: 35, crit: 0.05, mp: 20 },
    mechanics: [
      { name: '흐름 조절', icon: 'wave', desc: '위력은 약하지만 물마법의 흐름을 세밀하게 조절해 적에게 [감속]을 걸고 행동을 늦춥니다.' },
      { name: '마력 감지', icon: 'eye', desc: '마력의 흔적을 읽어 적의 약점을 짚어 냅니다. 대상의 방어력을 낮추고 아군의 공격을 보조합니다.' }
    ],
    skills: [
      {
        id: 'sharin_s1', art: 'assets/characters/Character_10/skill_sharin_s1.svg', name: '물살', nameEn: 'Ripple',
        category: '단일 공격 / 감속', type: 'attack', element: 'water', anim: 'water_bolt', icon: 'water', mp: 4,
        desc: '지팡이 끝에서 물살을 일으켜 적 1명에게 150%의 공격 피해를 입히고, 2턴간 [감속]을 부여합니다.',
        note: '[감속]: 행동 순서가 늦춰지고 공격력이 10% 감소합니다.',
        actions: [
          { do: 'damage', target: 'single', power: 1.5 },
          { do: 'status', to: 'hit', status: 'slow', turns: 2 }
        ]
      },
      {
        id: 'sharin_s2', art: 'assets/characters/Character_10/skill_sharin_s2.svg', name: '마력 추적', nameEn: 'Mana Trace',
        category: '디버프 / 약점 노출', type: 'debuff', element: 'water', anim: 'mana_trace', icon: 'eye', mp: 3,
        desc: '남은 마력의 흔적을 읽어 적 1명의 방어력을 2턴간 20% 감소시키고, 그 대상을 공격하는 아군의 치명타율을 10% 증가시킵니다.',
        actions: [
          { do: 'status', to: 'target', status: 'expose', turns: 2 }
        ]
      },
      {
        id: 'sharin_s3', art: 'assets/characters/Character_10/skill_sharin_s3.svg', name: '맑은 흐름', nameEn: 'Clear Stream',
        category: '아군 전체 회복 / 정화', type: 'buff', element: 'water', anim: 'clear_stream', icon: 'heal', mp: 5,
        desc: '맑은 물줄기로 아군 전체의 체력을 자신 공격력의 120%만큼 회복시키고, 디버프를 1개 해제합니다.',
        note: '마력 회복: 맑은 물줄기가 아군 전체의 마력을 12 회복시킵니다. (임시 효과)',
        actions: [
          { do: 'heal', to: 'allies', ratio: 1.2 },
          { do: 'cleanse', to: 'allies', count: 1 },
          { do: 'mp', to: 'allies', amount: 12 }
        ]
      }
    ],
    ultimate: {
      id: 'sharin_ult', art: 'assets/characters/Character_10/skill_sharin_ult.svg', name: '역류', nameEn: 'Undertow',
      category: '적 전체 공격 / 감속 & 회복', type: 'attack', element: 'water', anim: 'undertow', icon: 'tide', mp: 0,
      desc: '훈련장 전체의 물길을 거꾸로 돌립니다. 적 전체에게 260%의 공격 피해를 입히고 2턴간 [감속]을 부여하며, 아군 전체의 체력을 자신 공격력의 80%만큼 회복시킵니다.',
      actions: [
        { do: 'damage', target: 'all', power: 2.6 },
        { do: 'status', to: 'hit', status: 'slow', turns: 2 },
        { do: 'heal', to: 'allies', ratio: 0.8 }
      ]
    }
  },

  /* ── 나즈나 (기존 사이트: 임시 데이터) ───────────────── */
  Character_11: {
    id: 'Character_11', draft: true,
    name: '나즈나',
    nameEn: 'Nazuna',
    themeColor: '#6F8A55',
    role: '제어형 서브 딜러 — 덩굴로 적을 묶고 발판 삼아 움직입니다.',
    element: 'nature',
    subElement: 'fire',
    images: { full: 'assets/characters/Character_11/full.svg' },
    combat: { hp: 500, atk: 105, def: 40, crit: 0.05, mp: 70 },
    mechanics: [
      { name: '속박 메커니즘', icon: 'vine', desc: '땅에서 덩굴을 솟아오르게 해 적을 휘감고 움직임을 봉쇄합니다. [속박]된 적은 다음 행동이 늦춰집니다.' },
      { name: '도약 메커니즘', icon: 'leap', desc: '식물을 발판 삼아 가볍게 도약해 공격을 피하고, 다음 공격의 위력을 높입니다.' }
    ],
    skills: [
      {
        id: 'nazuna_s1', art: 'assets/characters/Character_11/skill_nazuna_s1.svg', name: '가시 덩굴', nameEn: 'Thorn Vine',
        category: '단일 공격 / 속박', type: 'attack', element: 'nature', anim: 'thorn_vine', icon: 'vine', mp: 12,
        desc: '가시 덩굴로 적 1명을 휘감아 180%의 공격 피해를 입히고, 1턴간 [속박]을 부여합니다.',
        note: '[속박]: 받는 피해가 10% 증가하고, 다음 행동이 마지막 순서로 밀립니다.',
        actions: [
          { do: 'damage', target: 'single', power: 1.8 },
          { do: 'status', to: 'hit', status: 'bind', turns: 1 }
        ]
      },
      {
        id: 'nazuna_s2', art: 'assets/characters/Character_11/skill_nazuna_s2.svg', name: '덩굴 도약', nameEn: 'Vine Leap',
        category: '범위 공격 / 회피 증가', type: 'attack', element: 'nature', anim: 'vine_leap', icon: 'leap', mp: 16,
        desc: '덩굴을 발판 삼아 뛰어올라 적 2명에게 140%의 공격 피해를 입히고, 2턴간 자신의 회피율을 15% 증가시킵니다.',
        actions: [
          { do: 'damage', target: 'two', power: 1.4 },
          { do: 'status', to: 'self', status: 'evade_up', turns: 2 }
        ]
      },
      {
        id: 'nazuna_s3', art: 'assets/characters/Character_11/skill_nazuna_s3.svg', name: '뿌리 결계', nameEn: 'Root Ward',
        category: '아군 전체 버프 / 피해 감소', type: 'buff', element: 'nature', anim: 'root_ward', icon: 'root', mp: 10,
        desc: '땅속 뿌리로 결계를 둘러 2턴간 아군 전체가 받는 피해를 15% 감소시킵니다.',
        note: '마력 회복: 뿌리가 땅의 기운을 끌어올려 아군 전체의 마력을 8 회복시킵니다. (임시 효과)',
        actions: [
          { do: 'status', to: 'allies', status: 'root_ward', turns: 2 },
          { do: 'mp', to: 'allies', amount: 8 }
        ]
      }
    ],
    ultimate: {
      id: 'nazuna_ult', art: 'assets/characters/Character_11/skill_nazuna_ult.svg', name: '숲의 포옹', nameEn: 'Embrace of the Wild',
      category: '적 전체 공격 / 전체 속박', type: 'attack', element: 'nature', anim: 'forest', icon: 'leaf', mp: 0,
      desc: '훈련장을 순식간에 숲으로 뒤덮습니다. 적 전체에게 300%의 공격 피해를 입히고 1턴간 [속박]을 부여합니다. [속박] 상태였던 적에게는 피해량이 20% 증가합니다.',
      actions: [
        { do: 'damage', target: 'all', power: 3.0, bonusIfTarget: { status: 'bind', bonus: 0.2 } },
        { do: 'status', to: 'hit', status: 'bind', turns: 1 }
      ]
    }
  },

  /* ── 알리제 (기존 사이트: 임시 데이터 · 게임 스킬은 새 구성) ── */
  Character_12: {
    id: 'Character_12', draft: true,
    name: '알리제',
    nameEn: 'Alizee',
    themeColor: '#C2703F',
    role: '연소 파티 메인 딜러 (화염 & 바람 근접 폭딜러)',
    element: 'wind',
    subElement: 'fire',
    images: { full: 'assets/characters/Character_12/full.svg' },
    combat: { hp: 480, atk: 115, def: 35, crit: 0.1, mp: 40 },
    /* 고유 패시브 [잔불의 후폭풍] — 엔진 afterburnChase */
    passive: 'afterburn',
    passiveData: {
      fieldTotal: 8, minStacks: 3, fullStacks: 5, power: 1.6, fullPower: 2.4, splash: 0.8,
      skill: { id: 'alize_chase', name: '잔불의 후폭풍', nameEn: 'Afterburn Chase', type: 'attack', element: 'fire', anim: 'afterburn_chase', actions: [] }
    },
    mechanics: [
      { name: '[풍압 확산]', icon: 'wind', desc: '바람 스킬로 적의 [연소]를 주변 적들에게 사방으로 거세게 확산시킵니다.' },
      { name: '[산소 과열]', icon: 'burst', desc: '적에게 쌓인 [연소]를 기폭할 때, 연소 스택 수에 따라 자신의 마력을 즉시 환급받아 연속 폭딜 기회를 얻습니다.' },
      { name: '[잔불의 후폭풍] 패시브', icon: 'dash', desc: '모든 아군 · 적군의 행동이 끝나고 다음 턴이 시작되기 직전, 조건을 만족하면 [연소] 3스택 이상인 적 중 가장 스택이 높은 적에게 돌진해 160% 추가공격 + [연소] 1스택. 대상이 [연소] 5스택 이상이면 240%로 증폭되고 주변 적 2명에게 80% 화염 피해. 대상의 [연소]가 5스택 이상이면 1~2회, 10스택 이상이면 1~3회 무작위로 연속 발동합니다. (발동 조건: 전장의 [연소] 합계 8스택 이상, 또는 [연소] 5스택 이상인 적이 있을 때)' }
    ],
    skills: [
      {
        id: 'alize_s1', art: 'assets/characters/Character_12/skill_alize2_s1.svg', name: '돌풍 난타', nameEn: 'Wind-Blade Kick',
        category: '단일 공격 / [연소] 불꽃 확산', type: 'attack', element: 'wind', anim: 'wind_kick', icon: 'wind', mp: 8,
        desc: '바람을 가르는 발차기로 적 1명에게 170%의 공격 피해를 입히고 [연소] 2스택을 부여합니다. 대상 주변에 이미 [연소] 상태인 다른 적이 있다면, 바람의 압력으로 그 적의 [연소] 1스택을 타격 대상에게 복사(전이)해 옵니다.',
        actions: [
          { do: 'damage', target: 'single', power: 1.7 },
          { do: 'status', to: 'hit', status: 'burn', stacks: 2, turns: 2 },
          { do: 'burnTransfer' }
        ]
      },
      {
        id: 'alize_s2', art: 'assets/characters/Character_12/skill_alize2_s2.svg', name: '너클 인페르노', nameEn: 'Triple Flame Fists',
        category: '단일 3연타 공격 / 스택 강타 & 넉백(행동 불가)', type: 'attack', element: 'fire', anim: 'knuckle_inferno', icon: 'fist', mp: 11,
        desc: '화염을 제트 분사하는 너클로 3연속 근접 타격을 날립니다. 1 · 2타마다 [연소] 1스택을 쌓고, 마지막 3타는 강렬한 넉백과 함께 적을 1턴간 [행동 불가]로 만듭니다. 넉백될 때 대상의 [연소] 불꽃이 튀어 옆의 적 2명에게도 [연소] 1스택이 확산됩니다.',
        note: '타격당 피해량은 문서에 없어 70% × 3타(총 210%)로 정했습니다. (임시)',
        actions: [
          { do: 'damage', target: 'single', power: 0.7 },
          { do: 'status', to: 'hit', status: 'burn', stacks: 1, turns: 2 },
          { do: 'damage', target: 'single', power: 0.7 },
          { do: 'status', to: 'hit', status: 'burn', stacks: 1, turns: 2 },
          { do: 'damage', target: 'single', power: 0.7 },
          { do: 'status', to: 'hit', status: 'stun', turns: 1 },
          { do: 'burnSpread', count: 2, stacks: 1 }
        ]
      },
      {
        id: 'alize_s3', art: 'assets/characters/Character_12/skill_alize2_s3.svg', name: '산소 폭발', nameEn: 'Oxygen Ignition',
        category: '범위 공격 / [연소] 스택 소모 & 마력 환급', type: 'attack', element: 'fire', anim: 'oxygen_ignition', icon: 'burst', mp: 12,
        desc: '전방에 강력한 기류를 쏘아 보내 적 전체의 [연소]를 산소와 반응시켜 한꺼번에 기폭합니다. 대상의 [연소]를 모두 소모하여, 소모한 스택 수에 비례해 기하급수적으로 증폭된 피해를 입힙니다. 3스택 이상의 [연소]를 기폭하면 이 스킬의 마력 80%를 즉시 환급받습니다.',
        note: '스택별 피해(상한 없음): 0 → 150% · 3 → 258% · 5 → 450% · 8 → 918% · 10 → 1350% · 이후 스택당 +240%',
        actions: [
          { do: 'detonate', target: 'all', base: 1.5, quad: 0.12, knee: 10, refund: { minStacks: 3, ratio: 0.8 } }
        ]
      }
    ],
    ultimate: {
      id: 'alize_ult', art: 'assets/characters/Character_12/skill_alize2_ult.svg', name: '최종 술식 - 화염 태풍의 가두리', nameEn: 'Ignition Cyclone',
      category: '적 전체 공격 / [연소] 최대 충전 & 유예 자해', type: 'attack', element: 'fire', anim: 'ignition_cyclone', icon: 'tornado', mp: 0,
      desc: '적의 주위를 고속으로 회전하며 바람의 벽을 세운 뒤 화염을 불어넣어 거대한 태풍을 만들고, 정점에서 중앙으로 낙하해 지면을 대폭발시킵니다. 적 전체에게 420%의 피해를 입히고, 모든 적의 [연소]를 즉시 최소 5스택까지 충전합니다. (턴 종료 시 [잔불의 후폭풍] 확정 발동)',
      note: '[아드레날린 패널티]: 이번 턴 동안 알리제가 받는 피해는 유예되고, 턴이 끝나면 유예된 피해의 50%가 2턴에 걸쳐 지속 피해로 들어옵니다. (이 피해로는 쓰러지지 않고 HP 1에서 멈춤)',
      actions: [
        { do: 'damage', target: 'all', power: 4.2 },
        { do: 'burnMax', stacks: 5, turns: 2 },
        { do: 'status', to: 'self', status: 'adrenaline', turns: 1 }
      ]
    }
  },

  /* ── 레이 (게임 전용 · 번개) ─────────────────────────── */
  Character_13: {
    id: 'Character_13', gameOnly: true,
    name: '레이',
    nameEn: 'Rei',
    themeColor: '#7B6CC4',
    role: '번개 속성 메인 딜러 (축적 & 예열 폭딜형)',
    element: 'lightning',
    subElement: 'gold',
    usesBolt: true,
    boltLink: true,          // 번개 속성 아군이 스킬을 쓸 때마다 [번개] +1 (과충전 포격의 파티 시너지)
    ultPoints: 6,
    images: { full: 'assets/characters/Character_13/full.svg' },
    combat: { hp: 450, atk: 120, def: 32, crit: 0.1, mp: 50 },
    mechanics: [
      { name: '찌릿 & 번개 수급', icon: 'bolt', desc: '스킬로 적에게 [찌릿] 디버프를 누적시키고, [찌릿] 스택이 쌓이거나 반응할 때마다 화면 오른쪽의 [번개] 스택이 누적됩니다.' },
      { name: '번개 속성 파티 시너지', icon: 'chain', desc: '파티에 편성된 번개 속성 아군이 많을수록 스킬 피해량이 대폭 증가하고 [번개] 스택의 수급 속도가 빨라집니다.' },
      { name: '[빛] 골드 속성 패시브', icon: 'sun', desc: '블랙 속성 적에게 주는 모든 피해가 3% 증가합니다. 공격 스킬을 쓸 때마다 적의 기력을 흡수해 마력을 조금씩 채우고, 낮은 확률로 손패 맨 앞에 [마력 분배] 카드가 생겨 턴 시작 시 자신의 마력을 아군 전체에 균등하게 나눕니다.' },
      { name: '번개 소모 예열 시스템', icon: 'charge', desc: '누적된 [번개] 스택 중 일부를 소모하여 한 턴을 준비(예열)한 뒤, 다음 턴에 치명적인 추가 폭딜을 퍼붓습니다.' }
    ],
    skills: [
      {
        id: 'rei_s1', art: 'assets/characters/Character_13/skill_rei_s1.svg', name: '감전 사격', nameEn: 'Voltage Shot',
        category: '단일 공격 / [찌릿] 및 [번개] 수급', type: 'attack', element: 'lightning', anim: 'volt_shot', icon: 'voltShot', mp: 8,
        desc: '번개의 마력을 띤 탄환을 발사하여 적 1명에게 210%의 공격 피해를 입히고 [찌릿] 2스택을 부여합니다. 파티 내 번개 속성 캐릭터 1명당 이 스킬의 피해량이 15% 증가합니다. (최대 60% 증가)',
        note: '[찌릿]: 턴 종료 시 지속 피해를 받으며, 해당 대상이 받는 모든 피해량이 스택당 3% 증가합니다. (최대 10스택)',
        actions: [
          { do: 'damage', target: 'single', power: 2.1, synergy: { per: 0.15, max: 0.6 } },
          { do: 'status', to: 'hit', status: 'zap', stacks: 2, turns: 2 }
        ]
      },
      {
        id: 'rei_s2', art: 'assets/characters/Character_13/skill_rei_s2.svg', name: '과충전 포격', nameEn: 'Overcharge Cannon',
        category: '범위 공격 / [번개] 스택 수급', type: 'attack', element: 'lightning', anim: 'overcharge', icon: 'cannon', mp: 12,
        desc: '전장의 적 전체에게 전류를 분사하여 140%의 공격 피해를 입히고, [찌릿] 상태인 적 1명당 [번개] 스택을 2개씩 획득합니다.',
        note: '파티 시너지: 레이가 출전 중이면 번개 속성 아군이 스킬을 사용할 때마다 [번개] 스택이 1개씩 추가 적립됩니다.',
        actions: [
          { do: 'damage', target: 'all', power: 1.4 },
          { do: 'bolt', perZapped: 2 }
        ]
      },
      {
        id: 'rei_s3', art: 'assets/characters/Character_13/skill_rei_s3.svg', name: '과전류 장전', nameEn: 'Hyper-Charge',
        category: '자신 강화 / 예열 ([번개] 10 소모)', type: 'buff', element: 'lightning', anim: 'hyper_charge', icon: 'charge', mp: 4,
        boltCost: 10, holdOtherAttacks: true,
        drawWeight: 0.6, handLimit: 1,   // 예열 카드는 조금 덜 나오고, 손패에 1장까지만
        desc: '화면 오른쪽의 [번개] 스택을 10개 소모하여 2턴간 자신을 [과전류 예열] 상태로 만듭니다. 사용한 턴에는 직접 공격하지 않고 예열에 전념합니다.',
        note: '예열 효과 (다음 턴): 치명타율 30% · 치명타 피해 50% 증가 / 모든 공격 스킬과 궁극기가 방어력 40% 무시 / 공격 명중 시 적 전체에게 [찌릿] 3스택. 이 카드를 쓴 턴에는 레이의 다른 공격 카드가 사용되지 않고 손패에 남습니다.',
        actions: [
          { do: 'status', to: 'self', status: 'overcurrent', turns: 2 }
        ]
      }
    ],
    ultimate: {
      id: 'rei_ult', art: 'assets/characters/Character_13/skill_rei_ult.svg', name: '최종 술식 - 뇌신 붕괴포', nameEn: "Thunder God's Buster",
      category: '적 전체 공격 / [번개] 스택 비례 극폭딜', type: 'attack', element: 'lightning', anim: 'thunder_buster', icon: 'buster', mp: 0,
      desc: '축적된 전하 마력을 한꺼번에 방출하여 적 전체에게 350%의 공격 피해를 입힙니다. 현재 [번개] 스택 1개당 피해량이 12%씩 추가 증가합니다. (예: 20스택 → +240%) [과전류 예열] 상태라면 대상의 [찌릿]을 소모하지 않고 스택 수를 2배로 증폭시킵니다. 발동 후 모든 [번개] 스택이 초기화됩니다.',
      note: '[과전류 예열]이 아닐 때는 대상의 [찌릿]이 소모됩니다.',
      actions: [
        { do: 'damage', target: 'all', power: 3.5, boltPower: 0.12 },
        { do: 'zapAmp', ifSelf: 'overcurrent' },
        { do: 'boltReset' }
      ]
    }
  },

  /* ── 코루스코 (게임 전용 · 번개) ─────────────────────── */
  Character_14: {
    id: 'Character_14', gameOnly: true,
    name: '코루스코',
    nameEn: 'Corusco',
    themeColor: '#C9A23A',
    role: '스택 수급 & 예열 증폭형 서브 딜러 (번개 파티 전용)',
    element: 'lightning',
    subElement: 'black',
    usesBolt: true,
    boltLink: true,          // 번개 속성 아군이 스킬을 쓸 때마다 [번개] +1
    boltOnHit: 1,            // 자신이 공격을 명중시키면 [번개] +1
    boltStart: 10,           // 전투 시작 시 [번개] 10
    ultPoints: 7,
    images: { full: 'assets/characters/Character_14/full.svg' },
    combat: { hp: 470, atk: 100, def: 36, crit: 0.05, mp: 50 },
    mechanics: [
      { name: '공유 번개 수급기', icon: 'bolt', desc: '자신이 공격을 명중시키거나 번개 속성 아군이 스킬을 발동할 때마다 화면 오른쪽의 [번개] 스택을 즉시 끌어올립니다. 전투 시작 시 [번개] 스택을 10개 갖고 시작합니다.' },
      { name: '과전압 예열 메커니즘', icon: 'charge', desc: '[번개] 스택을 소모하는 가벼운 예열 스킬을 사용하여, 기본 공격 스킬들의 낮은 계수를 순간적으로 3~4배 이상 끌어올립니다.' },
      { name: '고유 디버프 [EMS]', icon: 'ems', desc: '궁극기 사용 시 부여되는 특수 제어 디버프. 적의 무작위 스킬 1개를 몇 턴 동안 사용 불능 상태로 만듭니다.' }
    ],
    skills: [
      {
        id: 'corusco_s1', art: 'assets/characters/Character_14/skill_corusco_s1.svg', name: '체인 라이트닝', nameEn: 'Chain Lightning',
        category: '범위 공격 / [찌릿] 및 [번개] 수급', type: 'attack', element: 'lightning', anim: 'chain_lightning', icon: 'chain', mp: 7,
        desc: '전류를 쏘아 적 2명에게 90%의 공격 피해를 입히고, [찌릿] 2스택을 부여하며 [번개] 스택을 2개 획득합니다. 파티 내 번개 속성 아군 1명당 [번개] 스택을 1개씩 추가로 획득합니다.',
        note: '[과전압 예열] 상태에서 사용 시: 타격 대상이 적 전체로 확대되며, 피해량이 280%로 증가합니다.',
        actions: [
          { do: 'damage', target: 'two', power: 0.9, primed: { status: 'overvolt', target: 'all', power: 2.8 } },
          { do: 'status', to: 'hit', status: 'zap', stacks: 2, turns: 2 },
          { do: 'bolt', amount: 2, perLightning: 1 }
        ]
      },
      {
        id: 'corusco_s2', art: 'assets/characters/Character_14/skill_corusco_s2.svg', name: '전하 플러그', nameEn: 'Voltage Plug',
        category: '단일 공격 / 디버프 & 피해 증폭', type: 'attack', element: 'lightning', anim: 'voltage_plug', icon: 'plug', mp: 9,
        desc: '적 1명에게 110%의 공격 피해를 입히고 2턴간 [찌릿] 3스택을 즉시 부여합니다. 대상이 이미 [찌릿] 상태일 경우, 적이 받는 번개 속성 피해를 2턴간 20% 증가시킵니다.',
        note: '[과전압 예열] 상태에서 사용 시: 피해량이 350%로 증가하고, 대상이 보유한 [찌릿] 1스택당 [번개] 스택을 1개씩 추가 수급합니다.',
        actions: [
          { do: 'damage', target: 'single', power: 1.1, primed: { status: 'overvolt', power: 3.5 } },
          { do: 'status', to: 'hit', status: 'conductive', turns: 2, ifTarget: 'zap' },
          { do: 'status', to: 'hit', status: 'zap', stacks: 3, turns: 2 },
          { do: 'bolt', perTargetZap: 1, ifSelf: 'overvolt' }
        ]
      },
      {
        id: 'corusco_s3', art: 'assets/characters/Character_14/skill_corusco_s3.svg', name: '과전압 예열', nameEn: 'High-Voltage Setup',
        category: '자신 강화 / 예열 ([번개] 5 소모)', type: 'buff', element: 'lightning', anim: 'hv_setup', icon: 'charge', mp: 3,
        boltCost: 5,
        drawWeight: 0.6, handLimit: 1,   // 예열 카드는 조금 덜 나오고, 손패에 1장까지만
        desc: '화면 오른쪽의 [번개] 스택을 5개 소모하여 자신에게 1턴간 [과전압 예열] 상태를 부여합니다.',
        note: '예열 효과 (이번 턴): 체인 라이트닝 · 전하 플러그의 피해 계수가 크게 증가합니다. 번개 속성 아군이 공격할 때마다 [번개] 스택 2개를 즉시 적립합니다. — 같은 턴의 뒤쪽 슬롯에 공격 카드를 놓아야 효과를 볼 수 있습니다.',
        actions: [
          { do: 'status', to: 'self', status: 'overvolt', turns: 1 }
        ]
      }
    ],
    ultimate: {
      id: 'corusco_ult', art: 'assets/characters/Character_14/skill_corusco_ult.svg', name: '최종 술식 - 뇌운의 과부하', nameEn: 'Thunder Cloud Overload',
      category: '적 전체 공격 / [EMS] 부여 & 파티 번개 수급', type: 'attack', element: 'lightning', anim: 'thunder_cloud', icon: 'cloud', mp: 0,
      desc: '하늘에 과전압 전자기장을 형성하여 적 전체에게 260%의 공격 피해를 입히고 [찌릿] 2스택을 부여합니다. 명중한 적에게 [EMS]를 부여하고, 즉시 [번개] 스택을 10개 적립하며, 2턴간 [뇌운 지대]를 형성합니다.',
      note: '[EMS]: 대상의 일반 스킬(궁극기 제외) 중 무작위 1개가 봉인되어 3턴 동안 사용할 수 없습니다. [뇌운 지대]: 번개 속성 아군이 공격할 때마다 적 전체가 가진 [찌릿] 지속 피해를 즉시 1회 추가 발동시킵니다.',
      actions: [
        { do: 'damage', target: 'all', power: 2.6 },
        { do: 'status', to: 'hit', status: 'zap', stacks: 2, turns: 2 },
        { do: 'seal', turns: 3 },
        { do: 'bolt', amount: 10 },
        { do: 'field', field: 'thundercloud', turns: 2 }
      ]
    }
  },

  /* ── 페델레 (게임 전용 · 방어 지원형 서포터) ─────────── */
  Character_15: {
    id: 'Character_15', gameOnly: true,
    name: '페델레',
    nameEn: 'Fedele',
    themeColor: '#4E5D8C',
    role: '방어 지원형 유니버설 서포터',
    element: 'earth',
    subElement: 'lightning',
    images: { full: 'assets/characters/Character_15/full.svg' },
    combat: { hp: 560, atk: 95, def: 50, crit: 0.05, mp: 50 },
    mechanics: [
      { name: '[부담감]', icon: 'weight', desc: '적의 전투 의지를 짓누르는 고유 압박 상태. 스택에 따라 공격력과 방어력을 깎아내립니다. (스택당 5% · 최대 3스택)' }
    ],
    skills: [
      {
        id: 'fedele_s1', art: 'assets/characters/Character_15/skill_fedele_s1.svg', name: '중압의 일격', nameEn: 'Heavy Pressure',
        category: '단일 공격 / [부담감] 부여', type: 'attack', element: 'earth', anim: 'gravity_shot', icon: 'gravity', mp: 6,
        desc: '지휘봉 끝에서 응축된 중력파를 발사해 적 1명에게 140%의 공격 피해를 입히고, 2턴간 대상에게 [부담감] 1스택을 부여합니다.',
        note: '[부담감]: 스택당 대상의 공격력과 방어력이 5%씩 감소합니다. (최대 3스택)',
        actions: [
          { do: 'damage', target: 'single', power: 1.4 },
          { do: 'status', to: 'hit', status: 'burden', stacks: 1, turns: 2 }
        ]
      },
      {
        id: 'fedele_s2', art: 'assets/characters/Character_15/skill_fedele_s2.svg', name: '절대 역장', nameEn: 'Absolute Field',
        category: '방어 / 보호막 & 디버프 해제 & 피해 감면', type: 'buff', element: 'earth', anim: 'absolute_field', icon: 'guard', mp: 10,
        desc: '딜링 없이 파티의 생존에 집중합니다. 아군 전체에게 [보호막]을 2턴간 부여하고, 디버프를 1개 해제하며, 2턴간 [피해 감면 30%]를 부여합니다.',
        note: '보호막 양은 문서에 없어 자신 최대 체력의 15%로 정했습니다. (임시)',
        actions: [
          { do: 'shield', to: 'allies', base: 'maxHp', ratio: 0.15, turns: 2 },
          { do: 'cleanse', to: 'allies', count: 1 },
          { do: 'status', to: 'allies', status: 'damage_cut', turns: 2 }
        ]
      },
      {
        id: 'fedele_s3', art: 'assets/characters/Character_15/skill_fedele_s3.svg', name: '중력 파열', nameEn: 'Gravity Burst',
        category: '범위 공격 / [부담감] 확산 & 행동 제어', type: 'attack', element: 'earth', anim: 'gravity_burst', icon: 'weight', mp: 9,
        desc: '지휘봉의 마력을 넓게 전개해 적 2명에게 110%의 공격 피해를 입히고 [부담감] 1스택을 부여합니다. 이미 [부담감]이 있던 적에게는 1턴간 [행동 제어]를 부여합니다.',
        note: '[행동 제어]: 그 턴에 행동할 수 없습니다.',
        actions: [
          { do: 'damage', target: 'two', power: 1.1 },
          { do: 'status', to: 'hit', status: 'stun', turns: 1, ifTarget: 'burden' },
          { do: 'status', to: 'hit', status: 'burden', stacks: 1, turns: 2 }
        ]
      }
    ],
    ultimate: {
      id: 'fedele_ult', art: 'assets/characters/Character_15/skill_fedele_ult.svg', name: '최종 술식 - 그랜드 프레셔', nameEn: 'Grand Pressure',
      category: '적 전체 공격 / 파티 방어 극대화', type: 'attack', element: 'earth', anim: 'grand_pressure', icon: 'gravity', mp: 0,
      desc: '전장에 거대한 중력 역장을 전개합니다. 적 전체에게 220%의 공격 피해를 입히고(대상의 [부담감] 1스택당 피해량 +10%), [부담감] 2스택을 즉시 부여합니다. 2턴간 아군 전체의 피해 감면이 50%가 됩니다.',
      actions: [
        { do: 'damage', target: 'all', power: 2.2, burdenBonus: { per: 0.1 } },
        { do: 'status', to: 'hit', status: 'burden', stacks: 2, turns: 2 },
        { do: 'status', to: 'allies', status: 'grand_guard', turns: 2 }
      ]
    }
  },

  /* ── 실반 (게임 전용 · 자연 속성 힐러) ───────────────── */
  Character_16: {
    id: 'Character_16', gameOnly: true,
    name: '실반',
    nameEn: 'Sylvan',
    themeColor: '#5E9A6A',
    role: '순수 치유형 & 상태 보호 서포터 (힐러 / 자연 속성)',
    element: 'nature',
    images: { full: 'assets/characters/Character_16/full.svg' },
    combat: { hp: 420, atk: 80, def: 38, crit: 0, mp: 60 },
    mechanics: [
      { name: '[신경망 동조]', icon: 'link', desc: '아군이 받는 피해를 필드 전체로 나누어 단일 대상의 급사를 막습니다.' },
      { name: '[세포벽 정화]', icon: 'cell', desc: '적의 지속 피해와 지속 디버프의 위력을 억제하는 방어막을 둘러 줍니다.' },
      { name: '[고립]', icon: 'stun', desc: '신경망 연결에 집중하는 동안 스킬을 사용할 수 없습니다.' }
    ],
    skills: [
      {
        id: 'healer_s1', art: 'assets/characters/Character_16/skill_sylvan_s1.svg', name: '신경망 연결', nameEn: 'Neural Link',
        category: '아군 지원 / 피해 분산 & 받는 피해 감소', type: 'buff', element: 'nature', anim: 'neural_link', icon: 'link', mp: 8,
        desc: '식물의 신경망으로 아군을 연결합니다. 3턴간 아군 전체가 받는 피해의 50%를 필드의 다른 아군에게 균등하게 나누고, 받는 피해를 50% 감소시키며, 실반의 치유량이 20% 증가합니다. 대신 2턴간 [고립] 상태가 되어 실반의 카드가 손패에 나오지 않습니다.',
        note: '[고립]: 실반의 카드(궁극기 포함)가 손패에서 사라지고, 고립이 끝날 때까지 나오지 않습니다. 피해 감면 효과끼리는 중첩되지 않고 가장 큰 것만 적용됩니다.',
        actions: [
          { do: 'status', to: 'allies', status: 'neural_link', turns: 3 },
          { do: 'status', to: 'self', status: 'isolation', turns: 2 }
        ]
      },
      {
        id: 'healer_s2', art: 'assets/characters/Character_16/skill_sylvan_s2.svg', name: '세포벽 정화', nameEn: 'Cell Wall Purge',
        category: '아군 지원 / 특수 보호막 & 디버프 약화', type: 'buff', element: 'nature', anim: 'cell_wall', icon: 'cell', mp: 9,
        desc: '아군 전체에게 자신 최대 체력의 20%에 해당하는 [세포벽 보호막]을 2턴간 부여합니다. 보호막이 유지되는 동안 적이 부여한 [연소] · [찌릿] 등 지속 피해의 위력이 크게 낮아집니다. 시전 즉시 아군 전체의 디버프 지속 시간을 1턴 감소시킵니다.',
        note: '지속 피해 감소량은 문서에 수치가 없어 60%로 정했습니다. (임시)',
        actions: [
          { do: 'shield', to: 'allies', base: 'maxHp', ratio: 0.2, turns: 2 },
          { do: 'status', to: 'allies', status: 'cell_wall', turns: 2 },
          { do: 'debuffTick', to: 'allies', amount: 1 }
        ]
      },
      {
        id: 'healer_s3', art: 'assets/characters/Character_16/skill_sylvan_s3.svg', name: '생명의 순환', nameEn: 'Cycle of Life',
        category: '아군 지원 / 대규모 회복 & 마력 회복', type: 'heal', element: 'nature', anim: 'life_cycle', icon: 'heal', mp: 30,
        desc: '아군 전체의 체력을 실반 최대 체력의 25%만큼 회복시키고, 자신을 제외한 아군 전체의 마력을 70% 채웁니다. 이후 3턴간 실반의 치유량이 50% 증가합니다. 마력을 크게 소모합니다.',
        note: '[신경망 연결] 상태라면 치유량 증가가 함께 적용됩니다.',
        actions: [
          { do: 'heal', to: 'allies', base: 'maxHp', ratio: 0.25 },
          { do: 'mp', to: 'others', pct: 0.7 },
          { do: 'status', to: 'self', status: 'heal_up', turns: 3 }
        ]
      }
    ],
    ultimate: {
      id: 'healer_ult', art: 'assets/characters/Character_16/skill_sylvan_ult.svg', name: '최종 술식 - 세계수의 영역', nameEn: 'Global Canopy Sanctuary',
      category: '아군 지원 / 전면 케어 & 마력 회복', type: 'heal', element: 'nature', anim: 'world_tree', icon: 'tree', mp: 0,
      desc: '적을 공격하는 대신 2턴간 필드에 [세계수의 영역]을 전개해 매 턴 종료 시 아군 전체의 체력을 30%씩 회복시킵니다. 즉시 아군 전체의 모든 디버프를 해제하고, [세포벽 정화]를 다시 부여하며, 자신의 마력을 크게 회복합니다.',
      actions: [
        { do: 'field', field: 'world_tree', turns: 2 },
        { do: 'cleanse', to: 'allies', all: true },
        { do: 'shield', to: 'allies', base: 'maxHp', ratio: 0.2, turns: 2 },
        { do: 'status', to: 'allies', status: 'cell_wall', turns: 2 },
        { do: 'mp', to: 'self', pct: 0.6 }
      ]
    }
  }
};

/* 편성 화면 캐릭터 목록 — 기존 사이트 캐릭터 목록 순서 + 게임 전용 캐릭터(레이 · 코루스코 · 페델레 · 실반) */
G.DATA.roster = ['Character_05', 'Character_10', 'Character_11', 'Character_12', 'Character_13', 'Character_14', 'Character_15', 'Character_16'];

/* 속성 이름 · 아이콘 · 색 (기존 사이트 ELEMENT_INFO 와 같음) */
G.DATA.elements = {
  fire:      { name: '화염', icon: 'flame', color: '#a8482c' },
  earth:     { name: '대지', icon: 'earth', color: '#7d6440' },
  water:     { name: '물',   icon: 'water', color: '#3f6e7e' },
  nature:    { name: '자연', icon: 'leaf',  color: '#5b7346' },
  wind:      { name: '바람', icon: 'wind',  color: '#5f8580' },
  lightning: { name: '번개', icon: 'bolt',  color: '#6a5a8c' },
  light:     { name: '빛',   icon: 'sun',   color: '#b8924a' },
  gold:      { name: '골드', icon: 'sun',   color: '#b8922a' },   // 패시브 [빛]: 블랙 속성 적에게 피해 +3% · 마력 분배
  black:     { name: '블랙', icon: 'moon',  color: '#2c2a36' }
};

/* ── 골드 속성 전용: 특수 카드 [마력 분배] ─────────────────
 *  · 골드 속성 캐릭터(레이)의 손패에 낮은 확률로 생성 · 손패 맨 앞(1번)에 고정 · 손패 칸을 차지하지 않음
 *  · 턴이 시작될 때(아군 행동 전) 자동으로 사용: 자신의 마력을 아군 전체(필드)에 균등하게 나눔
 *  · 행동 슬롯 · 열의를 쓰지 않음 */
G.DATA.specialSkills = {
  light_share: {
    id: 'light_share', name: '마력 분배', nameEn: 'Light Share',
    category: '골드 속성 전용 · 패시브 생성 카드', type: 'buff', element: 'gold', anim: 'light_share', icon: 'sun', mp: 0,
    art: 'assets/characters/common/skill_light_share.svg',
    desc: '턴이 시작될 때 자동으로 사용되어, 자신이 축적한 마력을 필드의 아군 전체에게 균등하게 나누어 줍니다.',
    note: '[빛] 골드 속성 패시브: 블랙 속성 적에게 주는 피해 +3% · 공격 스킬을 쓸 때마다 마력을 조금 흡수합니다.',
    actions: []
  }
};
