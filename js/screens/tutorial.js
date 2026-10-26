/**
 * 전투 튜토리얼 (스테이지 1)
 * ─────────────────────────────────────────────────────────────
 * 카드 사용 → 되돌리기 → 카드 설명(호버) → 대상 지정 → 실제 사용 → 버프/디버프 확인 → 열의/궁극기 → 2배속/오토
 * · 각 단계에서 허용된 조작만 통과시키고(allow), 나머지 입력은 무시합니다.
 * · 'commit' 단계 전까지는 슬롯이 가득 차도 자동 시전을 보류합니다(holdCommit).
 */
window.G = window.G || {};

G.Tutorial = (function () {
  const U = G.util;

  const STEP_DEFS = [
    { id: 'hand', title: '스킬 카드', allow: ['queue'], target: 'hand', wait: 'queued',
      text: '아래 카드는 편성한 캐릭터의 <b>스킬 카드</b>입니다. (궁극기를 제외한 스킬 중 랜덤)',
      todo: '카드를 하나 클릭해 사용해 보세요.' },
    { id: 'slot', title: '행동 순서', allow: ['unqueue'], target: 'slots', wait: 'unqueued',
      text: '사용한 카드는 위쪽 <b>행동 슬롯</b>에 올라가며, 이 순서대로 스킬을 시전합니다. 슬롯 수는 편성 인원과 같습니다. (지금은 1명이므로 1칸)',
      todo: '슬롯의 카드를 클릭해 원래 자리로 되돌려 보세요.' },
    { id: 'hover', title: '스킬 설명', allow: [], target: 'hand', wait: 'tip', next: true,
      text: '카드 위에 <b>마우스를 올리면</b> 스킬의 자세한 설명을 볼 수 있습니다. 카드 오른쪽 위 숫자는 <b>마력(MP) 소모량</b>입니다. 마력이 모자라면 부족한 만큼 <b>체력</b>을 소모해 사용합니다.',
      todo: '카드 위에 마우스를 올려 보세요.' },
    { id: 'target', title: '공격 대상', allow: ['target'], target: 'enemy', wait: 'target',
      text: '<b>적을 클릭</b>하면 공격 대상을 지정할 수 있습니다. 대상은 언제든지 다시 바꿀 수 있습니다.',
      todo: '적을 클릭해 대상으로 지정해 보세요.' },
    { id: 'commit', title: '전투 개시', allow: ['queue', 'unqueue', 'target'], target: 'handSlots', wait: 'resolved',
      text: '행동 슬롯이 <b>모두 채워지면</b> 아군이 순서대로 공격하고, 이어서 적이 공격합니다. 여기까지가 <b>1턴</b>입니다. 사용하지 않은 카드는 다음 턴에도 남아 있습니다.',
      todo: '카드를 사용해 공격하세요.' },
    { id: 'status', title: '버프 · 디버프', allow: [], target: 'status', wait: 'tip', next: true,
      text: '캐릭터 머리 위의 작은 아이콘은 현재 걸려 있는 <b>버프</b>와 <b>디버프</b>입니다. 숫자는 남은 턴 수(연소는 스택 수)입니다. [연소]는 턴이 끝날 때 스택에 비례한 피해를 줍니다.',
      todo: '아이콘에 마우스를 올려 효과를 확인해 보세요.' },
    { id: 'moxie', title: '열의와 궁극기', allow: [], target: 'moxie', next: true,
      text: '카드를 사용할 때마다 마름모(<b>열의</b>)가 1개씩 쌓입니다. 5개가 모이면 궁극기 <b>종말의 메테오</b> 카드가 마법에 추가됩니다.' },
    { id: 'controls', title: '전투 보조', allow: [], target: 'controls', next: true,
      text: '오른쪽 위 버튼으로 <b>2배속</b>과 <b>오토 전투</b>를 켤 수 있습니다. 메뉴에서 다시 시작하거나 전투를 포기할 수 있습니다.' }
  ];

  function create(ui) {
    const STEPS = STEP_DEFS.map(function (d) { return Object.assign({}, d); });
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
      else { bx = Math.min(1920 - bw - 40, r.x + r.w + 40); by = Math.max(150, r.y); }
      box.style.left = bx + 'px'; box.style.top = Math.max(20, by) + 'px';
    }

    function advance() {
      if (finished || destroyed) return;
      i++;
      if (i >= STEPS.length) { finish(); return; }
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
      notify: notify,
      done: function () { return finished; },
      destroy: function () { destroyed = true; offTip(); layer.remove(); }
    };
  }

  return { create: create };
})();
