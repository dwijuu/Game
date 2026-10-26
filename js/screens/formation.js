/**
 * 편성 화면 (전투 이전)
 *  · 4칸 (1~3 출전 / 4 대기). 칸을 누르면 캐릭터 목록 → 오른쪽에 스킬 패널 → '확인'으로 그 칸에 배치
 *  · stage.formation.fixed 가 있으면 고정 편성 (스테이지 1: 아르덴 1명 고정 + '스토리' 표기, 나머지 칸 편성 불가)
 *  · '전투 시작' → 전투 세션을 만들어 전투 화면으로
 */
(function () {
  const U = G.util;

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

  G.router.register('formation', function () {
    let onKey = null;
    return {
      mount: function (root, params, ctx) {
        const stage = G.DATA.stages[params.stageId];
        const fixed = isLocked(stage);
        const lockOthers = fixed && !!(stage.formation && stage.formation.lockOthers);
        const hasStory = !!(stage.formation && stage.formation.fixed);   // 다시 하기: 스토리 덱 버튼 표시
        let team = teamFor(stage);

        const s = U.el('section', 'g-screen fm-screen g-fade-in');
        s.innerHTML = '<div class="g-hall"><div class="g-hall-wall"></div>' +
          '<div class="g-hall-pillar" style="left:22%"></div><div class="g-hall-pillar" style="left:62%"></div></div>';

        const top = U.el('div', 'g-topbar');
        const back = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>STAGE</span>' });
        back.addEventListener('click', function () { ctx.go('#/chapter/' + stage.chapter); });
        top.append(back, U.el('div', 'g-badge', { html: '<span class="num">03.</span><span>FORMATION // ' + U.esc(stage.name) + '</span>' }));
        s.appendChild(top);

        /* 왼쪽: 목표 / 적 */
        const info = U.el('div', 'fm-info');
        const enemyCounts = {};
        stage.enemies.forEach(function (id) { enemyCounts[id] = (enemyCounts[id] || 0) + 1; });
        info.innerHTML =
          '<div class="fm-sec"><div class="fm-sec-h">목표</div><ul class="fm-obj">' +
            stage.objectives.map(function (o) { return '<li>' + U.esc(o) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="fm-sec"><div class="fm-sec-h">적</div><div class="fm-enemies">' +
            Object.keys(enemyCounts).map(function (id) {
              const ed = G.DATA.enemies[id];
              return '<div class="fm-enemy' + (ed.sprite ? ' has-sprite' : '') + '">' + (ed.sprite ? '<img src="' + ed.sprite.base + '" alt="">' : G.art.human('', ed.tint)) + (enemyCounts[id] > 1 ? '<span class="fm-enemy-count">×' + enemyCounts[id] + '</span>' : '') + '</div>';
            }).join('') + '</div>' +
            '<div class="fm-enemy-names">' + Object.keys(enemyCounts).map(function (id) { return U.esc(G.DATA.enemies[id].name); }).join(' · ') + '</div></div>' +
          '<div class="fm-sec fm-stage-name g-mono">' + U.esc(stage.name) + ' // ' + (stage.tutorial ? 'TUTORIAL' : 'BATTLE') + '</div>';
        s.appendChild(info);
        /* 적 아이콘에 마우스를 올리면 그 적의 스킬 · 궁극기 */
        Array.prototype.forEach.call(info.querySelectorAll('.fm-enemy'), function (el, i) {
          const def = G.DATA.enemies[Object.keys(enemyCounts)[i]];
          el._tip = function () {
            const sk = def.skills.map(function (k) { return '<div class="tt-row"><b>' + U.esc(k.name) + '</b> — ' + U.esc(k.desc) + '</div>'; }).join('');
            const ult = def.ultimate ? '<div class="tt-row"><b>궁극기 · ' + U.esc(def.ultimate.name) + '</b> — ' + U.esc(def.ultimate.desc) + '</div>' : '';
            return '<div class="tt-title">' + U.esc(def.name) + ' <span class="tt-tag debuff">HP ' + def.combat.hp + ' · ATK ' + def.combat.atk + '</span></div>' + sk + ult +
              (def.actionsPerTurn ? '<div class="tt-sub">한 턴에 ' + def.actionsPerTurn.join('~') + '회 행동합니다.</div>' : '');
          };
        });

        const slotsWrap = U.el('div', 'fm-slots');
        s.appendChild(slotsWrap);
        s.appendChild(U.el('div', 'fm-bench-note', { text: '4번째 칸은 대기석입니다. 전투 중 한 턴을 소모해 교체할 수 있습니다.' }));
        if (fixed) s.appendChild(U.el('div', 'fm-hint', { text: '처음 플레이할 때는 스토리 편성으로만 진행합니다. 칸을 누르면 캐릭터 정보를 볼 수 있고, 클리어한 뒤에는 편성을 바꿀 수 있습니다.' }));
        /* 클리어한 고정 편성 스테이지: 왼쪽에 '스토리 덱으로 플레이' (스토리 편성 자동 채우기, 이후 수정 가능) */
        if (!fixed && hasStory) {
          const sb = U.el('button', 'g-btn fm-story-btn', { type: 'button', html: '<span>스토리 덱으로 플레이</span><small>' +
            storyTeam(stage).filter(Boolean).map(function (id) { return U.esc(G.DATA.characters[id].name); }).join(' · ') + '</small>' });
          sb.addEventListener('click', function () { team = storyTeam(stage); G.save.setTeam(team); renderSlots(); });
          info.appendChild(sb);
        }

        const actions = U.el('div', 'fm-actions');
        const startBtn = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '전투 시작' });
        /* 덱 불러오기: 미리 만들어 둔 덱으로 바로 편성 (전투 시작 옆) */
        const deckBtn = U.el('button', 'g-btn fm-deck-btn', { type: 'button', text: '덱 불러오기' });
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
            const b = U.el('button', 'fm-slot' + (locked ? ' is-locked' : '') + (isFixed ? ' is-fixed' : ''), { type: 'button' });
            /* 스토리 고정 편성: 칸을 눌러 캐릭터 목록 · 설명은 볼 수 있지만 변경은 불가 */
            const viewOnly = fixed;
            b.innerHTML = '<div class="fm-slot-no' + (i === 3 ? ' is-bench' : '') + '">' + (i === 3 ? '대기' : String(i + 1).padStart(2, '0')) + '</div>';
            if (c) {
              b.style.setProperty('--slot-color', c.themeColor);
              b.innerHTML +=
                '<div class="fm-slot-art"><img' + (c.images.battle ? ' class="is-sprite"' : '') + ' src="' + (c.images.battle || c.images.full) + '" alt=""></div>' +
                '<div class="fm-slot-shade"></div>' +
                '<div class="fm-slot-name">' + U.esc(c.name) + '</div>' +
                '<div class="fm-slot-en">' + U.esc(c.nameEn) + '</div>' +
                (isFixed ? '<div class="fm-slot-tag">스토리</div>' : '');
            } else if (locked) {
              b.innerHTML += '<div class="fm-slot-empty">' + U.svgIcon('i-lock') + '<span>편성 불가</span></div>';
            } else {
              b.innerHTML += '<div class="fm-slot-empty"><div class="plus">+</div><span>편성</span></div>';
            }
            b.addEventListener('click', function () { openList(i, viewOnly); });
            slotsWrap.appendChild(b);
          }
          startBtn.disabled = !team.some(Boolean);
        }

        /* ── 캐릭터 목록 ── */
        let overlay = null;
        function closeList() { if (overlay) { overlay.remove(); overlay = null; } }
        function openList(slotIndex, viewOnly) {
          closeList();
          let selected = team[slotIndex] || G.DATA.roster[0];
          overlay = U.el('div', 'cl-overlay');
          const left = U.el('div', 'cl-left');
          const ltop = U.el('div', 'g-topbar');
          const lback = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>FORMATION</span>' });
          lback.addEventListener('click', closeList);
          ltop.append(lback, U.el('div', 'g-badge', { html: '<span class="num">' + (slotIndex === 3 ? '대기' : String(slotIndex + 1).padStart(2, '0')) + '</span><span>' + (viewOnly ? 'HERO INFO' : 'SELECT HERO') + '</span>' }));
          left.appendChild(ltop);
          const grid = U.el('div', 'cl-grid');
          left.appendChild(grid);
          const right = U.el('div', 'cl-right');
          overlay.append(left, right);

          function renderGrid() {
            grid.innerHTML = '';
            G.DATA.roster.forEach(function (id) {
              const c = G.DATA.characters[id];
              const at = team.indexOf(id);
              const card = U.el('button', 'cl-card' + (id === selected ? ' is-selected' : ''), { type: 'button' });
              card.style.setProperty('--card-color', c.themeColor);
              card.innerHTML = '<img' + (c.images.battle ? ' class="is-sprite"' : '') + ' src="' + (c.images.battle || c.images.full) + '" alt="">' +
                (at === slotIndex ? '<div class="cl-card-flag is-current">현재</div>' : at !== -1 ? '<div class="cl-card-flag">편성 중</div>' : '') +
                '<div class="cl-card-foot"><div class="cl-card-name">' + U.esc(c.name) + '</div><div class="cl-card-en">' + U.esc(c.nameEn) + '</div></div>';
              card.addEventListener('click', function () { selected = id; renderGrid(); renderRight(); });
              grid.appendChild(card);
            });
          }

          function renderRight() {
            const c = G.DATA.characters[selected];
            right.style.setProperty('--char-color', c.themeColor);
            right.innerHTML =
              '<div class="cl-r-eyebrow">HERO // ' + U.esc(c.nameEn) + '</div>' +
              '<div class="cl-r-name">' + U.esc(c.name) + '</div>' +
              '<div class="cl-r-en">' + U.esc(c.nameEn) + '</div>' +
              '<div class="cl-stats">' +
                '<div class="cl-stat"><b>HP</b><span>' + c.combat.hp + '</span></div>' +
                '<div class="cl-stat"><b>ATK</b><span>' + c.combat.atk + '</span></div>' +
                '<div class="cl-stat"><b>DEF</b><span>' + c.combat.def + '</span></div>' +
                '<div class="cl-stat"><b>MP</b><span>' + (c.combat.mp || G.DATA.rules.MP_DEFAULT) + '</span></div>' +
                '<div class="cl-stat"><b>ULT</b><span>' + (c.ultPoints || G.DATA.rules.MOXIE_MAX) + '</span></div></div>' +
              '';

            /* 역할군 · 속성 · 메커니즘 */
            right.appendChild(U.el('div', 'cl-skill-h', { text: 'PROFILE' }));
            const prof = U.el('div', 'cl-tiles is-small');
            if (c.role) prof.appendChild(iconTile('is-role', 'burst', '역할군', '<div class="tt-title">역할군</div>' + U.esc(c.role)));
            [c.element, c.subElement].forEach(function (el, i) {
              if (!el) return;
              const tile = iconTile('is-elem ' + el, EL(el).icon, EL(el).name,
                '<div class="tt-title">' + EL(el).name + ' <span class="tt-tag">' + (i ? '서브 속성' : '메인 속성') + '</span></div>' +
                (el === 'gold' ? '패시브 [빛]: 블랙 속성 적에게 주는 피해 +3% · 공격 시 마력 흡수 · [마력 분배] 카드 생성'
                  : el === 'black' ? '블랙 속성입니다. 골드 속성 캐릭터의 [빛] 패시브에 약합니다.'
                  : i ? '보조로 사용하는 원소입니다.' : '주력으로 사용하는 원소입니다.'));
              tile.querySelector('.cl-tile-ico').style.background = EL(el).color;
              prof.appendChild(tile);
            });
            (c.mechanics || []).forEach(function (m) {
              prof.appendChild(iconTile('is-mech', m.icon || 'burst', m.name, '<div class="tt-title">' + U.esc(m.name) + '</div>' + U.esc(m.desc)));
            });
            right.appendChild(prof);

            /* 스킬 아이콘 (마우스를 올리면 설명) */
            right.appendChild(U.el('div', 'cl-skill-h', { text: 'SKILL' }));
            const sk = U.el('div', 'cl-tiles');
            c.skills.forEach(function (x, i) {
              const t = iconTile('is-skill', x.icon || 'burst', x.name, skillTip(x, false), 'MP ' + (x.mp || 0));
              if (x.element) t.querySelector('.cl-tile-ico').style.background = EL(x.element).color;
              if (x.art) skillArt(t, x.art);   // 스킬 카드 그림이 있으면 전투 카드와 같은 그림으로 표시
              sk.appendChild(t);
            });
            const ut = iconTile('is-skill is-ult', c.ultimate.icon || 'burst', c.ultimate.name, skillTip(c.ultimate, true, c.ultPoints), 'ULTIMATE');
            if (c.ultimate.art) skillArt(ut, c.ultimate.art);
            sk.appendChild(ut);
            right.appendChild(sk);
            right.appendChild(U.el('div', 'cl-hint', { text: '아이콘에 마우스를 올리거나 아이콘을 누르면 자세한 정보를 볼 수 있습니다.' }));
            const act = U.el('div', 'cl-actions');
            if (viewOnly) {
              /* 스토리 고정 편성: 보기만 가능 */
              act.classList.add('is-view');
              act.appendChild(U.el('div', 'cl-lock-note', { html: U.svgIcon('i-lock') + '<span>스토리에서는 캐릭터를 변경할 수 없습니다</span>' }));
              const close = U.el('button', 'g-btn g-btn-ghost', { type: 'button', text: '닫기' });
              close.addEventListener('click', closeList);
              act.appendChild(close);
              right.appendChild(act);
              return;
            }
            if (team[slotIndex]) {
              const rm = U.el('button', 'g-btn', { type: 'button', text: '편성 해제' });
              rm.addEventListener('click', function () { team[slotIndex] = null; commit(); });
              act.appendChild(rm);
            }
            const cancel = U.el('button', 'g-btn g-btn-ghost', { type: 'button', text: '취소' });
            cancel.addEventListener('click', closeList);
            const ok = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '확인' });
            ok.addEventListener('click', function () {
              const from = team.indexOf(selected);
              if (from !== -1 && from !== slotIndex) team[from] = team[slotIndex];   // 다른 칸에 있던 캐릭터면 자리 교환
              team[slotIndex] = selected;
              commit();
            });
            act.append(cancel, ok);
            right.appendChild(act);
          }

          function commit() {
            if (!fixed) G.save.setTeam(team);
            closeList();
            renderSlots();
          }

          renderGrid();
          renderRight();
          s.appendChild(overlay);
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
          if (overlay) closeList();
        };
        document.addEventListener('keydown', onKey);

        renderSlots();
        root.appendChild(s);
      },
      unmount: function () { if (onKey) document.removeEventListener('keydown', onKey); }
    };
  });
})();
