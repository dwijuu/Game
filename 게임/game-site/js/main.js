/**
 * 게임 사이트 진입점
 * ─────────────────────────────────────────────────────────────
 * 기존 사이트(로비)로 돌아가는 주소
 *  1) 기존 사이트가 넘겨준 ?return=<주소> (같은 PC의 http(s)/file 주소만 허용)
 *  2) 없으면 실행 방식에 맞는 기본값
 *     · ../../메인화면/index.html (파일 · localhost · 깃허브 페이지 모두 같은 상대 경로)
 */
window.G = window.G || {};

G.app = (function () {
  const LOBBY_FILE_PATH = '../../메인화면/index.html';

  /* 화면 간에 잠시 전달하는 값 (메모리 전용, 새로고침 시 초기화) */
  const session = { newlyUnlocked: null, newChapter: null };

  function isSafeReturn(url) {
    try {
      const u = new URL(url, location.href);
      if (u.protocol === 'file:') return location.protocol === 'file:';
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      return u.hostname === location.hostname || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch (e) { return false; }
  }

  function lobbyUrl() {
    const q = new URLSearchParams(location.search).get('return');
    if (q && isSafeReturn(q)) {
      try { sessionStorage.setItem('AGENT_GAME_RETURN', q); } catch (e) {}
      return q;
    }
    try {
      const saved = sessionStorage.getItem('AGENT_GAME_RETURN');
      if (saved && isSafeReturn(saved)) return saved;
    } catch (e) {}
    /* 파일 · localhost · 깃허브 페이지(https://아이디.github.io/저장소/) 어디서 열어도 되도록 상대 경로로 */
    return new URL(LOBBY_FILE_PATH, location.href).href;
  }

  function toLobby() { G.loading.go(lobbyUrl()); }   // 로딩 화면 + 기록 함께 보냄

  function boot() {
    G.save.load();
    G.util.bindFit();
    G.tip.init();
    G.sfx.bindClicks();
    G.bgm.bind();
    lobbyUrl();   // return 주소를 세션에 기억
    G.router.start(document.getElementById('screen-root'));
  }

  return { boot, toLobby, session };
})();

document.addEventListener('DOMContentLoaded', G.app.boot);
