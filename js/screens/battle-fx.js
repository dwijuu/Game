/**
 * 스킬 연출 (battle-ui 에서 cast 이벤트마다 호출)
 * ─────────────────────────────────────────────────────────────
 * · 이미지 파일 없이 DOM + Web Animations API 로 그리며, 끝난 요소는 즉시 제거합니다.
 * · 모든 시간은 ctx.speed(1 또는 2)로 나눠 2배속에 맞춥니다.
 * · 스킬 데이터의 anim 값으로 연출을 고릅니다. 새 스킬은 아래 FX 에 함수만 추가하면 됩니다.
 *
 * ctx = { layer, speed, signal, point(uid, part), sprite(uid), shake(power) }
 *   part: 'chest' | 'feet' | 'muzzle' | 'head'
 */
window.G = window.G || {};

G.fx = (function () {
  function spawn(ctx, cls, x, y, style) {
    const d = document.createElement('div');
    d.className = 'fx ' + cls;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    if (style) d.style.cssText += style;
    ctx.layer.appendChild(d);
    return d;
  }

  /* 애니메이션 후 요소 제거. 화면을 떠나면(abort) 즉시 정리 */
  function run(ctx, el, frames, dur, opts) {
    const o = opts || {};
    const anim = el.animate(frames, {
      duration: dur / ctx.speed, delay: (o.delay || 0) / ctx.speed,
      easing: o.easing || 'ease-out', fill: 'both'
    });
    function onAbort() { try { anim.cancel(); } catch (e) {} el.remove(); }
    if (ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });
    return anim.finished.catch(function () {}).then(function () {
      if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
      if (!o.keep) el.remove();
    });
  }

  function wait(ctx, ms) { return G.util.wait(ms / ctx.speed, ctx.signal); }
  function GROUND() { return 690; }

  function sparks(ctx, x, y, n, dist, cls, dur) {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const r = dist * (0.6 + Math.random() * 0.6);
      const s = spawn(ctx, cls || 'fx-spark', x, y);
      s.style.transform = 'translate(-50%,-50%) rotate(' + (a * 180 / Math.PI) + 'deg)';
      ps.push(run(ctx, s, [
        { transform: 'translate(-50%,-50%) rotate(' + (a * 180 / Math.PI) + 'deg) translateX(0) scaleX(1)', opacity: 1 },
        { transform: 'translate(-50%,-50%) rotate(' + (a * 180 / Math.PI) + 'deg) translateX(' + r + 'px) scaleX(0.3)', opacity: 0 }
      ], dur || 520, { easing: 'cubic-bezier(0.2,0.8,0.3,1)' }));
    }
    return Promise.all(ps);
  }

  function burst(ctx, x, y, cls, scale, dur) {
    const b = spawn(ctx, 'fx-burst ' + (cls || ''), x, y);
    return run(ctx, b, [
      { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(' + (scale || 2.2) + ')', opacity: 0 }
    ], dur || 520);
  }

  function flames(ctx, x, y, n, size) {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const f = spawn(ctx, 'fx-flame', x + (Math.random() - 0.5) * 80, y, 'width:' + (size || 26) + 'px;height:' + ((size || 26) * 1.5) + 'px;');
      ps.push(run(ctx, f, [
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-260%) scale(0.3)', opacity: 0 }
      ], 700, { delay: i * 90 }));
    }
    return Promise.all(ps);
  }

  function hexShield(ctx, uid, delay) {
    const p = ctx.point(uid, 'chest');
    const h = spawn(ctx, 'fx-hex', p.x, p.y + 30);
    h.innerHTML = '<svg viewBox="0 0 100 116"><polygon points="50,2 98,30 98,86 50,114 2,86 2,30"/></svg>';
    return run(ctx, h, [
      { transform: 'translate(-50%,-50%) scale(0.75)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.02)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.85, offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 }
    ], 1000, { delay: delay || 0 });
  }

  function recoil(ctx, uid) {
    const s = ctx.sprite(uid);
    if (s) s.animate([{ transform: 'none' }, { transform: 'translateX(14px)' }, { transform: 'none' }], { duration: 260 / ctx.speed, easing: 'ease-out' });
  }
  function lunge(ctx, uid, dir) {
    const s = ctx.sprite(uid);
    if (!s) return;
    s.animate([{ transform: 'none' }, { transform: 'translateX(' + (dir * 90) + 'px)', offset: 0.45 }, { transform: 'none' }],
      { duration: 620 / ctx.speed, easing: 'cubic-bezier(0.2,0,0,1)' });
  }
  function glow(ctx, uid, color, dur) {
    const s = ctx.sprite(uid);
    if (!s) return;
    s.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 18px ' + color + ') brightness(1.15)', offset: 0.4 }, { filter: 'none' }],
      { duration: (dur || 900) / ctx.speed, easing: 'ease-in-out' });
  }


  /* ── 색을 지정할 수 있는 공용 연출 ───────────────────── */
  function cburst(ctx, x, y, color, scale, dur, size) {
    const b = spawn(ctx, 'fx-burst', x, y, 'border-color:' + color + ';box-shadow:0 0 30px ' + color + ', inset 0 0 22px ' + color + ';' + (size ? 'width:' + size + 'px;height:' + size + 'px;' : ''));
    return run(ctx, b, [
      { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(' + (scale || 2.2) + ')', opacity: 0 }
    ], dur || 560);
  }
  function ring(ctx, x, y, color, scale, dur, delay) {
    const r = spawn(ctx, 'fx-ring', x, y, 'border-color:' + color + ';box-shadow:0 0 22px ' + color + ';');
    return run(ctx, r, [{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(' + (scale || 2.6) + ')', opacity: 0 }], dur || 800, { delay: delay || 0 });
  }
  function rise(ctx, x, y, n, color, spread, height, size) {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const d = spawn(ctx, 'fx-ember', x + (Math.random() - 0.5) * (spread || 150), y - Math.random() * 30,
        'background:' + color + ';box-shadow:0 0 8px 3px ' + color + ';' + (size ? 'width:' + size + 'px;height:' + size + 'px;' : ''));
      ps.push(run(ctx, d, [
        { transform: 'translate(-50%,-50%) scale(0.5)', opacity: 0 },
        { transform: 'translate(-50%,-50%) translateY(-50px) scale(1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-50%) translateY(-' + (height || 220) + 'px) scale(0.2)', opacity: 0 }
      ], 1000, { delay: i * 45 }));
    }
    return Promise.all(ps);
  }
  function shot(ctx, from, to, core, glowColor, dur, w) {
    const ang = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    const b = spawn(ctx, 'fx-bullet', from.x, from.y, 'background:' + core + ';box-shadow:0 0 10px 4px ' + glowColor + ', 0 0 26px 10px ' + glowColor + ';' + (w ? 'width:' + w + 'px;' : ''));
    return run(ctx, b, [
      { transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) translateX(0)' },
      { transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) translateX(' + Math.hypot(to.x - from.x, to.y - from.y) + 'px)' }
    ], dur || 460, { easing: 'cubic-bezier(0.5,0,0.9,0.6)' });
  }
  function dim(ctx, color, dur) {
    const d = spawn(ctx, 'fx-dim', 0, 0, 'background:' + color + ';');
    return run(ctx, d, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], dur || 2400, { easing: 'linear' });
  }
  function spikes(ctx, uid, color, delay) {
    const p = ctx.point(uid, 'feet');
    return Promise.all([-50, -14, 22, 54].map(function (ox, k) {
      const r = spawn(ctx, 'fx-rock fx-vine' + (k % 2 ? ' is-big' : ''), p.x + ox, p.y + 10, 'background:' + color + ';');
      return run(ctx, r, [
        { transform: 'translate(-50%,-100%) translateY(120px) scaleY(0.3) rotate(' + (k % 2 ? 6 : -6) + 'deg)', opacity: 0 },
        { transform: 'translate(-50%,-100%) translateY(0) scaleY(1.05) rotate(' + (k % 2 ? -4 : 4) + 'deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-100%) translateY(0) scaleY(1) rotate(0deg)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-100%) translateY(40px) scaleY(0.7)', opacity: 0 }
      ], 1000, { delay: (delay || 0) + k * 60, easing: 'cubic-bezier(0.2,0.9,0.3,1)' });
    }));
  }
  function streaks(ctx, x, y, color, dir) {
    return Promise.all([-40, -10, 20, 50].map(function (oy, i) {
      const l = spawn(ctx, 'fx-streak', x, y + oy, 'background:' + color + ';');
      return run(ctx, l, [
        { transform: 'translate(-50%,-50%) translateX(' + (dir * -120) + 'px) scaleX(0.2)', opacity: 0 },
        { transform: 'translate(-50%,-50%) translateX(0) scaleX(1)', opacity: 0.9, offset: 0.4 },
        { transform: 'translate(-50%,-50%) translateX(' + (dir * 160) + 'px) scaleX(0.3)', opacity: 0 }
      ], 520, { delay: i * 50 });
    }));
  }
  function dashTo(ctx, uid, tx) {
    const s = ctx.sprite(uid);
    if (!s) return;
    const p = ctx.point(uid, 'feet');
    const dx = tx - p.x + (tx < p.x ? 140 : -140);
    s.animate([{ transform: 'none' }, { transform: 'translateX(' + dx + 'px)', offset: 0.35 }, { transform: 'translateX(' + dx + 'px)', offset: 0.6 }, { transform: 'none' }],
      { duration: 900 / ctx.speed, easing: 'cubic-bezier(0.2,0,0,1)' });
  }
  function hop(ctx, uid) {
    const s = ctx.sprite(uid);
    if (!s) return;
    s.animate([{ transform: 'none' }, { transform: 'translateY(-150px)', offset: 0.45 }, { transform: 'none' }],
      { duration: 800 / ctx.speed, easing: 'ease-in-out' });
  }
  function center(ctx, uids, part) {
    const ps = uids.map(function (u) { return ctx.point(u, part || 'feet'); });
    return { x: ps.reduce(function (a, p) { return a + p.x; }, 0) / ps.length, y: ps[0].y };
  }

  /* 번개 줄기: 두 점 사이를 지그재그로 잇는 SVG (깜빡이며 사라짐) */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function zigzag(a, b, seg, jitter) {
    const pts = [];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const j = (i === 0 || i === seg) ? 0 : (Math.random() - 0.5) * 2 * jitter;
      pts.push((a.x + dx * t + nx * j).toFixed(1) + ',' + (a.y + dy * t + ny * j).toFixed(1));
    }
    return pts.join(' ');
  }
  function bolt(ctx, a, b, color, width, dur, delay, jitter) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'fx fx-svg');
    svg.setAttribute('viewBox', '0 0 1920 920');
    const seg = Math.max(5, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 55));
    const j = jitter == null ? 26 : jitter;
    [[width * 3.2, color, 0.35], [width, '#ffffff', 1]].forEach(function (cfg) {
      const pl = document.createElementNS(SVGNS, 'polyline');
      pl.setAttribute('points', zigzag(a, b, seg, j));
      pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', cfg[1]);
      pl.setAttribute('stroke-width', cfg[0]);
      pl.setAttribute('stroke-linejoin', 'round');
      pl.setAttribute('stroke-linecap', 'round');
      pl.setAttribute('opacity', cfg[2]);
      svg.appendChild(pl);
    });
    svg.style.filter = 'drop-shadow(0 0 8px ' + color + ')';
    ctx.layer.appendChild(svg);
    return run(ctx, svg, [
      { opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.35, offset: 0.25 }, { opacity: 1, offset: 0.4 },
      { opacity: 0.6, offset: 0.7 }, { opacity: 0 }
    ], dur || 420, { delay: delay || 0, easing: 'linear' });
  }
  function spark(ctx, p, color, n, dist) { return sparks(ctx, p.x, p.y, n || 10, dist || 110, 'fx-spark is-volt', 420); }
  const VOLT = '#b9a8ff', GOLD = '#ffd75e';

  const FX_EXTRA = {};
  /* ══ 궁극기 시네마틱 ═══════════════════════════════════
   * 궁극기마다 고유한 짧은 연출 (전체 화면 · 약 2초). battle-ui 의 ultCinematic 이 호출.
   * cctx = { layer(1920×920 무대), speed, signal, art:{src|sil}, color, enemy }
   * 키는 스킬의 anim 값과 같음. 없으면 generic. */
  function cArt(cctx, x, y, h, opts) {
    const o = opts || {};
    const d = document.createElement('div');
    d.className = 'fx cine-art' + (cctx.enemy ? ' is-enemy' : '');
    d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.height = h + 'px';
    d.innerHTML = cctx.art.src ? '<img src="' + cctx.art.src + '" alt="" style="height:' + h + 'px">' : cctx.art.sil;
    if (!cctx.art.src) { const sv = d.querySelector('svg'); if (sv) { sv.style.height = h + 'px'; sv.style.width = (h * 0.42) + 'px'; } }
    cctx.layer.appendChild(d);
    const from = o.from || 'translate(-50%,-100%) translateX(' + (cctx.enemy ? -80 : 80) + 'px) scale(1.06)';
    run(cctx, d, [
      { transform: from, opacity: 0 },
      { transform: 'translate(-50%,-100%) scale(1)', opacity: 1, offset: 0.18 },
      { transform: 'translate(-50%,-100%) scale(1.03)', opacity: 1, offset: 0.85 },
      { transform: 'translate(-50%,-100%) scale(1.05)', opacity: 0 }
    ], o.dur || 2100, { easing: 'linear' });
    return d;
  }
  function bg(cctx, css) { const b = spawn(cctx, 'cine-bg', 0, 0, css); run(cctx, b, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], 2200, { easing: 'linear' }); return b; }
  function stageShake(cctx, p) {
    cctx.layer.animate([{ transform: 'none' }, { transform: 'translate(' + (-p) + 'px,' + (p / 2) + 'px)' }, { transform: 'translate(' + p + 'px,' + (-p / 2) + 'px)' }, { transform: 'none' }], { duration: 300 / cctx.speed });
  }
  function flashC(cctx, color, peak) { const f = spawn(cctx, 'fx-flash', 0, 0, 'background:' + color + ';'); return run(cctx, f, [{ opacity: peak || 0.8 }, { opacity: 0 }], 600); }

  const CINE = {
    /* 아르덴 — 종말의 메테오: 신호탄이 하늘로 → 하늘이 붉게 물듦 → 메테오가 화면을 가로질러 떨어짐 */
    meteor: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#120812 0%,#3a1410 55%,#6b2a10 100%);');
      cArt(c, 520, 980, 860);
      await wait(c, 380);
      const fl = spawn(c, 'fx-flare', 600, 420);
      run(c, fl, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-50%) translate(120px,-520px)', opacity: 0.4 }], 520, { easing: 'ease-in' });
      await wait(c, 450);
      const red = spawn(c, 'cine-bg', 0, 0, 'background:radial-gradient(ellipse at 75% 0%, rgba(255,120,40,0.75), transparent 60%);');
      run(c, red, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], 1300);
      const met = spawn(c, 'fx-meteor', 2150, -220);
      met.innerHTML = '<div class="fx-meteor-tail" style="width:900px;height:140px;top:-70px"></div><div class="fx-meteor-core" style="left:-130px;top:-130px;width:260px;height:260px"></div>';
      const ang = Math.atan2(700 + 220, 1150 - 2150) * 180 / Math.PI;
      await run(c, met, [
        { left: '2150px', top: '-220px', transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) scale(0.5)' },
        { left: '1150px', top: '700px', transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) scale(1.3)' }
      ], 700, { easing: 'cubic-bezier(0.55,0,1,0.45)' });
      stageShake(c, 18); flashC(c, '#ffd9a0', 0.9);
      await wait(c, 350);
    },
    /* 샤린 — 역류: 물기둥이 솟고 거대한 파도가 화면을 덮음 */
    undertow: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#04121c 0%,#0b2c40 60%,#14506a 100%);');
      cArt(c, 960, 960, 800);
      rise(c, 960, 900, 26, '#9fe0ff', 1600, 700, 10);
      await wait(c, 600);
      const w = spawn(c, 'cine-wave', 2300, 560);
      await run(c, w, [{ left: '2300px', transform: 'translate(-50%,-50%) scaleY(0.4)', opacity: 0.6 }, { left: '960px', transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.6 }, { left: '-400px', transform: 'translate(-50%,-50%) scaleY(1.1)', opacity: 0.9 }], 1100, { easing: 'cubic-bezier(.4,0,.6,1)' });
      stageShake(c, 10); flashC(c, '#cdeeff', 0.5);
      await wait(c, 200);
    },
    /* 나즈나 — 숲의 포옹: 사방에서 덩굴이 솟아 화면을 뒤덮음 */
    forest: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#040c04 0%,#0e2a0c 70%,#1b3f14 100%);');
      cArt(c, 960, 960, 780);
      await wait(c, 350);
      const ps = [];
      for (let i = 0; i < 18; i++) {
        const x = (i / 17) * 1920 + (Math.random() - 0.5) * 60, h = 380 + Math.random() * 420;
        const v = spawn(c, 'cine-vine', x, 940, 'height:' + h + 'px;');
        ps.push(run(c, v, [{ transform: 'translate(-50%,-100%) scaleY(0) rotate(' + ((Math.random() - 0.5) * 24) + 'deg)', opacity: 1 }, { transform: 'translate(-50%,-100%) scaleY(1) rotate(' + ((Math.random() - 0.5) * 24) + 'deg)', opacity: 1, offset: 0.55 }, { opacity: 0 }], 1500, { delay: i * 40, easing: 'cubic-bezier(.2,.9,.3,1)' }));
      }
      rise(c, 960, 900, 30, '#a7dd7e', 1800, 600, 10);
      await wait(c, 900);
      stageShake(c, 8);
      await wait(c, 400);
    },
    /* 알리제 — 열풍 폭주: 바람 줄기가 휘몰아치고 불꽃 회오리가 솟음 */
    tempest: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#140804 0%,#3d1606 70%,#6a2808 100%);');
      cArt(c, 560, 960, 820);
      for (let i = 0; i < 10; i++) {
        const l = spawn(c, 'fx-streak', 960, 120 + i * 75, 'background:rgba(255,220,180,0.85);width:420px;');
        run(c, l, [{ transform: 'translate(-50%,-50%) translateX(1200px)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) translateX(-1200px)', opacity: 0 }], 700, { delay: i * 60 });
      }
      await wait(c, 500);
      const tw = [0, 1, 2, 3, 4, 5].map(function (i) {
        const r = spawn(c, 'fx-ring is-tornado', 1250, 760 - i * 110, 'width:' + (200 + i * 110) + 'px;height:' + (60 + i * 20) + 'px;');
        const sw = (i % 2 ? 1 : -1) * (30 + i * 8);
        return run(c, r, [{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) translateX(' + sw + 'px) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) translateX(' + (-sw) + 'px) scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) translateY(-60px) scale(1.2)', opacity: 0 }], 1300, { delay: i * 50, easing: 'ease-in-out' });
      });
      rise(c, 1250, 860, 28, '#ffb36b', 500, 700, 9);
      await Promise.all(tw);
    },
    /* 알리제 — 화염 태풍의 가두리: 바람의 벽이 회전 → 화염이 빨려 들어감 → 정점에서 낙하 · 대폭발 */
    ignition_cyclone: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#120502 0%,#3a1206 60%,#6a2408 100%);');
      const art = cArt(c, 960, 980, 820);
      const rings = [];
      for (let i = 0; i < 7; i++) {
        const r = spawn(c, 'fx-ring is-tornado', 960, 820 - i * 100, 'width:' + (1300 - i * 120) + 'px;height:' + (120 - i * 8) + 'px;');
        rings.push(run(c, r, [{ transform: 'translate(-50%,-50%) scale(0.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) translateY(-80px) scale(0.6)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-50%) scale(0.1)', opacity: 0 }], 1700, { delay: i * 40, easing: 'ease-in-out' }));
      }
      for (let i = 0; i < 8; i++) {
        const l = spawn(c, 'fx-streak', 960, 140 + i * 90, 'background:rgba(255,200,150,0.9);width:520px;');
        run(c, l, [{ transform: 'translate(-50%,-50%) translateX(' + (i % 2 ? 1100 : -1100) + 'px)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) translateX(' + (i % 2 ? -1100 : 1100) + 'px)', opacity: 0 }], 700, { delay: i * 50 });
      }
      rise(c, 960, 900, 40, '#ffb36b', 1400, 800, 10);
      await wait(c, 1200);
      art.animate([{ transform: 'translate(-50%,-100%)' }, { transform: 'translate(-50%,-100%) translateY(-200px) scale(0.9)', offset: 0.4 }, { transform: 'translate(-50%,-100%) translateY(60px) scale(1.1)' }], { duration: 500 / c.speed, fill: 'forwards' });
      await wait(c, 450);
      stageShake(c, 22); flashC(c, '#ffd9a0', 0.95);
      const w = spawn(c, 'fx-wave', 960, 860);
      run(c, w, [{ transform: 'translate(-50%,-50%) scale(0.2,0.06)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(5,1)', opacity: 0 }], 700);
      await wait(c, 350);
    },
    /* 레이 — 뇌신 붕괴포: 사방의 전류가 한 점으로 모여 구체가 됨 → 화면을 가르는 포격 */
    thunder_buster: async function (c) {
      bg(c, 'background:radial-gradient(ellipse at 40% 50%,#2a1a5a 0%,#0b0620 70%);');
      cArt(c, 420, 980, 860);
      const o = { x: 860, y: 470 };
      for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2; bolt(c, { x: o.x + Math.cos(a) * 700, y: o.y + Math.sin(a) * 420 }, o, '#b9a8ff', 3, 380, i * 60, 30); }
      const orb = spawn(c, 'fx-volt-orb', o.x, o.y, 'width:240px;height:240px;');
      await run(c, orb, [{ transform: 'translate(-50%,-50%) scale(0.1)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(0.85)', opacity: 1 }], 1000, { keep: true });
      const beam = spawn(c, 'fx-volt-beam', 1400, o.y, 'width:1300px;height:200px;');
      run(c, beam, [{ transform: 'translate(-50%,-50%) scaleY(0.05)', opacity: 0 }, { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-50%) scaleY(0.05)', opacity: 0 }], 800);
      bolt(c, o, { x: 1920, y: o.y }, '#b9a8ff', 10, 700, 0, 40);
      stageShake(c, 16); flashC(c, '#e6deff', 0.8);
      await wait(c, 300); orb.remove();
      await wait(c, 300);
    },
    /* 코루스코 — 뇌운의 과부하: 먹구름이 몰려와 낙뢰가 연달아 내리꽂힘 */
    thunder_cloud: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#050402 0%,#1e1806 60%,#3a2c08 100%);');
      cArt(c, c.enemy ? 560 : 1380, 980, 860);
      const cl = spawn(c, 'fx-cloud', 960, 110, 'width:2100px;height:260px;');
      run(c, cl, [{ transform: 'translate(-50%,-50%) translateY(-120px)', opacity: 0 }, { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], 2000);
      await wait(c, 600);
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 4; k++) { const x = 200 + Math.random() * 1520; bolt(c, { x: x + (Math.random() - 0.5) * 100, y: 140 }, { x: x, y: 900 }, '#ffd75e', 6, 360, k * 50, 50); }
        stageShake(c, 8 + r * 4);
        await wait(c, 260);
      }
      flashC(c, '#fff3c4', 0.6);
      await wait(c, 250);
    },
    /* 페델레 — 그랜드 프레셔: 중력 고리가 안쪽으로 짓눌러 들어옴 → 화면이 눌림 */
    grand_pressure: async function (c) {
      bg(c, 'background:radial-gradient(ellipse at 50% 55%,#1c2350 0%,#070918 70%);');
      cArt(c, 960, 980, 820);
      for (let i = 0; i < 6; i++) {
        const r = spawn(c, 'fx-ring', 960, 520, 'border-color:#aab8ff;box-shadow:0 0 30px rgba(130,150,255,0.8);width:300px;height:300px;');
        run(c, r, [{ transform: 'translate(-50%,-50%) scale(6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(3)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 }], 900, { delay: i * 160, easing: 'ease-in' });
      }
      await wait(c, 1100);
      c.layer.animate([{ transform: 'none' }, { transform: 'scaleY(0.94) translateY(20px)', offset: 0.3 }, { transform: 'none' }], { duration: 500 / c.speed });
      const g = spawn(c, 'fx-gwell is-big', 960, 520, 'width:640px;height:640px;');
      run(c, g, [{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], 800);
      stageShake(c, 14);
      await wait(c, 600);
    },
    /* 실반 — 세계수의 영역: 어둠 속에서 세계수가 자라나고 빛 입자가 퍼짐 */
    world_tree: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#020a04 0%,#0c2410 70%,#1a3a1c 100%);');
      cArt(c, 480, 980, 760);
      const t = spawn(c, 'fx-tree', 1150, 520, 'width:900px;height:900px;');
      t.innerHTML = G.icons.svg('tree');
      run(c, t, [{ transform: 'translate(-50%,-50%) translateY(300px) scale(0.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 }], 2000, { easing: 'cubic-bezier(.2,.8,.3,1)' });
      await wait(c, 700);
      rise(c, 1150, 900, 36, '#c8f5b0', 1400, 700, 11);
      const glow2 = spawn(c, 'cine-bg', 0, 0, 'background:radial-gradient(circle at 60% 50%, rgba(200,245,176,0.45), transparent 55%);');
      run(c, glow2, [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], 1200);
      await wait(c, 1100);
    },
    /* 교사 — 빛의 시범 강의: 회전하는 빛살 */
    teacher_ult: async function (c) {
      bg(c, 'background:radial-gradient(circle at 50% 50%,#3a3010 0%,#0a0804 70%);');
      cArt(c, 960, 980, 820);
      const rays = spawn(c, 'cine-rays', 960, 460);
      run(c, rays, [{ transform: 'translate(-50%,-50%) rotate(0deg) scale(0.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(40deg) scale(1)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-50%) rotate(80deg) scale(1.3)', opacity: 0 }], 1800, { easing: 'linear' });
      await wait(c, 1200);
      flashC(c, '#fff8d8', 0.85); stageShake(c, 10);
      await wait(c, 500);
    },
    /* 중간 보스 — 해일의 거대 용: 물의 용이 화면을 가로지름 */
    mb_tidal_dragon: async function (c) {
      bg(c, 'background:linear-gradient(180deg,#02101a 0%,#07283c 70%,#0d3e58 100%);');
      cArt(c, 420, 980, 860);
      await wait(c, 300);
      const dr = spawn(c, 'fx-dragon', -500, 300, 'width:1400px;height:320px;');
      dr.innerHTML = '<div class="fx-dragon-head" style="width:360px;height:280px"></div><div class="fx-dragon-body" style="width:1120px;height:160px;top:80px"></div>';
      await run(c, dr, [{ left: '-500px', top: '260px', transform: 'translate(-50%,-50%) rotate(6deg)' }, { left: '2500px', top: '520px', transform: 'translate(-50%,-50%) rotate(14deg)' }], 1300, { easing: 'cubic-bezier(.4,0,.6,1)' });
      stageShake(c, 14); flashC(c, '#cdeeff', 0.5);
      await wait(c, 300);
    },
    corusco_finale: async function (c) {
      await CINE.thunder_cloud(c);
      flashC(c, '#ffffff', 0.9);
      await wait(c, 300);
    },
    generic: async function (c) {
      bg(c, 'background:radial-gradient(circle at 50% 50%,' + c.color + ' 0%,#05060a 70%);');
      cArt(c, 960, 980, 820);
      ring(c, 960, 460, c.color, 6, 1200);
      await wait(c, 1600);
      flashC(c, '#ffffff', 0.6);
      await wait(c, 300);
    }
  };
  async function cine(name, cctx) { return (CINE[name] || CINE.generic)(cctx); }

  /* [마력 분배]: 시전자에게서 금빛 구슬이 아군에게 흩어짐 */
  FX_EXTRA.light_share = async function (ctx, e) {
    const a = ctx.point(e.actor, 'chest');
    glow(ctx, e.actor, 'rgba(255,215,94,1)', 900);
    ring(ctx, a.x, a.y, '#ffd75e', 2, 600);
    await wait(ctx, 300);
    await Promise.all(e.allies.filter(function (u) { return u !== e.actor; }).map(function (uid) {
      const p = ctx.point(uid, 'chest');
      return shot(ctx, a, p, '#fff6d0', 'rgba(255,215,94,0.9)', 420, 18).then(function () { return ring(ctx, p.x, p.y, '#ffd75e', 1.4, 500); });
    }));
  };

  const FX = {
    /* 화염 탄환: 총구 섬광 → 화염 탄환이 날아가 → 폭발 + 불씨 */
    pyro_shell: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle');
      const t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(255,140,40,0.9)', 600);
      await wait(ctx, 250);
      recoil(ctx, e.actor);
      burst(ctx, m.x, m.y, 'is-muzzle', 1.6, 300);
      const ang = Math.atan2(t.y - m.y, t.x - m.x) * 180 / Math.PI;
      const b = spawn(ctx, 'fx-bullet', m.x, m.y);
      const dx = t.x - m.x, dy = t.y - m.y;
      for (let i = 1; i <= 6; i++) {
        const em = spawn(ctx, 'fx-ember', m.x + dx * i / 7, m.y + dy * i / 7);
        run(ctx, em, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0.9, offset: 0.2 }, { opacity: 0, transform: 'translate(-50%,-120%) scale(0.2)' }], 600, { delay: 40 + i * 55 });
      }
      await run(ctx, b, [
        { transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) translateX(0)' },
        { transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) translateX(' + Math.hypot(dx, dy) + 'px)' }
      ], 460, { easing: 'cubic-bezier(0.5,0,0.9,0.6)' });
      ctx.shake(4);
      burst(ctx, t.x, t.y, '', 2.4, 560);
      sparks(ctx, t.x, t.y, 12, 110);
      await flames(ctx, t.x, t.y + 40, 3, 30);
    },

    /* 대지 장벽: 발밑 문양 → 적 2명 아래에서 바위가 솟구침 → 아군 전체 육각 보호막 */
    earth_guard: async function (ctx, e) {
      const f = ctx.point(e.actor, 'feet');
      const rune = spawn(ctx, 'fx-rune', f.x, f.y);
      run(ctx, rune, [
        { transform: 'translate(-50%,-50%) scale(0.2, 0.06) rotate(0deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1, 0.3) rotate(60deg)', opacity: 1, offset: 0.4 },
        { transform: 'translate(-50%,-50%) scale(1.1, 0.33) rotate(120deg)', opacity: 0 }
      ], 1300);
      glow(ctx, e.actor, 'rgba(232,196,74,0.9)', 900);
      await wait(ctx, 420);
      const rocks = [];
      e.targets.forEach(function (uid, ti) {
        const p = ctx.point(uid, 'feet');
        [-46, 0, 44].forEach(function (ox, k) {
          const r = spawn(ctx, 'fx-rock' + (k === 1 ? ' is-big' : ''), p.x + ox, p.y + 10);
          rocks.push(run(ctx, r, [
            { transform: 'translate(-50%,-100%) translateY(120px) scaleY(0.3)', opacity: 0 },
            { transform: 'translate(-50%,-100%) translateY(0) scaleY(1.05)', opacity: 1, offset: 0.25 },
            { transform: 'translate(-50%,-100%) translateY(0) scaleY(1)', opacity: 1, offset: 0.7 },
            { transform: 'translate(-50%,-100%) translateY(30px) scaleY(0.8)', opacity: 0 }
          ], 950, { delay: ti * 160 + k * 70, easing: 'cubic-bezier(0.2,0.9,0.3,1)' }));
        });
        const dust = spawn(ctx, 'fx-dust', p.x, p.y + 6);
        rocks.push(run(ctx, dust, [{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], 800, { delay: ti * 160 + 120 }));
      });
      setTimeout(function () { if (!ctx.signal.aborted) ctx.shake(5); }, 300 / ctx.speed);
      await wait(ctx, 650);
      e.allies.forEach(function (uid, i) { hexShield(ctx, uid, i * 120); });
      await Promise.all(rocks);
    },

    /* 과열 과충전: 열기 고리가 퍼짐 → 아군 전체에 불씨가 피어오름 */
    overheat: async function (ctx, e) {
      const c = ctx.point(e.actor, 'chest');
      glow(ctx, e.actor, 'rgba(255,120,30,1)', 1300);
      const rings = [0, 1, 2].map(function (i) {
        const r = spawn(ctx, 'fx-ring', c.x, c.y);
        return run(ctx, r, [{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(2.8)', opacity: 0 }], 800, { delay: i * 160 });
      });
      await wait(ctx, 380);
      const embers = [];
      e.allies.forEach(function (uid) {
        const f = ctx.point(uid, 'feet');
        glow(ctx, uid, 'rgba(255,150,50,0.8)', 900);
        for (let i = 0; i < 12; i++) {
          const em = spawn(ctx, 'fx-ember is-big', f.x + (Math.random() - 0.5) * 150, f.y - Math.random() * 40);
          embers.push(run(ctx, em, [
            { transform: 'translate(-50%,-50%) scale(0.5)', opacity: 0 },
            { transform: 'translate(-50%,-50%) translateY(-60px) scale(1)', opacity: 1, offset: 0.3 },
            { transform: 'translate(-50%,-50%) translateY(-240px) scale(0.2)', opacity: 0 }
          ], 1000, { delay: i * 45, easing: 'ease-out' }));
        }
      });
      await Promise.all(rings.concat(embers));
    },

    /* 종말의 메테오: 신호탄 → 하늘이 어두워짐 → 메테오 낙하 → 대폭발 */
    meteor: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle');
      glow(ctx, e.actor, 'rgba(255,140,40,1)', 800);
      await wait(ctx, 250);
      recoil(ctx, e.actor);
      const flare = spawn(ctx, 'fx-flare', m.x, m.y);
      await run(ctx, flare, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-50%) translate(-60px,' + (-m.y - 60) + 'px)', opacity: 0.6 }], 520, { easing: 'ease-in' });

      const dim = spawn(ctx, 'fx-dim', 0, 0);
      run(ctx, dim, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 2600, { easing: 'linear' });
      await wait(ctx, 450);

      const pts = e.targets.map(function (u) { return ctx.point(u, 'feet'); });
      const cx = pts.reduce(function (a, p) { return a + p.x; }, 0) / pts.length;
      const gy = pts[0].y - 40;
      const sx = cx + 520, sy = -240;
      const ang = Math.atan2(gy - sy, cx - sx) * 180 / Math.PI;
      const met = spawn(ctx, 'fx-meteor', sx, sy);
      met.innerHTML = '<div class="fx-meteor-tail"></div><div class="fx-meteor-core"></div>';
      met.style.transform = 'translate(-50%,-50%) rotate(' + ang + 'deg)';
      await run(ctx, met, [
        { left: sx + 'px', top: sy + 'px', transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) scale(0.6)' },
        { left: cx + 'px', top: gy + 'px', transform: 'translate(-50%,-50%) rotate(' + ang + 'deg) scale(1.2)' }
      ], 760, { easing: 'cubic-bezier(0.55,0,1,0.45)' });

      ctx.shake(16);
      const flash = spawn(ctx, 'fx-flash', 0, 0);
      run(ctx, flash, [{ opacity: 0.6 }, { opacity: 0 }], 650);
      const wave = spawn(ctx, 'fx-wave', cx, gy + 40);
      run(ctx, wave, [{ transform: 'translate(-50%,-50%) scale(0.2, 0.06)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(3.2, 0.9)', opacity: 0 }], 900);
      pts.forEach(function (p, i) {
        burst(ctx, p.x, p.y - 160, '', 3, 700);
        flames(ctx, p.x, p.y - 20, 5, 40);
        sparks(ctx, p.x, p.y - 140, 14, 170, 'fx-spark is-big', 700);
      });
      await wait(ctx, 900);
    },


    /* ── 샤린 (물) ── */
    water_bolt: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle'), t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(120,200,230,0.9)', 600);
      await wait(ctx, 250);
      cburst(ctx, m.x, m.y, '#9fe0ff', 1.4, 300, 40);
      await shot(ctx, m, t, '#e6f8ff', 'rgba(80,170,220,0.85)', 520, 54);
      ctx.shake(3);
      cburst(ctx, t.x, t.y, '#7fd0f0', 2.4, 600);
      await rise(ctx, t.x, t.y + 60, 10, '#9fe0ff', 120, 120, 8);
    },
    mana_trace: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(120,200,230,0.9)', 800);
      await wait(ctx, 250);
      const eye = spawn(ctx, 'fx-eye', t.x, t.y - 140);
      eye.innerHTML = G.icons.svg('eye');
      ring(ctx, t.x, t.y, '#9fe0ff', 2, 700);
      ring(ctx, t.x, t.y, '#9fe0ff', 2, 700, 250);
      await run(ctx, eye, [
        { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }
      ], 1100);
    },
    clear_stream: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(120,230,200,0.9)', 900);
      const c = ctx.point(e.actor, 'chest');
      ring(ctx, c.x, c.y, '#8fe8d0', 2.6, 800);
      await wait(ctx, 300);
      await Promise.all(e.allies.map(function (uid, i) {
        const f = ctx.point(uid, 'feet');
        glow(ctx, uid, 'rgba(120,230,200,0.8)', 900);
        return rise(ctx, f.x, f.y, 12, '#8fe8d0', 140, 260, 10);
      }));
    },
    undertow: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(120,200,230,1)', 1000);
      dim(ctx, 'rgba(0,20,40,0.6)', 2600);
      await wait(ctx, 400);
      const c = center(ctx, e.targets);
      const w = spawn(ctx, 'fx-tide', c.x + 700, c.y - 120);
      await run(ctx, w, [
        { transform: 'translate(-50%,-50%) scaleY(0.2)', opacity: 0, left: (c.x + 700) + 'px' },
        { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%,-50%) scaleY(1.1)', opacity: 0.9, left: (c.x - 200) + 'px' }
      ], 900, { easing: 'cubic-bezier(0.4,0,0.6,1)' });
      ctx.shake(10);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, '#9fe0ff', 3, 700); rise(ctx, p.x, p.y + 100, 10, '#9fe0ff', 160, 160, 9); });
      await wait(ctx, 500);
      e.allies.forEach(function (uid) { const f = ctx.point(uid, 'feet'); rise(ctx, f.x, f.y, 8, '#8fe8d0', 120, 220, 9); });
      await wait(ctx, 600);
    },

    /* ── 나즈나 (자연) ── */
    thorn_vine: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,200,100,0.9)', 700);
      await wait(ctx, 300);
      ctx.shake(4);
      await spikes(ctx, e.targets[0], '#4f7a3a', 0);
    },
    vine_leap: async function (ctx, e) {
      hop(ctx, e.actor);
      const f = ctx.point(e.actor, 'feet');
      spikes(ctx, e.actor, '#5b8a45', 0);
      await wait(ctx, 500);
      await Promise.all(e.targets.map(function (uid, i) {
        const t = ctx.point(uid, 'chest');
        return wait(ctx, i * 180).then(function () { ctx.shake(4); cburst(ctx, t.x, t.y, '#9fd27a', 2.2, 520); return rise(ctx, t.x, t.y + 40, 8, '#9fd27a', 120, 140, 8); });
      }));
    },
    root_ward: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,200,100,0.9)', 900);
      const f = ctx.point(e.actor, 'feet');
      const rune = spawn(ctx, 'fx-rune', f.x, f.y, 'border-color:#8fc46a;box-shadow:0 0 22px rgba(140,200,100,0.6), inset 0 0 30px rgba(140,200,100,0.35);');
      run(ctx, rune, [{ transform: 'translate(-50%,-50%) scale(0.2,0.06)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1,0.3) rotate(60deg)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(1.1,0.33) rotate(120deg)', opacity: 0 }], 1200);
      await wait(ctx, 400);
      await Promise.all(e.allies.map(function (uid, i) {
        const p = ctx.point(uid, 'chest');
        const h = spawn(ctx, 'fx-hex is-green', p.x, p.y + 30);
        h.innerHTML = '<svg viewBox="0 0 100 116"><polygon points="50,2 98,30 98,86 50,114 2,86 2,30"/></svg>';
        return run(ctx, h, [{ transform: 'translate(-50%,-50%) scale(0.75)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.02)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 }], 1000, { delay: i * 120 });
      }));
    },
    forest: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,200,100,1)', 1000);
      dim(ctx, 'rgba(8,24,6,0.62)', 2800);
      await wait(ctx, 450);
      ctx.shake(8);
      await Promise.all(e.targets.map(function (uid, i) { return spikes(ctx, uid, '#3e6a2c', i * 120); }));
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, '#9fd27a', 3, 700); });
      rise(ctx, center(ctx, e.targets).x, GROUND() , 24, '#a7dd7e', 700, 300, 10);
      await wait(ctx, 700);
    },

    /* ── 알리제 (바람 + 화염) ── */
    gale_rush: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest');
      const a = ctx.point(e.actor, 'chest');
      streaks(ctx, a.x, a.y, 'rgba(200,240,230,0.9)', -1);
      dashTo(ctx, e.actor, t.x);
      await wait(ctx, 340);
      ctx.shake(6);
      cburst(ctx, t.x, t.y, '#d8f4ee', 2.4, 520);
      streaks(ctx, t.x, t.y, 'rgba(200,240,230,0.9)', -1);
      await wait(ctx, 600);
    },
    blast_knuckle: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(255,140,40,0.9)', 600);
      dashTo(ctx, e.actor, t.x);
      await wait(ctx, 360);
      ctx.shake(9);
      burst(ctx, t.x, t.y, '', 3, 650);
      sparks(ctx, t.x, t.y, 14, 150);
      await flames(ctx, t.x, t.y + 40, 4, 34);
    },
    tailwind: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(200,240,230,0.9)', 900);
      await Promise.all(e.allies.map(function (uid, i) {
        const p = ctx.point(uid, 'chest');
        return wait(ctx, i * 120).then(function () { glow(ctx, uid, 'rgba(200,240,230,0.8)', 700); return streaks(ctx, p.x, p.y, 'rgba(200,240,230,0.85)', -1); });
      }));
    },
    tempest: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(255,160,60,1)', 1000);
      dim(ctx, 'rgba(30,10,0,0.6)', 2800);
      await wait(ctx, 450);
      const c = center(ctx, e.targets, 'chest');
      const tw = [0, 1, 2, 3, 4].map(function (i) {
        const r = spawn(ctx, 'fx-ring is-tornado', c.x, c.y + 120 - i * 70, 'width:' + (120 + i * 60) + 'px;height:' + (40 + i * 14) + 'px;');
        return run(ctx, r, [
          { transform: 'translate(-50%,-50%) rotate(0deg) scale(0.4)', opacity: 0 },
          { transform: 'translate(-50%,-50%) rotate(180deg) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(-50%,-50%) rotate(540deg) scale(1.1)', opacity: 0.9, offset: 0.8 },
          { transform: 'translate(-50%,-50%) rotate(720deg) scale(1.3)', opacity: 0 }
        ], 1500, { delay: i * 60, easing: 'linear' });
      });
      ctx.shake(10);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'feet'); flames(ctx, p.x, p.y - 20, 5, 38); });
      await Promise.all(tw);
    },

    /* ── 레이 (번개) ── */
    volt_shot: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle'), t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(185,168,255,0.95)', 600);
      cburst(ctx, m.x, m.y, VOLT, 1.2, 380, 50);
      await wait(ctx, 260);
      recoil(ctx, e.actor);
      shot(ctx, m, t, '#f4f0ff', 'rgba(150,120,255,0.9)', 360, 70);
      bolt(ctx, m, t, VOLT, 4, 420, 60);
      await wait(ctx, 380);
      ctx.shake(5);
      cburst(ctx, t.x, t.y, VOLT, 2.4, 520);
      bolt(ctx, { x: t.x - 60, y: t.y - 90 }, { x: t.x + 40, y: t.y + 80 }, VOLT, 3, 360, 0, 18);
      await spark(ctx, t, VOLT, 12, 120);
    },
    overcharge: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle');
      glow(ctx, e.actor, 'rgba(185,168,255,1)', 1100);
      ring(ctx, m.x, m.y, VOLT, 1.6, 600);
      await wait(ctx, 420);
      recoil(ctx, e.actor);
      e.targets.forEach(function (uid, i) {
        const t = ctx.point(uid, 'chest');
        bolt(ctx, m, t, VOLT, 6, 620, i * 70, 34);
        bolt(ctx, m, { x: t.x, y: t.y + 40 }, '#8a6cff', 3, 560, 60 + i * 70, 40);
      });
      await wait(ctx, 300);
      ctx.shake(8);
      e.targets.forEach(function (uid) { const t = ctx.point(uid, 'chest'); cburst(ctx, t.x, t.y, VOLT, 2.6, 560); spark(ctx, t, VOLT, 10, 140); });
      await wait(ctx, 550);
    },
    hyper_charge: async function (ctx, e) {
      const c = ctx.point(e.actor, 'chest'), f = ctx.point(e.actor, 'feet');
      glow(ctx, e.actor, 'rgba(185,168,255,1)', 1500);
      const ps = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, r = 220;
        ps.push(bolt(ctx, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.8 }, c, VOLT, 3, 380, i * 110, 22));
      }
      ring(ctx, c.x, c.y, VOLT, 0.4, 900, 0);
      rise(ctx, f.x, f.y, 14, '#cbbcff', 140, 280, 7);
      await Promise.all(ps);
      cburst(ctx, c.x, c.y, VOLT, 1.8, 500);
      await wait(ctx, 300);
    },
    thunder_buster: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle'), c = ctx.point(e.actor, 'chest');
      glow(ctx, e.actor, 'rgba(185,168,255,1)', 1800);
      dim(ctx, 'rgba(8,4,30,0.72)', 3200);
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        bolt(ctx, { x: c.x + Math.cos(a) * 260, y: c.y + Math.sin(a) * 200 }, m, VOLT, 3, 360, i * 80, 20);
      }
      const orb = spawn(ctx, 'fx-volt-orb', m.x, m.y);
      await run(ctx, orb, [{ transform: 'translate(-50%,-50%) scale(0.1)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], 800);
      recoil(ctx, e.actor);
      const cx = center(ctx, e.targets, 'chest');
      const beam = spawn(ctx, 'fx-volt-beam', (m.x + cx.x) / 2, m.y, 'width:' + Math.abs(m.x - cx.x + 200) + 'px;');
      run(ctx, beam, [{ transform: 'translate(-50%,-50%) scaleY(0.05)', opacity: 0 }, { transform: 'translate(-50%,-50%) scaleY(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-50%) scaleY(0.8)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) scaleY(0.05)', opacity: 0 }], 1000);
      e.targets.forEach(function (uid, i) { const t = ctx.point(uid, 'chest'); bolt(ctx, m, t, VOLT, 8, 900, i * 60, 40); });
      await wait(ctx, 250);
      ctx.shake(16);
      const flash = spawn(ctx, 'fx-flash', 0, 0, 'background:#e6deff;');
      run(ctx, flash, [{ opacity: 0.55 }, { opacity: 0 }], 600);
      e.targets.forEach(function (uid) {
        const t = ctx.point(uid, 'chest');
        cburst(ctx, t.x, t.y, VOLT, 3.4, 800);
        for (let k = 0; k < 3; k++) bolt(ctx, { x: t.x + (Math.random() - 0.5) * 60, y: -40 }, { x: t.x + (Math.random() - 0.5) * 40, y: t.y + 120 }, VOLT, 5, 500, 150 + k * 120, 40);
        spark(ctx, t, VOLT, 16, 190);
      });
      await wait(ctx, 1000);
    },

    /* ── 코루스코 (번개) ── */
    chain_lightning: async function (ctx, e) {
      const c = ctx.point(e.actor, 'chest');
      glow(ctx, e.actor, 'rgba(255,215,94,0.95)', 700);
      await wait(ctx, 260);
      let from = { x: c.x - 60, y: c.y - 30 };
      for (let i = 0; i < e.targets.length; i++) {
        const t = ctx.point(e.targets[i], 'chest');
        bolt(ctx, from, t, GOLD, 4, 460, 0, 30);
        await wait(ctx, 150);
        ctx.shake(3);
        cburst(ctx, t.x, t.y, GOLD, 1.9, 460);
        spark(ctx, t, GOLD, 8, 100);
        from = t;
      }
      await wait(ctx, 420);
    },
    voltage_plug: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(255,215,94,0.95)', 700);
      dashTo(ctx, e.actor, t.x);
      await wait(ctx, 360);
      ctx.shake(6);
      const plug = spawn(ctx, 'fx-plug', t.x, t.y);
      run(ctx, plug, [{ transform: 'translate(-50%,-50%) scale(1.8) rotate(45deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(45deg)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-50%) scale(1) rotate(45deg)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(0.6) rotate(45deg)', opacity: 0 }], 900);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + 0.4;
        bolt(ctx, t, { x: t.x + Math.cos(a) * 130, y: t.y + Math.sin(a) * 130 }, GOLD, 3, 380, 120 + k * 60, 16);
      }
      cburst(ctx, t.x, t.y, GOLD, 2.2, 520);
      await wait(ctx, 700);
    },
    hv_setup: async function (ctx, e) {
      const c = ctx.point(e.actor, 'chest'), f = ctx.point(e.actor, 'feet');
      glow(ctx, e.actor, 'rgba(255,215,94,1)', 1100);
      ring(ctx, c.x, c.y, GOLD, 2.4, 700);
      ring(ctx, c.x, c.y, GOLD, 2.4, 700, 180);
      for (let i = 0; i < 4; i++) bolt(ctx, { x: f.x + (i - 1.5) * 50, y: f.y }, { x: c.x + (i - 1.5) * 18, y: c.y - 140 }, GOLD, 2.5, 340, i * 90, 14);
      await rise(ctx, f.x, f.y, 12, '#ffe7a0', 120, 260, 7);
    },
    thunder_cloud: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(255,215,94,1)', 1500);
      dim(ctx, 'rgba(10,8,0,0.7)', 3200);
      await wait(ctx, 300);
      const cx = center(ctx, e.targets, 'chest');
      const cloud = spawn(ctx, 'fx-cloud', cx.x, 90);
      run(ctx, cloud, [{ transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 }], 2600);
      await wait(ctx, 600);
      for (let round = 0; round < 3; round++) {
        e.targets.forEach(function (uid, i) {
          const t = ctx.point(uid, 'chest');
          bolt(ctx, { x: t.x + (Math.random() - 0.5) * 120, y: 110 }, { x: t.x, y: t.y + 40 }, GOLD, 5, 420, i * 70, 36);
        });
        await wait(ctx, 200);
        ctx.shake(7 + round * 3);
        e.targets.forEach(function (uid) { const t = ctx.point(uid, 'chest'); cburst(ctx, t.x, t.y, GOLD, 2.2, 460); });
        await wait(ctx, 220);
      }
      const flash = spawn(ctx, 'fx-flash', 0, 0, 'background:#fff3c4;');
      run(ctx, flash, [{ opacity: 0.45 }, { opacity: 0 }], 550);
      await wait(ctx, 500);
    },

    /* ── 중간 보스 (물/자연) ── */
    mb_drip_shot: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle'), t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(90,190,230,1)', 700);
      cburst(ctx, m.x, m.y, '#7fd0f0', 1.4, 360, 50);
      await wait(ctx, 300);
      await shot(ctx, m, t, '#dff6ff', 'rgba(40,150,210,0.9)', 420, 70);
      ctx.shake(5);
      cburst(ctx, t.x, t.y, '#5fc0ea', 2.6, 560);
      for (let i = 0; i < 8; i++) {
        const d = spawn(ctx, 'fx-drop', t.x + (Math.random() - 0.5) * 120, t.y - 40);
        run(ctx, d, [{ transform: 'translate(-50%,-50%) translateY(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) translateY(' + (120 + Math.random() * 80) + 'px)', opacity: 0 }], 700, { delay: i * 40, easing: 'ease-in' });
      }
      await wait(ctx, 600);
    },
    mb_clone: async function (ctx, e) {
      const sp = ctx.sprite(e.actor);
      const f = ctx.point(e.actor, 'feet');
      glow(ctx, e.actor, 'rgba(120,210,240,1)', 1000);
      ring(ctx, f.x, f.y - 200, '#9fe0ff', 2.4, 800);
      if (sp) {
        const ghost = sp.cloneNode(true);
        ghost.className = 'fx fx-ghost';
        ghost.style.left = f.x + 'px'; ghost.style.top = (f.y - 200) + 'px';
        ctx.layer.appendChild(ghost);
        await run(ctx, ghost, [
          { transform: 'translate(-50%,-50%)', opacity: 0 },
          { transform: 'translate(-50%,-50%) translateX(-70px)', opacity: 0.7, offset: 0.4 },
          { transform: 'translate(-50%,-50%) translateX(-90px)', opacity: 0.55, offset: 0.8 },
          { transform: 'translate(-50%,-50%) translateX(-90px)', opacity: 0 }
        ], 1300);
      } else await wait(ctx, 900);
    },
    mb_blessing: async function (ctx, e) {
      const f = ctx.point(e.actor, 'feet');
      glow(ctx, e.actor, 'rgba(140,220,150,1)', 1100);
      ring(ctx, f.x, f.y - 200, '#9fe6a8', 2.6, 800);
      await Promise.all(e.allies.map(function (uid) { const p = ctx.point(uid, 'feet'); return rise(ctx, p.x, p.y, 16, '#a6e8b8', 160, 300, 9); }));
    },
    mb_tidal_dragon: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(90,190,230,1)', 1600);
      dim(ctx, 'rgba(0,18,36,0.72)', 3400);
      await wait(ctx, 450);
      const c = center(ctx, e.targets, 'chest');
      const dr = spawn(ctx, 'fx-dragon', -300, 160);
      dr.innerHTML = '<div class="fx-dragon-head"></div><div class="fx-dragon-body"></div>';
      await run(ctx, dr, [
        { left: '-300px', top: '120px', transform: 'translate(-50%,-50%) rotate(8deg) scale(0.8)', opacity: 0 },
        { left: (c.x - 300) + 'px', top: '200px', transform: 'translate(-50%,-50%) rotate(14deg) scale(1)', opacity: 1, offset: 0.45 },
        { left: (c.x + 200) + 'px', top: (c.y - 40) + 'px', transform: 'translate(-50%,-50%) rotate(26deg) scale(1.1)', opacity: 1 }
      ], 1300, { easing: 'cubic-bezier(0.4,0,0.7,1)' });
      ctx.shake(16);
      const flash = spawn(ctx, 'fx-flash', 0, 0, 'background:#cdeeff;');
      run(ctx, flash, [{ opacity: 0.5 }, { opacity: 0 }], 600);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, '#7fd0f0', 3.2, 760); rise(ctx, p.x, p.y + 120, 12, '#9fe0ff', 180, 200, 10); });
      await wait(ctx, 900);
    },

    /* 보스 코루스코 결말 공격: 화면이 암전 → 뇌운 → 전장 전체 낙뢰 */
    corusco_finale: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(255,215,94,1)', 2400);
      dim(ctx, 'rgba(0,0,0,0.85)', 4200);
      const c = ctx.point(e.actor, 'chest');
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        bolt(ctx, { x: c.x + Math.cos(a) * 300, y: c.y + Math.sin(a) * 240 }, c, GOLD, 3, 340, i * 70, 24);
      }
      await wait(ctx, 900);
      const cloud = spawn(ctx, 'fx-cloud', 960, 80, 'width:1800px;');
      run(ctx, cloud, [{ transform: 'translate(-50%,-50%) scale(0.7)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 1, offset: 0.85 }, { opacity: 0 }], 3000);
      await wait(ctx, 500);
      for (let round = 0; round < 4; round++) {
        for (let k = 0; k < 6; k++) {
          const x = 900 + Math.random() * 950;
          bolt(ctx, { x: x + (Math.random() - 0.5) * 120, y: 60 }, { x: x, y: 700 }, GOLD, 6, 380, k * 40, 44);
        }
        ctx.shake(10 + round * 4);
        await wait(ctx, 260);
      }
      const flash = spawn(ctx, 'fx-flash', 0, 0, 'background:#fffbe6;');
      run(ctx, flash, [{ opacity: 0.9 }, { opacity: 0 }], 900);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, GOLD, 3.6, 900); });
      ctx.shake(22);
      await wait(ctx, 900);
    },

    /* ── 페델레 (중력) ── */
    gravity_shot: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle'), t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(140,160,230,0.95)', 700);
      ring(ctx, m.x, m.y, '#aab8ff', 1.2, 400);
      await wait(ctx, 280);
      recoil(ctx, e.actor);
      await shot(ctx, m, t, '#1a1f3a', 'rgba(130,150,255,0.85)', 460, 46);
      ctx.shake(5);
      const g = spawn(ctx, 'fx-gwell', t.x, t.y);
      run(ctx, g, [{ transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 }], 700);
      const sp = ctx.sprite(e.targets[0]);
      if (sp) sp.animate([{ transform: 'none' }, { transform: 'translateY(16px) scaleY(0.94)', offset: 0.3 }, { transform: 'none' }], { duration: 600 / ctx.speed });
      await wait(ctx, 600);
    },
    absolute_field: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,160,230,1)', 1000);
      const c = center(ctx, e.allies, 'chest');
      const dome = spawn(ctx, 'fx-dome', c.x, c.y + 40);
      run(ctx, dome, [{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.03)', opacity: 0.8, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 0 }], 1300);
      await wait(ctx, 400);
      e.allies.forEach(function (uid, i) { hexShield(ctx, uid, i * 100); });
      await wait(ctx, 900);
    },
    gravity_burst: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,160,230,1)', 800);
      await wait(ctx, 300);
      ctx.shake(7);
      await Promise.all(e.targets.map(function (uid, i) {
        const t = ctx.point(uid, 'chest');
        return wait(ctx, i * 140).then(function () {
          const g = spawn(ctx, 'fx-gwell', t.x, t.y);
          ring(ctx, t.x, t.y, '#aab8ff', 2.2, 600);
          const sp = ctx.sprite(uid);
          if (sp) sp.animate([{ transform: 'none' }, { transform: 'translateY(20px) scaleY(0.92)', offset: 0.3 }, { transform: 'none' }], { duration: 650 / ctx.speed });
          return run(ctx, g, [{ transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 }], 800);
        });
      }));
    },
    grand_pressure: async function (ctx, e) {
      dim(ctx, 'rgba(6,8,30,0.75)', 3000);
      await wait(ctx, 300);
      const c = center(ctx, e.targets, 'chest');
      const g = spawn(ctx, 'fx-gwell is-big', c.x, c.y - 40);
      run(ctx, g, [{ transform: 'translate(-50%,-50%) scale(0.1) rotate(0deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(180deg)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(0.4) rotate(360deg)', opacity: 0 }], 1800);
      for (let i = 0; i < 3; i++) ring(ctx, c.x, c.y, '#aab8ff', 5 - i, 900, i * 200);
      await wait(ctx, 700);
      ctx.shake(14);
      e.targets.forEach(function (uid) {
        const sp = ctx.sprite(uid);
        if (sp) sp.animate([{ transform: 'none' }, { transform: 'translateY(34px) scaleY(0.88)', offset: 0.25 }, { transform: 'translateY(34px) scaleY(0.88)', offset: 0.7 }, { transform: 'none' }], { duration: 900 / ctx.speed });
        const p = ctx.point(uid, 'feet'); cburst(ctx, p.x, p.y - 10, '#aab8ff', 3, 700);
      });
      await wait(ctx, 500);
      e.allies.forEach(function (uid, i) { hexShield(ctx, uid, i * 80); });
      await wait(ctx, 700);
    },

    /* ── 치유사 (자연 · 치유) ── */
    neural_link: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,220,150,1)', 1200);
      const a = ctx.point(e.actor, 'chest');
      e.allies.forEach(function (uid, i) {
        if (uid === e.actor) return;
        const p = ctx.point(uid, 'chest');
        const l = spawn(ctx, 'fx-vinelink', a.x, a.y, 'width:' + Math.hypot(p.x - a.x, p.y - a.y) + 'px;transform-origin:0 50%;');
        const ang = Math.atan2(p.y - a.y, p.x - a.x) * 180 / Math.PI;
        run(ctx, l, [{ transform: 'translate(0,-50%) rotate(' + ang + 'deg) scaleX(0)', opacity: 1 }, { transform: 'translate(0,-50%) rotate(' + ang + 'deg) scaleX(1)', opacity: 1, offset: 0.4 }, { transform: 'translate(0,-50%) rotate(' + ang + 'deg) scaleX(1)', opacity: 0 }], 1300, { delay: i * 120 });
      });
      await wait(ctx, 500);
      await Promise.all(e.allies.map(function (uid) { const p = ctx.point(uid, 'chest'); return ring(ctx, p.x, p.y, '#9fe6a8', 1.8, 700); }));
    },
    cell_wall: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(140,220,150,1)', 1000);
      await wait(ctx, 300);
      await Promise.all(e.allies.map(function (uid, i) {
        const p = ctx.point(uid, 'chest');
        const h = spawn(ctx, 'fx-hex is-green', p.x, p.y + 30);
        h.innerHTML = '<svg viewBox="0 0 100 116"><polygon points="50,2 98,30 98,86 50,114 2,86 2,30"/><polygon points="50,30 74,44 74,72 50,86 26,72 26,44"/></svg>';
        return run(ctx, h, [{ transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.02)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0 }], 1100, { delay: i * 120 });
      }));
    },
    life_cycle: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(160,240,170,1)', 1300);
      const f = ctx.point(e.actor, 'feet');
      const rune = spawn(ctx, 'fx-rune', f.x, f.y, 'border-color:#9fe6a8;box-shadow:0 0 22px rgba(140,220,150,0.6), inset 0 0 30px rgba(140,220,150,0.35);');
      run(ctx, rune, [{ transform: 'translate(-50%,-50%) scale(0.2,0.06)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.2,0.34) rotate(90deg)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(1.3,0.36) rotate(180deg)', opacity: 0 }], 1400);
      await wait(ctx, 400);
      await Promise.all(e.allies.map(function (uid) { const p = ctx.point(uid, 'feet'); glow(ctx, uid, 'rgba(160,240,170,0.9)', 900); return rise(ctx, p.x, p.y, 16, '#b8f0c0', 160, 320, 9); }));
    },
    world_tree: async function (ctx, e) {
      dim(ctx, 'rgba(4,20,8,0.6)', 3200);
      const c = center(ctx, e.allies, 'feet');
      const tree = spawn(ctx, 'fx-tree', c.x, c.y - 330);
      tree.innerHTML = G.icons.svg('tree');
      run(ctx, tree, [{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.05)', opacity: 0.8, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 }], 2600);
      await wait(ctx, 700);
      rise(ctx, c.x, c.y, 30, '#c8f5b0', 700, 420, 10);
      e.allies.forEach(function (uid, i) { glow(ctx, uid, 'rgba(160,240,170,1)', 1000); });
      await wait(ctx, 1400);
    },

    /* ── 알리제 (새 구성) ── */
    wind_kick: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest'), a = ctx.point(e.actor, 'chest');
      streaks(ctx, a.x, a.y, 'rgba(220,245,240,0.9)', -1);
      dashTo(ctx, e.actor, t.x);
      await wait(ctx, 330);
      ctx.shake(6);
      const arc = spawn(ctx, 'fx-claw', t.x, t.y, 'background:linear-gradient(90deg,transparent,#fff,transparent);height:10px;width:260px;');
      run(ctx, arc, [{ transform: 'translate(-50%,-50%) rotate(-30deg) scaleX(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) rotate(-30deg) scaleX(1)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) rotate(-30deg) scaleX(1.1)', opacity: 0 }], 420);
      cburst(ctx, t.x, t.y, '#ffd2a0', 2.2, 480);
      await flames(ctx, t.x, t.y + 40, 3, 28);
    },
    knuckle_inferno: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(255,140,40,0.9)', 1400);
      const sp = ctx.sprite(e.actor), p0 = ctx.point(e.actor, 'feet');
      const dx = t.x - p0.x + (t.x < p0.x ? 140 : -140);
      if (sp) sp.animate([{ transform: 'none' }, { transform: 'translateX(' + dx + 'px)', offset: 0.15 }, { transform: 'translateX(' + dx + 'px)', offset: 0.85 }, { transform: 'none' }], { duration: 1600 / ctx.speed, easing: 'cubic-bezier(.2,0,0,1)' });
      await wait(ctx, 280);
      for (let i = 0; i < 3; i++) {
        ctx.shake(4 + i * 3);
        burst(ctx, t.x + (i - 1) * 24, t.y - 10 + i * 10, '', 1.6 + i * 0.5, 380);
        sparks(ctx, t.x, t.y, 8 + i * 4, 90 + i * 30);
        const tsp = ctx.sprite(e.targets[0]);
        if (tsp && i === 2) tsp.animate([{ transform: 'none' }, { transform: 'translateX(-80px) rotate(-6deg)', offset: 0.3 }, { transform: 'none' }], { duration: 700 / ctx.speed });
        await wait(ctx, i === 2 ? 450 : 260);
      }
      await flames(ctx, t.x, t.y + 40, 4, 34);
    },
    oxygen_ignition: async function (ctx, e) {
      const a = ctx.point(e.actor, 'muzzle');
      glow(ctx, e.actor, 'rgba(255,200,120,1)', 900);
      streaks(ctx, a.x - 100, a.y, 'rgba(220,245,240,0.9)', -1);
      await wait(ctx, 380);
      e.targets.forEach(function (uid, i) {
        const t = ctx.point(uid, 'chest');
        setTimeout(function () {
          if (ctx.signal.aborted) return;
          ring(ctx, t.x, t.y, '#ffd2a0', 3, 600);
          burst(ctx, t.x, t.y, '', 3.4, 700);
          flames(ctx, t.x, t.y + 40, 5, 40);
        }, i * 120 / ctx.speed);
      });
      await wait(ctx, 250);
      ctx.shake(12);
      await wait(ctx, 700);
    },
    ignition_cyclone: async function (ctx, e) {
      glow(ctx, e.actor, 'rgba(255,160,60,1)', 1400);
      dim(ctx, 'rgba(30,10,0,0.6)', 3000);
      const c = center(ctx, e.targets, 'chest');
      const rings = [0, 1, 2, 3, 4].map(function (i) {
        const r = spawn(ctx, 'fx-ring is-tornado', c.x, c.y + 130 - i * 75, 'width:' + (420 - i * 50) + 'px;height:' + (70 - i * 6) + 'px;');
        return run(ctx, r, [{ transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) translateY(-40px) scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0 }], 1500, { delay: i * 60, easing: 'ease-in-out' });
      });
      rise(ctx, c.x, c.y + 150, 26, '#ffb36b', 420, 380, 9);
      await wait(ctx, 1200);
      ctx.shake(18);
      const f = spawn(ctx, 'fx-flash', 0, 0);
      run(ctx, f, [{ opacity: 0.7 }, { opacity: 0 }], 600);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'feet'); burst(ctx, p.x, p.y - 150, '', 3.4, 700); flames(ctx, p.x, p.y - 20, 6, 42); });
      await Promise.all(rings);
    },
    afterburn_chase: async function (ctx, e) {
      const t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(255,140,40,1)', 900);
      rise(ctx, ctx.point(e.actor, 'feet').x, ctx.point(e.actor, 'feet').y, 10, '#ffb36b', 120, 200, 8);
      dashTo(ctx, e.actor, t.x);
      await wait(ctx, 330);
      ctx.shake(10);
      burst(ctx, t.x, t.y, '', 3.2, 600);
      sparks(ctx, t.x, t.y, 14, 150);
      e.targets.slice(1).forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, '#ffb36b', 2, 500); flames(ctx, p.x, p.y + 30, 3, 30); });
      await flames(ctx, t.x, t.y + 40, 4, 36);
    },

    /* ── 교사 ── */
    light_shot: async function (ctx, e) {
      const m = ctx.point(e.actor, 'muzzle'), t = ctx.point(e.targets[0], 'chest');
      glow(ctx, e.actor, 'rgba(255,236,170,1)', 700);
      await wait(ctx, 350);
      await shot(ctx, m, t, '#fffbe6', 'rgba(255,220,120,0.9)', 420, 80);
      ctx.shake(5);
      cburst(ctx, t.x, t.y, '#ffe9a8', 2.4, 560);
      await sparks(ctx, t.x, t.y, 10, 120, 'fx-spark');
    },
    teacher_ult: async function (ctx, e) {
      const c = ctx.point(e.actor, 'chest');
      glow(ctx, e.actor, 'rgba(255,236,170,1)', 1400);
      dim(ctx, 'rgba(40,30,0,0.55)', 2600);
      await wait(ctx, 450);
      ring(ctx, c.x, c.y, '#ffe9a8', 6, 1100);
      e.targets.forEach(function (uid, i) {
        const p = ctx.point(uid, 'feet');
        const beam = spawn(ctx, 'fx-beam', p.x, p.y - 360);
        run(ctx, beam, [{ transform: 'translate(-50%,-50%) scaleX(0.1)', opacity: 0 }, { transform: 'translate(-50%,-50%) scaleX(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) scaleX(0.2)', opacity: 0 }], 900, { delay: 300 + i * 120 });
      });
      await wait(ctx, 700);
      ctx.shake(10);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, '#ffe9a8', 2.6, 600); });
      await wait(ctx, 600);
    },
    demo_wave: async function (ctx, e) {
      const c = ctx.point(e.actor, 'chest');
      glow(ctx, e.actor, 'rgba(255,236,170,1)', 900);
      await wait(ctx, 300);
      ring(ctx, c.x, c.y, '#ffe9a8', 5, 1000);
      ring(ctx, c.x, c.y, '#ffe9a8', 5, 1000, 200);
      await wait(ctx, 600);
      ctx.shake(6);
      e.targets.forEach(function (uid) { const p = ctx.point(uid, 'chest'); cburst(ctx, p.x, p.y, '#ffe9a8', 2, 500); });
      await wait(ctx, 450);
    },

    /* 적 공격: 검은 형체가 달려들어 할퀴기 */
    shadow_strike: async function (ctx, e) {
      lunge(ctx, e.actor, 1);
      await wait(ctx, 300);
      const t = ctx.point(e.targets[0], 'chest');
      const claws = [-26, 0, 26].map(function (ox, i) {
        const c = spawn(ctx, 'fx-claw', t.x + ox, t.y);
        return run(ctx, c, [
          { transform: 'translate(-50%,-50%) rotate(-38deg) scaleX(0)', opacity: 1 },
          { transform: 'translate(-50%,-50%) rotate(-38deg) scaleX(1)', opacity: 1, offset: 0.35 },
          { transform: 'translate(-50%,-50%) rotate(-38deg) scaleX(1.1)', opacity: 0 }
        ], 480, { delay: i * 70 });
      });
      ctx.shake(5);
      burst(ctx, t.x, t.y, 'is-dark', 2, 520);
      await Promise.all(claws);
    }
  };

  async function play(name, ctx, e) {
    const fn = FX[name] || FX_EXTRA[name];
    if (!fn) {
      const s = ctx.sprite(e.actor);
      if (s) glow(ctx, e.actor, 'rgba(255,255,255,0.8)', 600);
      return wait(ctx, 500);
    }
    return fn(ctx, e);
  }

  /* 턴 종료 연소 / 열염 지대 / 보호막 흡수 */
  function burnTick(ctx, uid) { const p = ctx.point(uid, 'chest'); return flames(ctx, p.x, p.y + 30, 4, 28); }
  function zoneTick(ctx, uid) {
    const p = ctx.point(uid, 'feet');
    burst(ctx, p.x, p.y - 20, 'is-zone', 2, 500);
    return flames(ctx, p.x, p.y - 10, 4, 34);
  }
  function shieldHit(ctx, uid) { return hexShield(ctx, uid, 0); }
  /* 찌릿 피해: 대상 위로 작은 번개가 튐 */
  function zapTick(ctx, uid) {
    const p = ctx.point(uid, 'chest');
    bolt(ctx, { x: p.x - 30, y: p.y - 120 }, { x: p.x + 20, y: p.y + 40 }, VOLT, 3, 360, 0, 16);
    return spark(ctx, p, VOLT, 8, 80);
  }

  function dripTick(ctx, uid) {
    const p = ctx.point(uid, 'head');
    const ps = [];
    for (let i = 0; i < 5; i++) {
      const d = spawn(ctx, 'fx-drop', p.x + (Math.random() - 0.5) * 70, p.y - 20);
      ps.push(run(ctx, d, [{ transform: 'translate(-50%,-50%)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-50%) translateY(170px)', opacity: 0 }], 600, { delay: i * 60, easing: 'ease-in' }));
    }
    return Promise.all(ps);
  }
  /* 물의 분신이 공격을 대신 맞음 */
  function decoyHit(ctx, uid) {
    const p = ctx.point(uid, 'chest');
    cburst(ctx, p.x - 60, p.y, '#9fe0ff', 2.4, 520);
    return rise(ctx, p.x - 60, p.y + 80, 14, '#cdeeff', 120, 180, 8);
  }

  /* 궁극기 시전 직전: 발밑 문양 + 빛기둥 + 상승 입자 + 캐릭터가 살짝 떠오름 */
  function ultCharge(ctx, uid, color) {
    const f = ctx.point(uid, 'feet'), c = ctx.point(uid, 'chest');
    const sp = ctx.sprite(uid);
    if (sp) sp.animate([{ transform: 'none' }, { transform: 'translateY(-26px) scale(1.04)', offset: 0.35 }, { transform: 'translateY(-26px) scale(1.04)', offset: 0.7 }, { transform: 'none' }],
      { duration: 1400 / ctx.speed, easing: 'cubic-bezier(.3,.7,.3,1)' });
    glow(ctx, uid, color, 1400);
    const rune = spawn(ctx, 'fx-rune', f.x, f.y, 'border-color:' + color + ';box-shadow:0 0 30px ' + color + ', inset 0 0 30px ' + color + ';width:420px;height:420px;');
    run(ctx, rune, [{ transform: 'translate(-50%,-50%) scale(0.2,0.06) rotate(0deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1,0.28) rotate(90deg)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.15,0.32) rotate(200deg)', opacity: 0 }], 1500);
    const pillar = spawn(ctx, 'fx-pillar', f.x, f.y - 300, 'background:linear-gradient(0deg, ' + color + ', transparent);box-shadow:0 0 40px ' + color + ';');
    run(ctx, pillar, [{ transform: 'translate(-50%,-50%) scaleX(0.05)', opacity: 0 }, { transform: 'translate(-50%,-50%) scaleX(1)', opacity: 0.8, offset: 0.25 }, { transform: 'translate(-50%,-50%) scaleX(0.3)', opacity: 0 }], 1100);
    ring(ctx, c.x, c.y, color, 3, 700, 0);
    ring(ctx, c.x, c.y, color, 3, 700, 200);
    rise(ctx, f.x, f.y, 18, color, 200, 360, 8);
    ctx.shake(4);
  }

  return { play, burnTick, zoneTick, shieldHit, zapTick, dripTick, decoyHit, ultCharge, cine };
})();
