/**
 * 챕터 선택 — 비디오 테이프
 *  · 선택된 챕터는 앞면(표지), 나머지는 옆면
 *  · 열린 챕터의 옆면을 누르면 그 챕터의 앞면이 보이고, 앞면을 누르면 입장
 *  · 잠긴 챕터(미제작 / 선행 조건 미충족)는 회색 · 클릭 불가
 */
(function () {
  const U = G.util;
  const COVER_COLOR = ['#0f42cf', '#3a6ea5', '#8a3a2e', '#2b6b4f', '#5a3a8a'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function cover(ch, isNew) {
    const wrap = U.el('div', 'cs-cover-wrap');
    const body = U.el('div', 'cs-tape-body');
    const btn = U.el('button', 'cs-cover', { type: 'button', 'aria-label': ch.title + ' 입장' });
    const hero = G.DATA.characters.Character_05;
    const kind = ch.stages.every(function (id) { return G.DATA.stages[id] && G.DATA.stages[id].storyOnly; }) ? 'STORY ONLY' : 'STORY';
    btn.innerHTML =
      '<div class="cs-cover-top"><span>VIDEO // ARCHIVE</span><span>◈ SP</span></div>' +
      '<div class="cs-cover-art" style="background:' + COVER_COLOR[(ch.no - 1) % COVER_COLOR.length] + '"><img src="' + hero.images.full + '" alt="" style="transform:translateX(' + (-38 + (ch.no - 1) * 9) + '%)"></div>' +
      '<div class="cs-cover-num">' + pad(ch.no) + '</div>' +
      '<div class="cs-cover-tag">' + kind + '</div>' +
      (isNew ? '<div class="cs-new-flag">NEW</div>' : '') +
      '<div class="cs-cover-bottom">' +
        '<div class="cs-cover-title">' + U.esc(ch.title) + '</div>' +
        '<div class="cs-cover-sub">TAPE ' + pad(ch.no) + ' // ' + ch.stages.length + ' STAGE' + (ch.stages.length > 1 ? 'S' : '') + '</div>' +
        '<div class="cs-cover-meta"><span class="g-barcode"></span><span class="vhs">VHS</span></div>' +
      '</div>';
    wrap.appendChild(body);
    wrap.appendChild(btn);
    return { wrap: wrap, btn: btn };
  }

  function spine(ch, unlocked, isNew) {
    const n = U.el(unlocked ? 'button' : 'div', 'cs-spine' + (unlocked ? ' is-open' : ' is-locked'), unlocked ? { type: 'button', 'aria-label': ch.title + ' 선택' } : { 'aria-disabled': 'true' });
    n.innerHTML =
      '<div class="cs-spine-band" style="' + (unlocked ? 'background:' + COVER_COLOR[(ch.no - 1) % COVER_COLOR.length] : '') + '"></div>' +
      '<div class="cs-spine-label"><span>' + U.esc(ch.title) + '</span></div>' +
      '<div class="cs-spine-num">' + pad(ch.no) + '</div>' +
      '<div class="cs-spine-vhs">VHS</div>' +
      '<div class="g-barcode"></div>' +
      (unlocked ? '' : '<div class="cs-spine-lock">' + U.svgIcon('i-lock') + '</div>') +
      (isNew ? '<div class="cs-new-flag">NEW</div>' : '');
    return n;
  }

  G.router.register('select', function () {
    return {
      mount: function (root, params, ctx) {
        const s = U.el('section', 'g-screen cs-screen g-fade-in');
        s.innerHTML =
          '<div class="g-bg-grid"></div><div class="g-hash"></div><div class="g-ghost-num">TAPE</div>' +
          '<div class="cs-label-bl"><span class="g-barcode"></span><span class="g-mono">CTL-00122 // STORY</span></div>' +
          '<div class="cs-label-br g-mono">SELECT CHAPTER // VIDEO ARCHIVE</div>';

        const top = U.el('div', 'g-topbar');
        const back = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>LOBBY</span>' });
        back.addEventListener('click', function () { G.app.toLobby(); });
        const badge = U.el('div', 'g-badge', { html: '<span class="num">01.</span><span>STORY // VIDEO ARCHIVE</span>' });
        const count = U.el('div', 'g-mono', { text: 'SHOWING ' + G.DATA.chapters.length + ' TAPES' });
        top.append(back, badge, count);
        s.appendChild(top);

        const shelf = U.el('div', 'cs-shelf');
        const cap = U.el('div', 'cs-caption');
        s.append(shelf, cap);
        root.appendChild(s);

        const unlocked = G.DATA.chapters.filter(function (c) { return G.save.isChapterUnlocked(c.id); });
        const newCh = G.app.session.newChapter;
        /* 기본 선택: 새로 열린 챕터 → 가장 최근에 열린 챕터 */
        let selected = (newCh && G.save.isChapterUnlocked(newCh)) ? newCh : (unlocked.length ? unlocked[unlocked.length - 1].id : null);

        function render() {
          shelf.innerHTML = '';
          G.DATA.chapters.forEach(function (ch) {
            const open = G.save.isChapterUnlocked(ch.id);
            const isNew = ch.id === newCh;
            if (ch.id === selected) {
              const c = cover(ch, isNew);
              c.btn.addEventListener('click', function () {
                if (G.app.session.newChapter === ch.id) G.app.session.newChapter = null;
                ctx.go('#/chapter/' + ch.id);
              });
              shelf.appendChild(c.wrap);
            } else {
              const sp = spine(ch, open, isNew);
              if (open) sp.addEventListener('click', function () { selected = ch.id; render(); });
              shelf.appendChild(sp);
            }
          });
          const sel = G.DATA.chapters.find(function (c) { return c.id === selected; });
          cap.innerHTML = sel
            ? '<div class="cs-caption-title">' + U.esc(sel.title) + '</div>' +
              '<div class="cs-caption-sub g-mono">' + (sel.stages.every(function (id) { return G.save.isCleared(id); }) ? 'CLEAR' : 'NOW PLAYABLE') + '</div>' +
              '<div class="cs-caption-hint">테이프를 눌러 챕터에 입장합니다' + (unlocked.length > 1 ? ' · 다른 테이프의 옆면을 누르면 선택됩니다' : '') + '</div>'
            : '<div class="cs-caption-title">NO TAPE</div>';
        }
        render();
      },
      unmount: function () {}
    };
  });
})();
