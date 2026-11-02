/**
 * 전투 튜토리얼
 * ─────────────────────────────────────────────────────────────
 * 'basic' (스테이지 1): 카드 사용 → 되돌리기 → 카드 정보(호버) → 적의 예고 → 대상 지정 → 턴 진행 → 버프/디버프 → 열의/궁극기 → 셔플 → 전투 보조
 *   · 특정 캐릭터의 스킬은 설명하지 않음 (게임 규칙만)
 * 'team'  (스테이지 4): 상대인 교사가 설명 — 단체 전투 → 캐릭터 변경(아르덴 ↔ 나즈나, 연습이라 턴 소모 없음) → 덱 구성 → 덱 추천 위치
 *   · 스테이지 데이터의 tutorial 값: true 또는 'basic' → basic, 'team' → team
 * · 각 단계에서 허용된 조작만 통과시키고(allow), 나머지 입력은 무시합니다.
 * · 'commit' 단계 전까지는 슬롯이 가득 차도 자동 시전을 보류합니다(holdCommit).
 */
window.G = window.G || {};

G.Tutorial = (function () {
  const U = G.util;

  /* 게임 플레이 방법만 설명 — 특정 캐릭터의 스킬 이야기는 하지 않음 (어떤 캐릭터로 편성해도 같은 규칙) */
  const STEP_DEFS = [
    { id: 'hand', title: '스킬 카드', allow: ['queue'], target: 'hand', wait: 'queued',
      text: '아래 카드는 편성한 캐릭터들의 <b>스킬 카드</b>입니다. 어떤 캐릭터로 편성하든 카드는 같은 방식으로 사용합니다.',
      todo: '카드를 하나 클릭해 사용해 보세요.' },
    { id: 'slot', title: '행동 슬롯', allow: ['unqueue'], target: 'slots', wait: 'unqueued',
      text: '사용한 카드는 위쪽 <b>행동 슬롯</b>에 올라가며, 이 순서대로 시전합니다. 슬롯 수는 <b>편성 인원</b>과 같아서, 함께 싸우는 동료가 많을수록 한 턴에 더 많은 카드를 쓸 수 있습니다.',
      todo: '슬롯의 카드를 클릭해 원래 자리로 되돌려 보세요.' },
    { id: 'hover', title: '카드 정보', allow: [], target: 'hand', wait: 'tip', next: true,
      text: '카드 위에 <b>마우스를 올리면</b> 자세한 설명을 볼 수 있습니다. 카드 왼쪽 위 숫자는 <b>마력(MP) 소모량</b>입니다. 마력이 모자라면 부족한 만큼 <b>체력</b>을 대신 소모합니다.',
      todo: '카드 위에 마우스를 올려 보세요.' },
    { id: 'intent', title: '적의 예고', allow: [], target: 'intent', next: true,
      text: '적 머리 위의 표시는 적이 <b>이번 턴에 할 행동</b>입니다. 마우스를 올리면 자세히 볼 수 있으니, 보고 나서 어떤 카드를 쓸지 정하세요.' },
    { id: 'target', title: '공격 대상', allow: ['target'], target: 'enemy', wait: 'target',
      text: '<b>적을 클릭</b>하면 공격 대상을 지정할 수 있습니다. 대상은 언제든지 다시 바꿀 수 있습니다.',
      todo: '적을 클릭해 대상으로 지정해 보세요.' },
    { id: 'commit', title: '턴 진행', allow: ['queue', 'unqueue', 'target'], target: 'handSlots', wait: 'resolved',
      text: '행동 슬롯이 <b>모두 채워지면</b> 아군이 순서대로 행동하고, 이어서 적이 행동합니다. 여기까지가 <b>1턴</b>입니다. 사용하지 않은 카드는 다음 턴에도 남아 있습니다.',
      todo: '카드를 사용해 턴을 진행하세요.' },
    { id: 'status', title: '버프 · 디버프', allow: [], target: 'status', wait: 'tip', next: true,
      text: '머리 위의 작은 아이콘은 지금 걸려 있는 <b>버프</b>와 <b>디버프</b>입니다. 숫자는 남은 턴 수(또는 쌓인 수)이고, 마우스를 올리면 효과를 볼 수 있습니다.',
      todo: '아이콘에 마우스를 올려 효과를 확인해 보세요.' },
    { id: 'moxie', title: '열의와 궁극기', allow: [], target: 'moxie', next: true,
      text: '캐릭터가 카드를 쓸 때마다 그 캐릭터의 마름모(<b>열의</b>)가 쌓입니다. 마름모가 가득 차면 그 캐릭터의 <b>궁극기</b> 카드가 들어오며, 궁극기는 마력을 쓰지 않습니다.' },
    { id: 'shuffle', title: '카드 셔플', allow: [], target: 'shuffle', next: true,
      text: '원하는 카드가 없을 때는 <b>셔플</b> 버튼으로 지금 보이는 스킬 카드를 모두 새로 뽑을 수 있습니다. 전투마다 <b>3번</b> 쓸 수 있고, 턴은 넘어가지 않습니다. (궁극기 카드는 그대로 남습니다)' },
    { id: 'controls', title: '전투 보조', allow: [], target: 'controls', next: true,
      text: '오른쪽 위에서 편성한 캐릭터들의 <b>스킬</b> 목록을 보거나, <b>2배속</b>과 <b>오토 전투</b>를 켤 수 있습니다. 메뉴에서 다시 시작하거나 전투를 포기할 수 있습니다.' }
  ];

  /* 스테이지 4 — 단체 전투 튜토리얼 (대련 상대인 교사가 직접 설명) */
  const TEAM_DEFS = [
    { id: 'team', title: '단체 전투', allow: [], target: 'allies', next: true,
      text: '이번엔 <b>단체 전투</b>다. 세 명이 필드에 나가 싸우고, 한 명은 <b>대기석</b>에서 기다린다. 편성한 인원(대기석 포함)만큼 <b>행동 슬롯</b>이 생기니, 한 턴에 카드도 그만큼 쓸 수 있지.' },
    { id: 'swap', title: '캐릭터 변경', allow: ['swap'], target: 'bench', wait: 'swapped',
      text: '대기석의 <b>초상화</b>를 누르면 필드의 캐릭터와 <b>자리를 바꿀 수 있다</b>. 원래는 <b>한 턴을 소모</b>하지만, 지금은 연습이니 턴은 넘어가지 않는다.',
      todo: '대기석의 아르덴을 눌러 나즈나와 바꿔 보세요.' },
    { id: 'deck', title: '덱 구성', allow: [], target: 'allies', next: true,
      text: '팀(덱)은 보통 <b>메인 딜러</b> · <b>서브 딜러</b> · <b>서포터(힐러)</b>로 짠다. 공격으로 밀어붙일지, 버티며 싸울지에 따라 구성이 달라지지. 정답은 없다. <b>원하는 대로 덱을 짜도 된다.</b><br>지금은 스토리라 바꿀 수 없지만, <b>스토리 덱으로 한 번 클리어한 스테이지</b>는 다음부터 원하는 덱으로 플레이할 수 있다.' },
    { id: 'decks', title: '다른 덱', allow: [], target: null, next: true,
      text: '캐릭터끼리 잘 맞는 조합도 여러 가지 있다. 조합 설명은 <b>스테이지 선택 화면 오른쪽 위 [덱 추천]</b>에서 볼 수 있지.<br>설명은 여기까지. 이제 진짜로 붙어 보자!' }
  ];
  const SETS = { basic: { defs: STEP_DEFS }, team: { defs: TEAM_DEFS, speaker: '지도교수' } };

  function create(ui, kind) {
    const SET = SETS[kind] || SETS.basic;
    const STEPS = SET.defs.map(function (d) { return Object.assign({}, d); });
    let i = 0, finished = false, destroyed = false;
    const layer = U.el('div', 'tut-layer');
    const spot = U.el('div', 'tut-spot');
    const box = U.el('div', 'tut-box');
    layer.append(spot, box);
    ui.screen.appendChild(layer);

    const offTip = G.tip.onShow(function (el) {
      const st = STEPS[i];
      if (!st || finished || st.wait !== 'tip') return;
      if (st.id === 'hover' && ui.hand.contains(el)) setTimeout(advance, 900);
      if (st.id === 'status' && el.classList.contains('bt-status')) setTimeout(advance, 1200);
    });

    function rectOf(el) {
      const sc = G.util.getScale() || 1;
      const base = ui.screen.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: (r.left - base.left) / sc, y: (r.top - base.top) / sc, w: r.width / sc, h: r.height / sc };
    }
    function union(a, b) {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
    }

    function targetRect(kind) {
      const st = ui.state;
      if (kind === 'hand') return rectOf(ui.hand);
      if (kind === 'slots') return rectOf(ui.slots);
      if (kind === 'handSlots') return union(rectOf(ui.hand), rectOf(ui.slots));
      if (kind === 'controls') return rectOf(ui.hudTR);
      if (kind === 'enemy') {
        const e = st.enemies.find(function (x) { return x.alive; });
        const el = e && ui.unitEl(e.uid);
        return el ? rectOf(el.querySelector('.bt-sprite')) : null;
      }
      if (kind === 'status') {
        const u = st.allies.concat(st.enemies).find(function (x) { return x.alive && x.statuses.length; });
        const el = u ? ui.statusEl(u.uid) : ui.unitEl(st.allies[0].uid).querySelector('.bt-hp-wrap');
        return el ? rectOf(el) : null;
      }
      if (kind === 'intent') {
        const e = st.enemies.find(function (x) { return x.alive; });
        const el = e && ui.unitEl(e.uid) && ui.unitEl(e.uid).querySelector('.bt-intent');
        return el ? rectOf(el) : null;
      }
      if (kind === 'shuffle') return ui.shuffleEl ? rectOf(ui.shuffleEl) : null;
      if (kind === 'bench') return ui.benchEl ? rectOf(ui.benchEl) : null;
      if (kind === 'allies') {
        const els = st.allies.map(function (u) { const el = ui.unitEl(u.uid); return el && el.querySelector('.bt-sprite'); }).filter(Boolean);
        return els.length ? els.map(rectOf).reduce(union) : null;
      }
      if (kind === 'moxie') { const el = ui.moxieEl(st.allies[0].uid); return el ? rectOf(el) : null; }
      return null;
    }

    function render() {
      if (destroyed) return;
      const st = STEPS[i];
      if (!st || finished) { layer.style.display = 'none'; return; }
      layer.style.display = '';
      const r = targetRect(st.target);
      const pad = 12;
      if (r) {
        spot.style.display = '';
        spot.style.left = (r.x - pad) + 'px'; spot.style.top = (r.y - pad) + 'px';
        spot.style.width = (r.w + pad * 2) + 'px'; spot.style.height = (r.h + pad * 2) + 'px';
      } else spot.style.display = 'none';

      box.innerHTML =
        (SET.speaker ? '<div class="tut-speaker">' + SET.speaker + '</div>' : '') +
        '<div class="tut-step">TUTORIAL ' + (i + 1) + ' / ' + STEPS.length + '</div>' +
        '<div class="tut-title">' + st.title + '</div>' +
        '<div class="tut-text">' + st.text + '</div>' +
        (st.todo ? '<div class="tut-do">▶ ' + st.todo + '</div>' : '');
      if (st.next) {
        const nb = U.el('button', 'g-btn g-btn-primary tut-next', { type: 'button', text: i === STEPS.length - 1 ? '시작' : '다음' });
        nb.addEventListener('click', advance);
        box.appendChild(nb);
      }
      /* 설명창 위치: 강조 영역과 겹치지 않게 */
      const bw = 520;
      let bx, by;
      if (!r) { bx = 700; by = 380; }
      else if (r.y > 520) { bx = Math.min(1920 - bw - 40, Math.max(40, r.x + r.w - bw)); by = r.y - 250; }
      else if (r.x > 1200) { bx = r.x - bw - 40; by = r.y + r.h + 30; }
      else if (r.x + r.w + 40 + bw > 1880) { bx = Math.max(40, r.x - bw - 40); by = Math.max(150, r.y); }   // 오른쪽에 자리가 없으면 왼쪽에 (예: 아군 전체 강조)
      else { bx = Math.min(1920 - bw - 40, r.x + r.w + 40); by = Math.max(150, r.y); }
      box.style.left = bx + 'px'; box.style.top = Math.max(20, by) + 'px';
    }

    function advance() {
      if (finished || destroyed) return;
      i++;
      if (i >= STEPS.length) { finish(); return; }
      if (ui.onStep) ui.onStep();   // 단계마다 허용되는 조작이 달라짐 (예: 캐릭터 변경 버튼 활성화)
      render();
    }
    function finish() {
      finished = true;
      layer.style.display = 'none';
      ui.onDone();
    }

    /* 연출 중에는 숨기고, 플레이어 차례가 되면 다시 표시 */
    function notify(evt) {
      if (finished || destroyed) return;
      const st = STEPS[i];
      if (evt === 'playerPhase') {
        if (st.id === 'commit' && st.waitingResolve) { advance(); return; }
        render();
        return;
      }
      if (st.id === 'commit' && evt === 'queued' && ui.state.queue.length >= ui.state.actions) {
        st.waitingResolve = true;
        layer.style.display = 'none';
        return;
      }
      if (evt === 'swapOpen') { layer.style.display = 'none'; return; }
      if (st.wait === evt) { advance(); return; }
      render();
    }

    return {
      allow: function (action) {
        if (finished) return true;
        const st = STEPS[i];
        return !!st && st.allow.indexOf(action) !== -1;
      },
      holdCommit: function () { return !finished && STEPS[i].id !== 'commit'; },
      /* 연습 교체: 턴을 넘기지 않음 · 정해진 캐릭터(나즈나)만 교체 가능 */
      practiceSwap: function () { return !finished && STEPS[i].id === 'swap'; },
      swapOnly: function () { return !finished && STEPS[i].id === 'swap' ? 'Character_11' : null; },
      notify: notify,
      done: function () { return finished; },
      destroy: function () { destroyed = true; offTip(); layer.remove(); }
    };
  }

  return { create: create };
})();
