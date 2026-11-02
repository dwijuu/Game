/* 챕터 맵 — 열린 스테이지만 타임라인에 표시, 클릭 시 오른쪽 팝업(이름·설명·입장) */
(function () {
  const U = G.util;

  /* 스테이지 구성 아이콘 — 금속 휘장(배지) 느낌의 금빛 선 문장 (ref/컨셉레퍼런스: 아르데코 원형 · 마름모 프레임)
   *  story: 원형 프레임 + 펼친 책 + 별 / battle: 마름모 프레임 + 교차한 두 검 / after: 원형 + 책 + 달 */
  const BADGE = {
    story:
      '<circle cx="24" cy="24" r="21.5" class="b-fill"/>' +
      '<circle cx="24" cy="24" r="21.5"/><circle cx="24" cy="24" r="17.6" class="b-thin"/>' +
      '<path d="M24 0.8l2 2.6-2 2.6-2-2.6zM24 42l2 2.6-2 2.6-2-2.6zM0.8 24l2.6-2 2.6 2-2.6 2zM42 24l2.6-2 2.6 2-2.6 2z" class="b-solid"/>' +
      '<path d="M12.6 19.4c3.8-1.6 7.6-1.2 11.4 1.4 3.8-2.6 7.6-3 11.4-1.4v12.4c-3.8-1.6-7.6-1.2-11.4 1.4-3.8-2.6-7.6-3-11.4-1.4z"/>' +
      '<path d="M24 20.8v12.4M15.4 23.2c2.4-.6 4.6-.3 6.6.8M15.4 26.6c2.4-.6 4.6-.3 6.6.8M32.6 23.2c-2.4-.6-4.6-.3-6.6.8M32.6 26.6c-2.4-.6-4.6-.3-6.6.8" class="b-thin"/>' +
      '<path d="M24 10.2l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" class="b-solid"/>',
    after:
      '<circle cx="24" cy="24" r="21.5" class="b-fill"/>' +
      '<circle cx="24" cy="24" r="21.5"/><circle cx="24" cy="24" r="17.6" class="b-thin" stroke-dasharray="1.6 2.2"/>' +
      '<path d="M24 0.8l2 2.6-2 2.6-2-2.6zM24 42l2 2.6-2 2.6-2-2.6z" class="b-solid"/>' +
      '<path d="M12.6 21.4c3.8-1.6 7.6-1.2 11.4 1.4 3.8-2.6 7.6-3 11.4-1.4v11.4c-3.8-1.6-7.6-1.2-11.4 1.4-3.8-2.6-7.6-3-11.4-1.4z"/>' +
      '<path d="M24 22.8v11.4" class="b-thin"/>' +
      '<path d="M26.8 9.4a5 5 0 1 0 3.4 8.2 4 4 0 0 1-3.4-8.2z" class="b-solid"/>',
    battle:
      '<path d="M24 1.6 46.4 24 24 46.4 1.6 24z" class="b-fill"/>' +
      '<path d="M24 1.6 46.4 24 24 46.4 1.6 24z"/><path d="M24 6.6 41.4 24 24 41.4 6.6 24z" class="b-thin"/>' +
      '<path d="M15.2 33.4 31.4 15.6l2.4-.6-.6 2.4L16.8 35z M32.8 33.4 16.6 15.6l-2.4-.6.6 2.4L31.2 35z"/>' +
      '<path d="M13.8 30.4l3.8 3.8M34.2 30.4l-3.8 3.8M12.6 35.4l1.6-1.6M35.4 35.4l-1.6-1.6"/>' +
      '<path d="M24 9.4l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" class="b-solid"/>',
    boss:
      '<path d="M24 1.6 46.4 24 24 46.4 1.6 24z" class="b-fill"/>' +
      '<path d="M24 1.6 46.4 24 24 46.4 1.6 24z"/><path d="M24 6.6 41.4 24 24 41.4 6.6 24z" class="b-thin"/>' +
      '<path d="M14.6 30.6h18.8l1.8-10.4-6.2 4.6L24 16.6l-5 8.2-6.2-4.6z"/>' +
      '<path d="M15.6 34h16.8" class="b-thin"/>' +
      '<circle cx="24" cy="12.6" r="1.4" class="b-solid"/>'
  };
  function badge(kind, cls) {
    return '<svg class="cm-badge ' + (cls || '') + ' is-' + kind + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + (BADGE[kind] || BADGE.story) + '</svg>';
  }

  G.router.register('map', function () {
    let onKey = null;
    return {
      mount: function (root, params, ctx) {
        const ch = G.DATA.chapters.find(function (c) { return c.id === params.chapterId; });
        const s = U.el('section', 'g-screen cm-screen g-fade-in');
        const hero = G.DATA.characters.Character_05;
        s.innerHTML =
          '<div class="cm-bg"></div>' +
          '<div class="g-bg-grid"></div>' +
          '<div class="g-ghost-num">' + (ch.side ? '' : String(ch.no).padStart(2, '0')) + '</div>' +
          '<div class="cm-horizon"></div>' +
          '<div class="cm-vline" style="left:14%"></div><div class="cm-vline" style="right:14%"></div>' +
          '<div class="cm-chapter-title"><div class="eyebrow">' + (ch.side ? 'SIDE STORY' : 'VOLUME ' + (['I', 'II', 'III', 'IV', 'V'][ch.no - 1] || ch.no) + ' · STORY') + '</div>' +
          '<div class="title">' + U.esc(ch.title) + '</div>' +
          '<div class="sub">스테이지를 선택하세요</div></div>';

        const top = U.el('div', 'g-topbar');
        const back = U.el('button', 'g-back', { type: 'button', html: U.svgIcon('i-back') + '<span>LIBRARY</span>' });
        back.addEventListener('click', function () { ctx.go('#/'); });
        /* 오른쪽 위: 덱 추천 */
        const recBtn = U.el('button', 'cm-tool cs-rec-btn', { type: 'button', html: G.lineIcon('deck') + '<span>덱 추천</span>' });
        recBtn.addEventListener('click', function (e) { e.stopPropagation(); G.deckRec(s); });
        /* 오른쪽 위: 캐릭터 목록 — 편성 화면의 캐릭터 정보 창과 같은 화면 (보기 전용) */
        const heroBtn = U.el('button', 'cm-tool cs-hero-btn', { type: 'button', html: G.lineIcon('friends') + '<span>캐릭터 목록</span>' });
        heroBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          G.heroList(s, { backLabel: 'STAGE SELECT', badge: '<span class="num">HERO</span><span>CHARACTER LIST</span>' });
        });
        top.append(back, U.el('div', 'g-badge', { html: '<span class="num">02.</span><span>' + U.esc(ch.title) + ' // STAGE SELECT</span>' }), heroBtn, recBtn, (function () { const b = G.settings.button(s); b.classList.add('cm-set-btn'); return b; })());
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
          if (st.story) p.push({ k: 'story', badge: 'story', label: '스토리' });
          if (!st.storyOnly) p.push({ k: 'battle', badge: st.boss ? 'boss' : 'battle', label: st.boss ? '보스전' : '전투' });
          if (st.afterStory) p.push({ k: 'story', badge: 'after', label: '후속 스토리' });
          return p;
        }
        function flowHtml(st) {
          return '<div class="cm-flow">' + parts(st).map(function (x, i) {
            return (i ? '<span class="cm-flow-arrow">›</span>' : '') + '<span class="cm-flow-item is-' + x.k + '">' + badge(x.badge) + '<b>' + x.label + '</b></span>';
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
          const enter = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '입장', 'data-sfx': 'none' });
          enter.addEventListener('click', function () {
            enter.disabled = true;   // 중복 입장 방지
            G.app.session.lastStage = st.id;   // 돌아왔을 때 이 스테이지가 보이도록
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
            '<div class="cm-node-parts">' + parts(st).map(function (x) { return '<span class="is-' + x.k + '" title="' + x.label + '">' + badge(x.badge) + '</span>'; }).join('') + '</div>' +
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
          /* 처음 보이는 위치: 새로 열린 스테이지 → 방금 플레이(클리어)한 스테이지 → 마지막 스테이지 */
          const lastIdx = visible.indexOf(G.app.session.lastStage);
          const focusIdx = fresh ? visible.indexOf(fresh) : lastIdx !== -1 ? lastIdx : visible.length - 1;
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
