/**
 * 스토리 화면
 *  1) 검은 화면에 스테이지 이름 3초
 *  2) 장면(SCENE) 이 바뀔 때마다 검은 화면에 장면 제목 · 장소
 *  3) 대사 → 클릭(또는 Space/Enter)으로 진행
 *     · 글자가 출력되는 중 클릭하면 즉시 전체 표시, 다시 클릭하면 다음 대사
 *  4) 오른쪽 위 SKIP → 스토리를 완전히 넘김
 *     · 전투가 있는 스테이지: 편성 화면으로
 *     · 스토리 전용 스테이지(storyOnly): STAGE CLEAR → 클리어 처리 → 스테이지 화면
 */
(function () {
  const U = G.util;
  const TITLE_MS = 3000;
  const SCENE_MS = 2400;
  const TYPE_MS = 30;

  G.router.register('story', function () {
    let onKey = null, typeTimer = 0;

    return {
      mount: function (root, params, ctx) {
        const st = G.DATA.stages[params.stageId];
        const isAfter = params.name === 'after';   // 전투 승리 후 이어지는 스토리
        const story = G.DATA.stories[isAfter ? st.afterStory : st.story];
        if (!story || !story.lines || !story.lines.length) {
          ctx.go(isAfter ? '#/chapter/' + st.chapter : '#/stage/' + st.id + '/formation', { replace: true });
          return;
        }
        const ch = G.DATA.chapters.find(function (c) { return c.id === st.chapter; });
        const storyOnly = !!(st.storyOnly || story.clearOnEnd || isAfter);
        const clearKey = isAfter ? st.id + ':after' : st.id;

        const s = U.el('section', 'g-screen st-screen');
        const scene = U.el('div', 'st-scene bg-dark');
        const light = U.el('div', 'st-light');
        const figure = U.el('div', 'st-figure', { html: G.art.girl() });
        const palm = U.el('div', 'st-palm', { html: '<div class="st-palm-fire"></div><div class="st-palm-dust"></div><div class="st-palm-dust d2"></div>' });
        const glint = U.el('div', 'st-glint');
        const portrait = U.el('img', 'st-portrait', { alt: '' });
        const sceneLabel = U.el('div', 'st-scene-label');
        scene.append(light, figure, palm, glint, portrait);

        const box = U.el('div', 'st-box');
        const name = U.el('div', 'st-name is-empty');
        const text = U.el('div', 'st-text');
        const next = U.el('div', 'st-next');
        box.append(name, text, next);

        const skip = U.el('button', 'st-skip', { type: 'button', html: '<span>SKIP</span>' + U.svgIcon('i-skip') });
        const prog = U.el('div', 'st-progress g-mono');

        const title = U.el('div', 'st-title');
        title.innerHTML =
          '<div class="st-title-eyebrow">' + U.esc(ch.title) + '</div>' +
          '<div class="st-title-name">' + U.esc(st.name) + '</div>' +
          (st.subtitle ? '<div class="st-title-sub">' + U.esc(st.subtitle) + '</div>' : '') +
          '<div class="st-title-rule"></div>';

        const card = U.el('div', 'st-card');   // 장면 전환 카드

        s.append(scene, sceneLabel, box, skip, prog, card, title);
        root.appendChild(s);

        let index = -1, typing = false, full = '', ready = false, done = false, inCard = false, cardResolve = null;

        function finish() {
          if (done) return;
          done = true;
          clearInterval(typeTimer);
          if (!storyOnly) { ctx.go('#/stage/' + st.id + '/formation'); return; }
          /* 스토리 전용 스테이지: STAGE CLEAR */
          /* 이미 해금된 스테이지·챕터는 다시 '해금'으로 알리지 않음 */
          const next = Object.keys(G.DATA.stages).map(function (k) { return G.DATA.stages[k]; })
            .find(function (x) { return x.requires === clearKey && x.chapter === st.chapter; });
          const nextWas = !!(next && G.save.isStageUnlocked(next.id));
          const chCand = G.DATA.chapters.filter(function (c) { return c.requires === clearKey && !G.save.isChapterUnlocked(c.id); });
          G.save.markCleared(clearKey);
          const nextNew = !!(next && !nextWas && G.save.isStageUnlocked(next.id));
          if (nextNew) G.app.session.newlyUnlocked = next.id;
          const newCh = chCand.find(function (c) { return G.save.isChapterUnlocked(c.id); });
          if (newCh) G.app.session.newChapter = newCh.id;
          const ov = U.el('div', 'st-clear');
          ov.innerHTML = '<div class="st-clear-big">STAGE CLEAR</div>' +
            '<div class="st-clear-sub">' + U.esc(st.name) + (st.subtitle ? ' — ' + U.esc(st.subtitle) : '') + '</div>' +
            (newCh ? '<div class="st-clear-new">' + U.esc(newCh.title) + ' 해금</div>' : '') +
            (nextNew ? '<div class="st-clear-new">' + U.esc(next.name) + ' 해금</div>' : '') +
            '<div class="st-clear-hint">화면을 클릭하면 스테이지 화면으로 돌아갑니다</div>';
          let leaving = false;
          ov.addEventListener('click', function (e) {
            e.stopPropagation();
            if (leaving) return; leaving = true;
            ctx.go('#/chapter/' + st.chapter);
          });
          s.appendChild(ov);
        }

        function applyFx(fx) {
          if (!fx) return;
          if (fx === 'flicker') { light.className = 'st-light is-flicker'; }
          else if (fx === 'figure') { light.className = 'st-light is-bright'; figure.classList.add('is-visible'); }
          else if (fx === 'approach') { figure.classList.add('is-near'); }
          else if (fx === 'shake') {
            scene.classList.remove('is-shake'); void scene.offsetWidth; scene.classList.add('is-shake');
            light.classList.remove('is-warp'); void light.offsetWidth; light.classList.add('is-warp');
          }
          else if (fx === 'run') { figure.classList.add('is-run'); }
          else if (fx === 'dark') { light.className = 'st-light is-off'; }
          else if (fx === 'palm') { palm.classList.add('is-on'); }
          else if (fx === 'palmOff') { palm.classList.remove('is-on'); }
          else if (fx === 'glint') { glint.classList.remove('is-on'); void glint.offsetWidth; glint.classList.add('is-on'); }
        }

        /* 장면 전환: 검은 화면에 SCENE 번호 · 제목 · 장소 */
        function showScene(line) {
          inCard = true;
          card.innerHTML = '<div class="st-card-no">' + U.esc(line.scene) + '</div>' +
            '<div class="st-card-title">' + U.esc(line.title || '') + '</div>' +
            (line.place ? '<div class="st-card-place">' + U.esc(line.place) + '</div>' : '');
          card.classList.add('is-on');
          box.classList.remove('is-on');
          portrait.classList.remove('is-on');
          palm.classList.remove('is-on');
          return new Promise(function (resolve) {
            cardResolve = resolve;
            U.wait(SCENE_MS, ctx.signal).then(resolve, function () {});
          }).then(function () {
            if (!inCard) return;
            inCard = false; cardResolve = null;
            scene.className = 'st-scene bg-' + (line.bg || 'dark');
            light.className = 'st-light';
            figure.className = 'st-figure';
            sceneLabel.innerHTML = '<b>' + U.esc(line.scene) + '</b> ' + U.esc(line.title || '') + (line.place ? '<span>' + U.esc(line.place) + '</span>' : '');
            sceneLabel.classList.add('is-on');
            card.classList.remove('is-on');
            box.classList.add('is-on');
          });
        }

        function show(i) {
          const line = story.lines[i];
          prog.textContent = 'LOG ' + String(i + 1).padStart(2, '0') + ' / ' + String(story.lines.length).padStart(2, '0');
          if (line.scene) {
            return showScene(line).then(function () { if (!done) advance(true); });
          }
          applyFx(line.fx);
          text.classList.remove('is-narration', 'is-narrator');
          if (line.speaker) {
            name.classList.remove('is-empty');
            const pc = G.DATA.characters[line.portrait];
            name.innerHTML = U.esc(line.speaker) + (pc ? '<small>' + U.esc(pc.nameEn) + '</small>' : '');
          } else if (line.narrator) {
            name.classList.remove('is-empty');
            name.innerHTML = '<span class="st-narr-tag">NARRATION</span>';
            text.classList.add('is-narrator');
          } else {
            name.classList.add('is-empty');
            name.textContent = '';
            text.classList.add('is-narration');
          }
          const pc = line.portrait && G.DATA.characters[line.portrait];
          if (pc) { if (portrait.getAttribute('src') !== pc.images.full) portrait.src = pc.images.full; portrait.classList.add('is-on'); }
          else portrait.classList.remove('is-on');
          type(line.text);
        }

        function type(str) {
          clearInterval(typeTimer);
          full = str; typing = true; next.classList.remove('is-on');
          let n = 0;
          text.textContent = '';
          typeTimer = setInterval(function () {
            n += 1;
            text.textContent = full.slice(0, n);
            if (n >= full.length) endType();
          }, TYPE_MS);
        }
        function endType() {
          clearInterval(typeTimer);
          text.textContent = full;
          typing = false;
          next.classList.add('is-on');
        }

        function advance(fromScene) {
          if (!ready || done) return;
          if (inCard) { if (cardResolve) cardResolve(); return; }   // 장면 카드는 클릭으로 넘길 수 있음
          if (typing && !fromScene) { endType(); return; }
          if (index + 1 >= story.lines.length) { finish(); return; }
          index++;
          show(index);
        }

        s.addEventListener('click', function (e) {
          if (skip.contains(e.target)) return;
          advance();
        });
        skip.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
        onKey = function (e) {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
          else if (e.key === 'Escape') finish();
        };
        document.addEventListener('keydown', onKey);

        /* 검은 화면 + 스테이지 이름 3초 → 사라지며 첫 대사(또는 첫 장면) */
        return U.wait(TITLE_MS, ctx.signal).then(function () {
          title.classList.add('is-out');
          if (!story.lines[0].scene) box.classList.add('is-on');
          ready = true;
          index = 0;
          show(0);
          return U.wait(700, ctx.signal);
        }).then(function () { title.remove(); });
      },
      unmount: function () {
        clearInterval(typeTimer);
        if (onKey) document.removeEventListener('keydown', onKey);
      }
    };
  });
})();
