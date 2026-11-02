/**
 * 메인화면 ↔ 게임 ↔ 타이틀 기록 공유
 * ─────────────────────────────────────────────────────────────
 *  · 세 사이트는 같은 저장 이름(localStorage: AGENT_GAME_*)을 씁니다.
 *  · 같은 주소(start-dev.bat · localhost:5500)로 열면 저장소가 하나라 그대로 공유됩니다.
 *  · 파일을 더블클릭해 열면 브라우저에 따라 사이트마다 저장소가 따로일 수 있어서,
 *    사이트를 옮길 때 지금 기록을 주소(?sync=...)에 실어 보내고, 도착한 사이트가 그 기록을 받아 저장합니다.
 *  · 이 파일은 save.js 보다 먼저 불러와야 합니다 (도착하자마자 기록을 넣고 나서 읽도록).
 *
 *  G.sync.url(주소) → 지금 기록을 실은 주소
 */
window.G = window.G || {};

G.sync = (function () {
  const KEYS = ['AGENT_GAME_SAVE', 'AGENT_GAME_BGM', 'AGENT_GAME_BGM_VOL', 'AGENT_GAME_SFX', 'AGENT_GAME_SFX_VOL', 'AGENT_MAIN_BGM'];   // 마지막: 메인화면 축음기에서 고른 곡

  function enc(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function dec(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(escape(atob(str)));
  }

  function snapshot() {
    const o = {};
    try { KEYS.forEach(function (k) { const v = localStorage.getItem(k); if (v !== null) o[k] = v; }); } catch (e) {}
    return o;
  }

  /* 도착: 주소에 실려 온 기록을 저장하고 주소에서 지움 */
  (function receive() {
    try {
      const u = new URL(location.href);
      const s = u.searchParams.get('sync');
      if (!s) return;
      const o = JSON.parse(dec(s));
      KEYS.forEach(function (k) { if (typeof o[k] === 'string') localStorage.setItem(k, o[k]); });
      u.searchParams.delete('sync');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* 잘못된 값이면 무시하고 지금 저장을 그대로 씀 */ }
  })();

  /* 출발: 다른 사이트로 가는 주소에 지금 기록을 실음 (같은 PC 주소로 갈 때만) */
  function url(target) {
    try {
      const u = new URL(target, location.href);
      if (u.origin !== location.origin && !(u.protocol === 'file:' && location.protocol === 'file:')) return u.href;
      u.searchParams.set('sync', enc(JSON.stringify(snapshot())));
      return u.href;
    } catch (e) { return target; }
  }

  /* 두 사이트를 탭 두 개로 함께 열어 둔 경우: 다른 탭에서 기록이 바뀌면 이 탭도 다시 읽음 */
  window.addEventListener('storage', function (e) {
    if (e.key === 'AGENT_GAME_SAVE' && G.save) G.save.load();
  });

  return { url: url, KEYS: KEYS };
})();
