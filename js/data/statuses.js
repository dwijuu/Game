/**
 * 버프 / 디버프 / 필드 효과 정의
 * ─────────────────────────────────────────────────────────────
 * status: { name, kind: 'buff' | 'debuff', icon(js/core/art.js G.icons 키), mods, desc(s) }
 *  · mods: 능력치 보정 (가산)
 *      atk / def      공격력 · 방어력 배율 (−0.15 = −15%)
 *      fireDmg        화염 속성 피해 증가
 *      crit           치명타율 증가
 *      defIgnore      방어 무시
 *      dmgTaken       받는 피해 증감 (+0.1 = 10% 더 받음, −0.15 = 15% 덜 받음)
 *      dmgUp          주는 피해 증가
 *      evade          회피율 (공격을 완전히 피함)
 *      critTaken      이 대상을 공격하는 쪽의 치명타율 증가
 *      critDmg        치명타 피해 증가 (+0.5 = 치명타 배율 +50%p)
 *      lightningTaken 받는 번개 속성 피해 증가
 *      dotTaken       받는 지속 피해 증감 (세포벽 정화 −0.6)
 *      healUp         시전하는 치유량 증가
 *  · group: 'cut'     같은 그룹끼리는 중첩되지 않고 가장 큰 효과 하나만 적용 (피해 감면)
 *  · stack: true      스택이 누적되는 상태 (연소 · 찌릿), maxStacks 로 상한
 *  · perStack: true   mods 가 스택 수만큼 곱해짐 (찌릿: 스택당 받는 피해 +3%)
 *  · delayed: true    처음 부여된 턴에는 효과가 없고 다음 턴부터 적용 (과전류 예열)
 *  · consumeOnAttack  다음 공격 1회에 쓰이고 사라짐 (방어 무시 30%)
 *  · absorb: true     피해를 대신 받는 보호막 (value = 남은 보호막 양)
 *  · 지속 턴은 스킬에서 지정하며, 턴이 끝날 때 1씩 줄어듭니다.
 *
 * 턴 = 아군의 모든 공격 → 적군의 모든 공격 → 턴 종료
 */
window.G = window.G || {};
G.DATA = G.DATA || {};

/* ⚠ 문서에 수치가 없는 항목 (임시 값)
 *   BURN_PER_STACK: 연소 1스택이 턴 종료 시 입히는 피해 = 부여한 캐릭터 공격력 × 8% (스택 제한이 없어져 10% → 8%)
 *   CRIT_DAMAGE:    치명타 피해 배율 150%
 *   MP_DEFAULT:     캐릭터 최대 마력 (combat.mp 가 없을 때)
 *   HP_PER_MP:      마력이 모자랄 때 부족한 마력 1당 소모하는 체력 (체력은 1 아래로 내려가지 않음)
 *   ZAP_PER_STACK:  찌릿 지속 피해 (문서에 수치 없음)
 */
G.DATA.rules = {
  BURN_PER_STACK: 0.08,
  CRIT_DAMAGE: 1.5,
  BENCH_HEAL: 0.05,
  MOXIE_MAX: 5,
  MP_DEFAULT: 100,
  HP_PER_MP: 2,
  ZAP_PER_STACK: 0.06,   // 찌릿 1스택이 턴 종료 시 입히는 피해 = 부여한 캐릭터 공격력 × 6% (임시 값)
  ZAP_MAX: 10,
  GOLD_VS_BLACK: 0.03,   // [빛] 골드 속성 → 블랙 속성 적에게 피해 +3%
  GOLD_MP_ON_ATTACK: 3,  // [빛] 골드 속성: 공격 스킬 사용 시 마력 +3 (임시 값 — 문서: '조금씩')
  LIGHT_SHARE_CHANCE: 0.2, // [마력 분배] 카드가 턴마다 생성될 확률 (임시 값 — 문서: '낮은 확률')           // 찌릿 최대 스택
  DRIP_RATIO: 0.25,      // 물방울 침식: 턴 종료 시 부여한 적 공격력 × 25% (임시 값)
  RAIN_WATER: 0.3,       // [비]: 물 속성 기술 공격력 +30%
  RAIN_FIRE: -0.4        // [비]: 아군의 화염 속성 기술 공격력 −40% ('대폭 하락' — 임시 값)
};

G.DATA.statuses = {
  burn: {
    name: '연소', kind: 'debuff', short: '연', icon: 'flame', stack: true,
    short: '턴 종료 시 스택만큼 화염 지속 피해',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: function (s) { return '턴 종료 시 보유 스택에 비례하여 지속 피해를 입습니다. (스택 제한 없음 · 현재 ' + s.stacks + '스택 · 턴당 ' + Math.round(s.stacks * s.value) + ' 피해)'; }
  },
  def_down: {
    name: '방어력 감소', kind: 'debuff', short: '방', icon: 'defDown',
    short: '방어력 15% 감소',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { def: -0.15 },
    desc: '방어력이 15% 감소합니다.'
  },
  shield: {
    name: '보호막', kind: 'buff', short: '막', icon: 'shield', absorb: true,
    short: '피해를 대신 흡수',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: function (s) { return '피해를 대신 흡수합니다. (남은 보호막 ' + Math.round(s.value) + ')'; }
  },
  overheat: {
    name: '과열', kind: 'buff', short: '열', icon: 'heatUp',
    short: '화염 피해 +20% · 치명타율 +10%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { fireDmg: 0.2, crit: 0.1 },
    desc: '화염 속성 피해가 20%, 치명타율이 10% 증가합니다.'
  },
  slow: {
    name: '감속', kind: 'debuff', icon: 'slow',
    short: '공격력 -10% · 행동이 늦어짐',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { atk: -0.1 },
    desc: '공격력이 10% 감소하고 행동 순서가 늦춰집니다.'
  },
  bind: {
    name: '속박', kind: 'debuff', icon: 'vine',
    short: '받는 피해 +10% · 마지막에 행동',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgTaken: 0.1 },
    desc: '받는 피해가 10% 증가하고, 다음 행동이 마지막 순서로 밀립니다.'
  },
  expose: {
    name: '약점 노출', kind: 'debuff', icon: 'eye',
    short: '방어력 -20% · 받는 치명타 확률 증가',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { def: -0.2, critTaken: 0.1 },
    desc: '방어력이 20% 감소하고, 이 대상을 공격하는 아군의 치명타율이 10% 증가합니다.'
  },
  haste: {
    name: '가속', kind: 'buff', icon: 'dash', consumeOnAttack: true,
    short: '먼저 행동 · 다음 공격 피해 +15%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgUp: 0.15 },
    desc: '행동 순서가 앞당겨지고, 다음 공격의 피해가 15% 증가합니다.'
  },
  evade_up: {
    name: '회피 증가', kind: 'buff', icon: 'leap',
    short: '회피율 +15%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { evade: 0.15 },
    desc: '회피율이 15% 증가합니다.'
  },
  root_ward: {
    name: '뿌리 결계', kind: 'buff', icon: 'root',
    short: '받는 피해 -15%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgTaken: -0.15 },
    desc: '받는 피해가 15% 감소합니다.'
  },
  tailwind: {
    name: '순풍', kind: 'buff', icon: 'atkUp',
    short: '공격력 +15%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { atk: 0.15 },
    desc: '공격력이 15% 증가합니다.'
  },
  /* ── 번개 (레이 · 코루스코) ── */
  zap: {
    name: '찌릿', kind: 'debuff', icon: 'bolt', stack: true, maxStacks: 10, perStack: true,
    short: '스택당 받는 피해 +3% · 턴 종료 시 전기 피해',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgTaken: 0.03 },
    desc: function (s) { return '턴 종료 시 지속 전기 피해를 받고, 받는 모든 피해량이 스택당 3% 증가합니다. (최대 10스택 · 현재 ' + s.stacks + '스택 · 받는 피해 +' + (s.stacks * 3) + '% · 턴당 ' + Math.round(s.stacks * s.value) + ' 피해)'; }
  },
  conductive: {
    name: '전하 증폭', kind: 'debuff', icon: 'plug',
    short: '받는 번개 피해 +20%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { lightningTaken: 0.2 },
    desc: '받는 번개 속성 피해가 20% 증가합니다.'
  },
  overcurrent: {
    name: '과전류 예열', kind: 'buff', icon: 'charge', delayed: true, chip: '과전류',
    short: '치명타 대폭 강화 · 방어 무시 · 명중 시 찌릿 확산',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { crit: 0.3, critDmg: 0.5, defIgnore: 0.4 },
    desc: function (s) { return (s.dormant ? '예열 중 — 다음 턴부터 적용됩니다. ' : '') + '치명타율 30%, 치명타 피해 50% 증가. 모든 공격 스킬과 궁극기가 적의 방어력을 40% 무시하고, 공격 명중 시 적 전체에게 [찌릿] 3스택을 부여합니다.'; }
  },
  overvolt: {
    name: '과전압 예열', kind: 'buff', icon: 'charge', chip: '과전압',
    short: '체인 라이트닝 · 전하 플러그 위력 대폭 증가',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: '예열 중에는 체인 라이트닝 · 전하 플러그의 피해 계수가 대폭 증가합니다(체인 라이트닝 90% → 280% · 적 전체, 전하 플러그 110% → 350%). 번개 속성 아군이 공격할 때마다 [번개] 스택이 2개씩 적립됩니다.'
  },
  ems: {
    name: 'EMS', kind: 'debuff', icon: 'ems', chip: 'EMS',
    short: '스킬 1개 봉인',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: function (s) { return '스킬 1개가 봉인되어 사용할 수 없습니다.' + (s.sealedName ? ' (봉인: ' + s.sealedName + ')' : ''); }
  },
  /* ── 알리제 ── */
  adrenaline: {
    name: '아드레날린', kind: 'buff', icon: 'burst', chip: '아드레날린',
    short: '받는 피해를 유예 (턴 종료 후 일부만 들어옴)',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: '받는 피해가 즉시 적용되지 않고 유예됩니다. 턴이 끝나면 유예된 피해의 50%가 2턴에 걸쳐 지속 피해로 들어옵니다. (이 피해로는 쓰러지지 않음)'
  },
  aftershock: {
    name: '아드레날린 반동', kind: 'debuff', icon: 'burst',
    short: '유예된 피해가 턴 종료 시 들어옴',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: function (s) { return '유예됐던 피해가 턴 종료 시 들어옵니다. (턴당 ' + Math.round(s.value) + ' · 체력 1 아래로는 내려가지 않음)'; }
  },
  /* ── 페델레 ── */
  burden: {
    name: '부담감', kind: 'debuff', icon: 'weight', stack: true, maxStacks: 3, perStack: true,
    short: '스택당 공격력 · 방어력 -5%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { atk: -0.05, def: -0.05 },
    desc: function (s) { return '전투 의지가 짓눌려 스택당 공격력과 방어력이 5%씩 감소합니다. (최대 3스택 · 현재 ' + s.stacks + '스택 · −' + (s.stacks * 5) + '%)'; }
  },
  stun: {
    name: '행동 제어', kind: 'debuff', icon: 'stun', chip: '행동 제어',
    short: '이번 턴 행동 불가',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: '이번 턴에 행동할 수 없습니다.'
  },
  damage_cut: {
    name: '피해 감면', kind: 'buff', icon: 'guard', group: 'cut',
    short: '받는 피해 -30%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgTaken: -0.3 },
    desc: '받는 모든 피해가 30% 감소합니다. (피해 감면 효과끼리는 중첩되지 않고 가장 큰 것만 적용)'
  },
  grand_guard: {
    name: '그랜드 프레셔 — 피해 감면', kind: 'buff', icon: 'guard', group: 'cut',
    short: '받는 피해 -50%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgTaken: -0.5 },
    desc: '받는 모든 피해가 50% 감소합니다. (피해 감면 효과끼리는 중첩되지 않고 가장 큰 것만 적용)'
  },
  /* ── 실반 ── */
  isolation: {
    name: '고립', kind: 'buff', icon: 'stun', chip: '고립',
    short: '스킬 사용 불가 (신경망 집중)',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: '신경망 연결에 집중합니다. 이 캐릭터의 카드(궁극기 포함)는 마법에 나오지 않아 사용할 수 없습니다.'
  },
  neural_link: {
    name: '신경망 연결', kind: 'buff', icon: 'link', group: 'cut', chip: '연결',
    short: '받는 피해 -50% · 일부를 아군에게 분산',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dmgTaken: -0.5, healUp: 0.2 },
    desc: '받는 피해가 50% 감소하고, 받은 피해의 50%를 필드의 다른 아군에게 균등하게 나눕니다. 이 상태에서 시전하는 치유량이 20% 증가합니다. (피해 감면 효과끼리는 중첩되지 않음)'
  },
  cell_wall: {
    name: '세포벽 정화', kind: 'buff', icon: 'cell',
    short: '지속 피해 -60%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { dotTaken: -0.6 },
    desc: '연소 · 찌릿 · 물방울 침식 등 지속 피해의 위력이 60% 감소합니다.'
  },
  heal_up: {
    name: '치유량 증가', kind: 'buff', icon: 'heal',
    short: '치유량 +50%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { healUp: 0.5 },
    desc: '시전하는 치유량이 50% 증가합니다.'
  },
  /* ── 중간 보스 ── */
  drip: {
    name: '물방울 침식', kind: 'debuff', icon: 'water', dot: true,
    short: '턴 종료 시 물 지속 피해',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: function (s) { return '턴 종료 시 물 속성 지속 피해를 받습니다. (턴당 ' + Math.round(s.value) + ' 피해)'; }
  },
  water_clone: {
    name: '공격 회피 (물의 분신)', kind: 'buff', icon: 'clone', chip: '분신',
    short: '다음 공격 1회 무효',   // 머리 위 아이콘 툴팁용 한 줄 요약
    desc: '분신이 공격을 대신 맞아 다음 단일/범위 공격 1회를 무효화합니다.'
  },
  blessing: {
    name: '자연의 축복수', kind: 'buff', icon: 'atkUp',
    short: '공격력 +20%',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { atk: 0.2 },
    desc: '공격력이 20% 증가합니다.'
  },
  pierce: {
    name: '방어 무시', kind: 'buff', short: '관', icon: 'pierce', consumeOnAttack: true,
    short: '다음 공격이 방어력 30% 무시',   // 머리 위 아이콘 툴팁용 한 줄 요약
    mods: { defIgnore: 0.3 },
    desc: '다음 공격이 대상의 방어력을 30% 무시합니다.'
  }
};

/* 필드 효과 */
G.DATA.fields = {
  blaze_zone: {
    name: '열염 지대',
    enemyTickRatio: 0.3,     // 적이 행동할 때마다 (형성한 캐릭터 공격력 × 30%) 피해
    fireAllyBonus: 0.15,     // 화염 속성 아군 공격 시 피해량 +15%
    desc: '적이 행동할 때마다 지속 피해를 받고, 화염 속성 아군이 공격 시 피해량이 15% 추가 적용됩니다. 지대가 있는 동안 적의 [연소]는 사라지지 않고 최소 1스택이 유지됩니다.'
  },
  rain: {
    name: '비',
    side: 'enemy',
    desc: '물 속성 기술의 공격력이 30% 증가합니다 (양쪽 모두). 아군의 화염 속성 기술 공격력은 40% 감소합니다.'
  },
  world_tree: {
    name: '세계수의 영역',
    healRatio: 0.3,
    desc: '턴 종료 시마다 아군 전체가 최대 체력의 30%를 회복합니다.'
  },
  thundercloud: {
    name: '뇌운 지대',
    desc: '번개 속성 아군이 공격할 때마다, 적 전체가 가진 [찌릿] 지속 피해가 즉시 1회 추가로 발동합니다.'
  }
};
