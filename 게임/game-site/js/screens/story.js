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
        const spark = U.el('div', 'st-spark');   // 손끝의 전류 (fx: 'spark')
        const blackFx = U.el('div', 'st-blackfx');   // 번져 나가는 검은 마력 (fx: 'black')
        const flash = U.el('div', 'st-flash');        // 하얀 번쩍임 (fx: 'flash')
        const rustle = U.el('div', 'st-rustle', { html: '<i></i><i></i><i></i>' });   // 수풀 흔들림 (fx: 'rustle')
        /* 장면 분위기 입자 (배경마다 다름: 숲=반딧불 · 훈련장=먼지 · 복도=빛 먼지 · 방=햇살) */
        const ambient = U.el('div', 'st-ambient', { html: new Array(15).join('<i></i>') });
        const portrait = U.el('img', 'st-portrait', { alt: '' });   // (이전 방식 · 사용하지 않음)
        /* 등장인물: 전투 필드와 같은 그림(스프라이트). 한 장면에 여럿이 나오면 모두 서 있고, 말하는 사람만 밝게 */
        const castEl = U.el('div', 'st-cast');
        const sceneLabel = U.el('div', 'st-scene-label');
        scene.append(ambient, light, figure, palm, glint, blackFx, rustle, castEl, spark, flash);
        let cast = [];
        function charOfLine(line) {
          if (line.portrait && G.DATA.characters[line.portrait]) return line.portrait;
          if (!line.speaker) return null;
          const id = Object.keys(G.DATA.characters).find(function (k) { return G.DATA.characters[k].name === line.speaker; });
          return id || null;
        }
        /* 등장인물 표시 규칙
         *  · 대사가 있을 때만 인물이 보임 (나레이션 · 지문 중에는 모두 숨김)
         *  · 보이는 인물: 지금 말하는 사람 + 바로 전에 말한 상대 (최대 2명, 말하는 사람만 밝게)
         *  · 자리는 장면에서 처음 등장한 순서로 왼쪽 → 오른쪽 */
        let lastOther = null;
        function actorBox(id) {
          let el = castEl.querySelector('.st-actorbox[data-id="' + id + '"]');
          if (!el) {
            const c = G.DATA.characters[id];
            el = U.el('div', 'st-actorbox');
            el.setAttribute('data-id', id);
            el.innerHTML = '<img class="st-actor' + (c.images.battle ? '' : ' is-art') + '" src="' + (c.images.battle || c.images.full) + '" alt=""><div class="st-emote"></div>';
            castEl.appendChild(el);
          }
          return el;
        }
        function renderCast(speakerId) {
          let vis = [];
          if (speakerId) {
            vis = [speakerId];
            if (lastOther && lastOther !== speakerId && cast.indexOf(lastOther) !== -1) vis.push(lastOther);
          }
          vis.sort(function (a, b) { return cast.indexOf(a) - cast.indexOf(b); });
          const pos = vis.length === 1 ? [50] : [30, 70];
          cast.forEach(function (id) { if (vis.indexOf(id) !== -1) actorBox(id); });
          Array.prototype.forEach.call(castEl.querySelectorAll('.st-actorbox'), function (el) {
            const id = el.getAttribute('data-id');
            const at = vis.indexOf(id);
            if (cast.indexOf(id) === -1 && at === -1) { el.classList.remove('is-shown'); setTimeout(function () { if (!el.classList.contains('is-shown')) el.remove(); }, 400); return; }
            if (at === -1) { el.classList.remove('is-shown', 'is-speaking'); return; }
            const fresh = !el.classList.contains('is-shown');
            if (fresh) { el.style.transition = 'none'; el.style.left = pos[at] + '%'; void el.offsetWidth; el.style.transition = ''; }
            el.style.left = pos[at] + '%';
            el.classList.add('is-shown');
            el.classList.toggle('is-speaking', id === speakerId);
          });
          if (speakerId && speakerId !== lastSpeaker) { lastOther = lastSpeaker; lastSpeaker = speakerId; }
          castEl.classList.toggle('has-speaker', !!speakerId);
        }
        let lastSpeaker = null;

        /* 대사에 맞춘 인물 반응 (과하지 않게: 작은 동작 1개 + 머리 위 말풍선 기호 1개)
         *  line.act: 'hop' | 'shake' | 'nod' | 'shrink' | 'lean' | 'tremble' | 'fall' (없으면 문장에서 추정, false 면 없음)
         *  line.emote: '!' | '?' | '!?' | '…' | 'sweat' | 'anger' | 'spark' | 'heart' (없으면 추정, false 면 없음) */
        function inferReaction(line) {
          const t = String(line.text || '').trim();
          let act = null, emote = null;
          if (/^(으|으아|으악|으, 으)/.test(t)) { act = 'tremble'; emote = 'sweat'; }
          else if (/\?!|!\?/.test(t)) { act = 'hop'; emote = '!?'; }
          else if (/^흥|짜증|재수 없|안 급하거든|하지 마!|말하지 마/.test(t)) { act = 'shake'; emote = 'anger'; }
          else if (/^(앗|어\?|응\?|어라|잠깐)/.test(t)) { act = 'hop'; emote = '!'; }
          else if (/^(저,|저…|저\.|그, 그|아…|아, )/.test(t)) { act = 'shrink'; emote = 'sweat'; }
          else if (/^…|^\.\.\./.test(t)) { emote = '…'; }
          else if (/ㅋㅎㅎ|하하|기뻐요|좋아!|정말\?!|좋아\. |우승은 우리/.test(t)) { act = 'hop'; emote = 'spark'; }
          else if (/죄송|감사합니다|고마/.test(t)) { act = 'nod'; }
          else if (/!$/.test(t) && t.length < 24) { act = 'hop'; }
          else if (/\?$/.test(t) && t.length < 14) { emote = '?'; }
          return {
            act: line.act === false ? null : (line.act || act),
            emote: line.emote === false ? null : (line.emote || emote)
          };
        }
        const EMOTE = {
          '!': '<b>!</b>', '?': '<b>?</b>', '!?': '<b>!?</b>', '…': '<b>…</b>',
          sweat: '<svg viewBox="0 0 24 24"><path d="M12 3c3 4.5 5 7.5 5 10a5 5 0 0 1-10 0c0-2.5 2-5.5 5-10z" fill="#9fd3ff" stroke="#2a4a66" stroke-width="1.4"/></svg>',
          anger: '<svg viewBox="0 0 24 24"><path d="M4 9.5 9.5 4M4 14.5 9.5 20M20 9.5 14.5 4M20 14.5 14.5 20" stroke="#ff5a4a" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
          spark: '<svg viewBox="0 0 24 24"><path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="#ffe08a" stroke="#8a6a20" stroke-width="1"/></svg>',
          heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#ff8aa0"/></svg>'
        };
        function react(id, line) {
          if (!id) return;
          const el = castEl.querySelector('.st-actorbox[data-id="' + id + '"]');
          if (!el) return;
          const r = inferReaction(line);
          el.classList.remove('act-hop', 'act-shake', 'act-nod', 'act-shrink', 'act-lean', 'act-tremble', 'act-fall');
          void el.offsetWidth;
          if (r.act) el.classList.add('act-' + r.act);
          const em = el.querySelector('.st-emote');
          em.className = 'st-emote';
          em.innerHTML = '';
          if (r.emote && EMOTE[r.emote]) {
            em.innerHTML = EMOTE[r.emote];
            void em.offsetWidth;
            em.className = 'st-emote is-on emote-' + (r.emote.length > 2 ? r.emote : 'mark');
            if (r.emote === '!' || r.emote === '!?') G.sfx.play('st_pop');
          }
        }

        const box = U.el('div', 'st-box');
        const name = U.el('div', 'st-name is-empty');
        const text = U.el('div', 'st-text');
        const next = U.el('div', 'st-next');
        box.append(name, text, next);

        const skip = U.el('button', 'st-skip', { type: 'button', html: '<span>SKIP</span>' + U.svgIcon('i-skip') });
        /* 오른쪽 위 메뉴: LOG(지난 대사) · AUTO(자동 넘김) · SKIP */
        const tools = U.el('div', 'st-tools');
        const logBtn = U.el('button', 'st-tool', { type: 'button', html: G.icons.svg('book') + '<span>LOG</span>' });
        const autoBtn = U.el('button', 'st-tool', { type: 'button', html: U.svgIcon('i-auto') + '<span>AUTO</span>' });
        /* 설정 (효과음 · 기록) — 열려 있는 동안 AUTO 넘김은 잠시 멈춤 */
        const setBtn = U.el('button', 'st-tool st-set g-ico-only', { type: 'button', 'aria-label': '설정', html: G.lineIcon('gear') });
        setBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          G.settings.open(s, { onOpen: function () { clearTimeout(autoTimer); }, onClose: function () { if (!typing) scheduleAuto(); } });
        });
        tools.append(logBtn, autoBtn, skip, setBtn);
        const history = [];
        function logLine(line) {
          if (!line.text) return;
          history.push({ who: line.speaker || (line.narrator ? 'NARRATION' : ''), text: line.text, narr: !line.speaker });
        }
        let logEl = null;
        function openLog() {
          if (logEl) return;
          logEl = U.el('div', 'st-log');
          const box = U.el('div', 'st-log-box g-panel');
          box.innerHTML = '<div class="st-log-h">LOG <small>지난 대사</small></div>';
          const list = U.el('div', 'st-log-list');
          list.innerHTML = history.map(function (h) {
            return '<div class="st-log-row' + (h.narr ? ' is-narr' : '') + '">' + (h.who ? '<b>' + U.esc(h.who) + '</b>' : '<b></b>') + '<p>' + U.esc(h.text) + '</p></div>';
          }).join('') || '<div class="st-log-empty">아직 지난 대사가 없습니다.</div>';
          const cl = U.el('button', 'g-btn g-btn-primary st-log-close', { type: 'button', text: '닫기' });
          cl.addEventListener('click', function (e) { e.stopPropagation(); closeLog(); });
          box.append(list, cl);
          logEl.appendChild(box);
          logEl.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === logEl) closeLog(); });
          s.appendChild(logEl);
          list.scrollTop = list.scrollHeight;
        }
        function closeLog() { if (logEl) { logEl.remove(); logEl = null; } }
        logBtn.addEventListener('click', function (e) { e.stopPropagation(); openLog(); });
        let autoOn = false, autoTimer = 0;
        function scheduleAuto() {
          clearTimeout(autoTimer);
          if (!autoOn || done || typing || inCard || logEl || confirmEl) return;
          autoTimer = setTimeout(function () { if (!ctx.signal.aborted && autoOn && !logEl && !confirmEl) advance(); }, 1400 + Math.min(2600, full.length * 40));
        }
        autoBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          autoOn = !autoOn;
          autoBtn.classList.toggle('is-on', autoOn);
          if (autoOn && !typing) scheduleAuto(); else clearTimeout(autoTimer);
        });
        const prog = U.el('div', 'st-progress g-mono');

        const title = U.el('div', 'st-title');
        title.innerHTML =
          '<div class="st-title-eyebrow">' + U.esc(ch.title) + '</div>' +
          '<div class="st-title-name">' + U.esc(st.name) + '</div>' +
          (st.subtitle ? '<div class="st-title-sub">' + U.esc(st.subtitle) + '</div>' : '') +
          '<div class="st-title-rule"></div>';

        const card = U.el('div', 'st-card');   // 장면 전환 카드

        s.append(scene, sceneLabel, box, tools, prog, card, title);
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
          if (skipToSelect) { ctx.go('#/chapter/' + st.chapter); return; }   // SKIP → 바로 스테이지 선택 화면
          const ov = U.el('div', 'st-clear');
          G.sfx.play('clear');
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
          if (Array.isArray(fx)) { fx.forEach(applyFx); return; }
          /* 연출 효과음 */
          const SND = { flicker: 'st_eerie', figure: 'st_eerie', approach: 'st_step', shake: 'st_shake', run: 'st_run', dark: null, palm: 'st_palm', glint: 'st_glint', spark: 'st_spark', black: 'st_black', flash: 'st_flash', rustle: 'st_rustle' };
          if (SND[fx]) G.sfx.play(SND[fx]);
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
          else if (fx === 'spark') { spark.classList.remove('is-on'); void spark.offsetWidth; spark.classList.add('is-on'); }
          else if (fx === 'black') { blackFx.classList.remove('is-on'); void blackFx.offsetWidth; blackFx.classList.add('is-on'); }
          else if (fx === 'flash') { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); }
          else if (fx === 'rustle') { rustle.classList.remove('is-on'); void rustle.offsetWidth; rustle.classList.add('is-on'); }
        }

        /* 장면 전환: 검은 화면에 SCENE 번호 · 제목 · 장소 */
        function showScene(line) {
          inCard = true;
          card.innerHTML = '<div class="st-card-no">' + U.esc(line.scene) + '</div>' +
            '<div class="st-card-title">' + U.esc(line.title || '') + '</div>' +
            (line.place ? '<div class="st-card-place">' + U.esc(line.place) + '</div>' : '');
          card.classList.add('is-on');
          G.sfx.play('st_scene');
          box.classList.remove('is-on');
          cast = []; castEl.innerHTML = ''; lastSpeaker = null; lastOther = null;   // 장면이 바뀌면 등장인물 초기화
          blackFx.classList.remove('is-on');
          palm.classList.remove('is-on');
          return new Promise(function (resolve) {
            cardResolve = resolve;
            U.wait(SCENE_MS, ctx.signal).then(resolve, function () {});
          }).then(function () {
            if (!inCard) return;
            inCard = false; cardResolve = null;
            /* 장면 배경 그림 (훈련장 · 숲 · 복도) */
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
            name.innerHTML = U.esc(line.speaker) + (pc && pc.name === line.speaker ? '<small>' + U.esc(pc.nameEn) + '</small>' : '');
          } else if (line.narrator) {
            name.classList.remove('is-empty');
            name.innerHTML = '<span class="st-narr-tag">NARRATION</span>';
            text.classList.add('is-narrator');
          } else {
            name.classList.add('is-empty');
            name.textContent = '';
            text.classList.add('is-narration');
          }
          /* enter / exit: 말하지 않아도 장면에 등장 · 퇴장하는 인물 */
          if (line.enter && G.DATA.characters[line.enter] && cast.indexOf(line.enter) === -1) cast.push(line.enter);
          if (line.exit) cast = cast.filter(function (x) { return x !== line.exit; });
          const cid = charOfLine(line);
          if (cid && cast.indexOf(cid) === -1) cast.push(cid);
          logLine(line);
          renderCast(line.speaker ? cid : null);   // 나레이션 · 지문: 인물 숨김
          if (line.speaker) react(cid, line);
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
          scheduleAuto();
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
          if (tools.contains(e.target)) return;
          advance();
        });
        /* SKIP: 확인 창 → 예: 스토리를 넘김 / 아니오: 계속 보기 */
        let confirmEl = null;
        function askSkip() {
          if (done || confirmEl) return;
          confirmEl = U.el('div', 'st-confirm');
          const bx = U.el('div', 'st-confirm-box g-panel', { html: '<div class="st-confirm-title">스토리를 스킵하시겠습니까?</div>' +
            '<div class="st-confirm-sub">' + (storyOnly ? '이 스토리는 본 것으로 처리되고 스테이지 선택 화면으로 돌아갑니다.' : '스토리를 건너뛰고 전투 준비(편성) 화면으로 이동합니다.') + '</div>' });
          const yes = U.el('button', 'g-btn g-btn-primary', { type: 'button', text: '예' });
          const no = U.el('button', 'g-btn', { type: 'button', text: '아니오' });
          const row = U.el('div', 'st-confirm-actions');
          row.append(no, yes);
          bx.appendChild(row);
          confirmEl.appendChild(bx);
          confirmEl.addEventListener('click', function (e) { e.stopPropagation(); });
          no.addEventListener('click', function (e) { e.stopPropagation(); confirmEl.remove(); confirmEl = null; });
          yes.addEventListener('click', function (e) {
            e.stopPropagation();
            if (storyOnly) { skipToSelect = true; }
            finish();
          });
          s.appendChild(confirmEl);
        }
        let skipToSelect = false;
        skip.addEventListener('click', function (e) { e.stopPropagation(); askSkip(); });
        onKey = function (e) {
          if (confirmEl) { if (e.key === 'Escape') { confirmEl.remove(); confirmEl = null; } return; }
          if (logEl) { if (e.key === 'Escape') closeLog(); return; }
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
          else if (e.key === 'Escape') askSkip();
        };
        document.addEventListener('keydown', onKey);

        /* 검은 화면 + 스테이지 이름 3초 → 사라지며 첫 대사(또는 첫 장면) */
        /* 스테이지 이름 화면: 효과음 없음 (입장 효과음 제거) */
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
