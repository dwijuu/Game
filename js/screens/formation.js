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
              return '<div class="fm-enemy">' + G.art.human('', G.DATA.enemies[id].tint) + (enemyCounts[id] > 1 ? '<span class="fm-enemy-count">×' + enemyCounts[id] + '</span>' : '') + '</div>';
            }).join('') + '</div>' +
            '<div class="fm-enemy-names">' + Object.keys(enemyCounts).map(function (id) { return U.esc(G.DATA.enemies[id].name); }).join(' · ') + '</div></div>' +
          '<div class="fm-sec fm-stage-name g-mono">' + U.esc(stage.name) + ' // ' + (stage.tutorial ? 'TUTORIAL' : 'BATTLE') + '</div>';
        s.appendChild(info);

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
        actions.appendChild(startBtn);
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
                '<div class="fm-slot-art"><img src="' + c.images.full + '" alt=""></div>' +
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
          ltop.append(lback, U.el('div', 'g-badge', { html: '<span class="num">' + (slotIndex === 3 ? '대기' : String(slotIndex + 1).padStart(2, '0')) + '</span><span>' + (viewOnly ? 'AGENT INFO' : 'SELECT AGENT') + '</span>' }));
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
              card.innerHTML = '<img src="' + c.images.full + '" alt="">' +
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
              '<div class="cl-r-eyebrow">AGENT // ' + U.esc(c.id) + '</div>' +
              '<div class="cl-r-name">' + U.esc(c.name) + '</div>' +
              '<div class="cl-r-en">' + U.esc(c.nameEn) + '</div>' +
              '<div class="cl-stats">' +
                '<div class="cl-stat"><b>HP</b><span>' + c.combat.hp + '</span></div>' +
                '<div class="cl-stat"><b>ATK</b><span>' + c.combat.atk + '</span></div>' +
                '<div class="cl-stat"><b>DEF</b><span>' + c.combat.def + '</span></div>' +
                '<div class="cl-stat"><b>MP</b><span>' + (c.combat.mp || G.DATA.rules.MP_DEFAULT) + '</span></div>' +
                '<div class="cl-stat"><b>ULT</b><span>' + (c.ultPoints || G.DATA.rules.MOXIE_MAX) + '</span></div></div>' +
              (c.draft ? '<div class="cl-draft">기존 사이트에서 임시 데이터로 표시된 캐릭터입니다.</div>' : '') +
              (c.gameOnly ? '<div class="cl-draft">게임에서만 사용하는 캐릭터입니다. (전투 수치 · 이미지 임시)</div>' : '');

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

        startBtn.addEventListener('click', function () {
          if (!team.some(Boolean)) return;
          startBtn.disabled = true;   // 중복 클릭 방지
          ctx.setBattleSession({ stageId: stage.id, team: team.slice(), token: Date.now() });
          ctx.go('#/stage/' + stage.id + '/battle');
        });

        onKey = function (e) { if (e.key === 'Escape' && overlay) closeList(); };
        document.addEventListener('keydown', onKey);

        renderSlots();
        root.appendChild(s);
      },
      unmount: function () { if (onKey) document.removeEventListener('keydown', onKey); }
    };
  });
})();
