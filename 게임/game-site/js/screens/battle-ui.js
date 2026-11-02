/**
 * 전투 화면 (UI · 연출)
 * ─────────────────────────────────────────────────────────────
 * · 상태 변경은 모두 G.Battle(엔진)에서만 일어나고, 이 파일은 이벤트를 받아 연출/갱신만 합니다.
 * · 유닛·카드 DOM 은 uid 단위로 한 번만 만들고 바뀐 값만 갱신 (전체 재렌더링 없음)
 * · busy 플래그: 연출 중에는 입력을 받지 않음 → 연속 클릭/중복 입력 방지
 * · 화면을 벗어나면 ctx.signal 이 abort 되어 진행 중인 모든 연출이 즉시 중단됩니다.
 *
 * 턴 진행: [TURN n] 카드 선택 → 아군 행동(슬롯 순서) → [ENEMY TURN] 적 행동 → 턴 종료(연소·지속 턴 처리)
 */
(function () {
  const U = G.util;
  const B = G.Battle;

  /* 연출 속도 (ms, 1배속 기준) — 값을 키우면 더 천천히 진행됩니다 */
  const PACE = {
    introDelay: 1000,
    turnBanner: 1500,
    beforeAction: 500,
    afterCast: 350,
    hitShow: 650,
    statusShow: 450,
    betweenActions: 800,
    enemyBanner: 1600,
    betweenEnemies: 700,
    tickShow: 700,
    afterDeath: 700,
    commitDelay: 600,
    autoThink: 900
  };

  const ENEMY_X = { 1: [480], 2: [320, 620], 3: [230, 460, 690] };
  const ALLY_X = { 1: [1400], 2: [1300, 1560], 3: [1250, 1470, 1690] };
  const TYPE_LABEL = { attack: 'Attack', buff: 'Buff', debuff: 'Debuff', heal: 'Health' };
  function elemOf(k) { return (G.DATA.elements && G.DATA.elements[k]) || { name: k, color: '#555' }; }
  const ART_POS = ['50% 3%', '28% 10%', '72% 16%'];
  const GROUND_Y = 656;   // 발 위치 (캔버스 886px 기준 · 바닥에서 230px)
  /* 전투 그림 높이 (px) — 예전 400 → 320 으로 축소. 연출 좌표(point)도 이 비율로 맞춤 */
  const SPRITE_H = 320;
  const SK = SPRITE_H / 400;

  G.router.register('battle', function () {
    let cleanup = [];

    return {
      unmount: function () { cleanup.forEach(function (fn) { try { fn(); } catch (e) {} }); cleanup = []; },

      mount: function (root, params, ctx) {
        const stage = G.DATA.stages[params.stageId];
        const sess = ctx.takeBattleSession();
        const story = stage.story && G.DATA.stories[stage.story];
        const settings = G.save.getSettings();
        const signal = ctx.signal;

        /* 스토리 편성으로 플레이 중인지 (다시 하기에서 편성을 바꿨으면 튜토리얼 · 스토리 안내는 생략) */
        const storyIds = stage.formation && stage.formation.fixed ? stage.formation.fixed : null;
        const isStoryTeam = !!storyIds && storyIds.every(function (id, i) { return sess.team[i] === id; }) &&
          sess.team.slice(storyIds.length).every(function (x) { return !x; });
        const useTutorial = !!stage.tutorial && isStoryTeam;
        const tutKind = stage.tutorial === 'team' ? 'team' : 'basic';   // 'team': 스테이지 4 단체 전투 튜토리얼 (교사 설명)
        const st = B.create({
          team: sess.team,
          enemies: stage.enemies,
          seed: (sess.token || Date.now()) & 0xffffffff,
          fixedHand: useTutorial && tutKind === 'basic' ? ['arden_s1', 'arden_s2', 'arden_s1', 'arden_s1'] : null,   // 1스테이지: 3턴 안에 끝나도록 공격 카드 보장
          reserve: stage.reserve || null,
          finale: stage.finale ? { unit: stage.finale.unit, hpRatio: stage.finale.hpRatio, skill: G.DATA.enemies[stage.finale.unit].finaleSkill } : null
        });

        let busy = true;
        let paused = false, pauseWaiters = [];
        let speed = settings.speed;
        let auto = settings.auto;
        let ended = false;
        let tut = null;

        /* ── DOM ─────────────────────────────────────── */
        const s = U.el('section', 'g-screen bt-screen');
        s.innerHTML = '<div class="g-hall"><div class="g-hall-wall"></div>' +
          '<div class="g-hall-pillar" style="left:14%"></div><div class="g-hall-pillar" style="left:46%"></div><div class="g-hall-pillar" style="left:80%"></div></div>';
        const stageLayer = U.el('div', 'bt-stage-layer', { style: 'position:absolute;inset:0;' });
        const field = U.el('div', 'bt-field');
        const fxLayer = U.el('div', 'bt-fx');
        stageLayer.append(field, fxLayer);
        /* 카메라: 배경 + 전장 + 이펙트를 함께 움직임 (흔들림은 stageLayer 가 따로 담당) */
        const cam = U.el('div', 'bt-cam');
        cam.append(s.querySelector('.g-hall'), stageLayer);
        s.insertBefore(cam, s.firstChild);
        /* 스테이지 전용 배경 그림 (예: STAGE 08 숲) */
        if (stage.battleBg) {
          const hall = cam.querySelector('.g-hall');
          hall.classList.add('has-bg');
          hall.style.backgroundImage = 'url("' + stage.battleBg + '")';
          hall.style.setProperty('--bg-dim', String(stage.battleBgDim || 0));
        }

        const hudTL = U.el('div', 'bt-hud-tl');
        const turnRow = U.el('div', 'bt-hud-row');
        const fieldRow = U.el('div', 'bt-fields');
        /* 적 정보 버튼 (왼쪽 위) */
        const btnIntel = U.el('button', 'bt-hud-row bt-hud-sub bt-intel-btn', { type: 'button', html: '<span>' + U.esc(stage.name) + ' // ' + U.esc((stage.objectives || ['모든 적 처치']).join(' · ')) + '</span><span class="bt-intel-ico">' + G.icons.svg('eye') + '<b>적 정보</b></span>' });
        /* 증원 스테이지: 남은 적 수 (예: 훈련용 마법 더미 3 / 5) */
        const waveEl = U.el('div', 'bt-wave');
        function renderWave() {
          if (!st.totalFoes || !(stage.reserve && stage.reserve.length)) { waveEl.style.display = 'none'; return; }
          const left = st.enemies.filter(function (x) { return x.alive; }).length + st.reserve.length;
          const nm = (G.DATA.enemies[stage.enemies[0]] || {}).name || '적';
          waveEl.innerHTML = '<span>' + U.esc(nm) + '</span><b>' + (st.totalFoes - left) + '</b><i>/ ' + st.totalFoes + '</i>';
        }
        hudTL.append(turnRow, btnIntel, fieldRow, waveEl);
        renderWave();
        s.appendChild(hudTL);

        const hudTR = U.el('div', 'bt-hud-tr');
        function ctrl(icon, label, tip) {
          const b = U.el('button', 'bt-ctrl', { type: 'button', 'aria-label': label });
          b.innerHTML = '<div class="bt-ctrl-d">' + U.svgIcon(icon) + '</div><div class="bt-ctrl-l">' + label + '</div>';
          b._tip = function () { return tip(); };
          hudTR.appendChild(b);
          return b;
        }
        const btnSkills = ctrl('i-book', '스킬', function () { return '<div class="tt-title">아군 스킬</div>편성된 캐릭터들의 스킬과 궁극기 설명을 봅니다.'; });
        const btnSpeed = ctrl('i-speed', 'X2', function () { return '<div class="tt-title">속도 2배</div>전투 연출을 2배 빠르게 진행합니다.'; });
        const btnAuto = ctrl('i-auto', 'AUTO', function () { return '<div class="tt-title">오토 전투</div>카드를 자동으로 골라 전투를 진행합니다.'; });
        const btnPause = ctrl('i-pause', 'MENU', function () { return '<div class="tt-title">메뉴</div>일시정지 · 다시 시작 · 전투 포기'; });
        /* 설정 (효과음 · 기록) — 열려 있는 동안 전투 일시정지 */
        const btnSet = U.el('button', 'bt-ctrl bt-set', { type: 'button', 'aria-label': '설정' });
        btnSet.classList.add('g-ico-only');
        btnSet.innerHTML = G.lineIcon('gear');
        hudTR.appendChild(btnSet);
        s.appendChild(hudTR);

        /* 보스 체력 바 (화면 가운데 위) — 보스가 있는 스테이지(STAGE 08 코루스코) */
        const bossUnit = st.enemies.find(function (e) { return (B.charDef(e) || {}).boss; });
        let bossBar = null;
        if (bossUnit) {
          bossBar = U.el('div', 'bt-bossbar', { html:
            '<div class="bt-bossbar-name"><span class="tag">BOSS</span><b>' + U.esc(bossUnit.name) + '</b><span class="bt-bossbar-moxie"></span></div>' +
            '<div class="bt-bossbar-hp"><i class="lag"></i><i class="fill"></i><i class="shield"></i><span class="txt"></span></div>' });
          bossBar._tip = function () { const sh = B.getStatus(bossUnit, 'shield'); return '<div class="tt-title">' + U.esc(bossUnit.name) + '</div><div class="tt-nums"><span class="hp">HP</span><b>' + hpOf(bossUnit) + ' / ' + bossUnit.maxHp + '</b>' + (sh ? '<span class="sh">보호막</span><b>' + Math.round(sh.value) + '</b>' : '') + '</div>' + (bossUnit.statuses.length ? statusSummary(bossUnit).replace(/^<div class="tt-title">.*?<\/div>/, '') : ''); };
          s.appendChild(bossBar);
          s.classList.add('has-boss');
        }
        function renderBossBar() {
          if (!bossBar) return;
          const hpNow = hpOf(bossUnit), pct = Math.max(0, hpNow / bossUnit.maxHp * 100) + '%';
          bossBar.querySelector('.fill').style.width = pct;
          bossBar.querySelector('.lag').style.width = pct;
          const sh = B.getStatus(bossUnit, 'shield');
          bossBar.querySelector('.shield').style.width = sh ? Math.min(100, sh.value / bossUnit.maxHp * 100) + '%' : '0';
          bossBar.querySelector('.txt').textContent = hpNow + ' / ' + bossUnit.maxHp + (sh ? '  (+' + Math.round(sh.value) + ')' : '');
          const mx = bossBar.querySelector('.bt-bossbar-moxie');
          if (mx.children.length !== (bossUnit.moxieMax || 0)) mx.innerHTML = new Array((bossUnit.moxieMax || 0) + 1).join('<i></i>');
          Array.prototype.forEach.call(bossBar.querySelectorAll('.bt-bossbar-moxie i'), function (d, i) { d.classList.toggle('on', i < bossUnit.moxie); });
        }

        const slotsEl = U.el('div', 'bt-slots');
        s.appendChild(slotsEl);
        const handEl = U.el('div', 'bt-hand');
        /* 마법 카드(손패) 받침대 */
        const handTray = U.el('div', 'bt-hand-tray');
        s.append(handTray, handEl);
        /* 왼쪽 아래: 캐릭터 변경 버튼 + 대기석 */
        /* 오른쪽: [번개] 공유 스택 (레이 · 코루스코 편성 시) */
        const boltEl = U.el('div', 'bt-bolt', { html: '<div class="bt-bolt-ico">' + G.icons.svg('bolt') + '<b class="bt-bolt-n">0</b></div><div class="bt-bolt-lab">번개</div>' });
        boltEl._tip = function () {
          return '<div class="tt-title">번개 <span class="tt-tag">' + st.bolt + '</span></div>파티가 함께 쓰는 번개 스택입니다. [찌릿]을 쌓거나 [찌릿]이 반응할 때, 번개 속성 아군이 스킬을 쓸 때 누적됩니다.' +
            '<div class="tt-sub">예열 스킬이 소모하고, 레이의 궁극기는 스택 1개당 피해량이 12% 증가한 뒤 모두 초기화합니다.</div>';
        };
        s.appendChild(boltEl);
        /* 왼쪽: 적 진영의 [번개] (보스 코루스코) */
        const eBoltEl = U.el('div', 'bt-bolt is-enemy', { html: '<div class="bt-bolt-ico">' + G.icons.svg('bolt') + '<b class="bt-bolt-n">0</b></div><div class="bt-bolt-lab">적 번개</div>' });
        eBoltEl._tip = function () {
          return '<div class="tt-title">적 번개 <span class="tt-tag debuff">' + st.eBolt + '</span></div>적 진영이 쓰는 번개 스택입니다. 적이 과전압 예열을 쓸 때 소모합니다.';
        };
        s.appendChild(eBoltEl);
        const benchWrap = U.el('div', 'bt-bench-wrap');
        /* 캐릭터 변경: 별도 버튼 없이 대기석 초상화를 누르면 교체 창 (btnSwap 은 기능만 담당, 화면에는 숨김) */
        const btnSwap = U.el('button', 'bt-swap-btn is-hidden', { type: 'button', 'aria-label': '캐릭터 변경' });
        btnSwap.innerHTML = '<span class="bt-swap-ico">' + G.icons.svg('swap') + '</span><span class="bt-swap-txt">캐릭터 변경<small>1턴 소모</small></span>';
        btnSwap._tip = function () { return '<div class="tt-title">캐릭터 변경</div>전투 중인 캐릭터와 대기 중인 캐릭터의 자리를 바꿉니다.<div class="tt-sub">한 턴을 소모합니다 — 이번 턴에는 공격하지 않고 적의 공격을 받습니다. 빠지는 캐릭터의 카드는 마법에서 사라집니다.</div>'; };
        const benchEl = U.el('div', 'bt-bench');
        /* 카드 셔플 (대기석 오른쪽): 전투마다 3번, 지금 보이는 마법 카드를 모두 새로 뽑음 ([마력 분배] · 궁극기는 그대로) */
        const btnShuffle = U.el('button', 'bt-shuffle-btn', { type: 'button', 'aria-label': '카드 셔플' });
        btnShuffle._tip = function () { return '<div class="tt-title">카드 셔플 <span class="tt-tag">남은 횟수 ' + st.shuffles + ' / 3</span></div>지금 보이는 스킬 카드를 모두 무작위로 다시 뽑습니다. 턴은 소모하지 않습니다.<div class="tt-sub">궁극기 카드와 골드 패시브 [마력 분배] 카드는 바뀌지 않습니다. 슬롯에 올린 카드도 함께 바뀝니다.</div>'; };
        benchWrap.append(btnSwap, benchEl, btnShuffle);
        s.appendChild(benchWrap);

        root.appendChild(s);

        /* ── 대기 (일시정지 / 속도 반영) ─────────────── */
        function sleep(ms) {
          return U.wait(ms / speed, signal).then(function () {
            if (!paused) return;
            return new Promise(function (res) { pauseWaiters.push(res); });
          });
        }
        function setPaused(p) {
          paused = p;
          cam.getAnimations({ subtree: true }).forEach(function (a) { try { p ? a.pause() : a.play(); } catch (e) {} });
          if (!p) { const w = pauseWaiters; pauseWaiters = []; w.forEach(function (f) { f(); }); }
        }

        /* ── 유닛 ───────────────────────────────────── */
        const unitEls = new Map();

        function buildUnit(u) {
          const isEnemy = u.side === 'enemy';
          const n = U.el('div', 'bt-unit ' + (isEnemy ? 'is-enemy' : 'is-ally') + (isEnemy && (B.charDef(u) || {}).boss ? ' is-boss' : ''));
          const top = U.el('div', 'bt-unit-top');
          const intent = isEnemy ? U.el('div', 'bt-intent is-hidden') : null;
          const status = U.el('div', 'bt-status-row');
          const hpWrap = U.el('div', 'bt-hp-wrap');
          const hp = U.el('div', 'bt-hp', { html: '<div class="bt-hp-lag"></div><div class="bt-hp-fill"></div><div class="bt-hp-shield"></div>' });
          const hpTxt = U.el('div', 'bt-hp-txt');
          hpWrap.append(hp, hpTxt);
          let mpFill = null, mpTxt = null;
          if (!isEnemy && u.maxMp) {
            const mpRow = U.el('div', 'bt-mp-row', { html: '<span class="bt-mp-ico">' + G.icons.svg('mana') + '</span><div class="bt-mp"><div class="bt-mp-fill"></div></div><span class="bt-mp-txt"></span>' });
            mpFill = mpRow.querySelector('.bt-mp-fill'); mpTxt = mpRow.querySelector('.bt-mp-txt');
            mpRow._tip = function () { return '<div class="tt-title">마력 <span class="tt-tag">' + u.mp + ' / ' + u.maxMp + '</span></div><div class="tt-nums"><span class="hp">HP</span><b>' + hpOf(u) + ' / ' + u.maxHp + '</b><span class="mp">MP</span><b>' + u.mp + ' / ' + u.maxMp + '</b></div>카드를 사용하면 마력이 소모됩니다. 마력이 모자라면 부족한 만큼 체력을 소모합니다.'; };
            hpWrap.appendChild(mpRow);
          }
                    const moxie = (isEnemy && !u.moxieMax) ? null : U.el('div', 'bt-moxie' + (isEnemy ? ' is-enemy' : ''), { html: new Array((u.moxieMax || 5) + 1).join('<span></span>') });
          if (intent) top.appendChild(intent);
          top.append(status, hpWrap);
          if (moxie) top.appendChild(moxie);
          /* 캐릭터 이름은 머리 위에 표시하지 않음 (체력 바 · 그림에 마우스를 올리면 툴팁으로 확인) */
          const sprite = U.el('div', 'bt-sprite');
          /* 전투 그림: 기본 스탠딩 + 피격 그림(있으면). 그림이 없는 적은 실루엣 */
          let img = null, baseSrc = '', hitSrc = '', atkSrc = '';
          if (isEnemy) {
            const ed = B.charDef(u) || {};
            if (ed.sprite) { baseSrc = ed.sprite.base; hitSrc = ed.sprite.hit || ''; atkSrc = ed.sprite.atk || ''; img = U.el('img', '', { src: baseSrc, alt: u.name }); sprite.appendChild(img); }
            else sprite.innerHTML = G.art.enemy(ed, '');
            sprite.appendChild(U.el('div', 'bt-target-mark', { html: U.svgIcon('i-target') }));
          } else {
            const c = G.DATA.characters[u.defId];
            baseSrc = c.images.battle || c.images.full; hitSrc = c.images.battleHit || ''; atkSrc = c.images.battleAtk || '';
            img = U.el('img', '', { src: baseSrc, alt: c.name });
            if (c.images.battleScale) img.style.height = Math.round(SPRITE_H * c.images.battleScale) + 'px';   // 지팡이 등이 위로 길게 나온 그림: 같은 배율 유지
            sprite.appendChild(img);
          }
          [hitSrc, atkSrc].forEach(function (src) { if (src) { const pre = new Image(); pre.src = src; } });   // 피격 그림 미리 불러오기 (첫 피격 때 깜빡임 방지)
          sprite.appendChild(U.el('div', 'bt-shadow'));
          if (!isEnemy) sprite.appendChild(U.el('div', 'bt-ko', { text: '기절' }));
          /* 보호막이 있으면 발밑에 빛나는 방패 고리 */
          sprite.appendChild(U.el('div', 'bt-shield-ring', { html: '<i></i><i></i>' }));
          n.append(top, sprite);

          if (moxie) moxie._tip = function () { return (isEnemy ? '<div class="tt-title">궁극기 포인트 <span class="tt-tag debuff">' + u.moxie + ' / ' + u.moxieMax + '</span></div>행동할 때마다 1씩 쌓이고, 가득 차면 다음 행동이 궁극기입니다.'
            : '<div class="tt-title">열의 <span class="tt-tag">' + u.moxie + ' / ' + u.moxieMax + '</span></div>카드를 사용할 때마다 1씩 쌓입니다. ' + u.moxieMax + '가 되면 궁극기 카드가 마법에 추가됩니다.'); };
          if (intent) intent._tip = function () {
            if (!u.intent) return B.getStatus(u, 'ems') ? '<div class="tt-title">행동 불가 <span class="tt-tag debuff">EMS</span></div>쓸 수 있는 스킬이 모두 봉인되어 이번 턴에는 행동하지 않습니다.' : '';
            return '<div class="tt-title">다음 행동 <span class="tt-tag debuff">' + (u.intentUlt ? '궁극기 · ' : '') + U.esc(u.intent.name) + '</span></div>' + U.esc(u.intent.desc);
          };
          /* 정확한 수치는 마우스를 올렸을 때만 (체력 바 · 마력 바 · 그림) */
          function numbersTip(extra) {
            const sh = B.getStatus(u, 'shield');
            return '<div class="tt-title">' + U.esc(u.name) + '</div>' +
              '<div class="tt-nums"><span class="hp">HP</span><b>' + hpOf(u) + ' / ' + u.maxHp + '</b>' +
              (sh ? '<span class="sh">보호막</span><b>' + Math.round(sh.value) + '</b>' : '') +
              (u.maxMp ? '<span class="mp">MP</span><b>' + u.mp + ' / ' + u.maxMp + '</b>' : '') + '</div>' +
              (extra ? '<div class="tt-sub">' + extra + '</div>' : '');
          }
          hpWrap._tip = function () { return numbersTip(''); };
          if (!isEnemy) sprite._tip = function () { return numbersTip(''); };
          if (isEnemy) {
            sprite.addEventListener('click', function () { onTarget(u.uid); });
            sprite._tip = function () { return numbersTip('클릭하면 공격 대상으로 지정합니다.'); };
          }

          const ref = { root: n, hpFill: hp.children[1], hpLag: hp.children[0], hpShield: hp.children[2], hpTxt: hpTxt, mpFill: mpFill, mpTxt: mpTxt, status: status, moxie: moxie, intent: intent, sprite: sprite, img: img, baseSrc: baseSrc, hitSrc: hitSrc, atkSrc: atkSrc, hitTimer: 0, sig: '' };
          unitEls.set(u.uid, ref);
          field.appendChild(n);
          return ref;
        }

        function layout() {
          const xs = ALLY_X[st.allies.length] || ALLY_X[3];
          st.allies.forEach(function (u, i) {
            const r = unitEls.get(u.uid) || buildUnit(u);
            r.root.style.display = '';
            r.root.style.left = xs[i] + 'px';
          });
          st.bench.forEach(function (u) { const r = unitEls.get(u.uid); if (r) r.root.style.display = 'none'; });
          const ex = ENEMY_X[st.enemies.length] || ENEMY_X[3];
          st.enemies.forEach(function (u, i) {
            const r = unitEls.get(u.uid) || buildUnit(u);
            r.root.style.left = ex[i] + 'px';
          });
          renderBench();
        }

        function statusTip(d, x) {
          const desc = typeof d.desc === 'function' ? d.desc(x) : d.desc;
          const left = x.turns == null ? '다음 공격 시 소모' : '남은 턴: ' + x.turns + (x.dormant ? ' (다음 턴부터 적용)' : '');
          return '<div class="tt-title">' + U.esc(d.name) + ' <span class="tt-tag ' + d.kind + '">' + (d.kind === 'buff' ? '버프' : '디버프') + '</span></div>' +
            U.esc(desc) + '<div class="tt-sub">' + left + '</div>';
        }

        /* 연출 중 화면에 보여 줄 체력 (이벤트 순서대로 깎이게)
         *  엔진은 한 행동의 피해를 모두 먼저 계산하므로, 여러 번 때리는 공격(알리제 추가공격 등)도
         *  화면에서는 매 타격마다 그 시점의 체력(e.hp)으로 줄어들도록 이벤트 값을 우선 사용 */
        const shownHp = new Map();
        function hpOf(u) { const s = shownHp.get(u.uid); return s ? s.hp : u.hp; }
        function aliveOf(u) { const s = shownHp.get(u.uid); return s ? s.alive : u.alive; }

        /* 머리 위 아이콘 툴팁: 지금 가진 버프 · 디버프를 한 번에, 한 줄씩 요약 */
        function statusSummary(u) {
          if (!u.statuses.length) return '';
          const rows = u.statuses.map(function (x) {
            const d = G.DATA.statuses[x.id];
            const left = x.dormant ? '다음 턴부터' : x.turns == null ? '' : x.turns + '턴';
            const stk = d.stack && x.stacks ? ' ×' + x.stacks : '';
            const extra = x.id === 'shield' ? ' (' + Math.round(x.value) + ')' : x.id === 'ems' && x.sealedName ? ' (' + x.sealedName + ')' : '';
            return '<div class="tt-st ' + d.kind + '"><span class="tt-st-ico">' + G.icons.svg(d.icon) + '</span><b>' + U.esc(d.name) + stk + '</b>' +
              '<span class="tt-st-txt">' + U.esc(d.short || '') + U.esc(extra) + '</span><em>' + left + '</em></div>';
          }).join('');
          return '<div class="tt-title">' + U.esc(u.name) + ' <span class="tt-tag">버프 · 디버프</span></div>' + rows;
        }

        /* 지정 중인 적이 쓰러졌으면 가장 가까운 옆 적(같은 거리면 오른쪽 · 다음 칸 먼저)으로 대상을 옮김 */
        function syncTarget() {
          const list = st.enemies;
          const cur = list.findIndex(function (e) { return e.uid === st.targetUid; });
          const cu = list[cur];
          if (cu && cu.alive && aliveOf(cu)) return;
          const cand = list.map(function (e, i) { return { e: e, i: i }; }).filter(function (o) { return o.e.alive && aliveOf(o.e); });
          if (!cand.length) return;
          const at = cur < 0 ? 0 : cur;
          cand.sort(function (a, b) { return (Math.abs(a.i - at) - Math.abs(b.i - at)) || (b.i - a.i); });
          if (!B.setTarget(st, cand[0].e.uid)) return;
          list.forEach(function (e) { const r = unitEls.get(e.uid); if (r) r.root.classList.toggle('is-target', e.alive && aliveOf(e) && st.targetUid === e.uid); });
        }

        function updateUnit(u) {
          const r = unitEls.get(u.uid);
          if (!r) return;
          const hpNow = hpOf(u), alive = aliveOf(u);
          const pct = (hpNow / u.maxHp * 100) + '%';
          r.hpFill.style.width = pct;
          r.hpLag.style.width = pct;
          const sh = B.getStatus(u, 'shield');
          r.hpShield.style.width = sh ? Math.min(100, sh.value / u.maxHp * 100) + '%' : '0';
          r.hpTxt.textContent = hpNow + ' / ' + u.maxHp + (sh ? '  (+' + Math.round(sh.value) + ')' : '');
          if (r.mpFill) { r.mpFill.style.width = (u.mp / u.maxMp * 100) + '%'; r.mpTxt.textContent = u.mp; }
          r.root.classList.toggle('is-dead', !alive);
          /* 기절(쓰러짐)한 동안은 피격 그림 유지, 다시 일어나면 기본 그림 */
          if (r.img && r.hitSrc && !r.hitTimer) { const want = alive ? r.baseSrc : r.hitSrc; if (r.img.getAttribute('src') !== want) r.img.setAttribute('src', want); }
          r.root.classList.toggle('has-shield', !!(sh && sh.value > 0) && alive);
          r.root.classList.toggle('is-target', u.side === 'enemy' && alive && st.targetUid === u.uid);
          const sig = u.statuses.map(function (x) { return x.id + x.turns + ':' + x.stacks + ':' + Math.round(x.value) + (x.dormant ? 'd' : ''); }).join('|');
          if (sig !== r.sig) {
            r.sig = sig;
            r.status.innerHTML = '';
            u.statuses.forEach(function (x) {
              const d = G.DATA.statuses[x.id];
              const num = d.stack ? x.stacks : (x.turns == null ? '' : x.turns);
              /* 예열 · 분신 · EMS 처럼 중요한 상태는 이름과 남은 턴을 함께 표시 */
              const ic = U.el('div', 'bt-status ' + d.kind + ' ' + x.id + (d.chip ? ' is-key' : '') + (x.dormant ? ' is-dormant' : ''), { html: G.icons.svg(d.icon) + '<i>' + num + '</i>' });
              ic._tip = function () { return statusSummary(u); };
              r.status.appendChild(ic);
            });
          }
          if (r.moxie) Array.prototype.forEach.call(r.moxie.children, function (d, i) { d.classList.toggle('on', i < u.moxie); });
          if (u === bossUnit) renderBossBar();
          if (r.intent) {
            const stunned = !!B.getStatus(u, 'stun');
            const sealedAll = stunned || (!u.intent && !!B.getStatus(u, 'ems'));
            const left = (u.actsPlanned || 1) - (u.actsDone || 0);
            r.intent.textContent = (stunned ? '행동 제어' : u.intent ? u.intent.name : sealedAll ? '봉인됨' : '') + (!stunned && u.intent && left > 1 ? ' ×' + left + '회 행동' : '');
            r.intent.classList.toggle('is-ult', !!u.intentUlt);
            r.intent.classList.toggle('is-sealed', sealedAll);
            r.intent.classList.toggle('is-hidden', !u.alive || (!u.intent && !sealedAll) || (st.phase !== 'plan' && !stunned));
          }
        }
        function updateAllUnits() {
          st.allies.concat(st.bench, st.enemies).forEach(updateUnit);
          renderBench();
        }

        function renderBench() {
          benchEl.innerHTML = '';
          st.bench.forEach(function (u) {
            const c = G.DATA.characters[u.defId];
            const can = !btnSwap.disabled;
            const b = U.el('button', 'bt-bench-card' + (u.alive ? '' : ' is-dead') + (can ? ' can-swap' : ''), { type: 'button', 'aria-label': '캐릭터 변경' });
            b.style.setProperty('--card-color', c.themeColor);
            b.addEventListener('click', function () { btnSwap.click(); });
            b.innerHTML = '<img' + (c.images.battle ? ' class="is-sprite"' : '') + ' src="' + (c.images.battle || c.images.full) + '" alt=""><div class="lab">' + G.icons.svg('swap') + '변경</div><div class="nm">' + U.esc(c.name) + '</div>' +
              '<div class="hp"><b style="width:' + (u.hp / u.maxHp * 100) + '%"></b></div><div class="mp"><b style="width:' + (u.maxMp ? u.mp / u.maxMp * 100 : 0) + '%"></b></div>';
            b._tip = function () { return '<div class="tt-title">' + U.esc(c.name) + ' <span class="tt-tag">대기</span></div>HP ' + u.hp + ' / ' + u.maxHp + ' · MP ' + u.mp + ' / ' + u.maxMp + '<div class="tt-sub">누르면 출전 중인 캐릭터와 자리를 바꿉니다 (한 턴 소모). 대기 중에는 매 턴 체력을 조금 회복합니다.</div>'; };
            benchEl.appendChild(b);
          });
        }

        /* [번개] 스택 표시 */
        let boltShown = -1;
        function renderBolt(e) {
          boltEl.style.display = st.useBolt ? '' : 'none';
          eBoltEl.style.display = 'none';   // 적 진영 [번개]는 내부에서만 셈 (화면에 표시하지 않음)
          boltEl.querySelector('.bt-bolt-n').textContent = st.bolt;
          eBoltEl.querySelector('.bt-bolt-n').textContent = st.eBolt;
          boltEl.classList.toggle('is-hot', st.bolt >= 20);
          const el = e && e.side === 'enemy' ? eBoltEl : boltEl;
          if (e && boltShown !== -1 && e.delta) {
            el.classList.remove('is-pulse', 'is-drain'); void el.offsetWidth;
            el.classList.add(e.delta > 0 ? 'is-pulse' : 'is-drain');
            const f = U.el('div', 'bt-bolt-delta' + (e.delta < 0 ? ' is-neg' : ''), { text: (e.delta > 0 ? '+' : '') + e.delta + (e.label ? ' ' + e.label : '') });
            el.appendChild(f);
            setTimeout(function () { f.remove(); }, 1300 / speed);
          }
          boltShown = st.bolt;
        }

        /* 필드 효과 (열염 지대) */
        let zoneEl = null, rainEl = null;
        function renderFields() {
          fieldRow.innerHTML = '';
          st.fields.forEach(function (f) {
            const d = G.DATA.fields[f.id];
            const chip = U.el('div', 'bt-field-chip', { html: U.esc(d.name) + ' <small>' + f.turns + '턴</small>' });
            chip._tip = function () { return '<div class="tt-title">' + U.esc(d.name) + ' <span class="tt-tag">필드</span></div>' + U.esc(d.desc) + '<div class="tt-sub">남은 턴: ' + f.turns + (f.tick ? ' · 피해 ' + f.tick : '') + '</div>'; };
            fieldRow.appendChild(chip);
          });
          const hasZone = st.fields.some(function (f) { return f.id === 'blaze_zone'; });
          if (hasZone && !zoneEl) { zoneEl = U.el('div', 'bt-zone is-in'); field.insertBefore(zoneEl, field.firstChild); }
          if (!hasZone && zoneEl) { zoneEl.remove(); zoneEl = null; }
          const hasRain = st.fields.some(function (f) { return f.id === 'rain'; });
          if (hasRain && !rainEl) { rainEl = U.el('div', 'bt-rain'); field.insertBefore(rainEl, field.firstChild); }
          if (!hasRain && rainEl) { rainEl.remove(); rainEl = null; }
        }

        /* 연출 좌표 */
        function point(uid, part) {
          const r = unitEls.get(uid);
          const u = B.find(st, uid);
          if (!r || !u) return { x: 960, y: 443 };
          const x = parseFloat(r.root.style.left);
          const dir = u.side === 'ally' ? -1 : 1;
          if (part === 'feet') return { x: x, y: GROUND_Y };
          if (part === 'head') return { x: x, y: GROUND_Y - Math.round(380 * SK) };
          if (part === 'muzzle') return { x: x + dir * Math.round(70 * SK), y: GROUND_Y - Math.round(235 * SK) };
          return { x: x, y: GROUND_Y - Math.round(250 * SK) };
        }
        function shake(power) {
          stageLayer.animate([
            { transform: 'none' }, { transform: 'translate(' + (-power) + 'px,' + (power / 2) + 'px)' },
            { transform: 'translate(' + power + 'px,' + (-power / 2) + 'px)' }, { transform: 'translate(' + (-power / 2) + 'px,0)' }, { transform: 'none' }
          ], { duration: 360 / speed });
        }
        /* ── 카메라 무빙 ─────────────────────────────
         * 스킬 시전 시: 시전자에게 부드럽게 줌인 → 연출 동안 대상 쪽으로 천천히 따라감 → 행동이 끝나면 원위치
         * 화면 가장자리가 드러나지 않도록 이동량을 제한한다. */
        let camNow = { k: 1, x: 0, y: 0 }, camToken = 0, camAnim = null;
        function camFrame(fx, fy, k) {
          /* (fx,fy) 지점이 화면 중심 쪽으로 약간 끌려오도록 */
          const sx = fx + (960 - fx) * 0.32, sy = fy + (443 - fy) * 0.25;
          let x = sx - k * fx, y = sy - k * fy;
          x = Math.min(0, Math.max(1920 * (1 - k), x));
          y = Math.min(0, Math.max(886 * (1 - k), y));
          return { k: k, x: x, y: y };
        }
        function camCss(c) { return 'translate(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px) scale(' + c.k.toFixed(4) + ')'; }
        function camTo(c, ms, ease) {
          const from = camCss(camNow);
          if (camAnim) { try { camAnim.commitStyles(); } catch (e) {} camAnim.cancel(); }
          camNow = c;
          cam.style.transform = camCss(c);
          camAnim = cam.animate([{ transform: from }, { transform: camCss(c) }], { duration: ms / speed, easing: ease || 'cubic-bezier(.25,.8,.3,1)' });
          if (paused) camAnim.pause();
          const a = camAnim;
          return a.finished.then(function () { if (camAnim === a) camAnim = null; }, function () {});
        }
        function camFocus(actorUid, targets, strong) {
          const token = ++camToken;
          const a = point(actorUid, 'body');
          if (strong) {
            /* 궁극기: 시전자에게 크게 줌인했다가 대상 쪽으로 천천히 빠짐 */
            camTo(camFrame(a.x, a.y - 60, 1.22), 380, 'cubic-bezier(.2,.9,.2,1)').then(function () {
              if (token !== camToken || signal.aborted) return;
              const tg = (targets || []).filter(function (t) { return t !== actorUid; }).map(function (t) { return point(t, 'body'); });
              const mx = tg.length ? tg.reduce(function (n, p) { return n + p.x; }, 0) / tg.length : a.x;
              return camTo(camFrame(a.x + (mx - a.x) * 0.45, a.y - 30, 1.08), 1800, 'cubic-bezier(.4,0,.5,1)');
            });
            return;
          }
          const tg = (targets || []).filter(function (t) { return t !== actorUid; }).map(function (t) { return point(t, 'body'); });
          camTo(camFrame(a.x, a.y - 30, 1.09), 520).then(function () {
            if (token !== camToken || signal.aborted) return;
            /* 시전자에 고정한 채로 대상 쪽으로 살짝 흘러감 */
            let fx = a.x, fy = a.y - 30;
            if (tg.length) {
              const mx = tg.reduce(function (n, p) { return n + p.x; }, 0) / tg.length;
              fx = a.x + (mx - a.x) * 0.28;
            }
            return camTo(camFrame(fx, fy, 1.12), 1500, 'cubic-bezier(.4,0,.6,1)');
          });
        }
        function camReset() {
          if (camNow.k === 1 && camNow.x === 0 && camNow.y === 0) return Promise.resolve();
          camToken++;
          return camTo({ k: 1, x: 0, y: 0 }, 600, 'cubic-bezier(.5,0,.25,1)');
        }

        function fxCtx() {
          return {
            layer: fxLayer, speed: speed, signal: signal, point: point, shake: shake,
            sprite: function (uid) { const r = unitEls.get(uid); return r && r.sprite; }
          };
        }

        /* ── 카드 ───────────────────────────────────── */
        const cardEls = new Map();

        function skillTip(skill, ownerName, isUlt) {
          return '<div class="tt-row"><div class="tt-title">' + U.esc(skill.name) +
            (skill.nameEn ? ' <span class="tt-tag">' + U.esc(skill.nameEn) + '</span>' : '') + '</div>' +
            (skill.category ? '<div class="tt-sub" style="margin:0 0 6px">' + (isUlt ? '궁극기 · ' : '') + U.esc(skill.category) + '</div>' : '') +
            U.esc(skill.desc) + '</div>' +
            (skill.note ? '<div class="tt-row tt-sub">' + U.esc(skill.note) + '</div>' : '') +
            '<div class="tt-sub">' + U.esc(ownerName) + '</div>';
        }

        function cardDom(card) {
          const owner = B.find(st, card.owner);
          const c = G.DATA.characters[owner.defId];
          const skill = B.skillOf(card, st);
          const idx = card.ult ? 1 : c.skills.findIndex(function (x) { return x.id === skill.id; });
          const n = U.el('button', 'bt-card' + (card.ult ? ' is-ult' : '') + (card.special ? ' is-special' : ''), { type: 'button' });
          n.style.setProperty('--card-color', c.themeColor);
          /* 카드 테두리 그림 (assets/cards): 블랙 속성 캐릭터만 검은 테두리, 나머지는 흰 테두리
             · 카드에 적히는 글씨는 왼쪽 위 원 안의 소모 마력 숫자와 아래 리본의 스킬명뿐 */
          const isBlack = c.element === 'black' || c.subElement === 'black';
          const label = { attack: 'attack', debuff: 'debuff', buff: 'buff', heal: 'buff' }[skill.type] || 'buff';
          const nm = String(skill.name || '');
          n.classList.add(isBlack ? 'is-frame-black' : 'is-frame-white');
          n.classList.add(nm.length <= 5 ? 'is-name-s' : nm.length <= 7 ? 'is-name-m' : nm.length <= 10 ? 'is-name-l' : 'is-name-xl');
          n.innerHTML =
            (skill.art
              ? '<div class="bt-card-art is-skill-art" style="background-image:url(\'' + skill.art + '\')"></div>'   // 스킬 전용 카드 그림
              : '<div class="bt-card-art" style="background-image:url(\'' + c.images.full + '\');background-position:' + ART_POS[idx] + '"></div>') +
            '<img class="bt-card-frame" alt="" draggable="false" src="assets/cards/frame_' + (isBlack ? 'black' : 'white') + '.webp">' +
            '<img class="bt-card-label" alt="" draggable="false" src="assets/cards/label_' + label + '.webp">' +
            '<div class="bt-card-cost">' + (skill.mp || 0) + '</div>' +
            '<div class="bt-card-title"><span>' + U.esc(nm) + '</span></div>' +
            '<div class="bt-card-order"></div>';
          n._tip = function () {
            const pc = B.projectedCost(st, card.uid);
            let cost = '';
            if (skill.mp) {
              cost = '<div class="tt-row tt-sub">마력 ' + skill.mp + ' 소모' + (pc && pc.short ? ' · <em>마력 부족: 체력 ' + pc.hpCost + ' 소모</em>' : '') + '</div>';
            }
            if (skill.hpCost) cost += '<div class="tt-row tt-sub">체력 ' + Math.round(skill.hpCost * 100) + '% 소모 (최대 체력 기준 · 체력은 1 아래로 내려가지 않음)</div>';
            if (skill.boltCost) cost += '<div class="tt-row tt-sub">번개 ' + skill.boltCost + ' 소모 (현재 ' + st.bolt + ')' + (st.bolt < skill.boltCost ? ' · <em>번개가 모자라면 사용되지 않고 마법에 남습니다</em>' : '') + '</div>';
            if (card.special) cost += '<div class="tt-row tt-sub"><em>턴이 시작될 때 자동으로 사용됩니다 (행동 슬롯을 쓰지 않음)</em></div>';
            return skillTip(skill, c.name, card.ult) + cost;
          };
          return n;
        }

        function renderHand(opts) {
          const o = opts || {};
          const keep = new Set(st.hand.map(function (c) { return c.uid; }));
          cardEls.forEach(function (n, uid) { if (!keep.has(uid)) { n.remove(); cardEls.delete(uid); } });
          st.hand.forEach(function (card) {
            let n = cardEls.get(card.uid);
            if (!n) {
              n = cardDom(card);
              n.addEventListener('click', function () { onCardClick(card.uid); });
              /* 마법 카드에 마우스를 올리면 카드가 스치는 작은 소리 */
              n.addEventListener('mouseenter', function () { if (!busy && !ended && !n.classList.contains('is-queued')) G.sfx.play('card_hover'); });
              cardEls.set(card.uid, n);
              if (o.animate) {
                n.classList.add('is-new');
                n.addEventListener('animationend', function () { n.classList.remove('is-new'); }, { once: true });
              }
            }
            const qi = st.queue.indexOf(card.uid);
            n.classList.toggle('is-queued', qi !== -1);
            if (qi === -1) n.classList.remove('is-commit');
            const pc = B.projectedCost(st, card.uid);
            n.classList.toggle('is-hpcost', !!(pc && pc.short));
            const bs = B.skillOf(card, st);
            n.classList.toggle('is-boltshort', !!(bs && bs.boltCost && st.bolt < bs.boltCost));
            const ownerU = B.find(st, card.owner), ems = ownerU && B.getStatus(ownerU, 'ems');
            n.classList.toggle('is-sealed', !card.ult && !!(ems && bs && ems.sealed === bs.id));
            const ord = qi !== -1 ? '<b>' + (qi + 1) + '</b><span>READY</span>' : '';
            const oe = n.querySelector('.bt-card-order');
            if (oe.innerHTML !== ord) oe.innerHTML = ord;
          });
          /* 순서가 바뀐 카드만 옮김 (매번 다시 붙이면 연출이 다시 재생되어 깜빡임) */
          st.hand.forEach(function (card, i) {
            const n = cardEls.get(card.uid);
            if (handEl.children[i] !== n) handEl.insertBefore(n, handEl.children[i] || null);
          });
          /* 부채꼴 배치: 가운데를 기준으로 살짝 기울이고 양 끝을 조금 내림 */
          const cnt = st.hand.length, mid = (cnt - 1) / 2;
          st.hand.forEach(function (card, i) {
            const n = cardEls.get(card.uid), d = i - mid;
            n.style.setProperty('--fr', (d * 2.4).toFixed(2) + 'deg');
            n.style.setProperty('--fy', (Math.abs(d) * Math.abs(d) * 3).toFixed(1) + 'px');
            n.style.zIndex = String(i + 1);
          });
          renderSlots();
        }

        /* 행동 슬롯: 편성 인원 수만큼만 표시 (1명 = 1칸) */
        let slotSig = '';
        function renderSlots(runningIndex) {
          const n = B.availableSlots(st);
          const sig = n + '|' + st.queue.join(',') + '|' + runningIndex;
          if (sig === slotSig && slotsEl.children.length === n) return;
          slotSig = sig;
          slotsEl.innerHTML = '';
          for (let i = 0; i < n; i++) {
            const slot = U.el('div', 'bt-slot' + (runningIndex === i ? ' is-running' : ''));
            slot.appendChild(U.el('div', 'bt-slot-n', { text: String(i + 1) }));   // 인원과 상관없이 같은 모양 (1명이어도 번호 표시)
            const cu = st.queue[i];
            if (cu) {
              const card = st.hand.find(function (c) { return c.uid === cu; });
              if (card) {
                slot.classList.add('is-filled');
                const mini = cardDom(card);
                mini.tabIndex = -1;
                slot.appendChild(mini);
                slot.addEventListener('click', function () { onSlotClick(i); });
              }
            }
            slotsEl.appendChild(slot);
          }
        }

        /* ── 입력 ───────────────────────────────────── */
        function canInput() { return !busy && !ended && !paused && st.phase === 'plan'; }
        function gate(action) { return !tut || tut.allow(action); }

        function onCardClick(uid) {
          if (!canInput() || !gate('queue')) return;
          if (B.isQueued(st, uid)) return;
          const srcEl = cardEls.get(uid);
          const from = srcEl ? srcEl.getBoundingClientRect() : null;
          if (!B.queue(st, uid)) return;
          G.sfx.play('card_pick');
          G.tip.hide();
          renderHand();
          commitFx(uid, from);
          if (tut) tut.notify('queued');
          maybeRun();
        }
        /* 카드 사용 연출: 마법 카드의 잔상이 슬롯으로 날아가 꽂히고, 슬롯이 번쩍인다 */
        function commitFx(uid, from) {
          const qi = st.queue.indexOf(uid);
          const slot = slotsEl.children[qi];
          const hand = cardEls.get(uid);
          if (hand) { hand.classList.remove('is-commit'); void hand.offsetWidth; hand.classList.add('is-commit'); }
          if (!slot) return;
          slot.classList.remove('is-commit'); void slot.offsetWidth; slot.classList.add('is-commit');
          const mini = slot.querySelector('.bt-card');
          if (!from || !mini) return;
          /* 화면 배율을 고려해 마법 위치 → 슬롯 위치로 비행 */
          const to = mini.getBoundingClientRect();
          const sc = to.width / mini.offsetWidth || 1;
          const dx = (from.left + from.width / 2 - (to.left + to.width / 2)) / sc;
          const dy = (from.top + from.height / 2 - (to.top + to.height / 2)) / sc;
          const ks = from.width / to.width;
          /* 마법 위치에서 슬롯으로 부드럽게 이동 (회전 · 반짝임 없음) */
          mini.animate([
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + ks + ')', opacity: 0.6 },
            { transform: 'none', opacity: 1 }
          ], { duration: 260, easing: 'cubic-bezier(.25,.8,.3,1)' });
        }
        function onSlotClick(i) {
          if (!canInput() || !gate('unqueue')) return;
          if (!B.unqueue(st, i)) return;
          G.sfx.play('card_cancel');
          renderHand();
          if (tut) tut.notify('unqueued');
        }
        function onTarget(uid) {
          if (!canInput() || !gate('target')) return;
          if (!B.setTarget(st, uid)) return;
          G.sfx.play('target');
          st.enemies.forEach(updateUnit);
          if (tut) tut.notify('target');
        }

        function maybeRun() {
          if (!B.queueFull(st)) return;
          if (tut && tut.holdCommit()) return;
          busy = true;
          sleep(PACE.commitDelay).then(runTurn).catch(swallow);
        }

        function swallow(e) { if (!U.isAbort(e)) { console.error(e); showError(); } }

        /* ── 궁극기 컷인 ─────────────────────────────
         * 화면이 어두워지고, 사선 띠 위로 캐릭터 그림과 궁극기 이름이 지나감 (아군: 오른쪽에서 · 적: 왼쪽에서) */
        function ultColor(u) {
          const d = u && B.charDef(u);
          if (!d) return '#ffd75e';
          return u.side === 'ally' ? (d.themeColor || '#ffd75e') : (d.tint || '#c0392b');
        }
        /* 궁극기 시네마틱: 궁극기마다 고유한 연출(battle-fx.js 의 CINE)을 전체 화면으로 보여 줌
         *  · 위아래 레터박스 + 왼쪽 아래 작은 스킬 이름
         *  · 적의 궁극기: 붉은 테두리 · 경고 줄무늬 · 'ENEMY ULTIMATE' 표시 */
        async function ultCinematic(u, skill) {
          if (!u) return;
          const d = B.charDef(u);
          const enemy = u.side === 'enemy';
          G.tip.hide();   // 열려 있던 툴팁이 연출 위에 남지 않도록
          const ov = U.el('div', 'bt-cine' + (enemy ? ' is-enemy' : ''));
          const stageEl = U.el('div', 'bt-cine-stage');
          ov.appendChild(stageEl);
          ov.insertAdjacentHTML('beforeend',
            '<div class="bt-cine-bar top">' + (enemy ? '<span>WARNING // ENEMY ULTIMATE</span>' : '') + '</div>' +
            '<div class="bt-cine-bar bottom">' + (enemy ? '<span>WARNING // ENEMY ULTIMATE</span>' : '') + '</div>' +
            (enemy ? '<div class="bt-cine-frame"></div>' : '') +
            '<div class="bt-cine-label">' + (enemy ? '<b class="tag">적 궁극기</b>' : '') +
              '<div class="nm">' + U.esc(skill.name) + '</div><div class="who">' + U.esc(u.name) + '</div></div>');
          s.appendChild(ov);
          const k = 1 / speed;
          ov.querySelector('.bt-cine-bar.top').animate([{ transform: 'translateY(-100%)' }, { transform: 'none', offset: 0.12 }, { transform: 'none', offset: 0.9 }, { transform: 'translateY(-100%)' }], { duration: 2400 * k, fill: 'both' });
          ov.querySelector('.bt-cine-bar.bottom').animate([{ transform: 'translateY(100%)' }, { transform: 'none', offset: 0.12 }, { transform: 'none', offset: 0.9 }, { transform: 'translateY(100%)' }], { duration: 2400 * k, fill: 'both' });
          ov.querySelector('.bt-cine-label').animate([{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'none', offset: 0.2 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 2400 * k, fill: 'both' });
          const art = enemy ? (d.sprite ? { src: d.sprite.atk || d.sprite.base } : { sil: G.art.enemy(d, '') }) : { src: d.images.battleAtk || d.images.battle || d.images.full };   // 아군: 필드의 전투 그림과 같은 그림
          try {
            await Promise.all([
              G.fx.cine(skill.anim, { layer: stageEl, speed: speed, signal: signal, art: art, color: ultColor(u), enemy: enemy }),
              sleep(2200)
            ]);
          } finally { ov.remove(); }
        }

        /* ── 텍스트 연출 ─────────────────────────────── */
        function floatText(uid, txt, cls, dy) {
          const p = point(uid, 'head');
          const f = U.el('div', 'bt-float ' + (cls || ''), { text: txt });
          f.style.left = p.x + 'px'; f.style.top = (p.y + (dy || 0)) + 'px';
          fxLayer.appendChild(f);
          setTimeout(function () { f.remove(); }, 1600 / speed);
        }
        function callout(uid, text, enemy) {
          const p = point(uid, 'head');
          const c = U.el('div', 'bt-callout' + (enemy ? ' is-enemy' : ''), { text: text });
          c.style.left = p.x + 'px'; c.style.top = (p.y - 150) + 'px';
          fxLayer.appendChild(c);
          setTimeout(function () { c.remove(); }, 1700 / speed);
        }
        function banner(text, enemy) {
          const b = U.el('div', 'bt-banner' + (enemy ? ' is-enemy' : ''), { text: text });
          s.appendChild(b);
          setTimeout(function () { b.remove(); }, 1650 / speed);
        }
        function toast(text) {
          const t = U.el('div', 'bt-toast', { text: text });
          s.appendChild(t);
          setTimeout(function () { t.remove(); }, 2700);
        }
        function hit(uid) {
          const r = unitEls.get(uid);
          if (!r) return;
          r.root.classList.remove('is-hit'); void r.root.offsetWidth; r.root.classList.add('is-hit');
          /* 피격 그림으로 잠깐 바꿨다가 기본 그림으로 (쓰러졌으면 피격 그림 유지) */
          if (r.img && r.hitSrc) {
            clearTimeout(r.hitTimer);
            r.img.setAttribute('src', r.hitSrc);
            r.hitTimer = setTimeout(function () {
              r.hitTimer = 0;
              const u = B.find(st, uid);
              if (!signal.aborted && (!u || aliveOf(u))) r.img.setAttribute('src', posed === uid && r.atkSrc ? r.atkSrc : r.baseSrc);
            }, 700 / speed);
          }
        }

        /* ── 이벤트 연출 ─────────────────────────────── */
        /* 공격(스킬 시전) 그림: 시전하는 동안만 공격 그림, 행동이 끝나면 기본 그림 */
        let posed = null;
        function setAttackPose(uid) {
          clearAttackPose();
          const r = unitEls.get(uid);
          if (!r || !r.img || !r.atkSrc) return;
          posed = uid;
          if (!r.hitTimer) r.img.setAttribute('src', r.atkSrc);
        }
        function clearAttackPose() {
          if (!posed) return;
          const r = unitEls.get(posed), u = B.find(st, posed);
          posed = null;
          if (r && r.img && !r.hitTimer && u) r.img.setAttribute('src', aliveOf(u) ? r.baseSrc : (r.hitSrc || r.baseSrc));
        }
        /* 행동 연출 중에는 시전자 · 대상 · 피해를 받은 캐릭터의 정보만 보임 (카드를 고를 때는 모두) */
        function setFocus(uids) {
          s.classList.add('is-acting');
          unitEls.forEach(function (r, uid) { r.root.classList.toggle('is-focus', uids.indexOf(uid) !== -1); });
        }
        function addFocus(uid) { const r = unitEls.get(uid); if (r && s.classList.contains('is-acting')) r.root.classList.add('is-focus'); }
        function clearFocus() {
          s.classList.remove('is-acting');
          unitEls.forEach(function (r) { r.root.classList.remove('is-focus'); });
        }
        /* ── 시전 중인 스킬 카드 ─────────────────────
         * 카드를 사용하면(아군 행동) 그 카드가 화면 가운데에 크게 떠올라, 행동이 끝날 때까지 '시전 중'으로 보임 */
        let castEl = null;
        function showCastCard(actor, skill, isUlt) {
          hideCastCard(true);
          const c = G.DATA.characters[actor.defId];
          if (!c || !skill) return;
          const isBlack = c.element === 'black' || c.subElement === 'black';
          const label = { attack: 'attack', debuff: 'debuff', buff: 'buff', heal: 'buff' }[skill.type] || 'buff';
          const idx = isUlt ? 1 : Math.max(0, c.skills.findIndex(function (x) { return x.id === skill.id; }));
          const nm = String(skill.name || '');
          /* 중앙 위 행동 슬롯 줄의 왼쪽에 '지금 시전 중인 카드'를 조금 크게 · 금빛으로 강조 */
          const wrap = U.el('div', 'bt-castcard' + (isUlt ? ' is-ult' : '') + ' is-' + label);
          wrap.style.setProperty('--card-color', c.themeColor || '#d4af6a');
          const card = U.el('div', 'bt-card is-cast ' + (isBlack ? 'is-frame-black' : 'is-frame-white') + ' ' + (nm.length <= 5 ? 'is-name-s' : nm.length <= 7 ? 'is-name-m' : nm.length <= 10 ? 'is-name-l' : 'is-name-xl') + (isUlt ? ' is-ult' : ''));
          card.innerHTML =
            (skill.art
              ? '<div class="bt-card-art is-skill-art" style="background-image:url(\'' + skill.art + '\')"></div>'
              : '<div class="bt-card-art" style="background-image:url(\'' + c.images.full + '\');background-position:' + ART_POS[idx] + '"></div>') +
            '<img class="bt-card-frame" alt="" draggable="false" src="assets/cards/frame_' + (isBlack ? 'black' : 'white') + '.webp">' +
            '<img class="bt-card-label" alt="" draggable="false" src="assets/cards/label_' + label + '.webp">' +
            '<div class="bt-card-cost">' + (skill.mp || 0) + '</div>' +
            '<div class="bt-card-title"><span>' + U.esc(nm) + '</span></div>';
          wrap.appendChild(card);
          wrap.insertAdjacentHTML('beforeend', '<div class="bt-castcard-cap"><span class="tag">' + (isUlt ? 'ULTIMATE' : 'NOW') + '</span><b>' + U.esc(c.name) + '</b></div>');
          /* 슬롯 줄 왼쪽에 붙임 — 슬롯이 몇 칸이든(1명 · 4명 · 동료가 쓰러져 줄어도) 항상 '4칸 줄' 기준의 같은 자리 */
          const cv = s.getBoundingClientRect(), sr = slotsEl.getBoundingClientRect();
          const k = cv.width / s.offsetWidth || 1;
          const sw = slotsEl.firstElementChild ? slotsEl.firstElementChild.offsetWidth : 84;
          const mid = (sr.left + sr.width / 2 - cv.left) / k;
          wrap.style.left = Math.round(mid - (sw * 4 + 10 * 3) / 2 - 132) + 'px';
          wrap.style.top = Math.round((sr.top - cv.top) / k - 6) + 'px';
          s.appendChild(wrap);
          slotsEl.classList.add('is-casting');
          castEl = wrap;
        }
        function hideCastCard(instant) {
          if (!castEl) return;
          const el = castEl; castEl = null;
          slotsEl.classList.remove('is-casting');
          if (instant) { el.remove(); return; }
          el.classList.add('is-out');
          setTimeout(function () { el.remove(); }, 380);
        }
        async function play(events) {
          try { await playEvents(events); }
          finally {
            hideCastCard();
            clearAttackPose();
            /* 연출이 끝나면 실제 체력으로 맞춤 */
            const touched = Array.from(shownHp.keys());
            shownHp.clear();
            touched.forEach(function (uid) { const u = B.find(st, uid); if (u) updateUnit(u); });
          }
          if (camNow.k !== 1 && !signal.aborted) await camReset();
        }
        async function playEvents(events) {
          for (let i = 0; i < events.length; i++) {
            const e = events[i];
            switch (e.type) {
              case 'consume':
                renderHand();
                break;
              case 'cast': {
                const actor = B.find(st, e.actor);
                setAttackPose(e.actor);
                setFocus([e.actor].concat(e.targets || [], (e.skill && (e.skill.type === 'buff' || e.skill.type === 'heal')) ? (e.allies || []) : []));
                const adef = actor && B.charDef(actor);
                const isUlt = !!(e.skill.cutIn || (adef && adef.ultimate && adef.ultimate.id === e.skill.id));
                if (isUlt) { G.sfx.play(actor && actor.side === 'enemy' ? 'enemy_ult' : 'ult'); await ultCinematic(actor, e.skill); }
                G.sfx.skill(e.skill);   // 스킬 효과음
                /* 아군이 카드를 쓰면 시전 중인 카드를 화면에 띄움 (패시브 추가공격은 제외) */
                if (actor && actor.side === 'ally' && !e.passive && G.DATA.characters[actor.defId]) showCastCard(actor, e.skill, isUlt);
                else if (actor && actor.side === 'enemy') hideCastCard();
                camFocus(e.actor, e.targets, isUlt);
                if (isUlt) G.fx.ultCharge(fxCtx(), e.actor, ultColor(actor));
                callout(e.actor, e.skill.name, actor.side === 'enemy');
                await sleep(PACE.beforeAction);
                await G.fx.play(e.skill.anim, fxCtx(), e);
                /* 추가공격(패시브)은 타격 직후 바로 피해 숫자가 보이도록 대기 없음 */
                if (!e.passive) await sleep(PACE.afterCast);
                break;
              }
              case 'damage': {
                const u = B.find(st, e.unit);
                if (e.bench) { renderBench(); break; }
                if (e.deferred) { floatText(e.unit, '유예 -' + e.amount, 'is-hold', 0); updateUnit(u); await sleep(PACE.hitShow); break; }
                if (typeof e.hp === 'number') shownHp.set(e.unit, { hp: e.hp, alive: e.hp > 0 || (u && u.alive) });
                if (typeof e.hp === 'number' && e.hp <= 0) syncTarget();
                if (e.source === 'zap') { G.fx.zapTick(fxCtx(), e.unit); await sleep(220); }
                if (e.source === 'drip') { G.fx.dripTick(fxCtx(), e.unit); await sleep(220); }
                if (e.source === 'burn') { G.fx.burnTick(fxCtx(), e.unit); await sleep(250); }
                if (e.source === 'zone') { G.fx.zoneTick(fxCtx(), e.unit); await sleep(250); }
                addFocus(e.unit);
                hit(e.unit);
                /* 피격음: 지속 피해는 작게, 치명타 · 큰 피해는 묵직하게 */
                if (e.source === 'burn' || e.source === 'zone' || e.source === 'drip' || e.source === 'zap') G.sfx.play('hit', 0.5);
                else G.sfx.play(e.crit || e.amount >= 250 ? 'hit_heavy' : 'hit');
                if (e.absorbed) { G.fx.shieldHit(fxCtx(), e.unit); floatText(e.unit, '보호막 -' + e.absorbed, 'is-shield', -40); }
                floatText(e.unit, '-' + e.amount, e.crit ? 'is-crit' : e.source === 'burn' || e.source === 'zone' ? 'is-burn' : e.source === 'zap' ? 'is-zap' : e.source === 'drip' ? 'is-drip' : e.source === 'link' ? 'is-link' : e.source === 'pain' ? 'is-hpcost' : '');
                updateUnit(u);
                await sleep(PACE.hitShow);
                break;
              }
              case 'mpPay': {
                if (e.hpLoss) shownHp.delete(e.unit);   // 마력 부족으로 체력 소모: 실제 체력으로
                updateUnit(B.find(st, e.unit));
                if (e.spent) floatText(e.unit, 'MP -' + e.spent, 'is-mp', 80);
                if (e.hpLoss) { await sleep(250); hit(e.unit); floatText(e.unit, (e.selfHarm ? '자해 HP -' : '마력 부족 HP -') + e.hpLoss, 'is-hpcost', 40); }
                renderBench();
                break;
              }
              case 'mpGain':
                floatText(e.unit, (e.label ? e.label + ' ' : '') + 'MP +' + e.amount, 'is-mp', 80);
                updateUnit(B.find(st, e.unit));
                renderBench();
                break;
              case 'cleanse':
                floatText(e.unit, G.DATA.statuses[e.status].name + (e.consumed ? ' 소모' : ' 해제'), 'is-status buff', 10);
                updateUnit(B.find(st, e.unit));
                break;
              case 'miss':
                if (e.decoy) { G.fx.decoyHit(fxCtx(), e.unit); floatText(e.unit, '분신 — 무효', 'is-miss'); updateUnit(B.find(st, e.unit)); }
                else floatText(e.unit, 'MISS', 'is-miss');
                await sleep(400);
                break;
              case 'heal':
              case 'benchHeal':
                if (typeof e.hp === 'number' && shownHp.has(e.unit)) shownHp.set(e.unit, { hp: e.hp, alive: true });
                if (e.type === 'heal') { floatText(e.unit, (e.label ? e.label + ' ' : '') + '+' + e.amount, 'is-heal'); G.sfx.play('heal'); }
                updateUnit(B.find(st, e.unit));
                renderBench();
                break;
              case 'death':
                G.sfx.play('down');
                shownHp.set(e.unit, { hp: 0, alive: false });
                updateUnit(B.find(st, e.unit));
                syncTarget();   // 지정 중인 적이 쓰러지면 바로 옆 적으로 대상 이동
                await sleep(PACE.afterDeath);
                renderWave();
                break;
              case 'spawn': {
                /* 증원: 쓰러진 적의 자리에 새 적이 들어옴 */
                const old = unitEls.get(e.replaced);
                G.sfx.play('spawn');
                if (old) { old.root.remove(); unitEls.delete(e.replaced); }
                layout();
                const nr = unitEls.get(e.unit);
                if (nr) { nr.root.classList.add('is-spawn'); setTimeout(function () { nr.root.classList.remove('is-spawn'); }, 700 / speed); }
                updateUnit(B.find(st, e.unit));
                renderWave();
                await sleep(450);
                break;
              }
              case 'status': {
                const d = G.DATA.statuses[e.status];
                floatText(e.unit, (e.label ? e.label + ' · ' : '') + d.name + (d.stack ? ' ×' + e.stacks : '') + (e.amp ? ' 증폭' : '') + (e.sealed ? ' — ' + e.sealed + ' 봉인' : '') + (e.dormant ? ' (다음 턴)' : ''), 'is-status ' + d.kind, 40);
                updateUnit(B.find(st, e.unit));
                await sleep(PACE.statusShow);
                break;
              }
              case 'shield':
                floatText(e.unit, '보호막 +' + e.amount, 'is-shield', 40);
                updateUnit(B.find(st, e.unit));
                break;
              case 'field':
                renderFields();
                toast(e.field === 'rain' ? '필드에 [비]가 내리기 시작합니다! (물 속성 기술 +30% · 아군 화염 속성 기술 −40%)' : G.DATA.fields[e.field].name + '가 형성되었습니다!');
                await sleep(PACE.statusShow);
                break;
              case 'fieldEnd':
                renderFields();
                break;
              case 'statusTick':
              case 'moxie':
                updateUnit(B.find(st, e.unit));
                break;
              case 'ult':
                renderHand({ animate: true });
                if (e.first) toast('궁극기 카드가 마법에 추가되었습니다!');
                await sleep(500);
                break;
              case 'enter':
              case 'swap':
                G.sfx.play('swap');
                layout();
                updateAllUnits();
                toast(e.type === 'swap' ? '대기석 캐릭터와 교체했습니다.' : e.auto ? '필드의 아군이 모두 기절했습니다 — ' + B.find(st, e.unit).name + ' 출전! (턴 소모 없음)' : B.find(st, e.unit).name + ' 출전!');
                await sleep(900);
                break;
              case 'finale': {
                busy = true;
                handEl.classList.add('is-locked');
                await sleep(900);
                break;
              }
              case 'bolt':
                renderBolt(e);
                renderHand();
                await sleep(220);
                break;
              case 'hold': {
                floatText(e.unit, e.reason + ' — 카드가 마법에 남습니다', 'is-hold', 20);
                renderHand();
                await sleep(700);
                break;
              }
              case 'resist':
                floatText(e.unit, G.DATA.statuses[e.status].name + ' 실패', 'is-miss', 10);
                await sleep(300);
                break;
              case 'stunSkip':
                camFocus(e.unit, []);
                callout(e.unit, '행동 제어 — 행동 불가', true);
                await sleep(1000);
                break;
              case 'sealedSkip':
                camFocus(e.unit, []);
                callout(e.unit, 'EMS — 행동 불가', true);
                await sleep(1000);
                break;
              case 'handSync':
              case 'replace':
                renderHand({ animate: true });
                break;
              default:
                break;
            }
          }
        }

        /* ── 턴 진행 ────────────────────────────────── */
        async function runTurn() {
          busy = true;
          passBtn.style.display = 'none';
          handEl.classList.add('is-locked');
          st.phase = 'resolve';
          st.enemies.forEach(updateUnit);

          /* ⓪ 턴 시작: [마력 분배] 등 자동 사용 카드 */
          if (st.hand.some(function (c) { return c.special; })) {
            await play(B.resolveSpecials(st));
            renderHand();
            await sleep(PACE.betweenActions);
          }

          /* ① 아군의 모든 공격 */
          let ev;
          while (st.queue.length) {
            renderSlots(0);
            ev = B.resolveNext(st);
            if (!ev) break;
            await play(ev);
            renderSlots();
            if (st.finalePending) return runFinale();
            if (B.outcome(st)) return finish();
            if (st.queue.length) await sleep(PACE.betweenActions);
          }
          renderHand();

          /* ② 적군의 모든 공격 */
          if (B.enemyActions(st).length) {
            await sleep(PACE.betweenActions);
            banner('ENEMY TURN', true);
            G.sfx.play('enemy_turn');
            await sleep(PACE.enemyBanner);
            const order = B.enemyActions(st);
            for (let i = 0; i < order.length; i++) {
              await play(B.resolveEnemy(st, order[i]));
              if (st.finalePending) return runFinale();
              if (B.outcome(st)) return finish();
              await sleep(PACE.betweenEnemies);
            }
          }

          /* ③ 턴 종료 (연소 피해 · 지속 턴 감소) — 별도 메시지 없이 진행 */
          const endEv = B.endTurn(st);
          await play(endEv);
          renderFields();
          updateAllUnits();
          if (endEv.some(function (x) { return x.type === 'damage'; })) await sleep(PACE.tickShow);
          if (st.finalePending) return runFinale();
          if (B.outcome(st)) return finish();
          await startPlayerPhase();
        }

        /* 연출된 결말 (STAGE 08): 보스의 결말 공격 → 아군 전원 기절 → 클리어 */
        async function runFinale() {
          busy = true;
          st.queue = [];
          renderSlots();
          await sleep(600);
          const fin = stage.finale || {};
          /* 결말 전 대사 (왼쪽 위 초상화) → 결말 공격 → 결말 후 대사 → 클리어 */
          if (fin.before) await showIntro(fin.before, { center: true });
          await play(B.finale(st));
          renderBench();
          await sleep(1200);
          if (fin.after) await showIntro(fin.after, { center: true });
          await sleep(300);
          return finish();
        }

        async function startPlayerPhase() {
          clearFocus();   // 카드를 고를 때는 모든 캐릭터 정보 표시
          busy = true;
          st.phase = 'plan';
          renderTurn();
          syncTarget();
          banner('TURN ' + st.turn);
          G.sfx.play('turn_start');
          await sleep(PACE.turnBanner);
          const ev = B.draw(st);
          renderHand({ animate: true });
          await play(ev.filter(function (e) { return e.type !== 'draw'; }));
          updateAllUnits();
          handEl.classList.remove('is-locked');
          busy = false;
          refreshControls();
          if (tut) tut.notify('playerPhase');
          if (auto && (!tut || tut.done())) { autoStep(); return; }
          checkNoCards();
        }

        /* 사용할 수 있는 카드가 없을 때 (예: 실반 혼자 남아 [고립] 상태)
         *  · 캐릭터 교체도 못 하면 → 안내 후 자동으로 아군 턴을 넘김
         *  · 교체할 수 있으면 → [턴 넘기기] 버튼 (교체하거나 넘기거나 선택) */
        const passBtn = U.el('button', 'g-btn bt-pass', { type: 'button', text: '턴 넘기기' });
        passBtn.style.display = 'none';
        passBtn.addEventListener('click', function () {
          if (!canInput()) return;
          passBtn.style.display = 'none';
          busy = true;
          sleep(PACE.commitDelay).then(runTurn).catch(swallow);
        });
        s.appendChild(passBtn);
        function checkNoCards() {
          passBtn.style.display = 'none';
          if (!canInput() || B.hasPlayable(st) || st.queue.length) return;
          if (tut && !tut.done()) return;
          if (B.canSwap(st)) {
            toast('사용할 수 있는 카드가 없습니다. 캐릭터를 교체하거나 턴을 넘기세요.');
            passBtn.style.display = '';
            return;
          }
          toast('사용할 수 있는 카드가 없습니다 — 이번 턴은 행동하지 않습니다.');
          busy = true;
          sleep(1400).then(runTurn).catch(swallow);
        }

        function autoStep() {
          if (!canInput() || !auto) return;
          busy = true;
          sleep(PACE.autoThink).then(function () {
            if (!auto || ended) { busy = false; return; }
            B.autoPlan(st).forEach(function (u) { B.queue(st, u); });
            renderHand();
            return sleep(PACE.commitDelay).then(runTurn);
          }).catch(swallow);
        }

        function renderTurn() {
          turnRow.innerHTML = '<span>라운드: 1/1</span><span>턴: ' + st.turn + '</span>';
        }

        function refreshControls() {
          const tutLock = tut && !tut.done();
          btnSpeed.classList.toggle('is-on', speed === 2);
          btnAuto.classList.toggle('is-on', auto);
          s.classList.toggle('is-fast', speed === 2);
          btnSwap.disabled = !B.canSwap(st) || busy || (!!tutLock && !tut.allow('swap'));   // 튜토리얼 '캐릭터 변경' 단계에서만 허용
          renderBench();
          benchEl.style.display = st.bench.length ? '' : 'none';
          btnShuffle.innerHTML = '<span class="ico">' + G.icons.svg('shuffle') + '</span><span class="lab">셔플</span><b>' + st.shuffles + '</b>';
          btnShuffle.disabled = !B.canShuffle(st) || busy || !!tutLock;
          btnShuffle.classList.toggle('is-empty', st.shuffles <= 0);
          btnAuto.disabled = !!tutLock;
          btnSpeed.disabled = !!tutLock;
        }

        /* ── 결과 ───────────────────────────────────── */
        function finish() {
          clearFocus();
          if (ended) return;
          ended = true; busy = true;
          if (tut) tut.destroy();
          const res = B.outcome(st);
          const overlay = U.el('div', 'bt-result' + (res === 'lose' ? ' is-lose' : ''));
          G.sfx.play(res === 'lose' ? 'defeat' : 'victory');
          if (res === 'win') {
            /* 이미 해금된 스테이지·챕터는 다시 '해금'으로 알리지 않음 */
            const next = Object.keys(G.DATA.stages).map(function (k) { return G.DATA.stages[k]; })
              .find(function (x) { return x.requires === stage.id; });
            const nextWas = !!(next && G.save.isStageUnlocked(next.id));
            const chCand = G.DATA.chapters.filter(function (c) { return c.requires === stage.id && !G.save.isChapterUnlocked(c.id); });
            G.save.markCleared(stage.id);
            if (next && !nextWas && G.save.isStageUnlocked(next.id)) G.app.session.newlyUnlocked = next.id;
            const newCh = chCand.find(function (c) { return G.save.isChapterUnlocked(c.id); });
            if (newCh) G.app.session.newChapter = newCh.id;
            overlay.innerHTML = (st.scriptedWin
                ? '<div class="bt-result-big">STAGE CLEAR</div><div class="bt-result-sub">전투 종료</div>'
                : '<div class="bt-result-big">VICTORY</div><div class="bt-result-sub">전투 승리</div>') +
              '<div class="bt-result-meta g-mono">' + U.esc(stage.name) + ' // ' + st.turn + ' TURNS</div>' +
              (newCh ? '<div class="st-clear-new">' + U.esc(newCh.title) + ' 해금</div>' : '') +
              '<div class="bt-result-hint">' + (stage.afterStory ? '화면을 클릭하면 이야기가 이어집니다' : '화면을 클릭하면 스테이지 화면으로 돌아갑니다') + '</div>';
            let leaving = false;
            overlay.addEventListener('click', function () {
              if (leaving) return; leaving = true;
              ctx.clearBattleSession();
              /* 전투 후 이어지는 스토리가 있으면 먼저 스토리 → 끝나면 다음 스테이지 해금 */
              ctx.go(stage.afterStory ? '#/stage/' + stage.id + '/after' : '#/chapter/' + stage.chapter);
            });
          } else {
            /* 게임 오버: 필드 + 대기석까지 모두 기절 */
            overlay.innerHTML = '<div class="bt-result-big">GAME OVER</div><div class="bt-result-sub">모든 아군이 기절했습니다</div>' +
              '<div class="bt-result-meta g-mono">' + U.esc(stage.name) + ' // ' + st.turn + ' TURNS</div>';
            const act = U.el('div', 'bt-result-actions');
            const retry = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '다시하기' });
            /* 다시하기: 덱 편성 화면으로 돌아가 편성을 확인 · 수정한 뒤 다시 전투 */
            retry.addEventListener('click', function () {
              ctx.clearBattleSession();
              ctx.go('#/stage/' + stage.id + '/formation');
            });
            const out = U.el('button', 'g-btn', { type: 'button', text: '돌아가기' });
            out.addEventListener('click', function () { ctx.clearBattleSession(); ctx.go('#/chapter/' + stage.chapter); });
            act.append(out, retry);
            overlay.appendChild(act);
            overlay.style.cursor = 'default';
          }
          setTimeout(function () { if (!signal.aborted) s.appendChild(overlay); }, 900);
        }

        function showError() {
          ended = true;
          const m = U.el('div', 'bt-modal');
          m.innerHTML = '<div class="bt-modal-box g-panel"><div class="bt-modal-title">ERROR</div><div class="bt-modal-text">전투 진행 중 문제가 발생했습니다.</div></div>';
          const b = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '스테이지 화면으로' });
          b.addEventListener('click', function () { ctx.go('#/chapter/' + stage.chapter); });
          m.firstChild.appendChild(b);
          s.appendChild(m);
        }

        /* ── 컨트롤 ─────────────────────────────────── */
        btnSpeed.addEventListener('click', function () {
          speed = speed === 2 ? 1 : 2;
          G.save.setSetting('speed', speed);
          refreshControls();
        });
        btnAuto.addEventListener('click', function () {
          auto = !auto;
          G.save.setSetting('auto', auto);
          refreshControls();
          if (auto) autoStep();
        });
        btnSet.addEventListener('click', function () {
          const was = paused;
          G.settings.open(s, { onOpen: function () { if (!was) setPaused(true); }, onClose: function () { if (!was) setPaused(false); } });
        });
        btnPause.addEventListener('click', function () {
          if (ended) return;
          setPaused(true);
          const m = U.el('div', 'bt-modal');
          const box = U.el('div', 'bt-modal-box g-panel');
          box.innerHTML = '<div class="bt-modal-title">PAUSE</div>';
          const resume = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '계속하기' });
          const restart = U.el('button', 'g-btn', { type: 'button', text: '다시 시작' });
          const quit = U.el('button', 'g-btn', { type: 'button', text: '전투 포기' });
          resume.addEventListener('click', function () { m.remove(); setPaused(false); });
          restart.addEventListener('click', function () { ctx.go(location.hash); });
          /* 전투 포기: 한 번 더 확인 */
          quit.addEventListener('click', function () {
            box.innerHTML = '<div class="bt-modal-title">전투 포기</div>' +
              '<div class="bt-quit-q">정말 포기하시겠습니까?</div>' +
              '<div class="bt-quit-sub">지금까지의 전투 진행은 저장되지 않고 스테이지 선택 화면으로 돌아갑니다.</div>';
            const row = U.el('div', 'bt-quit-row');
            const no = U.el('button', 'g-btn', { type: 'button', text: '아니오' });
            const yes = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '포기하기' });
            no.addEventListener('click', function () { m.remove(); setPaused(false); });
            yes.addEventListener('click', function () { ctx.clearBattleSession(); ctx.go('#/chapter/' + stage.chapter); });
            row.append(no, yes);
            box.appendChild(row);
          });
          box.append(resume, restart, quit);
          m.appendChild(box);
          s.appendChild(m);
        });
        btnShuffle.addEventListener('click', function () {
          if (!canInput() || !B.canShuffle(st)) return;
          G.tip.hide();
          const ev = B.shuffle(st);
          if (!ev) return;
          G.sfx.play('shuffle');
          slotSig = '';
          renderHand({ animate: true });
          refreshControls();
          toast('카드를 새로 뽑았습니다 (남은 셔플 ' + st.shuffles + '회)');
        });
        btnSwap.addEventListener('click', function () {
          if (!canInput() || !B.canSwap(st)) return;
          if (tut && !tut.allow('swap')) return;
          const bench = st.bench.find(function (b) { return b.alive; });
          const bc = G.DATA.characters[bench.defId];
          /* 튜토리얼 연습 교체(스테이지 4): 턴을 넘기지 않고, 정해진 캐릭터(나즈나)와만 교체 */
          const practice = !!(tut && tut.practiceSwap());
          const only = practice ? tut.swapOnly() : null;
          const m = U.el('div', 'bt-modal');
          const box = U.el('div', 'bt-modal-box g-panel');
          box.innerHTML = '<div class="bt-modal-title">교체</div><div class="bt-modal-text">' + U.esc(bc.name) + '와(과) 자리를 바꿀 출전 캐릭터를 선택하세요.<br>' +
            (practice ? '지금은 연습이라 <b>턴이 넘어가지 않습니다</b>. (원래는 이번 턴의 행동이 모두 소모됩니다)' : '교체하면 이번 턴의 행동이 모두 소모됩니다.') + '</div>';
          const list = U.el('div', 'bt-swap-list');
          st.allies.forEach(function (a) {
            const c = G.DATA.characters[a.defId];
            const off = !!only && a.defId !== only;
            const it = U.el('button', 'bt-swap-item' + (a.alive ? '' : ' is-ko') + (off ? ' is-off' : ''), { type: 'button', html: '<img' + (c.images.battle ? ' class="is-sprite"' : '') + ' src="' + (c.images.battle || c.images.full) + '" alt=""><span>' + U.esc(c.name) + (a.alive ? '' : ' <em>기절</em>') + '</span>' });
            it.style.setProperty('--card-color', c.themeColor);
            if (off) it.disabled = true;
            it.addEventListener('click', async function () {
              if (off) return;
              m.remove();
              const ev = B.swap(st, a.uid);
              if (!ev) return;
              busy = true;
              try {
                renderHand();
                await play(ev);
                if (practice) {
                  /* 턴 소모 없음: 새로 들어온 캐릭터의 카드를 채우고 그대로 계획 단계 유지 */
                  await play(B.draw(st).filter(function (e) { return e.type !== 'draw'; }));
                  renderHand({ animate: true });
                  updateAllUnits();
                  busy = false;
                  refreshControls();
                  toast('연습 교체 — 턴이 넘어가지 않습니다.');
                  tut.notify('swapped');
                  return;
                }
                await runTurn();
              } catch (err) { swallow(err); }
            });
            list.appendChild(it);
          });
          const cancel = U.el('button', 'g-btn', { type: 'button', text: '취소' });
          cancel.addEventListener('click', function () { m.remove(); if (tut) tut.notify('swapCancel'); });
          box.append(list, cancel);
          m.appendChild(box);
          s.appendChild(m);
          if (tut) tut.notify('swapOpen');
        });

        /* 정보 창 공통: 위쪽 아이콘(탭)으로 대상을 고르고, 스크롤 없이 한 화면에 */
        function infoModal(title, entries) {
          if (ended || s.querySelector('.bt-modal')) return;
          setPaused(true);
          const m = U.el('div', 'bt-modal');
          const box = U.el('div', 'bt-modal-box g-panel bt-info');
          box.innerHTML = '<div class="bt-modal-title">' + U.esc(title) + '</div>';
          const tabs = U.el('div', 'bt-info-tabs');
          const body = U.el('div', 'bt-info-body');
          entries.forEach(function (en, i) {
            const tb = U.el('button', 'bt-info-tab', { type: 'button', html: '<span class="pic">' + en.pic + '</span><span class="nm">' + U.esc(en.name) + '</span>' });
            if (en.color) tb.style.setProperty('--card-color', en.color);
            tb.addEventListener('click', function () { show(i); });
            tabs.appendChild(tb);
          });
          function show(i) {
            Array.prototype.forEach.call(tabs.children, function (b, k) { b.classList.toggle('is-on', k === i); });
            body.innerHTML = entries[i].html;
          }
          if (entries.length > 1) box.appendChild(tabs);
          box.appendChild(body);
          const close = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '닫기' });
          close.addEventListener('click', function () { m.remove(); setPaused(false); });
          box.appendChild(close);
          m.appendChild(box);
          m.addEventListener('click', function (ev) { if (ev.target === m) { m.remove(); setPaused(false); } });
          s.appendChild(m);
          show(0);
        }
        function skillRows(list) {
          return list.map(function (k) {
            return '<div class="bt-info-skill' + (k.ult ? ' is-ult' : '') + '">' +
              (k.art ? '<img src="' + k.art + '" alt="">' : '<span class="noart">' + G.icons.svg(k.icon || 'burst') + '</span>') +
              '<div><div class="hd"><b>' + U.esc(k.name) + '</b><span>' + (k.ult ? '궁극기' : (TYPE_LABEL[k.type] || '')) + (k.mp ? ' · 마력 ' + k.mp : '') + (k.hpCost ? ' · 체력 ' + Math.round(k.hpCost * 100) + '%' : '') + (k.boltCost ? ' · 번개 ' + k.boltCost : '') + '</span></div>' +
              '<p>' + U.esc(k.desc) + '</p></div></div>';
          }).join('');
        }
        btnSkills.addEventListener('click', function () {
          const units = st.allies.concat(st.bench);
          infoModal('아군 스킬', units.map(function (u) {
            const c = G.DATA.characters[u.defId];
            return {
              name: c.name, color: c.themeColor,
              pic: '<img src="' + (c.images.battle || c.images.full) + '" alt="">',
              html: '<div class="bt-info-head"><b>' + U.esc(c.name) + '</b><span>' + U.esc(c.role || '') + '</span></div>' +
                skillRows(c.skills.concat([Object.assign({ ult: true }, c.ultimate, { desc: c.ultimate.desc + ' (열의 ' + (c.ultPoints || G.DATA.rules.MOXIE_MAX) + ' 필요)' })]))
            };
          }));
        });

        /* 적 정보 창: 적의 능력치 · 스킬 · 궁극기 (적이 여럿이면 아이콘을 눌러 고름) */
        btnIntel.addEventListener('click', function () {
          const seen = {}, entries = [];
          st.enemies.forEach(function (u) {
            const def = B.charDef(u);
            if (seen[def.id]) return; seen[def.id] = true;
            const same = st.enemies.filter(function (x) { return x.defId === def.id; });
            const ult = def.ultimate ? [Object.assign({ ult: true }, def.ultimate, { desc: def.ultimate.desc + (def.ultPoints ? ' (궁극기 포인트 ' + def.ultPoints + ' — 행동할 때마다 1씩 쌓이고, 가득 차면 다음 행동에 사용)' : def.ultEvery ? ' (' + def.ultEvery + '번째 행동마다 사용)' : '') })] : [];
            entries.push({
              name: def.name,
              pic: def.sprite ? '<img src="' + def.sprite.base + '" alt="">' : G.art.enemy(def, ''),
              html: '<div class="bt-info-head"><b>' + U.esc(def.name) + (same.length > 1 ? ' ×' + same.length : '') + '</b><span>HP ' + same.map(function (x) { return x.hp + '/' + x.maxHp; }).join(' · ') + (def.actionsPerTurn ? ' · 한 턴에 ' + def.actionsPerTurn.join('~') + '회 행동' : '') + '</span></div>' +
                skillRows(def.skills.concat(ult))
            });
          });
          infoModal('적 정보', entries);
        });

        const onKey = function (e) {
          if (e.key === 'Escape') { const m = s.querySelector('.bt-modal'); if (m && !ended) { m.remove(); setPaused(false); } }
        };
        document.addEventListener('keydown', onKey);
        cleanup.push(function () { document.removeEventListener('keydown', onKey); paused = false; pauseWaiters = []; if (tut) tut.destroy(); });

        /* ── 시작 ───────────────────────────────────── */
        layout();
        updateAllUnits();
        renderTurn();
        renderSlots();
        renderFields();
        renderBolt();
        refreshControls();
        handEl.classList.add('is-locked');

        const api = {
          screen: s, hand: handEl, slots: slotsEl, hudTR: hudTR, shuffleEl: btnShuffle, benchEl: benchEl,
          unitEl: function (uid) { const r = unitEls.get(uid); return r && r.root; },
          statusEl: function (uid) { const r = unitEls.get(uid); return r && r.status; },
          moxieEl: function (uid) { const r = unitEls.get(uid); return r && r.moxie; },
          state: st, signal: signal,
          onStep: function () { refreshControls(); },
          onDone: function () { refreshControls(); if (auto) autoStep(); toast('튜토리얼 완료 — 적을 쓰러뜨리세요!'); }
        };

        /* 처음엔 적과 아군만 → (스테이지 1: 왼쪽 위 소녀 실루엣 멘트, 클릭 시 사라짐) → 카드 등장 */
        return sleep(PACE.introDelay).then(function () {
          if (story && story.battleIntro) return showIntro(story.battleIntro, { center: true });
        }).then(function () {
          if (useTutorial) { tut = G.Tutorial.create(api, tutKind); refreshControls(); }
          if (stage.battleHint && isStoryTeam && !useTutorial) setTimeout(function () { if (!signal.aborted) toast(stage.battleHint); }, 1600);
          return startPlayerPhase();
        }).catch(swallow);

        /* opts.center: 화면 가운데 + 뒤에 반투명 검은 막 (STAGE 08 결말 대사처럼 눈에 띄어야 할 때) */
        function showIntro(line, opts) {
          return new Promise(function (resolve) {
            const ov = U.el('div', 'bt-intro' + (opts && opts.center ? ' is-center' : ''));
            /* portrait: 캐릭터 id → 초상화 (얼굴 이미지가 있으면 얼굴, 없으면 전신 위쪽) */
            const pc = line.portrait && G.DATA.characters[line.portrait];
            /* 전투 그림(스프라이트)이 있으면 그 얼굴 부분, 없으면 얼굴 이미지 · 전신 위쪽 */
            const ico = pc
              ? (pc.images.battle ? '<img class="is-sprite" src="' + pc.images.battle + '" alt="">'
                : '<img class="' + (pc.images.face ? 'is-face' : 'is-full') + '" src="' + (pc.images.face || pc.images.full) + '" alt="">')
              : G.art.girlIcon();
            ov.innerHTML = '<div class="bt-intro-box' + (line.enemy ? ' is-enemy' : '') + '"><div class="bt-intro-ico"' + (pc ? ' style="--card-color:' + pc.themeColor + '"' : '') + '>' + ico + '</div>' +
              '<div><div class="bt-intro-name">' + U.esc(line.speaker) + '</div><div class="bt-intro-text">' + U.esc(line.text) + '</div></div></div>' +
              '<div class="bt-intro-hint">화면을 클릭하세요</div>';
            ov.addEventListener('click', function () { ov.remove(); resolve(); }, { once: true });
            s.appendChild(ov);
          });
        }
      }
    };
  });
})();
