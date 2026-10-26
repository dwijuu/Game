/**
 * 해시 라우터
 * ─────────────────────────────────────────────────────────────
 *  #/                         챕터 선택 (비디오 테이프)
 *  #/chapter/ch1              챕터 스테이지 맵
 *  #/stage/ch1-s1/story       스토리
 *  #/stage/ch1-s1/formation   편성
 *  #/stage/ch1-s1/battle      전투
 *
 * · 화면은 { mount(root, params, ctx), unmount() } 형태. 전환 시 이전 화면을 반드시 unmount →
 *   리스너·타이머·진행 중 연출(AbortSignal)이 모두 정리되어 이전 상태가 남지 않습니다.
 * · 직접 URL 접근 / 새로고침 / 잠긴 스테이지 접근은 guard 에서 올바른 화면으로 돌려보냅니다.
 * · 전투는 편성 화면에서 '전투 시작'을 눌러 만든 세션이 있어야 진입 가능
 *   (전투 중 새로고침 → 편성 화면으로 복귀)
 */
window.G = window.G || {};

G.router = (function () {
  const screens = {};
  let current = null;       // { name, inst, controller }
  let root = null;
  let navToken = 0;

  /* 편성 → 전투로 넘기는 1회성 세션 (메모리) */
  let battleSession = null;

  function register(name, factory) { screens[name] = factory; }

  function parse(hash) {
    const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'chapter' && parts[1]) return { name: 'map', chapterId: parts[1] };
    if (parts[0] === 'stage' && parts[1]) return { name: parts[2] || 'formation', stageId: parts[1] };
    return { name: 'select' };
  }

  /* 잘못된 진행 상태를 올바른 경로로 교정 */
  function guard(r) {
    if (r.name === 'select' && location.hash && location.hash !== '#/' && location.hash !== '#') return '#/';
    if (r.name === 'map') {
      if (!G.save.isChapterUnlocked(r.chapterId)) return '#/';
    }
    if (r.stageId !== undefined) {
      const st = G.DATA.stages[r.stageId];
      if (!st) return '#/';
      if (!G.save.isStageUnlocked(r.stageId)) return G.save.isChapterUnlocked(st.chapter) ? '#/chapter/' + st.chapter : '#/';
      if (st.storyOnly && r.name !== 'story') return '#/stage/' + r.stageId + '/story';
      if (r.name === 'after') return (st.afterStory && G.save.isCleared(r.stageId)) ? null : '#/chapter/' + st.chapter;
      if (['story', 'formation', 'battle'].indexOf(r.name) === -1) return '#/stage/' + r.stageId + '/formation';
      if (r.name === 'story' && !st.story) return '#/stage/' + r.stageId + '/formation';
      if (r.name === 'battle' && (!battleSession || battleSession.stageId !== r.stageId)) {
        return '#/stage/' + r.stageId + '/formation';
      }
    }
    return null;
  }

  function go(hash, opts) {
    if (opts && opts.replace) {
      history.replaceState(null, '', hash);
      render();
    } else if (location.hash === hash) {
      render();
    } else {
      location.hash = hash;   // hashchange → render
    }
  }

  function render() {
    const r = parse(location.hash);
    const redirect = guard(r);
    if (redirect) { history.replaceState(null, '', redirect); return render(); }

    const token = ++navToken;
    G.tip.hide();
    if (current) {
      try { current.controller.abort(); } catch (e) {}
      try { current.inst.unmount && current.inst.unmount(); } catch (e) { console.error(e); }
      current = null;
    }
    root.innerHTML = '';
    document.getElementById('fx-root').innerHTML = '';

    const factory = screens[r.name === 'after' ? 'story' : r.name];
    const controller = new AbortController();
    const ctx = {
      signal: controller.signal,
      go: go,
      setBattleSession: function (s) { battleSession = s; },
      takeBattleSession: function () { return battleSession; },
      clearBattleSession: function () { battleSession = null; }
    };
    /* 화면 파일이 없거나(업로드 누락 · 경로 오류) 불러오지 못한 경우: 어떤 파일인지 알려 줌 */
    const FILES = { select: 'js/screens/chapter-select.js', chapter: 'js/screens/chapter-map.js', story: 'js/screens/story.js', formation: 'js/screens/formation.js', battle: 'js/screens/battle-ui.js' };
    if (typeof factory !== 'function') { fail(new Error('화면 파일을 불러오지 못했습니다: ' + (FILES[r.name] || r.name) + ' (파일이 없거나 위치가 다릅니다)')); return; }
    try {
      const inst = factory();
      current = { name: r.name, inst: inst, controller: controller };
      const p = inst.mount(root, r, ctx);
      if (p && p.catch) p.catch(function (e) { if (!G.util.isAbort(e) && token === navToken) fail(e); });
    } catch (e) {
      fail(e);
    }
  }

  /* 오류 시 무한 로딩 대신 복귀 가능한 안내 화면 */
  function fail(err) {
    console.error(err);
    root.innerHTML = '';
    const box = G.util.el('div', 'g-error');
    box.innerHTML = '<div class="g-error-code">ERROR // SCREEN</div>' +
      '<div class="g-error-msg">화면을 불러오는 중 문제가 발생했습니다.</div>' +
      '<div class="g-error-detail"></div>';
    /* 원인 확인용: 오류 내용 (휴대폰 등 개발자 도구를 열기 어려운 환경에서도 볼 수 있게) */
    box.querySelector('.g-error-detail').textContent = String((err && (err.message || err)) || '') + (err && err.stack ? '\n' + String(err.stack).split('\n').slice(1, 3).join('\n') : '');
    const row = G.util.el('div', 'g-error-actions');
    const reload = G.util.el('button', 'g-btn', { type: 'button', text: '새로고침' });
    reload.addEventListener('click', function () { location.reload(); });
    const btn = G.util.el('button', 'g-btn g-btn-primary', { type: 'button', text: '챕터 선택으로' });
    btn.addEventListener('click', function () { go('#/'); });
    row.append(reload, btn);
    box.appendChild(row);
    root.appendChild(box);
  }

  function start(rootEl) {
    root = rootEl;
    window.addEventListener('hashchange', render);
    render();
  }

  return { register, start, go };
})();
