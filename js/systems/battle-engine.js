/**
 * 전투 엔진 (순수 로직 · DOM 없음)
 * ─────────────────────────────────────────────────────────────
 * 화면(battle-ui.js)은 이 엔진의 함수를 호출하고, 반환되는 이벤트 배열을 순서대로 연출만 합니다.
 *
 * 턴 = ① 아군의 모든 공격(행동 슬롯 순서) → ② 적군의 모든 공격 → ③ 턴 종료
 *       (턴 종료 시: 연소 피해 → 버프/디버프·필드 지속 턴 감소 → 대기석 회복)
 *
 * 규칙 (게임.pdf + 리버스: 1999 방식)
 *  · 편성 인원 n (1~4) → 행동 슬롯 n칸, 손패 상한 = {1:2, 2:3, 3:4, 4:6}
 *  · 출전은 최대 3명, 4번째는 대기석 (매 턴 최대 체력의 5% 회복)
 *  · 손패는 출전 중인 캐릭터의 궁극기 제외 스킬 3개 중 랜덤 (카드 등급 없음)
 *  · 카드 사용 시 열의 +1 → 5가 되면 궁극기 카드가 손패에 추가, 사용 시 열의 0
 *  · 사용한 카드는 소멸, 사용하지 않은 카드는 다음 턴에 유지
 *  · 대기석 교체는 그 턴의 행동을 모두 소모 (교체되어 빠진 캐릭터의 카드는 손패에서 사라짐)
 *  · 마력(MP): 카드마다 소모량이 있으며, 마력이 모자라면 부족분 × HP_PER_MP 만큼 체력을 소모 (체력은 1 아래로 내려가지 않음)
 *  · 궁극기에 필요한 열의는 캐릭터마다 다를 수 있음 (ultPoints, 기본 5)
 *
 * [번개] (레이 · 코루스코) — 파티가 함께 쓰는 공유 스택 (st.bolt, 화면 오른쪽 표시)
 *  · 아군이 [찌릿]을 부여한 스킬 1회마다 +1, 턴 종료 등으로 [찌릿] 피해가 발동(반응)할 때마다 적 1명당 +1
 *  · 번개 속성 아군이 스킬을 쓸 때마다, 출전 중인 레이 · 코루스코 1명당 +1 (boltLink)
 *  · 코루스코가 공격을 명중시키면 +1, [과전압 예열] 중에는 번개 속성 아군이 공격할 때마다 +2
 *  · 스킬별 수급(과충전 포격 · 체인 라이트닝 등)과 소모(예열 스킬)는 스킬 데이터에 정의
 *  · boltCost 가 있는 카드는 [번개]가 모자라면 사용되지 않고 손패에 남음
 *  · 적 진영에도 번개 캐릭터(보스 코루스코)가 있으면 적 쪽 [번개](st.eBolt)를 따로 셈 (화면 왼쪽 표시)
 *
 * [기절 · 게임 오버]
 *  · 필드의 아군이 쓰러지면 '기절' 상태로 필드에 남음 → 한 턴을 소모해 대기석(4번) 캐릭터와 교체 가능
 *  · 필드의 아군이 모두 기절하면 1번 자리 캐릭터와 대기석 캐릭터가 자동으로 교체 (턴 소모 없음)
 *  · 대기석까지 모두 기절하면 패배(게임 오버)
 *
 * [연출된 결말] stage.finale = { unit: 적 id, hpRatio }
 *  · 해당 적의 체력이 hpRatio 아래로 내려가지 않고 멈춘 뒤, 결말 공격으로 아군 전원(대기석 포함)이 쓰러지고 클리어
 */
window.G = window.G || {};

G.Battle = (function () {
  const HAND_CAP = { 1: 2, 2: 3, 3: 4, 4: 6 };
  const R = function () { return G.DATA.rules; };

  let uidSeq = 0;
  function uid(p) { return p + (++uidSeq); }

  function makeUnit(side, def, slot) {
    const c = def.combat;
    return {
      uid: uid(side === 'ally' ? 'a' : 'e'),
      side: side, defId: def.id, name: def.name, slot: slot,
      element: def.element || null,
      subElement: def.subElement || null,
      maxHp: c.hp, hp: c.hp, atk: c.atk, def: c.def, crit: c.crit || 0,
      maxMp: side === 'ally' ? (c.mp || G.DATA.rules.MP_DEFAULT) : 0,
      mp: side === 'ally' ? (c.mp || G.DATA.rules.MP_DEFAULT) : 0,
      statuses: [], moxie: 0, alive: true,
      moxieMax: side === 'ally' ? (def.ultPoints || G.DATA.rules.MOXIE_MAX) : (def.ultPoints || 0),
      intent: null, skillCursor: 0
    };
  }

  /**
   * cfg = { team: [charId|null x4], enemies: [enemyId...], seed, fixedHand: [skillId...] }
   * team 의 앞 3칸 캐릭터가 출전, 4번째 칸 캐릭터가 대기석
   */
  function create(cfg) {
    const members = cfg.team.filter(Boolean);
    if (!members.length) throw new Error('편성된 캐릭터가 없습니다.');
    const n = Math.min(4, members.length);

    const allies = [], bench = [];
    cfg.team.forEach(function (id, i) {
      if (!id) return;
      const def = G.DATA.characters[id];
      if (!def) throw new Error('알 수 없는 캐릭터: ' + id);
      if (i < 3) allies.push(makeUnit('ally', def, i));
      else bench.push(makeUnit('ally', def, i));
    });
    while (allies.length < 3 && bench.length) allies.push(bench.shift());

    const enemies = cfg.enemies.map(function (id, i) {
      const def = G.DATA.enemies[id];
      if (!def) throw new Error('알 수 없는 적: ' + id);
      return makeUnit('enemy', def, i);
    });
    const counts = {}, idx = {};
    enemies.forEach(function (e) { counts[e.name] = (counts[e.name] || 0) + 1; });
    enemies.forEach(function (e) {
      if (counts[e.name] > 1) { idx[e.name] = (idx[e.name] || 0) + 1; e.name = e.name + ' ' + String.fromCharCode(64 + idx[e.name]); }
    });

    const st = {
      finale: cfg.finale || null, finalePending: false, scriptedWin: false,
      turn: 1,
      phase: 'plan',
      actions: n,
      handCap: HAND_CAP[n],
      allies: allies, bench: bench, enemies: enemies,
      hand: [], queue: [],
      fields: [],
      targetUid: enemies[0].uid,
      rng: G.util.rng(cfg.seed || (Date.now() & 0xffffffff)),
      fixedHand: (cfg.fixedHand || []).slice(),
      ultShown: false,
      bolt: 0,
      useBolt: false,
      eBolt: 0,
      useEBolt: false
    };
    /* [번개]: 이 메커니즘을 쓰는 캐릭터가 편성되어 있으면 화면에 표시, 코루스코는 10개를 갖고 시작 */
    allies.concat(bench).forEach(function (u) {
      const d = G.DATA.characters[u.defId];
      if (d.usesBolt) st.useBolt = true;
      if (d.boltStart) st.bolt += d.boltStart;
    });
    enemies.forEach(function (u) {
      const d = G.DATA.enemies[u.defId];
      if (d.usesBolt) st.useEBolt = true;
      if (d.boltStart) st.eBolt += d.boltStart;
    });
    planEnemies(st);
    return st;
  }

  /* ── 조회 ───────────────────────────────────────────── */
  function all(st) { return st.allies.concat(st.bench, st.enemies); }
  function find(st, u) { return all(st).find(function (x) { return x.uid === u; }) || null; }
  function charDef(unit) { return unit.side === 'ally' ? G.DATA.characters[unit.defId] : G.DATA.enemies[unit.defId]; }
  function skillOf(card, st) {
    if (card.special) return G.DATA.specialSkills[card.special];
    const def = charDef(find(st, card.owner));
    if (card.ult) return def.ultimate;
    return def.skills.find(function (s) { return s.id === card.skillId; });
  }
  function livingAllies(st) { return st.allies.filter(function (u) { return u.alive; }); }
  function livingEnemies(st) { return st.enemies.filter(function (u) { return u.alive; }); }
  function getStatus(u, id) { return u.statuses.find(function (s) { return s.id === id; }) || null; }
  function hasField(st, id) { return st.fields.find(function (f) { return f.id === id; }) || null; }

  function mod(unit, key) {
    let m = 0;
    const groups = {};
    unit.statuses.forEach(function (s) {
      if (s.dormant) return;   // 예열 중(다음 턴부터 적용)
      const d = G.DATA.statuses[s.id];
      if (!d || !d.mods || !d.mods[key]) return;
      const v = d.mods[key] * (d.perStack ? s.stacks : 1);
      /* 같은 group 의 효과는 중첩되지 않고 가장 강한 것 하나만 (피해 감면 등) */
      if (d.group) { const g = groups[d.group]; groups[d.group] = g == null ? v : (Math.abs(v) > Math.abs(g) ? v : g); return; }
      m += v;
    });
    Object.keys(groups).forEach(function (g) { m += groups[g]; });
    return m;
  }
  /* 지속 피해(연소 · 찌릿 · 물방울 침식) 배율: [세포벽 정화] 등으로 감소 */
  function dotMul(u) { return Math.max(0.1, 1 + mod(u, 'dotTaken')); }
  function healMul(u) { return Math.max(0, 1 + mod(u, 'healUp')); }
  /* 효과가 실제로 적용 중인 상태 (예열 대기 중이면 null) */
  function activeStatus(u, id) { const s = getStatus(u, id); return s && !s.dormant ? s : null; }
  /* 파티(출전 + 대기)에 편성된 살아 있는 번개 속성 캐릭터 수 */
  /* 속성 판정: 메인 · 서브 속성 모두 포함 (예: 페델레 대지/번개) */
  function hasElement(u, el) { return !!u && (u.element === el || u.subElement === el); }
  function lightningCount(st, side) {
    const pool = side === 'enemy' ? st.enemies : st.allies.concat(st.bench);
    return pool.filter(function (u) { return u.alive && hasElement(u, 'lightning'); }).length;
  }
  function boltOf(st, side) { return side === 'enemy' ? st.eBolt : st.bolt; }
  function gainBolt(st, n, ev, label, side) {
    if (!n) return;
    if (side === 'enemy') { st.eBolt = Math.max(0, st.eBolt + n); ev.push({ type: 'bolt', side: 'enemy', delta: n, value: st.eBolt, label: label || '' }); return; }
    st.bolt = Math.max(0, st.bolt + n);
    ev.push({ type: 'bolt', side: 'ally', delta: n, value: st.bolt, label: label || '' });
  }
  function friendsOf(st, u) { return u.side === 'ally' ? livingAllies(st) : livingEnemies(st); }
  function foesOf(st, u) { return u.side === 'ally' ? livingEnemies(st) : livingAllies(st); }
  function effAtk(u) { return u.atk * Math.max(0.1, 1 + mod(u, 'atk')); }
  function effDef(u) { return u.def * Math.max(0, 1 + mod(u, 'def')); }

  /* ── 피해 계산 ──────────────────────────────────────────
   * 기본 = 공격력 × 배율 − 방어력 × 0.5 × (1 − 방어 무시)
   * 증가 = 화염 속성 피해 증가(과열) + 열염 지대(화염 속성 아군) + 연소 스택 보너스(궁극기)
   * 치명타 = 치명타율(기본 + 과열) 판정 시 × 1.5
   */
  function calcDamage(st, src, dst, power, skill, act) {
    const ignore = Math.min(1, mod(src, 'defIgnore'));
    const base = Math.max(1, effAtk(src) * power - effDef(dst) * 0.5 * (1 - ignore));
    let bonus = mod(src, 'dmgUp');
    if (act.synergy) bonus += Math.min(act.synergy.max, act.synergy.per * lightningCount(st, src.side));
    if (act.bonusIfTarget && getStatus(dst, act.bonusIfTarget.status)) bonus += act.bonusIfTarget.bonus;
    if (act.bonusIfSelf && getStatus(src, act.bonusIfSelf.status)) bonus += act.bonusIfSelf.bonus;
    if (skill.element === 'fire') bonus += mod(src, 'fireDmg');
    /* [비] (중간 보스): 물 속성 기술 +30% (양쪽), 아군 화염 속성 기술 −40% */
    if (hasField(st, 'rain')) {
      if (skill.element === 'water') bonus += R().RAIN_WATER;
      if (skill.element === 'fire' && src.side === 'ally') bonus += R().RAIN_FIRE;
    }
    const zone = hasField(st, 'blaze_zone');
    if (zone && src.side === 'ally' && hasElement(src, 'fire')) bonus += G.DATA.fields.blaze_zone.fireAllyBonus;
    /* [빛] 골드 속성 패시브: 블랙 속성 상대에게 주는 피해 +3% */
    if (hasElement(src, 'gold') && hasElement(dst, 'black')) bonus += R().GOLD_VS_BLACK;
    if (act.burdenBonus) {
      const bd = getStatus(dst, 'burden');
      if (bd) bonus += act.burdenBonus.per * bd.stacks;
    }
    if (act.burnBonus) {
      const b = getStatus(dst, 'burn');
      if (b) bonus += Math.min(act.burnBonus.max, act.burnBonus.per * b.stacks);
    }
    const critRate = src.crit + mod(src, 'crit') + mod(dst, 'critTaken');
    const crit = critRate > 0 && st.rng() < critRate;
    let taken = 1 + mod(dst, 'dmgTaken');
    if (skill.element === 'lightning') taken += mod(dst, 'lightningTaken');
    taken = Math.max(0.1, taken);
    const critMul = R().CRIT_DAMAGE + mod(src, 'critDmg');
    const dmg = Math.max(1, Math.round(base * (1 + bonus) * taken * (crit ? critMul : 1)));
    return { dmg: dmg, crit: crit };
  }

  /* 보호막이 먼저 피해를 흡수 */
  function applyDamage(st, unit, amount, ev, info) {
    /* [신경망 연결]: 아군이 받는 피해의 50%를 필드의 다른 아군에게 균등하게 나눔 */
    if (unit.side === 'ally' && unit.alive && !(info && (info.source === 'link' || info.finale)) && activeStatus(unit, 'neural_link')) {
      const others = st.allies.filter(function (u) { return u !== unit && u.alive; });
      if (others.length && amount > 1) {
        const share = Math.floor(amount * 0.5 / others.length);
        if (share > 0) {
          amount -= share * others.length;
          others.forEach(function (o) { applyDamage(st, o, share, ev, { source: 'link' }); });
        }
      }
    }
    /* [아드레날린] (알리제 궁극기): 받는 피해를 유예 → 턴 종료 후 50%를 지속 피해로 (사망하지 않음) */
    if (unit.side === 'ally' && unit.alive && !(info && (info.finale || info.source === 'pain')) && activeStatus(unit, 'adrenaline')) {
      unit.deferred = (unit.deferred || 0) + amount;
      ev.push(Object.assign({ type: 'damage', unit: unit.uid, amount: amount, absorbed: 0, hp: unit.hp, deferred: true, bench: st.bench.indexOf(unit) !== -1 }, info || {}));
      return;
    }
    let rest = amount, absorbed = 0;
    const sh = getStatus(unit, 'shield');
    if (sh && sh.value > 0) {
      absorbed = Math.min(sh.value, rest);
      sh.value -= absorbed;
      rest -= absorbed;
      if (sh.value <= 0) unit.statuses = unit.statuses.filter(function (s) { return s !== sh; });
    }
    unit.hp = Math.max(0, unit.hp - rest);
    /* 연출된 결말: 보스 체력이 일정 비율 아래로 내려가지 않음 → 결말 공격 대기 */
    if (st.finale && unit.side === 'enemy' && unit.defId === st.finale.unit && !st.scriptedWin) {
      const floor = Math.max(1, Math.ceil(unit.maxHp * st.finale.hpRatio));
      if (unit.hp <= floor) { unit.hp = floor; st.finalePending = true; }
    }
    ev.push(Object.assign({ type: 'damage', unit: unit.uid, amount: amount, absorbed: absorbed, hp: unit.hp, bench: st.bench.indexOf(unit) !== -1 }, info || {}));
    if (unit.hp <= 0 && unit.alive) {
      unit.alive = false; unit.statuses = [];
      ev.push({ type: 'death', unit: unit.uid });
    }
  }

  function addStatus(unit, id, turns, extra) {
    const d = G.DATA.statuses[id];
    if (!d || !unit.alive) return null;
    let s = getStatus(unit, id);
    if (s) {
      if (turns == null || s.turns == null) s.turns = null;
      else s.turns = Math.max(s.turns, turns);
    } else {
      s = { id: id, turns: turns, stacks: 0, value: 0 };
      if (d.delayed) s.dormant = true;   // 처음 부여된 턴에는 효과 없음 (다음 턴부터)
      unit.statuses.push(s);
    }
    if (d.stack) s.stacks = Math.min(d.maxStacks || Infinity, s.stacks + (extra && extra.stacks != null ? extra.stacks : 1));
    s.fresh = true;   // 이번 스킬로 받은 '다음 공격 1회' 효과는 이번 공격에서 소모하지 않음
    if (extra && extra.value != null) s.value = d.absorb ? Math.max(s.value, extra.value) : Math.max(s.value, extra.value);
    return s;
  }

  /* ── 손패 ───────────────────────────────────────────── */
  function availableSlots(st) { return st.actions; }

  /**
   * 손패 채우기
   *  ① 필드에 있는 캐릭터마다 카드가 최소 1장 (모자라면 손패가 가득 차 있어도 가장 많은 캐릭터의 카드 1장을 교체)
   *  ② 나머지는 손패에 카드가 가장 적은 캐릭터부터 골고루 (같으면 무작위) → 한 캐릭터만 몰리지 않음
   *  ③ 스킬은 그 캐릭터의 3개 중 무작위
   */
  function draw(st) {
    const ev = [];
    const owners = livingAllies(st).filter(function (u) { return !activeStatus(u, 'isolation'); });   // [고립] 중에는 카드가 나오지 않음
    if (!owners.length) return ev;
    const normalCards = function () { return st.hand.filter(function (c) { return !c.ult && !c.special; }); };
    const countOf = function (u) { return normalCards().filter(function (c) { return c.owner === u.uid; }).length; };
    /* 스킬마다 뽑힐 확률 가중치(drawWeight, 기본 1) · 손패에 동시에 있을 수 있는 장수(handLimit) */
    const randomSkill = function (u) {
      const ems = getStatus(u, 'ems');
      let list = charDef(u).skills.filter(function (k) {
        if (ems && ems.sealed === k.id) return false;   // EMS 로 봉인된 스킬은 뽑히지 않음
        if (!k.handLimit) return true;
        return st.hand.filter(function (c) { return c.owner === u.uid && c.skillId === k.id; }).length < k.handLimit;
      });
      if (!list.length) list = charDef(u).skills.slice();
      const total = list.reduce(function (a, k) { return a + (k.drawWeight == null ? 1 : k.drawWeight); }, 0);
      let r = st.rng() * total;
      for (let i = 0; i < list.length; i++) { r -= (list[i].drawWeight == null ? 1 : list[i].drawWeight); if (r < 0) return list[i].id; }
      return list[list.length - 1].id;
    };
    function insert(card) {
      const ultIdx = st.hand.findIndex(function (c) { return c.ult; });
      if (ultIdx === -1) st.hand.push(card); else st.hand.splice(ultIdx, 0, card);
      ev.push({ type: 'draw', card: card });
    }
    function leastOwner() {
      let min = Infinity, list = [];
      owners.forEach(function (u) { const n = countOf(u); if (n < min) { min = n; list = [u]; } else if (n === min) list.push(u); });
      return list[Math.floor(st.rng() * list.length)];
    }

    /* 튜토리얼 등 고정 손패 */
    while (st.fixedHand.length && normalCards().length < st.handCap) {
      const sid = st.fixedHand.shift();
      const u = owners.find(function (o) { return charDef(o).skills.some(function (k) { return k.id === sid; }); });
      if (u) insert({ uid: uid('c'), owner: u.uid, skillId: sid, ult: false });
    }

    /* ① 필드 캐릭터마다 최소 1장 */
    owners.forEach(function (u) {
      if (countOf(u) > 0) return;
      if (normalCards().length >= st.handCap) {
        /* 손패가 가득 찼으면: 가장 많은 캐릭터의 (슬롯에 올리지 않은) 카드 1장을 교체 */
        let max = 0, rich = null;
        owners.forEach(function (o) { const n = countOf(o); if (n > max) { max = n; rich = o; } });
        if (!rich || max < 2) return;
        const victim = st.hand.find(function (c) { return !c.ult && c.owner === rich.uid && st.queue.indexOf(c.uid) === -1; });
        if (!victim) return;
        const idx = st.hand.indexOf(victim);
        const card = { uid: uid('c'), owner: u.uid, skillId: randomSkill(u), ult: false };
        st.hand.splice(idx, 1, card);
        ev.push({ type: 'replace', card: card, removed: victim.uid });
        return;
      }
      insert({ uid: uid('c'), owner: u.uid, skillId: randomSkill(u), ult: false });
    });

    /* ② 나머지는 골고루 */
    while (normalCards().length < st.handCap) {
      const u = leastOwner();
      insert({ uid: uid('c'), owner: u.uid, skillId: randomSkill(u), ult: false });
    }
    /* ②-1 [고립]이 끝난 캐릭터: 열의가 가득이면 궁극기 카드 다시 지급 */
    owners.forEach(function (u) {
      if (u.moxie >= (u.moxieMax || R().MOXIE_MAX) && !st.hand.some(function (c) { return c.ult && c.owner === u.uid; })) {
        const card = { uid: uid('c'), owner: u.uid, skillId: charDef(u).ultimate.id, ult: true };
        st.hand.push(card);
        ev.push({ type: 'ult', card: card, first: false });
      }
    });
    /* ③ [마력 분배]: 골드 속성 캐릭터에게 낮은 확률로 생성 · 손패 맨 앞에 고정 · 손패 칸을 차지하지 않음 */
    owners.forEach(function (u) {
      if (!hasElement(u, 'gold')) return;
      if (st.hand.some(function (c) { return c.special === 'light_share' && c.owner === u.uid; })) return;
      if (st.rng() >= R().LIGHT_SHARE_CHANCE) return;
      const card = { uid: uid('c'), owner: u.uid, skillId: 'light_share', special: 'light_share', ult: false };
      st.hand.unshift(card);
      ev.push({ type: 'draw', card: card });
    });
    return ev;
  }

  function gainMoxie(st, unit, n) {
    const ev = [];
    const max = unit.moxieMax || R().MOXIE_MAX;
    if (!unit || !unit.alive || unit.moxie >= max) return ev;
    unit.moxie = Math.min(max, unit.moxie + n);
    ev.push({ type: 'moxie', unit: unit.uid, value: unit.moxie });
    if (unit.moxie >= max && !st.hand.some(function (c) { return c.ult && c.owner === unit.uid; })
        && st.allies.indexOf(unit) !== -1 && !activeStatus(unit, 'isolation')) {
      const card = { uid: uid('c'), owner: unit.uid, skillId: charDef(unit).ultimate.id, ult: true };
      st.hand.push(card);
      ev.push({ type: 'ult', card: card, first: !st.ultShown });
      st.ultShown = true;
    }
    return ev;
  }

  /* ── 계획 단계 (행동 슬롯) ──────────────────────────── */
  function queue(st, cardUid) {
    if (st.phase !== 'plan') return false;
    if (st.queue.length >= availableSlots(st)) return false;
    const card = st.hand.find(function (c) { return c.uid === cardUid; });
    if (!card || card.special || st.queue.indexOf(cardUid) !== -1) return false;
    st.queue.push(cardUid);
    return true;
  }
  function unqueue(st, index) {
    if (st.phase !== 'plan') return false;
    if (index < 0 || index >= st.queue.length) return false;
    st.queue.splice(index, 1);
    return true;
  }
  function isQueued(st, cardUid) { return st.queue.indexOf(cardUid) !== -1; }
  function queueFull(st) { return st.queue.length >= availableSlots(st); }

  function setTarget(st, enemyUid) {
    const e = find(st, enemyUid);
    if (!e || e.side !== 'enemy' || !e.alive) return false;
    st.targetUid = enemyUid;
    return true;
  }
  function currentTarget(st) {
    const t = find(st, st.targetUid);
    if (t && t.alive) return t;
    const alive = livingEnemies(st);
    if (alive.length) st.targetUid = alive[0].uid;
    return alive[0] || null;
  }

  /* ── 스킬 실행 ──────────────────────────────────────── */
  function pickTargets(st, actor, kind, hint) {
    const foes = actor.side === 'ally' ? livingEnemies(st) : livingAllies(st);
    if (!foes.length) return [];
    const first = hint && hint.alive && foes.indexOf(hint) !== -1 ? hint : foes[0];
    if (kind === 'all') return foes;
    if (kind === 'two') {
      if (foes.length === 1) return [first];
      const i = foes.indexOf(first);
      return [first, foes[(i + 1) % foes.length]];
    }
    return [first];
  }

  /* 예열 상태에 따라 바뀌는 타격 범위 · 계수 */
  function dmgSpec(st, actor, act) {
    let target = act.target, power = act.power;
    if (act.primed && activeStatus(actor, act.primed.status)) {
      if (act.primed.target) target = act.primed.target;
      if (act.primed.power != null) power = act.primed.power;
    }
    if (act.boltPower) power += act.boltPower * boltOf(st, actor.side);
    return { target: target, power: power };
  }

  /* [찌릿] 지속 피해 1회 발동 (턴 종료 · 뇌운 지대) — 반응할 때마다 [번개] +1 */
  function zapTick(st, u, ev, label) {
    const z = getStatus(u, 'zap');
    if (!z || !z.stacks || !u.alive) return false;
    const amt = Math.max(1, Math.round(z.stacks * z.value * Math.max(0.1, 1 + mod(u, 'lightningTaken')) * dotMul(u)));
    applyDamage(st, u, amt, ev, { source: 'zap' });
    return true;
  }

  /* 적의 일반 스킬 중 봉인되지 않은 것 (없으면 null) */
  function pickEnemySkill(st, e) {
    const def = charDef(e);
    const sealed = getStatus(e, 'ems');
    const n = def.skills.length;
    for (let k = 0; k < n; k++) {
      const sk = def.skills[((e.normalIdx || 0) + k) % n];
      if (sealed && sealed.sealed === sk.id) continue;
      if (sk.boltCost && st.eBolt < sk.boltCost) continue;   // 적 [번개]가 모자란 예열 스킬은 건너뜀
      return sk;
    }
    return null;
  }

  function applySkill(st, actor, skill, hint) {
    const ev = [];
    const friends = friendsOf(st, actor);
    const side = actor.side;
    const foes = function () { return foesOf(st, actor); };

    /* 연출용으로 대상을 미리 계산 */
    let hit = [];
    const dmgAct = skill.actions.find(function (a) { return a.do === 'damage' || a.do === 'detonate'; });
    if (dmgAct) hit = pickTargets(st, actor, dmgSpec(st, actor, dmgAct).target, hint);
    else if (skill.actions.some(function (a) { return a.to === 'target'; })) hit = pickTargets(st, actor, 'single', hint);
    const castTargets = hit.length ? hit : (skill.actions.some(function (a) { return a.to === 'allies'; }) ? friends : [actor]);
    ev.push({ type: 'cast', actor: actor.uid, skill: skill, targets: castTargets.map(function (t) { return t.uid; }),
      allies: friends.map(function (t) { return t.uid; }) });

    /* 스킬 시작 시점에 [찌릿] 상태였던 대상 (전하 플러그 조건) */
    /* 스킬 시작 시점에 대상이 가지고 있던 상태 (ifTarget 조건: 전하 플러그 · 중력 파열) */
    const hadStatus = {};
    hit.forEach(function (t) { hadStatus[t.uid] = t.statuses.map(function (x) { return x.id; }); });

    let attacked = false, landed = 0, zapApplied = false, resetBolt = false, maxDetonated = 0;
    /* 한 대상에게 한 번 타격 (회피 · 물의 분신 판정 포함). 맞으면 true */
    function dealHit(t, power, act) {
      if (!t.alive) return false;
      const ev2 = mod(t, 'evade');
      if (ev2 > 0 && st.rng() < ev2) { ev.push({ type: 'miss', unit: t.uid }); return false; }
      const clone = getStatus(t, 'water_clone');
      if (clone) {
        t.statuses = t.statuses.filter(function (x) { return x !== clone; });
        ev.push({ type: 'miss', unit: t.uid, decoy: true });
        return false;
      }
      const r = calcDamage(st, actor, t, power, skill, act);
      applyDamage(st, t, r.dmg, ev, { crit: r.crit, source: 'skill', from: actor.uid });
      landed++;
      return true;
    }
    const hadCloud = !!hasField(st, 'thundercloud');   // 이번 스킬로 만든 뇌운 지대는 이번 스킬에 반응하지 않음
    const missed = function (r) { return ev.some(function (x) { return x.type === 'miss' && x.unit === r.uid; }); };
    skill.actions.forEach(function (act) {
      if (act.ifSelf && !activeStatus(actor, act.ifSelf) && act.do !== 'zapAmp') return;
      if (act.do === 'damage') {
        const spec = dmgSpec(st, actor, act);
        hit.forEach(function (t) { dealHit(t, spec.power, act); });
        attacked = true;
      } else if (act.do === 'detonate') {
        /* 산소 폭발: 대상의 [연소]를 모두 소모해 스택 수에 따라 기하급수적으로 증폭 */
        hit.forEach(function (t) {
          if (!t.alive) return;
          const b = getStatus(t, 'burn');
          const n = b ? b.stacks : 0;
          /* 스택 수에 따라 기하급수적으로 증가 (상한 없음): 기본 + quad × n² (n이 knee를 넘으면 그 뒤로는 직선) */
          const k = act.knee || Infinity;
          const nq = Math.min(n, k);
          const power = act.base + act.quad * nq * nq + (n > k ? 2 * act.quad * k * (n - k) : 0);
          if (dealHit(t, power, act) && b) {
            t.statuses = t.statuses.filter(function (x) { return x !== b; });
            ev.push({ type: 'cleanse', unit: t.uid, status: 'burn', consumed: true });
            if (n > maxDetonated) maxDetonated = n;
          }
        });
        attacked = true;
        /* 산소 과열: 3스택 이상을 기폭하면 이 스킬 마력의 80% 환급 */
        if (act.refund && maxDetonated >= act.refund.minStacks && actor.maxMp && skill.mp) {
          const before = actor.mp;
          actor.mp = Math.min(actor.maxMp, actor.mp + Math.round(skill.mp * act.refund.ratio));
          ev.push({ type: 'mpGain', unit: actor.uid, amount: actor.mp - before, mp: actor.mp, label: '산소 과열' });
        }
      } else if (act.do === 'burnTransfer') {
        /* 돌풍 난타: 다른 [연소] 적의 스택 1개를 대상에게 복사 */
        hit.forEach(function (t) {
          if (!t.alive || missed(t)) return;
          const src = foes().filter(function (e) { return e !== t && getStatus(e, 'burn'); })
            .sort(function (a, b) { return getStatus(b, 'burn').stacks - getStatus(a, 'burn').stacks; })[0];
          if (!src) return;
          const s2 = addStatus(t, 'burn', getStatus(src, 'burn').turns || 2, { stacks: 1, value: getStatus(src, 'burn').value });
          if (s2) ev.push({ type: 'status', unit: t.uid, status: 'burn', stacks: s2.stacks, label: '불꽃 전이' });
        });
      } else if (act.do === 'burnSpread') {
        /* 넉백 시 불꽃이 튐: 대상이 [연소]면 다른 적 N명에게 [연소] 확산 */
        hit.forEach(function (t) {
          const b = getStatus(t, 'burn');
          if (!b) return;
          foes().filter(function (e) { return e !== t; }).slice(0, act.count || 2).forEach(function (e) {
            const s2 = addStatus(e, 'burn', b.turns || 2, { stacks: act.stacks || 1, value: b.value });
            if (s2) ev.push({ type: 'status', unit: e.uid, status: 'burn', stacks: s2.stacks });
          });
        });
      } else if (act.do === 'burnMax') {
        /* 화염 태풍의 가두리: [연소]를 최대치로 */
        hit.forEach(function (t) {
          if (!t.alive) return;
          const cur = getStatus(t, 'burn');
          const need = Math.max(0, act.stacks - (cur ? cur.stacks : 0));   // 최소 act.stacks 까지 채움 (이미 더 많으면 그대로)
          const s2 = addStatus(t, 'burn', act.turns, { stacks: need, value: effAtk(actor) * R().BURN_PER_STACK });
          if (s2) ev.push({ type: 'status', unit: t.uid, status: 'burn', stacks: s2.stacks });
        });
      } else if (act.do === 'status') {
        const recips = act.to === 'self' ? [actor] : act.to === 'allies' ? friends : hit;
        recips.forEach(function (r) {
          if (!r.alive) return;
          if (act.to !== 'self' && act.to !== 'allies' && missed(r)) return;
          if (act.ifTarget && (hadStatus[r.uid] || []).indexOf(act.ifTarget) === -1) return;
          const extra = {};
          if (act.status === 'burn') { extra.stacks = act.stacks || 1; extra.value = effAtk(actor) * R().BURN_PER_STACK; }
          if (act.status === 'drip') extra.value = effAtk(actor) * R().DRIP_RATIO;
          if (act.status === 'zap') { extra.stacks = act.stacks || 1; extra.value = effAtk(actor) * R().ZAP_PER_STACK; zapApplied = true; }
          const s = addStatus(r, act.status, act.turns, extra);
          if (s && act.extend && s.turns != null) s.turns += act.extend;   // 지속 시간 연장 (화염 탄환)
          if (s) ev.push({ type: 'status', unit: r.uid, status: act.status, stacks: s.stacks, dormant: !!s.dormant });
        });
      } else if (act.do === 'shield') {
        const amount = Math.round((act.base === 'maxHp' ? actor.maxHp : effAtk(actor)) * act.ratio);
        const recips = act.to === 'self' ? [actor] : act.to === 'randomAlly' ? [friends[Math.floor(st.rng() * friends.length)]].filter(Boolean) : friends;
        recips.forEach(function (r) {
          if (!r.alive) return;
          addStatus(r, 'shield', act.turns, { value: amount });
          ev.push({ type: 'shield', unit: r.uid, amount: amount });
        });
      } else if (act.do === 'heal') {
        const amt = Math.round((act.base === 'maxHp' ? actor.maxHp : effAtk(actor)) * act.ratio * healMul(actor));
        friends.forEach(function (r) {
          if (!r.alive) return;
          const before = r.hp;
          r.hp = Math.min(r.maxHp, r.hp + amt);
          ev.push({ type: 'heal', unit: r.uid, amount: r.hp - before, hp: r.hp });
        });
      } else if (act.do === 'cleanse') {
        friends.forEach(function (r) {
          let n = act.all ? Infinity : (act.count || 1);
          r.statuses = r.statuses.filter(function (x) {
            const d = G.DATA.statuses[x.id];
            if (n > 0 && d && d.kind === 'debuff') { n--; ev.push({ type: 'cleanse', unit: r.uid, status: x.id }); return false; }
            return true;
          });
        });
      } else if (act.do === 'mp') {
        const recips = act.to === 'allies' ? friends : act.to === 'others' ? friends.filter(function (r) { return r !== actor; }) : [actor];
        recips.forEach(function (r) {
          if (!r.alive || !r.maxMp) return;
          const before = r.mp;
          r.mp = Math.min(r.maxMp, r.mp + (act.pct ? Math.round(r.maxMp * act.pct) : act.amount));
          ev.push({ type: 'mpGain', unit: r.uid, amount: r.mp - before, mp: r.mp });
        });
      } else if (act.do === 'debuffTick') {
        /* 아군 전체 디버프 지속 시간 −1 (0이 되면 해제) */
        friends.forEach(function (r) {
          const before = r.statuses.length;
          r.statuses = r.statuses.filter(function (x) {
            const d = G.DATA.statuses[x.id];
            if (!d || d.kind !== 'debuff' || x.turns == null) return true;
            x.turns -= act.amount || 1;
            if (x.turns <= 0) { ev.push({ type: 'cleanse', unit: r.uid, status: x.id }); return false; }
            return true;
          });
          ev.push({ type: 'statusTick', unit: r.uid });
          void before;
        });
      } else if (act.do === 'removeStatus') {
        friends.forEach(function (r) { r.statuses = r.statuses.filter(function (x) { return act.ids.indexOf(x.id) === -1; }); });
      } else if (act.do === 'field') {
        const f = G.DATA.fields[act.field];
        const ex = hasField(st, act.field);
        const tick = f.enemyTickRatio ? Math.round(effAtk(actor) * f.enemyTickRatio) : 0;
        if (ex) { ex.turns = Math.max(ex.turns, act.turns); ex.tick = Math.max(ex.tick, tick); }
        else st.fields.push({ id: act.field, turns: act.turns, owner: actor.uid, tick: tick, side: actor.side });
        ev.push({ type: 'field', field: act.field, turns: act.turns });
      } else if (act.do === 'bolt') {
        /* [번개] 수급 */
        let n = act.amount || 0;
        if (act.perLightning) n += act.perLightning * lightningCount(st, side);
        if (act.perZapped) n += act.perZapped * foes().filter(function (e) { return getStatus(e, 'zap'); }).length;
        if (act.perTargetZap) hit.forEach(function (t) { const z = getStatus(t, 'zap'); if (z && t.alive) n += act.perTargetZap * z.stacks; });
        gainBolt(st, n, ev, skill.name, side);
      } else if (act.do === 'boltReset') {
        resetBolt = true;   // 스킬의 모든 효과가 끝난 뒤 초기화
      } else if (act.do === 'zapAmp') {
        /* 뇌신 붕괴포: 과전류 예열이면 [찌릿] 2배, 아니면 [찌릿] 소모 */
        const amp = !!activeStatus(actor, act.ifSelf);
        hit.forEach(function (t) {
          const z = getStatus(t, 'zap');
          if (!z || !t.alive) return;
          if (amp) {
            z.stacks = Math.min(R().ZAP_MAX, z.stacks * 2);
            ev.push({ type: 'status', unit: t.uid, status: 'zap', stacks: z.stacks, amp: true });
          } else {
            t.statuses = t.statuses.filter(function (x) { return x !== z; });
            ev.push({ type: 'cleanse', unit: t.uid, status: 'zap', consumed: true });
          }
        });
      } else if (act.do === 'seal') {
        /* EMS: 일반 스킬 1개를 무작위로 봉인 */
        hit.forEach(function (t) {
          if (!t.alive || missed(t)) return;
          const def = charDef(t);
          const sk = def.skills[Math.floor(st.rng() * def.skills.length)];
          const s = addStatus(t, 'ems', act.turns);
          if (!s) return;
          s.sealed = sk.id; s.sealedName = sk.name;
          ev.push({ type: 'status', unit: t.uid, status: 'ems', stacks: 0, sealed: sk.name });
          if (t.side === 'enemy' && t.intent && !t.intentUlt && t.intent.id === sk.id) { t.intent = pickEnemySkill(st, t); ev.push({ type: 'statusTick', unit: t.uid }); }
          /* 아군이 봉인되면: 그 스킬 카드는 손패에서 사용 불가 표시 (봉인이 풀릴 때까지) */
          if (t.side === 'ally') ev.push({ type: 'handSync' });
        });
      }
    });

    /* [빛] 골드 속성: 공격 스킬을 쓸 때마다 마력을 조금 흡수 */
    if (side === 'ally' && attacked && hasElement(actor, 'gold') && actor.maxMp && actor.mp < actor.maxMp) {
      const before = actor.mp;
      actor.mp = Math.min(actor.maxMp, actor.mp + R().GOLD_MP_ON_ATTACK);
      ev.push({ type: 'mpGain', unit: actor.uid, amount: actor.mp - before, mp: actor.mp });
    }
    /* [고립]: 그 캐릭터의 카드는 손패에서 사라지고(궁극기 포함), 고립이 끝날 때까지 뽑히지 않음 */
    if (side === 'ally' && activeStatus(actor, 'isolation')) {
      const gone = st.hand.filter(function (c) { return c.owner === actor.uid; }).map(function (c) { return c.uid; });
      if (gone.length) {
        st.hand = st.hand.filter(function (c) { return gone.indexOf(c.uid) === -1; });
        st.queue = st.queue.filter(function (q) { return gone.indexOf(q) === -1; });
        ev.push({ type: 'handSync' });
      }
    }
    /* [번개] 수급 · 번개 연계 (아군 · 적 진영 각자의 [번개]) */
    if (side === 'ally' ? st.useBolt : st.useEBolt) {
      const def = charDef(actor);
      if (zapApplied) gainBolt(st, 1, ev, '찌릿', side);
      /* 번개 속성 캐릭터의 스킬 → 같은 진영 필드의 레이 · 코루스코 1명당 +1 */
      if (hasElement(actor, 'lightning')) {
        const links = friendsOf(st, actor).filter(function (u) { return charDef(u).boltLink; }).length;
        gainBolt(st, links, ev, '연계', side);
      }
      if (attacked && landed) {
        if (def.boltOnHit) gainBolt(st, def.boltOnHit, ev, '명중', side);
        if (hasElement(actor, 'lightning')) {
          /* 과전압 예열: 번개 속성 캐릭터가 공격할 때마다 +2 */
          if (friendsOf(st, actor).some(function (u) { return activeStatus(u, 'overvolt'); })) gainBolt(st, 2, ev, '과전압', side);
          /* 뇌운 지대: 상대 전체의 [찌릿] 피해 즉시 1회 추가 발동 */
          const cloud = hasField(st, 'thundercloud');
          if (hadCloud && cloud && (cloud.side || 'ally') === side) {
            let n = 0;
            foes().forEach(function (e) { if (zapTick(st, e, ev)) n++; });
            gainBolt(st, n, ev, '뇌운', side);
          }
        }
        /* 과전류 예열: 공격 명중 시 상대 전체에 [찌릿] 3스택 */
        if (activeStatus(actor, 'overcurrent') && skill.actions.indexOf(dmgAct) !== -1) {
          let any = false;
          foes().forEach(function (e) {
            const s2 = addStatus(e, 'zap', 2, { stacks: 3, value: effAtk(actor) * R().ZAP_PER_STACK });
            if (s2) { any = true; ev.push({ type: 'status', unit: e.uid, status: 'zap', stacks: s2.stacks }); }
          });
          if (any) gainBolt(st, 1, ev, '찌릿', side);
        }
      }
      if (resetBolt && boltOf(st, side)) gainBolt(st, -boltOf(st, side), ev, '초기화', side);
    }
    if (side === 'ally' && skill.holdOtherAttacks) actor.chargeTurn = st.turn;

    /* 방어 무시 등 '다음 공격 1회' 효과는 공격 후 소모 (이번 스킬로 새로 받은 것은 유지) */
    if (attacked) {
      const before = actor.statuses.length;
      actor.statuses = actor.statuses.filter(function (s) {
        const d = G.DATA.statuses[s.id];
        return !(d && d.consumeOnAttack && !s.fresh);
      });
      if (actor.statuses.length !== before) ev.push({ type: 'statusTick', unit: actor.uid });
    }
    actor.statuses.forEach(function (s) { delete s.fresh; });
    return ev;
  }

  /* 마력 소모: 모자라면 부족분 × HP_PER_MP 만큼 체력 소모 (체력은 1 아래로 내려가지 않음) */
  function payMp(unit, cost) {
    if (!cost || !unit.maxMp) return [];
    const fromMp = Math.min(unit.mp, cost);
    unit.mp -= fromMp;
    const short = cost - fromMp;
    let hpLoss = 0;
    if (short > 0) {
      hpLoss = Math.min(unit.hp - 1, short * R().HP_PER_MP);
      unit.hp -= hpLoss;
    }
    return [{ type: 'mpPay', unit: unit.uid, mp: unit.mp, spent: fromMp, hpLoss: hpLoss, hp: unit.hp }];
  }

  /* 계획 단계에서 카드별 예상 비용 (앞 슬롯에 같은 캐릭터 카드가 있으면 그만큼 마력이 줄어든 것으로 계산) */
  function projectedCost(st, cardUid) {
    const card = st.hand.find(function (c) { return c.uid === cardUid; });
    if (!card) return null;
    const owner = find(st, card.owner);
    const skill = skillOf(card, st);
    const cost = skill.mp || 0;
    let mp = owner.mp;
    const qi = st.queue.indexOf(cardUid);
    const upto = qi === -1 ? st.queue.length : qi;
    for (let i = 0; i < upto; i++) {
      const c = st.hand.find(function (x) { return x.uid === st.queue[i]; });
      if (c && c.owner === card.owner) mp -= (skillOf(c, st).mp || 0);
    }
    mp = Math.max(0, mp);
    return { cost: cost, mp: mp, short: Math.max(0, cost - mp), hpCost: Math.max(0, cost - mp) * R().HP_PER_MP };
  }

  /* 슬롯 1개 실행: 큐 맨 앞 카드를 사용 */
  function resolveNext(st) {
    const ev = [];
    if (!st.queue.length) return null;
    const cardUid = st.queue.shift();
    const ci = st.hand.findIndex(function (c) { return c.uid === cardUid; });
    if (ci === -1) return ev;
    const card = st.hand[ci];
    const actor = find(st, card.owner);
    const skill = skillOf(card, st);
    /* 사용할 수 없는 카드는 손패에 그대로 남김 ([번개] 부족 · 예열에 전념하는 턴) */
    if (actor && actor.alive && st.allies.indexOf(actor) !== -1) {
      let reason = '';
      const ems = getStatus(actor, 'ems');
      if (!card.ult && ems && ems.sealed === skill.id) reason = 'EMS 봉인';
      else if (activeStatus(actor, 'isolation')) reason = '고립';   // 신경망 연결 후 스킬 사용 불가
      else if (skill.boltCost && st.bolt < skill.boltCost) reason = '번개 부족';
      else if (actor.chargeTurn === st.turn && skill.type === 'attack') reason = '예열 중';
      if (reason) { ev.push({ type: 'hold', card: card, unit: actor.uid, reason: reason }); return ev; }
    }
    st.hand.splice(ci, 1);
    ev.push({ type: 'consume', card: card });
    if (!actor || !actor.alive || st.allies.indexOf(actor) === -1) { ev.push({ type: 'fizzle', card: card }); return ev; }
    ev.push.apply(ev, payMp(actor, skill.mp || 0));
    if (skill.boltCost) gainBolt(st, -skill.boltCost, ev, skill.name);
    ev.push.apply(ev, applySkill(st, actor, skill, currentTarget(st)));
    if (card.ult) { actor.moxie = 0; ev.push({ type: 'moxie', unit: actor.uid, value: 0 }); }
    else ev.push.apply(ev, gainMoxie(st, actor, 1));
    ev.push.apply(ev, cleanupDead(st));
    return ev;
  }

  /* 턴 시작(아군 행동 전): [마력 분배] 카드 자동 사용 — 자신의 마력을 필드 아군 전체에 균등하게 나눔 */
  function resolveSpecials(st) {
    const ev = [];
    const cards = st.hand.filter(function (c) { return c.special === 'light_share'; });
    cards.forEach(function (card) {
      st.hand = st.hand.filter(function (c) { return c !== card; });
      const actor = find(st, card.owner);
      ev.push({ type: 'consume', card: card });
      if (!actor || !actor.alive || st.allies.indexOf(actor) === -1) return;
      const sk = G.DATA.specialSkills.light_share;
      const team = livingAllies(st);
      ev.push({ type: 'cast', actor: actor.uid, skill: sk, targets: team.map(function (t) { return t.uid; }), allies: team.map(function (t) { return t.uid; }) });
      const pool = actor.mp;
      actor.mp = 0;
      ev.push({ type: 'mpPay', unit: actor.uid, mp: 0, spent: pool, hpLoss: 0, hp: actor.hp });
      const each = Math.floor(pool / team.length);
      let rest = pool - each * team.length;
      team.forEach(function (t) {
        if (!t.maxMp) return;
        const before = t.mp;
        t.mp = Math.min(t.maxMp, t.mp + each);
        ev.push({ type: 'mpGain', unit: t.uid, amount: t.mp - before, mp: t.mp });
        rest += each - (t.mp - before);   // 가득 찬 아군의 남는 몫
      });
      if (rest > 0) { actor.mp = Math.min(actor.maxMp, actor.mp + rest); }
    });
    return ev;
  }

  /* 기절한 아군의 카드 제거 (+ 필드 전원 기절 시 대기석 자동 투입) */
  function cleanupDead(st) {
    const ev = [];
    const deadOwners = st.allies.filter(function (u) { return !u.alive; }).map(function (u) { return u.uid; });
    if (deadOwners.length) {
      const before = st.hand.length;
      st.hand = st.hand.filter(function (c) { return deadOwners.indexOf(c.owner) === -1; });
      st.queue = st.queue.filter(function (q) { return st.hand.some(function (c) { return c.uid === q; }); });
      if (st.hand.length !== before) ev.push({ type: 'handSync' });
    }
    /* 기절한 아군은 필드에 남음. 필드의 아군이 모두 기절하면 1번 자리 ↔ 대기석 자동 교체 (턴 소모 없음) */
    if (st.allies.length && !st.allies.some(function (u) { return u.alive; }) && !st.scriptedWin) {
      const sub = st.bench.findIndex(function (b) { return b.alive; });
      if (sub !== -1) {
        const out = st.allies[0], b = st.bench[sub];
        b.slot = out.slot;
        st.allies[0] = b;
        st.bench[sub] = out;
        ev.push({ type: 'enter', unit: b.uid, replaced: out.uid, auto: true });
      }
    }
    return ev;
  }

  /* ── 대기석 교체 (그 턴 소모) ───────────────────────── */
  function canSwap(st) { return st.phase === 'plan' && st.bench.some(function (b) { return b.alive; }); }
  function swap(st, fieldUid) {
    if (!canSwap(st)) return null;
    const fi = st.allies.findIndex(function (u) { return u.uid === fieldUid; });
    const bi = st.bench.findIndex(function (b) { return b.alive; });
    if (fi === -1 || bi === -1) return null;   // 기절한 캐릭터도 교체 가능
    const out = st.allies[fi], inn = st.bench[bi];
    st.queue = [];
    st.hand = st.hand.filter(function (c) { return c.owner !== out.uid; });
    inn.slot = out.slot;
    st.allies[fi] = inn;
    st.bench[bi] = out;
    return [{ type: 'swap', out: out.uid, in: inn.uid }, { type: 'handSync' }];
  }

  /* ── 적 ─────────────────────────────────────────────── */
  /* 적 행동 예고: 일반 스킬을 순서대로 쓰다가 ultEvery 번째 행동마다 궁극기 */
  function planEnemies(st) {
    livingEnemies(st).forEach(function (e) {
      const def = charDef(e);
      const nth = (e.actCount || 0) + 1;
      const ultReady = def.ultimate && (def.ultPoints ? e.moxie >= def.ultPoints : (def.ultEvery && nth % def.ultEvery === 0));
      if (ultReady) { e.intent = def.ultimate; e.intentUlt = true; }
      else { e.intent = pickEnemySkill(st, e); e.intentUlt = false; }   // EMS 로 봉인된 스킬은 건너뜀 (모두 봉인이면 행동 불가)
    });
  }
  /* 적 행동 순서: [속박] · [감속] 상태인 적은 뒤로 */
  function enemyActions(st) {
    const late = function (e) { return getStatus(e, 'bind') ? 2 : getStatus(e, 'slow') ? 1 : 0; };
    return livingEnemies(st).slice().sort(function (a, b) { return late(a) - late(b); }).map(function (e) { return e.uid; });
  }
  function resolveEnemy(st, enemyUid) {
    const e = find(st, enemyUid);
    if (!e || !e.alive) return [];
    const ev = [];
    /* 열염 지대: 적이 행동할 때마다 지속 피해 */
    const zone = hasField(st, 'blaze_zone');
    if (zone) {
      applyDamage(st, e, zone.tick, ev, { source: 'zone' });
      if (!e.alive) return ev;
    }
    const foes = livingAllies(st);
    if (!foes.length) return ev;
    /* 행동 제어(중력 파열): 이번 턴 행동 불가 */
    if (activeStatus(e, 'stun')) { ev.push({ type: 'stunSkip', unit: e.uid }); return ev; }
    let sk = e.intent;
    if (sk && !e.intentUlt && sk.boltCost && st.eBolt < sk.boltCost) sk = pickEnemySkill(st, e);   // 예고 후 [번개]가 줄었으면 다른 스킬
    if (!sk) { ev.push({ type: 'sealedSkip', unit: e.uid }); return ev; }   // 쓸 수 있는 스킬이 모두 봉인됨
    e.actCount = (e.actCount || 0) + 1;
    const wasUlt = e.intentUlt && sk === charDef(e).ultimate;
    if (!wasUlt) e.normalIdx = (charDef(e).skills.indexOf(sk) + 1);
    if (sk.boltCost) gainBolt(st, -sk.boltCost, ev, sk.name, 'enemy');
    const target = foes[Math.floor(st.rng() * foes.length)];
    ev.push.apply(ev, applySkill(st, e, sk, target));
    /* 궁극기 포인트가 있는 적: 행동마다 +1, 궁극기 사용 시 0 */
    if (e.moxieMax) {
      e.moxie = wasUlt ? 0 : Math.min(e.moxieMax, e.moxie + 1);
      ev.push({ type: 'moxie', unit: e.uid, value: e.moxie });
    }
    ev.push.apply(ev, cleanupDead(st));
    return ev;
  }

  /* ── 턴 종료 ────────────────────────────────────────── */
  /* [잔불의 후폭풍] (알리제 패시브): 모든 행동이 끝난 뒤, 조건을 만족하면 자동 추가공격 */
  function afterburnChase(st, ev) {
    const alize = st.allies.find(function (u) { return u.alive && charDef(u).passive === 'afterburn'; });
    if (!alize) return;
    const P = charDef(alize).passiveData;
    const stacks = function (e) { const b = getStatus(e, 'burn'); return b ? b.stacks : 0; };
    const foes0 = livingEnemies(st);
    const total = foes0.reduce(function (n, e) { return n + stacks(e); }, 0);
    /* 발동: 전장의 [연소] 합계 8스택 이상, 또는 [연소] 5스택 이상인 적이 있을 때 */
    if (!(total >= P.fieldTotal || foes0.some(function (e) { return stacks(e) >= P.fullStacks; }))) return;
    const pick = function () {
      return livingEnemies(st).filter(function (e) { return stacks(e) >= P.minStacks; }).sort(function (a, b) { return stacks(b) - stacks(a); })[0];
    };
    const first = pick();
    if (!first) return;
    /* 추가공격 횟수: 대상 [연소] 10스택 이상 → 1~3회, 5스택 이상 → 1~2회, 그 외 1회 (무작위) */
    const s0 = stacks(first);
    const maxHits = s0 >= 10 ? 3 : s0 >= P.fullStacks ? 2 : 1;
    const hits = 1 + Math.floor(st.rng() * maxHits);
    const sk = P.skill;
    for (let h = 0; h < hits; h++) {
      const t = pick();
      if (!t || !alize.alive) break;
      const full = stacks(t) >= P.fullStacks;
      const others = livingEnemies(st).filter(function (e) { return e !== t; }).slice(0, 2);
      ev.push({ type: 'cast', actor: alize.uid, skill: sk, targets: [t.uid].concat(full ? others.map(function (e) { return e.uid; }) : []), allies: [], passive: true, hit: h + 1, hits: hits });
      const r = calcDamage(st, alize, t, full ? P.fullPower : P.power, sk, {});
      applyDamage(st, t, r.dmg, ev, { crit: r.crit, source: 'skill', from: alize.uid });
      const b = getStatus(t, 'burn');
      if (t.alive && b) { b.stacks += 1; ev.push({ type: 'status', unit: t.uid, status: 'burn', stacks: b.stacks }); }
      if (full) others.forEach(function (e) {
        if (!e.alive) return;
        const r2 = calcDamage(st, alize, e, P.splash, sk, {});
        applyDamage(st, e, r2.dmg, ev, { crit: r2.crit, source: 'skill', from: alize.uid });
      });
    }
  }

  function endTurn(st) {
    const ev = [];
    afterburnChase(st, ev);
    /* 아드레날린 패널티: 유예된 피해의 50%를 2턴에 걸쳐 지속 피해로 (HP 1 아래로는 내려가지 않음) */
    st.allies.concat(st.bench).forEach(function (u) {
      if (!u.alive || !u.deferred) return;
      const total = Math.round(u.deferred * 0.5);
      u.deferred = 0;
      u.statuses = u.statuses.filter(function (x) { return x.id !== 'adrenaline'; });
      if (total > 0) { const s2 = addStatus(u, 'aftershock', 2, { value: Math.ceil(total / 2) }); if (s2) ev.push({ type: 'status', unit: u.uid, status: 'aftershock', stacks: 0 }); }
    });
    st.allies.concat(st.bench).forEach(function (u) {
      const a = getStatus(u, 'aftershock');
      if (!u.alive || !a || !a.value) return;
      const dmg = Math.min(a.value, u.hp - 1);
      if (dmg > 0) { u.hp -= dmg; ev.push({ type: 'damage', unit: u.uid, amount: dmg, absorbed: 0, hp: u.hp, source: 'pain', bench: st.bench.indexOf(u) !== -1 }); }
    });
    /* ⓪ 세계수의 영역: 턴 종료 시 아군 체력 30% 회복 */
    const tree = hasField(st, 'world_tree');
    if (tree) {
      st.allies.forEach(function (u) {
        if (!u.alive || u.hp >= u.maxHp) return;
        const prev = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * G.DATA.fields.world_tree.healRatio));
        ev.push({ type: 'heal', unit: u.uid, amount: u.hp - prev, hp: u.hp });
      });
    }
    /* ① 연소 피해 */
    all(st).forEach(function (u) {
      if (!u.alive) return;
      const b = getStatus(u, 'burn');
      if (b && b.stacks > 0) applyDamage(st, u, Math.max(1, Math.round(b.stacks * b.value * dotMul(u))), ev, { source: 'burn' });
    });
    /* ①-1 물방울 침식 ([비]가 있으면 물 속성 +30%) */
    all(st).forEach(function (u) {
      if (!u.alive) return;
      const d = getStatus(u, 'drip');
      if (d && d.value > 0) applyDamage(st, u, Math.max(1, Math.round(d.value * (hasField(st, 'rain') ? 1 + R().RAIN_WATER : 1) * dotMul(u))), ev, { source: 'drip' });
    });
    /* ①-2 찌릿 피해 (반응할 때마다 [번개] +1) */
    let zapN = 0, zapA = 0;
    st.enemies.forEach(function (u) { if (u.alive && zapTick(st, u, ev)) zapN++; });
    st.allies.concat(st.bench).forEach(function (u) { if (u.alive && zapTick(st, u, ev)) zapA++; });
    if (st.useBolt) gainBolt(st, zapN, ev, '찌릿', 'ally');
    if (st.useEBolt) gainBolt(st, zapA, ev, '찌릿', 'enemy');
    ev.push.apply(ev, cleanupDead(st));
    /* ② 지속 턴 감소 */
    all(st).forEach(function (u) {
      if (!u.alive || !u.statuses.length) return;
      const blaze = !!hasField(st, 'blaze_zone');
      u.statuses.forEach(function (s) {
        if (s.turns == null) return;
        s.turns--;
        /* 열염 지대: [연소]가 사라지지 않고 최소 1스택 유지 */
        if (blaze && s.id === 'burn' && u.side === 'enemy' && s.turns <= 0) { s.turns = 1; s.stacks = Math.max(1, s.stacks); }
      });
      u.statuses = u.statuses.filter(function (s) { return s.turns == null || s.turns > 0; });
      u.statuses.forEach(function (s) { delete s.dormant; });   // 예열 완료 → 다음 턴부터 적용
      ev.push({ type: 'statusTick', unit: u.uid });
    });
    st.fields.forEach(function (f) { f.turns--; });
    st.fields.filter(function (f) { return f.turns <= 0; }).forEach(function (f) { ev.push({ type: 'fieldEnd', field: f.id }); });
    st.fields = st.fields.filter(function (f) { return f.turns > 0; });
    /* ③ 대기석 회복 */
    st.bench.forEach(function (b) {
      if (!b.alive || b.hp >= b.maxHp) return;
      const amt = Math.max(1, Math.round(b.maxHp * R().BENCH_HEAL));
      const prev = b.hp;
      b.hp = Math.min(b.maxHp, b.hp + amt);
      ev.push({ type: 'benchHeal', unit: b.uid, amount: b.hp - prev, hp: b.hp });
    });
    st.turn++;
    st.phase = 'plan';
    planEnemies(st);
    return ev;
  }

  /* 연출된 결말: 보스의 결말 공격 → 아군 전원(대기석 포함) 기절 → 클리어 */
  function finale(st) {
    const ev = [];
    if (!st.finalePending || st.scriptedWin) return ev;
    const boss = st.enemies.find(function (e) { return e.defId === st.finale.unit && e.alive; });
    st.finalePending = false;
    st.scriptedWin = true;
    st.queue = [];
    const sk = st.finale.skill;
    const victims = st.allies.concat(st.bench).filter(function (u) { return u.alive; });
    ev.push({ type: 'finale', actor: boss && boss.uid });
    ev.push({ type: 'cast', actor: boss && boss.uid, skill: sk, targets: st.allies.filter(function (u) { return u.alive; }).map(function (u) { return u.uid; }), allies: [] });
    victims.forEach(function (u) {
      u.statuses = u.statuses.filter(function (x) { return x.id !== 'shield'; });
      applyDamage(st, u, u.hp, ev, { source: 'skill', from: boss && boss.uid, finale: true });
    });
    return ev;
  }

  function outcome(st) {
    if (st.scriptedWin) return 'win';
    if (st.finalePending) return null;
    if (!livingEnemies(st).length) return 'win';
    if (!livingAllies(st).length && !st.bench.some(function (b) { return b.alive; })) return 'lose';
    return null;
  }

  /* 자동 전투 우선순위: 궁극기 → 버프·디버프(지원) → 공격
   *  · [번개]가 모자란 예열 카드는 고르지 않음
   *  · 레이가 예열(과전류 장전)하는 턴에는 레이의 공격 카드를 고르지 않음 */
  function autoPlan(st) {
    const picks = [];
    function rank(c) {
      if (c.ult) return 0;
      const sk = skillOf(c, st);
      const t = sk && sk.type;
      if (t === 'buff' || t === 'debuff' || t === 'heal') return 1;
      return 2;
    }
    const pool = st.hand
      .filter(function (c) { return !isQueued(st, c.uid) && !c.special; })
      .map(function (c, i) { return { c: c, r: rank(c), i: i }; })
      .sort(function (a, b) { return a.r - b.r || a.i - b.i; });
    let bolt = st.bolt;
    const charging = {};
    st.queue.forEach(function (q) {
      const c = st.hand.find(function (x) { return x.uid === q; });
      const sk = c && skillOf(c, st);
      if (sk && sk.boltCost) bolt -= sk.boltCost;
      if (sk && sk.holdOtherAttacks) charging[c.owner] = true;
    });
    const skipped = [];
    pool.forEach(function (o) {
      if (st.queue.length + picks.length >= availableSlots(st)) return;
      const sk = skillOf(o.c, st);
      if (sk.boltCost && bolt < sk.boltCost) { skipped.push(o.c.uid); return; }
      if (activeStatus(find(st, o.c.owner), 'isolation')) { skipped.push(o.c.uid); return; }
      const ems = getStatus(find(st, o.c.owner), 'ems');
      if (!o.c.ult && ems && ems.sealed === sk.id) { skipped.push(o.c.uid); return; }
      if (charging[o.c.owner] && sk.type === 'attack') { skipped.push(o.c.uid); return; }
      if (sk.boltCost) bolt -= sk.boltCost;
      if (sk.holdOtherAttacks) charging[o.c.owner] = true;
      picks.push(o.c.uid);
    });
    /* 슬롯이 남으면 건너뛴 카드로 채움 (사용되지 않고 손패에 남음) */
    skipped.forEach(function (u) { if (st.queue.length + picks.length < availableSlots(st)) picks.push(u); });
    return picks;
  }

  return {
    create, draw, queue, unqueue, isQueued, queueFull, availableSlots, setTarget, currentTarget,
    resolveNext, resolveSpecials, hasElement, enemyActions, resolveEnemy, endTurn, outcome, finale, canSwap, swap, autoPlan,
    find, skillOf, charDef, effAtk, effDef, getStatus, activeStatus, lightningCount, projectedCost, HAND_CAP
  };
})();
