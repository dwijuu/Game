/**
 * 챕터 선택 — 서가의 책 (중세 판타지 테마: 책등 = 챕터, 선택된 챕터 = 표지)
 *  · 선택된 챕터는 앞면(표지), 나머지는 옆면
 *  · 열린 챕터의 옆면을 누르면 그 챕터의 앞면이 보이고, 앞면을 누르면 입장
 *  · 잠긴 챕터(미제작 / 선행 조건 미충족)는 회색 · 클릭 불가
 */
(function () {
  const U = G.util;
  const COVER_COLOR = ['#5a2620', '#26402f', '#2a3550', '#4a3420', '#3e2a4a'];   // 가죽 표지 색

  function pad(n) { return String(n).padStart(2, '0'); }
  const EMBLEM = '<svg class="cs-emblem" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="100" cy="100" r="86" stroke-width="1.4"/><circle cx="100" cy="100" r="78" stroke-width="0.7" stroke-dasharray="2 5"/><path d="M100 14l18 60 60 26-60 26-18 60-18-60-60-26 60-26z" stroke-width="1.6"/><path d="M100 46l9 36 37 18-37 18-9 36-9-36-37-18 37-18z" stroke-width="1"/><circle cx="100" cy="100" r="10" fill="currentColor" stroke="none"/><path d="M39 39l18 18M161 39l-18 18M39 161l18-18M161 161l-18-18" stroke-width="1"/></g></svg>';
  function roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n); }

  function cover(ch, isNew) {
    const wrap = U.el('div', 'cs-cover-wrap');
    const body = U.el('div', 'cs-tape-body');
    const btn = U.el('button', 'cs-cover', { type: 'button', 'aria-label': ch.title + ' 입장' });
    const hero = G.DATA.characters.Character_05;
    const kind = ch.stages.every(function (id) { return G.DATA.stages[id] && G.DATA.stages[id].storyOnly; }) ? 'STORY ONLY' : 'STORY';
    btn.innerHTML =
      '<div class="cs-cover-top"><span>✦ CHRONICLE ✦</span><span></span></div>' +
      '<div class="cs-cover-art">' + EMBLEM + '<div class="cs-cover-roman">' + roman(ch.no) + '</div></div>' +   // 캐릭터 그림 대신 금빛 문장
      '<div class="cs-cover-num">' + roman(ch.no) + '</div>' +
      /* 챕터의 모든 스테이지를 클리어하면: 책 오른쪽 위에 걸린 책갈피 끈 */
      (ch.stages.length && ch.stages.every(function (id) { return G.save.isCleared(id); }) ? '<div class="cs-cover-clear" title="모든 스테이지 클리어">CLEAR</div>' : '') +
      (isNew ? '<div class="cs-new-flag">NEW</div>' : '') +
      '<div class="cs-cover-bottom">' +
        '<div class="cs-cover-title">' + U.esc(ch.title) + '</div>' +
        '<div class="cs-cover-sub">VOLUME ' + roman(ch.no) + ' · ' + (ch.stages.length ? ch.stages.length + ' STAGE' + (ch.stages.length > 1 ? 'S' : '') : 'COMING SOON') + '</div>' +
        '<div class="cs-cover-meta"><span class="g-barcode"></span><span class="vhs">VHS</span></div>' +
      '</div>';
    wrap.appendChild(body);
    wrap.appendChild(btn);
    return { wrap: wrap, btn: btn };
  }

  function spine(ch, unlocked, isNew) {
    /* 잠긴 챕터도 눌러서 표지는 볼 수 있음 (표지는 흐리게 · 입장 불가) */
    const n = U.el('button', 'cs-spine' + (unlocked ? ' is-open' : ' is-locked'), { type: 'button', 'aria-label': ch.title + ' 선택' });
    n.innerHTML =
      '<div class="cs-spine-band" style="' + (unlocked ? 'background:' + COVER_COLOR[(ch.no - 1) % COVER_COLOR.length] : '') + '"></div>' +
      '<div class="cs-spine-label"><span>' + U.esc(ch.title) + '</span></div>' +
      '<div class="cs-spine-num">' + roman(ch.no) + '</div>' +
      '<div class="cs-spine-vhs">VHS</div>' +
      '<div class="g-barcode"></div>' +
      (unlocked ? '' : '<div class="cs-spine-lock">' + U.svgIcon('i-lock') + '</div>') +
      (isNew ? '<div class="cs-new-flag">NEW</div>' : '');
    return n;
  }

  /* ── 덱 추천 ───────────────────────────────────────── */
  const DECKS = [
    {
      key: 'bolt', name: '번개덱', en: 'THUNDER DECK', icon: 'bolt', members: ['Character_13', 'Character_14', 'Character_15'],
      summary: '[번개]를 빠르게 모아 레이의 궁극기 한 방으로 끝내는 덱',
      points: [
        '코루스코: [번개] 수급 · 예열로 아군 화력 강화',
        '레이: [번개]가 많을수록 강해지는 궁극기로 마무리',
        '페델레: 보호막 · 피해 감면으로 버티기 (번개 시너지 포함)'
      ]
    },
    {
      key: 'burn', name: '연소덱', en: 'IGNITION DECK', icon: 'flame', members: ['Character_12', 'Character_05', 'Character_10'],
      summary: '[연소]를 쌓고, 알리제가 한꺼번에 터뜨리는 덱',
      points: [
        '아르덴: [연소]를 쌓고 [열염 지대]로 유지',
        '알리제: 턴마다 추가공격 · 산소 폭발로 기폭',
        '샤린: 적을 늦추고, 체력 · 마력 회복'
      ]
    }
  ];
  function memberTip(c) {
    const row = function (tag, k) { return '<div class="rec-sk"><div class="rec-sk-h"><span>' + tag + '</span><b>' + U.esc(k.name) + '</b></div><p>' + U.esc(k.desc) + '</p></div>'; };
    return '<div class="tt-big"><div class="tt-rec"><img src="' + (c.images.battle || c.images.full) + '" alt=""><div><div class="tt-title">' + U.esc(c.name) + ' <span class="tt-tag">' + U.esc(c.nameEn) + '</span></div>' +
      '<div class="tt-sub">' + U.esc(c.role || '') + '</div></div></div>' +
      c.skills.map(function (k, i) { return row('스킬 ' + (i + 1), k); }).join('') + row('궁극기', c.ultimate) + '</div>';
  }
  function openDeckRec(s) {
    if (s.querySelector('.cs-rec')) return;
    const m = U.el('div', 'cs-rec');
    const box = U.el('div', 'cs-rec-box g-panel');
    box.innerHTML = '<div class="cs-rec-title">덱 추천</div>';
    const tabs = U.el('div', 'cs-rec-tabs');
    const body = U.el('div', 'cs-rec-body');
    DECKS.forEach(function (d, i) {
      const tb = U.el('button', 'cs-rec-tab', { type: 'button', html: G.icons.svg(d.icon) + '<span>' + d.name + '</span>' });
      tb.addEventListener('click', function () { show(i); });
      tabs.appendChild(tb);
    });
    function show(i) {
      const d = DECKS[i];
      Array.prototype.forEach.call(tabs.children, function (b, k) { b.classList.toggle('is-on', k === i); });
      body.innerHTML = '<div class="cs-rec-en">' + d.en + '</div><div class="cs-rec-sum">' + U.esc(d.summary) + '</div>';
      const row = U.el('div', 'cs-rec-members');
      d.members.forEach(function (id) {
        const c = G.DATA.characters[id];
        const card = U.el('div', 'cs-rec-member');
        card.style.setProperty('--card-color', c.themeColor);
        card.innerHTML = '<div class="pic"><img class="' + (c.images.battle ? 'is-sprite' : 'is-art') + '" src="' + (c.images.battle || c.images.full) + '" alt=""></div><div class="nm">' + U.esc(c.name) + '</div><div class="role">' + U.esc((c.role || '').split(/[(\u2014]/)[0].trim()) + '</div>';
        card._tip = function () { return memberTip(c); };
        row.appendChild(card);
      });
      body.appendChild(row);
      body.insertAdjacentHTML('beforeend', '<ul class="cs-rec-points">' + d.points.map(function (p) { return '<li>' + U.esc(p) + '</li>'; }).join('') + '</ul>' +
        '<div class="cs-rec-hint">캐릭터에 마우스를 올리면 스킬 설명이 나옵니다</div>');
    }
    const close = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '닫기' });
    close.addEventListener('click', function () { m.remove(); });
    box.append(tabs, body, close);
    m.appendChild(box);
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    s.appendChild(m);
    show(0);
  }

  /* ── 기록 내보내기 · 불러오기 ─────────────────────────── */
  function ioModal(s, title, html, buttons) {
    const old = s.querySelector('.cs-io'); if (old) old.remove();
    const m = U.el('div', 'cs-rec cs-io');
    const box = U.el('div', 'cs-rec-box cs-io-box g-panel', { html: '<div class="cs-rec-title">' + U.esc(title) + '</div><div class="cs-io-text">' + html + '</div>' });
    const row = U.el('div', 'cs-io-actions');
    buttons.forEach(function (b) {
      const el = U.el('button', 'g-btn' + (b.primary ? ' g-btn-primary' : ''), { type: 'button', text: b.text });
      el.addEventListener('click', function () { m.remove(); if (b.onClick) b.onClick(); });
      row.appendChild(el);
    });
    box.appendChild(row);
    m.appendChild(box);
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    s.appendChild(m);
  }
  function stamp() {
    const d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }
  function exportSave(s) {
    try {
      const blob = new Blob([JSON.stringify(G.save.exportData(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'game-save_' + stamp() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      ioModal(s, '기록 내보내기', '클리어한 스테이지 <b>' + G.save.clearedCount() + '개</b>와 편성 · 설정을 파일로 저장했습니다.<br>다른 곳에서 <b>불러오기</b>로 이 파일을 고르면 이어서 할 수 있습니다.', [{ text: '확인', primary: true }]);
    } catch (e) {
      ioModal(s, '기록 내보내기', '파일을 만들지 못했습니다. (' + U.esc(e.message) + ')', [{ text: '확인', primary: true }]);
    }
  }
  function pickImport(s) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      const f = input.files && input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = function () {
        let obj;
        try { obj = JSON.parse(String(r.result)); } catch (e) { obj = null; }
        if (!obj) { ioModal(s, '기록 불러오기', '파일을 읽을 수 없습니다. 내보내기로 만든 .json 파일인지 확인해 주세요.', [{ text: '확인', primary: true }]); return; }
        const n = obj.save && obj.save.cleared ? Object.keys(obj.save.cleared).filter(function (k) { return k.indexOf(':') === -1; }).length : '?';
        ioModal(s, '기록 불러오기', '<b>' + U.esc(f.name) + '</b><br>이 파일의 기록(클리어 ' + n + '개)으로 <b>지금 기록을 덮어씁니다.</b> 계속할까요?', [
          { text: '취소' },
          { text: '불러오기', primary: true, onClick: function () {
            try {
              const res = G.save.importData(obj);
              ioModal(s, '기록 불러오기', '기록을 불러왔습니다. (클리어한 스테이지 ' + res.cleared + '개)', [{ text: '확인', primary: true, onClick: function () { location.reload(); } }]);
            } catch (e) {
              ioModal(s, '기록 불러오기', U.esc(e.message), [{ text: '확인', primary: true }]);
            }
          } }
        ]);
      };
      r.readAsText(f);
    });
    input.click();
  }

  G.deckRec = openDeckRec;
  /* 설정 창(js/core/settings.js)의 기록 내보내기 · 불러오기에서 사용 */
  G.saveIO = { exportSave: exportSave, pickImport: pickImport };   // 스테이지 선택 화면(chapter-map.js)의 '덱 추천' 버튼에서 사용

  G.router.register('select', function () {
    return {
      mount: function (root, params, ctx) {
        const s = U.el('section', 'g-screen cs-screen g-fade-in');
        s.innerHTML =
          '<div class="g-bg-grid"></div><div class="g-hash"></div>' +
          '<div class="cs-label-bl"><span class="g-barcode"></span><span class="g-mono">CTL-00122 // STORY</span></div>' +
          '<div class="cs-label-br g-mono">SELECT A VOLUME</div>';

        const top = U.el('div', 'g-topbar');
        const back = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>LOBBY</span>' });
        back.addEventListener('click', function () { G.app.toLobby(); });
        const badge = U.el('div', 'g-badge', { html: '<span class="num">01.</span><span>STORY // CHRONICLES</span>' });
        const MAIN = G.DATA.chapters.filter(function (c) { return !c.side; });   // 서브 스토리 챕터는 책장에 넣지 않음
        const count = U.el('div', 'g-mono', { text: MAIN.length + ' VOLUMES' });
        /* 오른쪽 위: 기록 내보내기 · 불러오기 */
        /* 오른쪽 위: 설정 (효과음 · 기록 내보내기 · 불러오기) */
        const btnSet = G.settings.button(s);
        btnSet.classList.add('cs-io-btn', 'is-first');
        top.append(back, badge, count, btnSet);
        s.appendChild(top);

        const shelf = U.el('div', 'cs-shelf');
        const cap = U.el('div', 'cs-caption');
        s.append(shelf, cap);

        /* ── 아래 탭: 메인 스토리(책장) · 서브 스토리(벽에 걸린 포스터 · 엽서 · 액자) ── */
        const wall = U.el('div', 'ss-wall');
        s.appendChild(wall);
        const tabs = U.el('nav', 'cs-tabs');
        const TAB_ICON = {
          main: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 4.5h5.5a2.5 2.5 0 0 1 2.5 2.5v13a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-2h6z"/></svg>',
          side: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5 8.5 7M12 2.5 15.5 7"/><rect x="4" y="7" width="16" height="13.5"/><rect x="7" y="10" width="10" height="7.5"/></svg>'
        };
        [['main', '메인 스토리'], ['side', '서브 스토리']].forEach(function (t) {
          const b = U.el('button', 'cs-tab', { type: 'button', 'data-tab': t[0], 'data-sfx': 'page', html: TAB_ICON[t[0]] + '<span>' + t[1] + '</span>' });
          b.addEventListener('click', function () { setTab(t[0]); });
          tabs.appendChild(b);
        });
        s.appendChild(tabs);
        function setTab(t) {
          G.app.session.storyTab = t;
          s.classList.toggle('is-side', t === 'side');
          Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('is-on', b.getAttribute('data-tab') === t); });
          if (t === 'side' && !wall.children.length) renderWall();
        }
        /* 서브 스토리: 같은 형식의 카드가 가로로 늘어서고, 끌어서 넘김 · 누른 카드만 크게 펼쳐짐 */
        let ssSel = G.app.session.sideSel || G.DATA.subStories[0].id;
        function sideInfo(it) {
          const ch = it.chapter && G.DATA.chapters.find(function (c) { return c.id === it.chapter; });
          const open = !!(ch && G.save.isChapterUnlocked(ch.id));
          const total = ch ? ch.stages.length : 0;
          const done = ch ? ch.stages.filter(function (id) { return G.save.isCleared(id); }).length : 0;
          return { ch: ch, open: open, total: total, done: done };
        }
        function renderWall() {
          wall.innerHTML = '';
          const side = U.el('div', 'ss-side');
          const view = U.el('div', 'ss-view');
          const track = U.el('div', 'ss-track');
          view.appendChild(track);
          const bar = U.el('div', 'ss-scroll', { html: '<i></i>' });
          wall.append(U.el('div', 'ss-band', { html: new Array(14).join('<span>SIDE STORY</span>') }), side, view, bar);
          const cards = [];
          G.DATA.subStories.forEach(function (it, i) {
            const c = it.char && G.DATA.characters[it.char];
            const inf = sideInfo(it);
            const el = U.el('div', 'ss-card' + (inf.open ? '' : ' is-locked') + (c ? '' : ' is-blank'));
            el.setAttribute('data-id', it.id);
            el.style.setProperty('--tone', c ? (c.themeColor || '#5a4a3a') : '#2a221b');
            const src = c ? (c.images.battle || c.images.full) : '';
            const no = String(i + 1).padStart(2, '0');
            el.innerHTML =
              '<div class="ss-art">' + (src ? '<img src="' + src + '" alt="">' : '<span class="ss-q">?</span>') +
                '<span class="ss-no">' + no + '</span></div>' +
              '<div class="ss-cap"><b>' + (c ? U.esc(it.title || c.name) : '미정') + '</b>' +
                '<span class="ss-en">' + (c ? U.esc(it.en || c.nameEn || '') : 'TBA') + '</span>' +
                (inf.open ? (inf.done < inf.total ? '<em class="ss-new">NEW</em>' : '<em class="ss-clear">CLEAR</em>') : '<em class="ss-lock">' + U.svgIcon('i-lock') + '</em>') + '</div>' +
              '<div class="ss-more">' +
                '<dl><dt>STAGES</dt><dd>' + (inf.ch ? inf.total : '—') + '</dd>' +
                '<dt>CLEAR</dt><dd>' + (inf.ch ? inf.done + ' / ' + inf.total : '—') + '</dd>' +
                '<dt>STATUS</dt><dd>' + (inf.open ? '열림' : c ? '준비 중' : '비어 있음') + '</dd></dl>' +
                (inf.open ? '<button type="button" class="g-btn g-btn-primary ss-enter">입장</button>' : '<div class="ss-wait">' + U.svgIcon('i-lock') + '<span>' + (c ? '아직 열리지 않은 이야기' : '정해지지 않은 자리') + '</span></div>') +
              '</div>';
            const enter = el.querySelector('.ss-enter');
            if (enter) {
              enter.dataset.sfx = 'book_open';
              enter.addEventListener('click', function (e) { e.stopPropagation(); G.app.session.sideSel = it.id; ctx.go('#/chapter/' + inf.ch.id); });
            }
            el.addEventListener('click', function () {
              if (dragged) return;
              if (ssSel === it.id) return;
              ssSel = it.id; G.app.session.sideSel = it.id;
              G.sfx.play('card_pick');
              select(true);
            });
            track.appendChild(el);
            cards.push(el);
          });
          /* 왼쪽: 선택한 카드의 번호 · 이름 */
          function select(smooth) {
            const idx = Math.max(0, G.DATA.subStories.findIndex(function (x) { return x.id === ssSel; }));
            const it = G.DATA.subStories[idx], c = it.char && G.DATA.characters[it.char], inf = sideInfo(it);
            cards.forEach(function (el, i) { el.classList.toggle('is-sel', i === idx); });
            side.innerHTML = '<span class="ss-side-no">' + String(idx + 1).padStart(2, '0') + '</span>' +
              '<b class="ss-side-name">' + (c ? U.esc(it.title || c.name) : '미정') + '</b>' +
              '<span class="ss-side-en">' + (c ? U.esc(it.en || '') + ' · SIDE STORY' : 'SIDE STORY') + '</span>' +
              '<p class="ss-side-note">' + (inf.open ? '카드 아래 [입장]으로 이야기를 시작합니다.' : c ? '이야기를 준비하고 있습니다.' : '새로운 이야기가 들어올 자리입니다.') + '</p>';
            requestAnimationFrame(function () { keepVisible(idx, smooth); });
          }
          /* 끌어서 좌우로 넘기기 */
          let x = 0, dragged = false;
          function maxX() { return Math.min(0, view.clientWidth - track.scrollWidth - 40); }
          function setX(v, smooth) {
            x = Math.max(maxX(), Math.min(0, v));
            track.style.transition = smooth ? 'transform 0.4s cubic-bezier(.2,.8,.2,1)' : 'none';
            track.style.transform = 'translateX(' + x + 'px)';
            const range = -maxX();
            bar.firstChild.style.width = range ? Math.max(12, view.clientWidth / track.scrollWidth * 100) + '%' : '100%';
            bar.firstChild.style.left = range ? (-x / range) * (100 - Math.max(12, view.clientWidth / track.scrollWidth * 100)) + '%' : '0';
          }
          function keepVisible(idx, smooth) {
            const el = cards[idx]; if (!el) return;
            const l = el.offsetLeft, r = l + el.offsetWidth;
            if (l + x < 0) setX(-l + 20, smooth);
            else if (r + x > view.clientWidth) setX(view.clientWidth - r - 20, smooth);
            else setX(x, false);
          }
          let down = null;
          view.addEventListener('pointerdown', function (e) { if (e.button !== 0 || e.target.closest('.ss-enter')) return; down = { px: e.clientX, x0: x, id: e.pointerId }; dragged = false; });
          view.addEventListener('pointermove', function (e) {
            if (!down || e.pointerId !== down.id) return;
            const k = view.getBoundingClientRect().width / view.offsetWidth || 1;
            const dx = (e.clientX - down.px) / k;
            if (!dragged && Math.abs(dx) > 6) { dragged = true; view.classList.add('is-dragging'); try { view.setPointerCapture(e.pointerId); } catch (er) {} }
            if (dragged) setX(down.x0 + dx, false);
          });
          function end() { if (!down) return; down = null; view.classList.remove('is-dragging'); setTimeout(function () { dragged = false; }, 0); }
          view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
          view.addEventListener('wheel', function (e) { setX(x - (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), false); e.preventDefault(); }, { passive: false });
          select(false);
        }
        setTab(G.app.session.storyTab === 'side' ? 'side' : 'main');
        root.appendChild(s);

        const unlocked = MAIN.filter(function (c) { return G.save.isChapterUnlocked(c.id); });
        const newCh = G.app.session.newChapter;
        /* 기본 선택: 새로 열린 챕터 → 가장 최근에 열린 챕터 */
        let selected = (newCh && G.save.isChapterUnlocked(newCh)) ? newCh : (unlocked.length ? unlocked[unlocked.length - 1].id : null);

        function render() {
          shelf.innerHTML = '';
          MAIN.forEach(function (ch) {
            const open = G.save.isChapterUnlocked(ch.id);
            const isNew = ch.id === newCh;
            if (ch.id === selected) {
              const c = cover(ch, isNew);
              if (!open) {
                /* 잠긴 챕터: 흐린 표지, 누르면 한 번 떨렸다가 제자리 (입장 불가) */
                c.wrap.classList.add('is-locked');
                c.btn.insertAdjacentHTML('beforeend', '<div class="cs-cover-lock">' + U.svgIcon('i-lock') + '<span>LOCKED</span></div>');
                c.btn.addEventListener('click', function () {
                  c.wrap.classList.remove('is-denied'); void c.wrap.offsetWidth; c.wrap.classList.add('is-denied');
                });
                shelf.appendChild(c.wrap);
                return;
              }
              c.btn.dataset.sfx = 'book_open';
              c.btn.addEventListener('click', function () {
                if (G.app.session.newChapter === ch.id) G.app.session.newChapter = null;
                ctx.go('#/chapter/' + ch.id);
              });
              shelf.appendChild(c.wrap);
            } else {
              const sp = spine(ch, open, isNew);
              sp.dataset.sfx = 'page';
              sp.addEventListener('click', function () { selected = ch.id; render(); });
              shelf.appendChild(sp);
            }
          });
          const sel = G.DATA.chapters.find(function (c) { return c.id === selected; });
          const selOpen = sel && G.save.isChapterUnlocked(sel.id);
          cap.innerHTML = '<div class="cs-caption-title">' + (sel ? U.esc(sel.name || sel.title) : '') + '</div>';
        }
        render();
      },
      unmount: function () {}
    };
  });
})();
