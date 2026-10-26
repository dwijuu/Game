/**
 * 적 데이터
 *  · art: 'silhouette' → 검은 형체의 인간 실루엣 (SVG로 그림, 이미지 로딩 없음)
 *  · skills 규격은 캐릭터 스킬과 같습니다. 적은 매 턴 skills 를 순서대로 사용합니다.
 *  · tint: 실루엣 색 (없으면 검은 형체)
 *  · ultimate + ultEvery: N번째 행동마다 궁극기 사용 (없으면 궁극기 없음)
 *  · ⚠ 적의 스킬·수치는 문서에 없어 임시로 정한 값입니다.
 */
window.G = window.G || {};
G.DATA = G.DATA || {};

G.DATA.enemies = {
  /* 스테이지 1 (튜토리얼) */
  shade: {
    id: 'shade',
    name: '검은 실루엣',
    art: 'silhouette',
    combat: { hp: 450, atk: 70, def: 20, crit: 0 },   // 1스테이지: 3턴 이내 종료되도록
    skills: [
      { id: 'shade_strike', name: '공격', type: 'attack', anim: 'shadow_strike',
        desc: '아군 1명에게 공격력 100%의 공격 피해를 줍니다.',
        actions: [{ do: 'damage', target: 'single', power: 1.0 }] }
    ]
  },
  /* 스테이지 4 — 실력 검증 : 담당 교사 (⚠ 스킬 · 수치는 임시 값) */
  teacher: {
    id: 'teacher',
    name: '교사',
    art: 'silhouette', tint: '#3a4560',
    combat: { hp: 2600, atk: 130, def: 30, crit: 0.05 },
    skills: [
      { id: 'teacher_shot', name: '지도 사격', type: 'attack', anim: 'light_shot',
        desc: '빛 줄기로 아군 1명에게 공격력 130%의 공격 피해를 줍니다.',
        actions: [{ do: 'damage', target: 'single', power: 1.3 }] },
      { id: 'teacher_demo', name: '광역 시범', type: 'attack', anim: 'demo_wave',
        desc: '마력의 파동으로 아군 전체에게 공격력 70%의 공격 피해를 줍니다.',
        actions: [{ do: 'damage', target: 'all', power: 0.7 }] }
    ],
    /* 궁극기: 3번째 행동마다 사용 (행동 예고에 금색으로 표시) */
    ultEvery: 3,
    ultimate: { id: 'teacher_ult', name: '빛의 시범 강의', type: 'attack', anim: 'teacher_ult',
      desc: '훈련장 전체를 빛으로 채워 아군 전체에게 공격력 120%의 공격 피해를 줍니다.',
      actions: [{ do: 'damage', target: 'all', power: 1.2 }] }
  },

  /* 스테이지 5 — 중간 보스 (캐릭터 성능 확인용 · 이름 미정 · 스프라이트는 별도 제작 예정 → 지금은 색 실루엣)
   *  물/자연 속성 하이브리드 서브 딜러 겸 서포터. 덱(캐릭터 선택) 목록에는 들어가지 않음.
   *  ⚠ 체력 · 공격력 · 방어력 · 지속 피해량 · 궁극기 주기 · [비]의 화염 감소량은 밸런스를 위해 정한 임시 값 */
  midboss: {
    id: 'midboss',
    name: '중간 보스',
    boss: true,
    element: 'water',
    art: 'silhouette', tint: '#2f5c6e',
    role: '물/자연 속성 하이브리드 서브 딜러 겸 서포터',
    combat: { hp: 4500, atk: 75, def: 40, crit: 0.05 },
    skills: [
      { id: 'mb_drip_shot', name: '수류 도트 사격', type: 'attack', element: 'water', anim: 'mb_drip_shot',
        desc: '물줄기를 응축한 탄환을 발사하여 아군 1명에게 180%의 공격 피해를 입히고, 3턴간 매 턴 종료 시 지속적인 물 속성 피해를 주는 [물방울 침식]을 부여합니다.',
        actions: [
          { do: 'damage', target: 'single', power: 1.8 },
          { do: 'status', to: 'hit', status: 'drip', turns: 3 }
        ] },
      { id: 'mb_clone', name: '물의 분신 회피', type: 'buff', element: 'water', anim: 'mb_clone',
        desc: '물의 마법으로 자신의 분신을 생성해 공격을 기만합니다. 1턴 동안 [공격 회피] 상태가 되어 단일/범위 공격을 1회 무효화합니다.',
        actions: [{ do: 'status', to: 'self', status: 'water_clone', turns: 2 }] },
      { id: 'mb_blessing', name: '자연의 축복수', type: 'buff', element: 'nature', anim: 'mb_blessing',
        desc: '물과 자연의 생명력을 결합해 2턴간 자신 진영 전체의 공격력을 20% 증가시키고, 체력을 자신 공격력의 100%만큼 즉시 회복합니다.',
        actions: [
          { do: 'status', to: 'allies', status: 'blessing', turns: 2 },
          { do: 'heal', to: 'allies', ratio: 1.0 }
        ] }
    ],
    /* 궁극기: 4번째 행동마다 */
    ultEvery: 4,
    ultimate: { id: 'mb_tidal_dragon', name: '최종 술식 - 해일의 거대 용', nameEn: 'Tidal Dragon', type: 'attack', element: 'water', anim: 'mb_tidal_dragon',
      desc: '하늘에서 거대한 물의 드래곤을 소환해 아군 전체에게 360%의 공격 피해를 입히고, 5턴간 필드에 [비]를 전개합니다.',
      actions: [
        { do: 'damage', target: 'all', power: 3.6 },
        { do: 'field', field: 'rain', turns: 5 }
      ] }
  },

  /* 스테이지 5 (임시 · 이전 버전, 지금은 사용하지 않음) */
  shade_temp: {
    id: 'shade_temp',
    name: '검은 실루엣',
    art: 'silhouette',
    combat: { hp: 650, atk: 65, def: 20, crit: 0 },
    skills: [
      { id: 'shade_strike', name: '공격', type: 'attack', anim: 'shadow_strike',
        desc: '아군 1명에게 공격력 100%의 공격 피해를 줍니다.',
        actions: [{ do: 'damage', target: 'single', power: 1.0 }] }
    ]
  }
};

/* 스테이지 8 — 메인 보스: 적 코루스코
 *  · 플레이어용 코루스코(Character_14)의 스킬 3개 · 궁극기를 그대로 사용 (적 진영의 [번개]를 따로 셈)
 *  · 궁극기 포인트 4: 행동할 때마다 1씩 쌓이고, 4가 되면 다음 행동이 궁극기
 *  · 적은 한 턴에 한 번만 행동하므로, 과전압 예열은 바로 다음 행동까지 유지되도록 2턴으로 둠
 *  · 행동 순서: 체인 라이트닝 → 과전압 예열 → 전하 플러그 (번개가 모자라면 예열은 건너뜀)
 *  · 체력이 거의 다 깎이면(stage.finale) 결말 공격으로 아군 전원을 쓰러뜨림 → 스토리상 클리어
 *  ⚠ 체력 · 공격력 · 방어력 · 결말 공격 이름은 임시 값
 */
(function () {
  const src = G.DATA.characters.Character_14;
  const clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  const byId = function (id) { return clone(src.skills.find(function (k) { return k.id === id; })); };
  const s1 = byId('corusco_s1'), s2 = byId('corusco_s2'), s3 = byId('corusco_s3');
  s3.actions = [{ do: 'status', to: 'self', status: 'overvolt', turns: 2 }];
  s3.note = '보스 전용: 한 턴에 한 번 행동하므로 다음 행동까지 [과전압 예열]이 유지됩니다.';
  G.DATA.enemies.corusco_boss = {
    id: 'corusco_boss',
    name: '코루스코',
    boss: true,
    element: 'lightning', subElement: 'black',
    art: 'silhouette', tint: '#8a6d1f',
    /* 전투 그림: 코루스코 스프라이트를 좌우 반전해 오른쪽(아군 쪽)을 바라보게 함 */
    sprite: { base: 'assets/characters/Character_14/boss.webp', hit: 'assets/characters/Character_14/boss_hit.webp', atk: 'assets/characters/Character_14/boss_atk.webp' },
    usesBolt: true, boltLink: true, boltOnHit: 1, boltStart: 10,
    ultPoints: 4,
    actionsPerTurn: [1, 2],   // 매 턴 무작위로 1번 또는 2번 행동
    combat: { hp: 5500, atk: 72, def: 45, crit: 0.08 },   // 1~2회 행동 · 행동 제어 40% 반영해 다시 맞춤
    skills: [s1, s3, s2],
    ultimate: clone(src.ultimate),
    finaleSkill: {
      id: 'corusco_finale', name: '최종 술식 - 뇌운의 과부하 · 전력 방출', type: 'attack', element: 'lightning', anim: 'corusco_finale', cutIn: true,
      desc: '남은 마력을 모두 끌어올려 전장 전체에 낙뢰를 떨어뜨립니다. (스토리 연출)', actions: []
    }
  };
})();
