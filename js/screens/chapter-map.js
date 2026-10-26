/* 챕터 맵 — 열린 스테이지만 타임라인에 표시, 클릭 시 오른쪽 팝업(이름·설명·입장) */
(function () {
  const U = G.util;

  G.router.register('map', function () {
    let onKey = null;
    return {
      mount: function (root, params, ctx) {
        const ch = G.DATA.chapters.find(function (c) { return c.id === params.chapterId; });
        const s = U.el('section', 'g-screen cm-screen g-fade-in');
        const hero = G.DATA.characters.Character_05;
        s.innerHTML =
          '<div class="g-bg-grid"></div>' +
          '<div class="g-ghost-num">' + String(ch.no).padStart(2, '0') + '</div>' +
          '<div class="cm-horizon"></div>' +
          '<div class="cm-vline" style="left:14%"></div><div class="cm-vline" style="right:14%"></div>' +
          '<div class="cm-chapter-title"><div class="eyebrow">VOLUME ' + (['I', 'II', 'III', 'IV', 'V'][ch.no - 1] || ch.no) + ' · STORY</div>' +
          '<div class="title">' + U.esc(ch.title) + '</div>' +
          '<div class="sub">스테이지를 선택하세요</div></div>';

        const top = U.el('div', 'g-topbar');
        const back = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>LIBRARY</span>' });
        back.addEventListener('click', function () { ctx.go('#/'); });
        /* 오른쪽 위: 덱 추천 */
        const recBtn = U.el('button', 'g-back cs-rec-btn', { type: 'button', html: G.icons.svg('star') + '<span>덱 추천</span>' });
        recBtn.addEventListener('click', function (e) { e.stopPropagation(); G.deckRec(s); });
        top.append(back, U.el('div', 'g-badge', { html: '<span class="num">02.</span><span>' + U.esc(ch.title) + ' // STAGE SELECT</span>' }), recBtn);
        s.appendChild(top);

        /* 타임라인 */
        /* 타임라인: 스테이지 간격은 고정, 화면을 넘으면 클릭 드래그(또는 휠)로 좌우 이동 */
        const GAP = 330, START = 220, VIEW = 1920;
        const tl = U.el('div', 'cm-timeline');
        const track = U.el('div', 'cm-track');
        tl.appendChild(track);
        const visible = ch.stages.filter(function (id) { return G.save.isStageUnlocked(id); });
        const trackW = Math.max(VIEW, START + Math.max(0, visible.length - 1) * GAP + 420);
        track.style.width = trackW + 'px';
        track.appendChild(U.el('div', 'cm-rail'));
        const fresh = G.app.session.newlyUnlocked;
        G.app.session.newlyUnlocked = null;

        let popup = null, selectedNode = null;

        function closePopup() {
          if (popup) { popup.remove(); popup = null; }
          if (selectedNode) { selectedNode.classList.remove('is-selected'); selectedNode = null; }
        }

        /* 이 스테이지의 구성: [스토리] → [전투] → [후속 스토리] 를 크게 표시 */
        function parts(st) {
          const p = [];
          if (st.story) p.push({ k: 'story', icon: 'book', label: '스토리' });
          if (!st.storyOnly) p.push({ k: 'battle', icon: 'sword', label: '전투' });
          if (st.afterStory) p.push({ k: 'story', icon: 'book', label: '후속 스토리' });
          return p;
        }
        function flowHtml(st) {
          return '<div class="cm-flow">' + parts(st).map(function (x, i) {
            return (i ? '<span class="cm-flow-arrow">›</span>' : '') + '<span class="cm-flow-item is-' + x.k + '">' + G.icons.svg(x.icon) + '<b>' + x.label + '</b></span>';
          }).join('') + '</div>';
        }
        function openPopup(st, node) {
          closePopup();
          selectedNode = node;
          node.classList.add('is-selected');
          popup = U.el('div', 'cm-popup g-panel');
          const tags = [];
          if (st.tutorial) tags.push('<span class="cm-tag">TUTORIAL</span>');
          if (st.temporary) tags.push('<span class="cm-tag warn">임시</span>');
          if (st.storyOnly) tags.push('<span class="cm-tag">STORY</span>');
          if (st.boss) tags.push('<span class="cm-tag warn">BOSS</span>');
          if (G.save.isCleared(st.id)) tags.push('<span class="cm-tag">CLEAR</span>');
          popup.innerHTML =
            '<div class="cm-popup-eyebrow">' + U.esc(ch.title) + ' // STAGE</div>' +
            '<div class="cm-popup-name">' + U.esc(st.name) + '</div>' +
            (st.subtitle ? '<div class="cm-popup-sub">' + U.esc(st.subtitle) + '</div>' : '') +
            '<div class="cm-popup-rule"></div>' +
            flowHtml(st) +
            (tags.length ? '<div class="cm-popup-tags">' + tags.join('') + '</div>' : '') +
            '<div class="cm-popup-desc">' + U.esc(st.desc) + '</div>';
          const close = U.el('button', 'cm-popup-close', { type: 'button', 'aria-label': '닫기', text: '✕' });
          close.addEventListener('click', closePopup);
          const actions = U.el('div', 'cm-popup-actions');
          const enter = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '입장' });
          enter.addEventListener('click', function () {
            enter.disabled = true;   // 중복 입장 방지
            ctx.go('#/stage/' + st.id + (st.story ? '/story' : '/formation'));
          });
          /* 전투 후 스토리: 스테이지를 클리어하고(후속 스토리까지 본 뒤) 다시 열었을 때만 버튼 표시 */
          if (st.afterStory && G.save.isCleared(st.id) && G.save.isCleared(st.id + ':after')) {
            const after = U.el('button', 'g-btn', { type: 'button', text: '후속 스토리' });
            after.addEventListener('click', function () { after.disabled = true; ctx.go('#/stage/' + st.id + '/after'); });
            actions.appendChild(after);
          }
          actions.appendChild(enter);
          popup.append(close, actions);
          s.appendChild(popup);
        }

        visible.forEach(function (id, i) {
          const st = G.DATA.stages[id];
          const node = U.el('button', 'cm-node' + (G.save.isCleared(id) ? ' is-cleared' : '') + (fresh === id ? ' is-new' : ''), { type: 'button' });
          /* 스테이지 수에 맞춰 간격 조절 (화면 밖으로 넘치지 않게) */
          node.style.left = (START + i * GAP) + 'px';
          node.innerHTML =
            '<div class="cm-node-no">' + String(st.no).padStart(2, '0') + '<small> /</small></div>' +
            '<div class="cm-node-name">' + U.esc(st.name) + '</div>' +
            (st.subtitle ? '<div class="cm-node-sub">' + U.esc(st.subtitle) + '</div>' : '') +
            '<div class="cm-node-parts">' + parts(st).map(function (x) { return '<span class="is-' + x.k + '" title="' + x.label + '">' + G.icons.svg(x.icon) + '</span>'; }).join('') + '</div>' +
            (G.save.isCleared(id) ? '<div class="cm-node-state">CLEAR</div>' : '') +
            (fresh === id ? '<div class="cm-new-flag">NEW</div>' : '');
          node.addEventListener('click', function (e) { e.stopPropagation(); if (dragMoved) return; openPopup(st, node); });
          track.appendChild(node);
        });
        ['CH.' + String(ch.no).padStart(2, '0') + ' 00:00', '— — —', 'END'].forEach(function (t, i) {
          const lab = U.el('div', 'cm-rail-time', { text: t });
          lab.style.left = [70, Math.round(trackW / 2) - 60, trackW - 120][i] + 'px';
          track.appendChild(lab);
        });
        s.appendChild(tl);

        /* 드래그 스크롤 */
        const minX = Math.min(0, VIEW - trackW);
        let x = 0, dragMoved = false;
        function setX(v, smooth) {
          x = Math.max(minX, Math.min(0, v));
          track.style.transition = smooth ? 'transform 0.45s cubic-bezier(.2,.8,.2,1)' : 'none';
          track.style.transform = 'translateX(' + x + 'px)';
          tl.classList.toggle('can-left', x < 0);
          tl.classList.toggle('can-right', x > minX);
        }
        function scrollToIndex(i) {
          if (i < 0) return;
          const nodeX = START + i * GAP;
          if (nodeX + x > VIEW - 520 || nodeX + x < 120) setX(-(nodeX - VIEW / 2 + 150), true);
        }
        if (minX < 0) {
          tl.classList.add('is-draggable');
          let down = null;
          const scale = function () { return tl.getBoundingClientRect().width / VIEW || 1; };
          tl.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            down = { px: e.clientX, x0: x, id: e.pointerId };
            dragMoved = false;
          });
          tl.addEventListener('pointermove', function (e) {
            if (!down || e.pointerId !== down.id) return;
            const dx = (e.clientX - down.px) / scale();
            if (!dragMoved && Math.abs(dx) > 6) { dragMoved = true; tl.classList.add('is-dragging'); try { tl.setPointerCapture(e.pointerId); } catch (er) {} }
            if (dragMoved) setX(down.x0 + dx, false);
          });
          const end = function (e) {
            if (!down || (e && e.pointerId !== down.id)) return;
            down = null;
            tl.classList.remove('is-dragging');
            setTimeout(function () { dragMoved = false; }, 0);   // 드래그 직후의 클릭은 무시
          };
          tl.addEventListener('pointerup', end);
          tl.addEventListener('pointercancel', end);
          tl.addEventListener('wheel', function (e) {
            const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            setX(x - d, false);
            e.preventDefault();
          }, { passive: false });
          /* 처음에는 가장 최근에 열린 스테이지가 보이도록 */
          const focusIdx = fresh ? visible.indexOf(fresh) : visible.length - 1;
          setX(0, false);
          scrollToIndex(focusIdx);
          if (!fresh) { track.style.transition = 'none'; track.style.transform = 'translateX(' + x + 'px)'; }
        }

        /* 팝업 바깥 클릭 / ESC 로 닫기 */
        s.addEventListener('click', function (e) {
          if (dragMoved) return;
          if (popup && !popup.contains(e.target)) closePopup();
        });
        onKey = function (e) { if (e.key === 'Escape') closePopup(); };
        document.addEventListener('keydown', onKey);

        root.appendChild(s);

        /* 새로 열린 스테이지가 있으면 자동 선택 */
        if (fresh) {
          const idx = visible.indexOf(fresh);
          if (idx !== -1) setTimeout(function () {
            if (ctx.signal.aborted) return;
            const nodes = track.querySelectorAll('.cm-node');
            if (nodes[idx]) openPopup(G.DATA.stages[fresh], nodes[idx]);
          }, 700);
        }
      },
      unmount: function () { if (onKey) document.removeEventListener('keydown', onKey); }
    };
  });
})();
