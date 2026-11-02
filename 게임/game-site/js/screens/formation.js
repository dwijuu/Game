/**
 * 편성 화면 (전투 이전)
 *  · 4칸 (1~3 출전 / 4 대기). 칸을 누르면 캐릭터 목록 → 오른쪽에 스킬 패널 → '확인'으로 그 칸에 배치
 *  · stage.formation.fixed 가 있으면 고정 편성 (스테이지 1: 아르덴 1명 고정 + '스토리' 표기, 나머지 칸 편성 불가)
 *  · '전투 시작' → 전투 세션을 만들어 전투 화면으로
 */
(function () {
  const U = G.util;
  /* 궁극기 이름 앞의 '최종 술식 -' 은 빼고 이름만 (칸이 좁아 잘리지 않도록) */
  function skName(n) { return String(n || '').replace(/^최종\s*술식\s*[-–—:]\s*/, ''); }

  function storyTeam(stage) {
    const t = stage.formation.fixed.slice(0, 4);
    while (t.length < 4) t.push(null);
    return t;
  }
  /* 고정 편성 스테이지: 처음 플레이(미클리어)에서만 고정, 클리어 후 다시 할 때는 자유 편성 */
  function isLocked(stage) {
    return !!(stage.formation && stage.formation.fixed) && !G.save.isCleared(stage.id);
  }
  function teamFor(stage) {
    if (isLocked(stage)) {
      const t = stage.formation.fixed.slice(0, 4);
      while (t.length < 4) t.push(null);
      return t;
    }
    const t = G.save.getTeam();
    if (!t.some(Boolean)) t[0] = G.DATA.roster[0];
    return t;
  }

  /* 속성 정보: characters.js 의 G.DATA.elements (기존 사이트 ELEMENT_INFO 와 같음) */
  function EL(k) { return G.DATA.elements[k] || { name: k, icon: 'burst', color: '#555' }; }

  /* 정보는 아이콘으로만 보여주고, 마우스를 올리면 툴팁으로 상세 정보 표시 */
  function iconTile(cls, iconKey, label, tipHtml, sub) {
    const t = U.el('div', 'cl-tile ' + cls);
    t.innerHTML = '<div class="cl-tile-ico">' + G.icons.svg(iconKey) + '</div>' +
      '<div class="cl-tile-label">' + U.esc(label) + '</div>' + (sub ? '<div class="cl-tile-sub">' + U.esc(sub) + '</div>' : '');
    t._tip = function () { return tipHtml; };
    return t;
  }
  function skillArt(tile, src) {
    const ico = tile.querySelector('.cl-tile-ico');
    ico.classList.add('is-art');
    ico.style.background = '';
    ico.innerHTML = '<img src="' + src + '" alt="">';
  }
  function skillTip(sk, isUlt, pts) {
    return '<div class="tt-row"><div class="tt-title">' + U.esc(sk.name) + (sk.nameEn ? ' <span class="tt-tag">' + U.esc(sk.nameEn) + '</span>' : '') + '</div>' +
      (sk.category ? '<div class="tt-sub" style="margin:0 0 6px">' + (isUlt ? '궁극기 · ' : '') + U.esc(sk.category) + (sk.element ? ' · ' + EL(sk.element).name : '') + '</div>' : '') +
      U.esc(sk.desc) + '</div>' +
      (sk.note ? '<div class="tt-row tt-sub">' + U.esc(sk.note) + '</div>' : '') +
      '<div class="tt-row tt-sub">' + (isUlt ? '궁극기: 마력 소모 없음 (열의 ' + (pts || 5) + ' 필요)' : '마력 ' + (sk.mp || 0) + ' 소모') + '</div>';
  }

  /* ── 캐릭터 목록 화면 (공용) ─────────────────────────────
   *  편성 화면의 캐릭터 선택 창과 스테이지 선택 화면의 [캐릭터 목록]이 같은 화면을 씀
   *  G.heroList(container, { backLabel, badge(html), selected, flag(id) → html, actions(act, selected, close), onClose })
   *  · actions 가 없으면 '닫기' 버튼만 표시 (보기 전용) · 반환값 { close } */
  G.heroList = function (container, o) {
    o = o || {};
    let selected = o.selected || G.DATA.roster[0];
    const overlay = U.el('div', 'cl-overlay');
    const left = U.el('div', 'cl-left');
    const ltop = U.el('div', 'g-topbar');
    const lback = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>' + U.esc(o.backLabel || 'BACK') + '</span>' });
    overlay.classList.add('rs-deck');
    lback.addEventListener('click', close);
    ltop.append(lback, U.el('div', 'g-badge', { html: o.badge || '<span>HERO LIST</span>' }));
    left.appendChild(ltop);
    const grid = U.el('div', 'cl-grid');
    left.appendChild(grid);
    /* 목록을 클릭한 채로 위아래로 끌어도 스크롤 (스크롤 바를 잡지 않아도 됨) */
    (function () {
      let down = null, moved = false;
      grid.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        down = { y: e.clientY, top: grid.scrollTop, id: e.pointerId };
        moved = false;
      });
      grid.addEventListener('pointermove', function (e) {
        if (!down || e.pointerId !== down.id) return;
        const k = grid.getBoundingClientRect().height / grid.offsetHeight || 1;
        const dy = (e.clientY - down.y) / k;
        if (!moved && Math.abs(dy) > 6) { moved = true; grid.classList.add('is-dragging'); try { grid.setPointerCapture(e.pointerId); } catch (er) {} }
        if (moved) grid.scrollTop = down.top - dy;
      });
      function end() { if (!down) return; down = null; grid.classList.remove('is-dragging'); setTimeout(function () { moved = false; }, 0); }
      grid.addEventListener('pointerup', end);
      grid.addEventListener('pointercancel', end);
      /* 끌기가 끝난 직후의 클릭(캐릭터 선택)은 무시 */
      grid.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
    })();
    const right = U.el('div', 'cl-right');
    overlay.append(left, right);
    function onKey(e) {
      if (!overlay.isConnected) { document.removeEventListener('keydown', onKey); return; }   // 화면이 바뀌어 사라진 경우
      if (e.key === 'Escape' && !container.querySelector('.dk-overlay')) close();
    }
    function close() {
      if (!overlay.isConnected) return;
      G.tip.hide();
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (o.onClose) o.onClose();
    }

    function renderGrid() {
      grid.innerHTML = '';
      G.DATA.roster.forEach(function (id, i) {
        const c = G.DATA.characters[id];
        const card = U.el('button', 'cl-card' + (id === selected ? ' is-selected' : ''), { type: 'button' });
        card.style.setProperty('--card-color', c.themeColor);
        card.innerHTML = '<span class="cl-card-art"><img' + (c.images.battle ? ' class="is-sprite"' : ' class="is-ph"') + ' src="' + (c.images.battle || c.images.full) + '" alt=""></span>' +
          (o.flag ? o.flag(id) : '') +
          '<span class="cl-card-foot"><span class="cl-card-no">' + String(i + 1).padStart(2, '0') + '</span><span class="cl-card-name">' + U.esc(c.name) + '</span></span>';
        card.addEventListener('click', function () { if (selected === id) return; selected = id; skillIdx = 0; renderGrid(); renderRight(); });
        grid.appendChild(card);
      });
    }

    /* ── 오른쪽: 메인화면 캐릭터 정보 화면과 같은 스킬 · 특성 배치 ── */
    const TYPE = { attack: '공격', buff: '버프', debuff: '디버프', heal: '회복' };
    let skillIdx = 0;
    function renderRight() {
      const c = G.DATA.characters[selected];
      const no = G.DATA.roster.indexOf(selected) + 1;
      const pts = c.ultPoints || G.DATA.rules.MOXIE_MAX;
      right.style.setProperty('--char-color', c.themeColor);
      const elems = [c.element, c.subElement].filter(Boolean);
      right.innerHTML =
        '<header class="cl-r-head">' +
          '<div class="cl-r-no">No. ' + String(no).padStart(2, '0') + '</div>' +
          '<div class="cl-r-name">' + U.esc(c.name) + '<em>' + U.esc(c.nameEn || '') + '</em></div>' +
          '<div class="cl-r-meta">' +
            elems.map(function (el, i) { return '<span class="cl-r-el" style="--el:' + EL(el).color + '">' + G.icons.svg(EL(el).icon) + EL(el).name + (i ? ' (서브)' : '') + '</span>'; }).join('') +
            '<span class="cl-r-stat"><em>HP</em>' + c.combat.hp + '</span>' +
            '<span class="cl-r-stat"><em>MP</em>' + (c.combat.mp || G.DATA.rules.MP_DEFAULT) + '</span>' +
            '<span class="cl-r-stat"><em>ULT</em>' + pts + '</span>' +
          '</div>' +
        '</header>' +
        '<div class="dt-h">스킬 <em>Skill</em></div>' +
        '<div class="dt-orbit"><svg class="dt-orbit-line" viewBox="0 0 640 220" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="320" cy="118" rx="306" ry="62"/><circle cx="16" cy="128" r="4"/><circle cx="380" cy="179" r="5"/></svg>' +
          '<div class="dt-sk-list"></div></div>' +
        '<article class="dt-sk-detail"></article>' +
        '<div class="dt-h">특성 <em>Trait</em></div>' +
        '<ul class="dt-traits">' + (c.mechanics || []).map(function (m) {
          return '<li><span class="mc-ico">' + G.icons.svg(m.icon || 'burst') + '</span><div><b>' + U.esc(m.name) + '</b><p>' + U.esc(m.desc) + '</p></div></li>';
        }).join('') + '</ul>';

      const list = c.skills.concat([c.ultimate]).filter(Boolean);
      const box = right.querySelector('.dt-sk-list'), det = right.querySelector('.dt-sk-detail');
      function pick(i) {
        skillIdx = i;
        const sk = list[i], ult = sk === c.ultimate;
        box.querySelectorAll('.dt-sk').forEach(function (b, j) { b.classList.toggle('is-on', j === i); });
        const tags = [ult ? '궁극기' : (TYPE[sk.type] || '스킬')];
        if (sk.element) tags.push(EL(sk.element).name);
        det.innerHTML =
          '<header><b>' + U.esc(skName(sk.name)) + '</b><em>' + U.esc(sk.nameEn || '') + '</em></header>' +
          '<div class="dt-sk-tags">' + tags.map(function (t, k) { return '<span' + (k === 1 ? ' style="--el:' + EL(sk.element).color + '"' : '') + '>' + t + '</span>'; }).join('') +
            (sk.category ? '<span class="is-cat">' + U.esc(sk.category) + '</span>' : '') + '</div>' +
          '<p>' + U.esc(sk.desc || '') + '</p>' +
          (sk.note ? '<p class="dt-sk-note">' + U.esc(sk.note) + '</p>' : '') +
          '<footer>' + (ult ? '마력 소모 없음 · 열의 ' + pts + ' 필요' : '마력 ' + (sk.mp || 0) + ' 소모' + (sk.hpCost ? ' · 최대 체력의 ' + Math.round(sk.hpCost * 100) + '% 소모' : '')) + '</footer>';
      }
      list.forEach(function (sk, i) {
        const ult = sk === c.ultimate;
        const b = U.el('button', 'dt-sk' + (ult ? ' is-ult' : ''), { type: 'button', 'data-sfx': 'page' });
        b.innerHTML = '<span class="dt-sk-art">' + (sk.art ? '<img src="' + sk.art + '" alt="">' : G.icons.svg(sk.icon || 'burst')) + '</span>' +
          '<span class="dt-sk-txt"><b>' + U.esc(skName(sk.name)) + '</b></span>';
        b.addEventListener('click', function () { pick(i); });
        box.appendChild(b);
      });
      pick(Math.min(skillIdx, list.length - 1));

      const act = U.el('div', 'cl-actions');
      if (o.actions) o.actions(act, selected, close);
      else {
        act.classList.add('is-view');
        const cl = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '닫기' });
        cl.addEventListener('click', close);
        act.appendChild(cl);
      }
      right.appendChild(act);
    }

    renderGrid();
    renderRight();
    container.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    return { close: close };
  };

  G.router.register('formation', function () {
    let onKey = null;
    return {
      mount: function (root, params, ctx) {
        const stage = G.DATA.stages[params.stageId];
        const fixed = isLocked(stage);
        const lockOthers = fixed && !!(stage.formation && stage.formation.lockOthers);
        const hasStory = !!(stage.formation && stage.formation.fixed);   // 다시 하기: 스토리 덱 버튼 표시
        let team = teamFor(stage);

        const s = U.el('section', 'g-screen fm-screen fm-v2 g-fade-in');
        s.innerHTML = '<div class="g-hall"><div class="g-hall-wall"></div>' +
          '<div class="g-hall-pillar" style="left:22%"></div><div class="g-hall-pillar" style="left:62%"></div></div>';

        const top = U.el('div', 'g-topbar');
        const back = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>STAGE</span>' });
        back.addEventListener('click', function () { ctx.go('#/chapter/' + stage.chapter); });
        const setBtn = G.settings.button(s);
        setBtn.classList.add('fm-set-btn');
        top.append(back, U.el('div', 'g-badge', { html: '<span class="num">03.</span><span>FORMATION // ' + U.esc(stage.name) + '</span>' }), setBtn);
        s.appendChild(top);

        /* 왼쪽: 목표 / 적 */
        const info = U.el('div', 'fm-info');
        const enemyCounts = {};
        stage.enemies.forEach(function (id) { enemyCounts[id] = (enemyCounts[id] || 0) + 1; });
        info.innerHTML =
          '<div class="fm2-eyebrow">BRIEFING // ' + U.esc(stage.name) + (stage.tutorial ? ' · TUTORIAL' : '') + '</div>' +
          '<div class="fm2-title">' + U.esc(stage.subtitle || stage.name) + '</div>' +
          '<div class="fm2-rule"></div>' +
          '<div class="fm-sec"><div class="fm-sec-h">목표</div><ul class="fm-obj">' +
            stage.objectives.map(function (o) { return '<li>' + U.esc(o) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="fm-sec"><div class="fm-sec-h">적</div><div class="fm-enemies">' +
            Object.keys(enemyCounts).map(function (id) {
              const ed = G.DATA.enemies[id];
              return '<div class="fm-enemy' + (ed.sprite ? ' has-sprite' : '') + '">' + (ed.sprite ? '<img src="' + ed.sprite.base + '" alt="">' : G.art.enemy(ed, '')) + (enemyCounts[id] > 1 ? '<span class="fm-enemy-count">×' + enemyCounts[id] + '</span>' : '') + '</div>';
            }).join('') + '</div>' +
            '<div class="fm-enemy-names">' + Object.keys(enemyCounts).map(function (id) { return U.esc(G.DATA.enemies[id].name); }).join(' · ') + '</div></div>' +
          '';
        s.appendChild(info);
        /* 적 아이콘에 마우스를 올리면 그 적의 스킬 · 궁극기 */
        Array.prototype.forEach.call(info.querySelectorAll('.fm-enemy'), function (el, i) {
          const def = G.DATA.enemies[Object.keys(enemyCounts)[i]];
          el._tip = function () {
            const sk = def.skills.map(function (k) { return '<div class="tt-row"><b>' + U.esc(k.name) + '</b> — ' + U.esc(k.desc) + '</div>'; }).join('');
            const ult = def.ultimate ? '<div class="tt-row"><b>궁극기 · ' + U.esc(def.ultimate.name) + '</b> — ' + U.esc(def.ultimate.desc) + '</div>' : '';
            return '<div class="tt-title">' + U.esc(def.name) + ' <span class="tt-tag debuff">HP ' + def.combat.hp + '</span></div>' + sk + ult +
              (def.actionsPerTurn ? '<div class="tt-sub">한 턴에 ' + def.actionsPerTurn.join('~') + '회 행동합니다.</div>' : '');
          };
        });

        const slotsWrap = U.el('div', 'fm-slots');
        s.appendChild(slotsWrap);
        if (fixed) info.appendChild(U.el('div', 'fm-hint', { text: '처음 플레이할 때는 스토리 편성으로만 진행합니다. 칸을 누르면 캐릭터 정보를 볼 수 있고, 클리어한 뒤에는 편성을 바꿀 수 있습니다.' }));
        /* 클리어한 고정 편성 스테이지: 왼쪽에 '스토리 덱으로 플레이' (스토리 편성 자동 채우기, 이후 수정 가능) */
        if (!fixed && hasStory) {
          const sb = U.el('button', 'g-btn fm-story-btn', { type: 'button', html: '<span>스토리 덱으로 플레이</span><small>' +
            storyTeam(stage).filter(Boolean).map(function (id) { return U.esc(G.DATA.characters[id].name); }).join(' · ') + '</small>' });
          sb.addEventListener('click', function () { team = storyTeam(stage); G.save.setTeam(team); renderSlots(); });
          info.appendChild(sb);
        }

        const actions = U.el('div', 'fm-actions');
        const startBtn = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '전투 시작', 'data-sfx': 'none' });
        /* 덱 불러오기: 미리 만들어 둔 덱으로 바로 편성 (전투 시작 옆) */
        const deckBtn = U.el('button', 'g-btn fm-deck-btn', { type: 'button', text: '덱 불러오기', 'data-sfx': 'none' });
        deckBtn.addEventListener('click', function () { openDecks(); });
        actions.append(deckBtn, startBtn);
        s.appendChild(actions);

        function renderSlots() {
          slotsWrap.innerHTML = '';
          for (let i = 0; i < 4; i++) {
            const id = team[i];
            const c = id && G.DATA.characters[id];
            const isFixed = fixed && !!c;
            const locked = !c && (lockOthers || (fixed && !c));
            /* 출전 1~3 = 아치형 벽감 · 대기 = 둥근 메달 (설명 문구 없음) */
            const isBench = i === 3;
            const b = U.el('button', 'fm2-slot' + (isBench ? ' is-bench' : '') + (c ? ' is-filled' : '') + (locked ? ' is-locked' : '') + (isFixed ? ' is-fixed' : ''), { type: 'button' });
            /* 스토리 고정 편성: 칸을 눌러 캐릭터 목록 · 설명은 볼 수 있지만 변경은 불가 */
            const viewOnly = fixed;
            let inner = '<div class="fm2-niche"><div class="fm2-glow"></div>';
            if (c) {
              b.style.setProperty('--slot-color', c.themeColor);
              inner += '<img class="fm2-art' + (c.images.battle ? ' is-sprite' : '') + '" src="' + (c.images.battle || c.images.full) + '" alt="">';
            } else if (locked) {
              inner += '<div class="fm2-empty">' + U.svgIcon('i-lock') + '</div>';
            } else {
              inner += '<div class="fm2-empty"><span class="plus"><i>+</i></span></div>';
            }
            inner += '</div>' +
              '<div class="fm2-no"><span>' + (isBench ? 'R' : ['I', 'II', 'III'][i]) + '</span></div>' +
              '<div class="fm2-plate">' + (c ? '<b>' + U.esc(c.name) + '</b>' : '<b class="is-empty">' + (locked ? '편성 불가' : '비어 있음') + '</b>') + '</div>' +
              (isBench ? '<div class="fm2-bench-lab">RESERVE</div>' : '') +
              (isFixed ? '<div class="fm2-tag">스토리</div>' : '');
            b.innerHTML = inner;

            b.addEventListener('click', function () { openList(i, viewOnly); });
            slotsWrap.appendChild(b);
          }
          startBtn.disabled = !team.some(Boolean);
        }

        /* ── 캐릭터 목록 (공용 화면 G.heroList 사용) ── */
        let list = null;
        function closeList() { if (list) { list.close(); list = null; } }
        function openList(slotIndex, viewOnly) {
          closeList();
          list = G.heroList(s, {
            backLabel: 'FORMATION',
            badge: '<span class="num">' + (slotIndex === 3 ? '대기' : String(slotIndex + 1).padStart(2, '0')) + '</span><span>' + (viewOnly ? 'HERO INFO' : 'SELECT HERO') + '</span>',
            selected: team[slotIndex] || G.DATA.roster[0],
            flag: function (id) { const at = team.indexOf(id); return at === slotIndex ? '<div class="cl-card-flag is-current">현재</div>' : at !== -1 ? '<div class="cl-card-flag">편성 중</div>' : ''; },
            onClose: function () { list = null; },
            actions: function (act, selected, close) {
              if (viewOnly) {
                /* 스토리 고정 편성: 보기만 가능 */
                act.classList.add('is-view');
                act.appendChild(U.el('div', 'cl-lock-note', { html: U.svgIcon('i-lock') + '<span>스토리에서는 캐릭터를 변경할 수 없습니다</span>' }));
                const cl = U.el('button', 'g-btn g-btn-ghost', { type: 'button', text: '닫기' });
                cl.addEventListener('click', close);
                act.appendChild(cl);
                return;
              }
              if (team[slotIndex]) {
                const rm = U.el('button', 'g-btn', { type: 'button', text: '편성 해제' });
                rm.addEventListener('click', function () { team[slotIndex] = null; commit(); });
                act.appendChild(rm);
              }
              const cancel = U.el('button', 'g-btn g-btn-ghost', { type: 'button', text: '취소' });
              cancel.addEventListener('click', close);
              const ok = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '확인' });
              ok.addEventListener('click', function () {
                const from = team.indexOf(selected);
                if (from !== -1 && from !== slotIndex) team[from] = team[slotIndex];   // 다른 칸에 있던 캐릭터면 자리 교환
                team[slotIndex] = selected;
                commit();
              });
              act.append(cancel, ok);
            }
          });
          function commit() {
            if (!fixed) G.save.setTeam(team);
            closeList();
            renderSlots();
          }
        }

        /* ── 덱 불러오기 창 ──
         *  · 저장된 덱 목록(최대 10개): 이름 바꾸기 · 맨 위로 · 삭제 · 현재 편성 저장(덮어쓰기) · 불러오기
         *  · 아래 '+' : 지금 편성을 새 덱으로 저장
         *  · 스토리 고정 편성(첫 플레이)에서는 불러오기만 막힘 */
        function openDecks() {
          let decks = G.save.getDecks();
          const ov = U.el('div', 'dk-overlay');
          const box = U.el('div', 'dk-box g-panel');
          box.innerHTML = '<div class="dk-title">덱 불러오기</div><div class="dk-sub">미리 덱을 만들어 두고, 전투 전에 원하는 덱으로 바로 바꿉니다.' + (fixed ? ' <em>스토리 첫 플레이에서는 덱을 바꿀 수 없습니다.</em>' : '') + '</div>';
          const list = U.el('div', 'dk-list');
          const close = U.el('button', 'g-btn g-btn-primary dk-close', { type: 'button', text: '닫기' });
          close.addEventListener('click', function () { ov.remove(); });
          box.append(list, close);
          ov.appendChild(box);
          ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
          s.appendChild(ov);

          function save() { G.save.setDecks(decks); }
          function sameTeam(a, b) { return a.every(function (x, i) { return (x || null) === (b[i] || null); }); }
          function iconBtn(cls, label, svg, fn) {
            const b = U.el('button', 'dk-ico ' + cls, { type: 'button', 'aria-label': label, html: svg });
            b._tip = function () { return label; };
            b.addEventListener('click', function (e) { e.stopPropagation(); G.tip.hide(); fn(); });
            return b;
          }
          function render() {
            list.innerHTML = '';
            decks.forEach(function (d, i) {
              const row = U.el('div', 'dk-row' + (sameTeam(d.team, team) ? ' is-current' : ''));
              const head = U.el('div', 'dk-head');
              const nm = U.el('button', 'dk-name', { type: 'button', html: '<svg viewBox="0 0 24 24" class="g-icon" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg><span>' + U.esc(d.name) + '</span>' });
              nm._tip = function () { return '이름 바꾸기'; };
              nm.addEventListener('click', function () {
                G.tip.hide();
                const inp = U.el('input', 'dk-name-input', { type: 'text', value: d.name, maxlength: '20' });
                nm.replaceWith(inp); inp.focus(); inp.select();
                const done = function () { const v = inp.value.trim(); if (v) d.name = v.slice(0, 20); save(); render(); };
                inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(); if (e.key === 'Escape') render(); e.stopPropagation(); });
                inp.addEventListener('blur', done);
              });
              head.appendChild(nm);
              if (sameTeam(d.team, team)) head.appendChild(U.el('span', 'dk-cur', { text: '현재 편성' }));
              const tools = U.el('div', 'dk-tools');
              tools.appendChild(iconBtn('is-up', '맨 위로', '<svg viewBox="0 0 24 24" class="g-icon" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h14M12 20V8M7 13l5-5 5 5"/></svg>', function () { decks.splice(i, 1); decks.unshift(d); save(); render(); }));
              tools.appendChild(iconBtn('is-del', '삭제', '<svg viewBox="0 0 24 24" class="g-icon" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>', function () {
                if (row.classList.contains('is-confirm')) { decks.splice(i, 1); save(); render(); return; }
                row.classList.add('is-confirm');
                tools.querySelector('.is-del')._tip = function () { return '한 번 더 누르면 삭제'; };
              }));
              head.appendChild(tools);
              const body = U.el('div', 'dk-body');
              const mem = U.el('div', 'dk-members');
              d.team.forEach(function (id, k) {
                const c = id && G.DATA.characters[id];
                const cell = U.el('div', 'dk-mem' + (k === 3 ? ' is-bench' : '') + (c ? '' : ' is-empty'));
                if (c) {
                  cell.style.setProperty('--card-color', c.themeColor);
                  cell.innerHTML = '<img class="' + (c.images.battle ? 'is-sprite' : 'is-art') + '" src="' + (c.images.battle || c.images.full) + '" alt=""><span>' + U.esc(c.name) + '</span>';
                  cell._tip = function () { return '<div class="tt-title">' + U.esc(c.name) + '</div>' + U.esc(c.role || ''); };
                } else cell.innerHTML = '<span>비어 있음</span>';
                if (k === 3) cell.insertAdjacentHTML('afterbegin', '<b class="tag">대기</b>');
                mem.appendChild(cell);
              });
              const acts = U.el('div', 'dk-acts');
              const over = U.el('button', 'g-btn dk-over', { type: 'button', text: '현재 편성 저장' });
              over._tip = function () { return '지금 편성 화면의 캐릭터로 이 덱을 덮어씁니다.'; };
              over.addEventListener('click', function () { d.team = team.slice(); save(); render(); });
              const use = U.el('button', 'g-btn g-btn-primary dk-use', { type: 'button', text: '불러오기' });
              use.disabled = fixed || !d.team.some(Boolean);
              use.addEventListener('click', function () {
                if (fixed) return;
                team = d.team.slice();
                G.save.setTeam(team);
                renderSlots();
                ov.remove();
              });
              acts.append(over, use);
              body.append(mem, acts);
              row.append(head, body);
              list.appendChild(row);
            });
            if (decks.length < G.save.MAX_DECKS) {
              const add = U.el('button', 'dk-add', { type: 'button', html: '<span class="plus">+</span><span>현재 편성을 새 덱으로 저장</span>' });
              add.addEventListener('click', function () {
                decks.push({ name: '덱 ' + (decks.length + 1), team: team.slice() });
                save(); render();
                list.scrollTop = list.scrollHeight;
              });
              list.appendChild(add);
            }
          }
          render();
        }

        startBtn.addEventListener('click', function () {
          if (!team.some(Boolean)) return;
          startBtn.disabled = true;   // 중복 클릭 방지
          ctx.setBattleSession({ stageId: stage.id, team: team.slice(), token: Date.now() });
          ctx.go('#/stage/' + stage.id + '/battle');
        });

        onKey = function (e) {
          if (e.key !== 'Escape') return;
          const dk = s.querySelector('.dk-overlay');
          if (dk) { dk.remove(); return; }
          if (list) closeList();
        };
        document.addEventListener('keydown', onKey);

        renderSlots();
        root.appendChild(s);
      },
      unmount: function () { if (onKey) document.removeEventListener('keydown', onKey); }
    };
  });
})();
