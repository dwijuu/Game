/**
 * 배경 음악 (assets/bgm/afternoon_letters.mp3 — 잔잔한 로파이 피아노, 직접 작곡 · 합성)
 * ─────────────────────────────────────────────────────────────
 *  · 챕터 선택(책장) · 스테이지 선택 화면에서만 재생 (스토리 · 편성 · 전투에서는 멈췄다가, 돌아오면 이어서 재생)
 *  · 브라우저 자동 재생 제한 때문에 화면을 처음 누를 때 시작
 *  · mp3 반복 재생 때 생기는 틈을 없애려고 Audio 2개를 번갈아 쓰며 끝부분을 살짝 겹침
 *  · 켜기/끄기 · 음량은 설정 창에서 (localStorage 'AGENT_GAME_BGM' / 'AGENT_GAME_BGM_VOL')
 */
window.G = window.G || {};

G.bgm = (function () {
  const SRC = 'assets/bgm/afternoon_letters.mp3';
  const OVERLAP = 1.2;   // 다음 반복을 미리 시작하는 시간 (초)
  let enabled = true, volume = 0.5, started = false, cur = 0, timer = 0, want = false;
  const ROUTES = ['select', 'map'];   // 배경 음악이 나오는 화면 (router 의 화면 이름)
  try { enabled = localStorage.getItem('AGENT_GAME_BGM') !== 'off'; } catch (e) {}
  try { const v = parseFloat(localStorage.getItem('AGENT_GAME_BGM_VOL')); if (v >= 0 && v <= 1) volume = v; } catch (e) {}
  const tracks = [new Audio(SRC), new Audio(SRC)];
  tracks.forEach(function (a) { a.preload = 'auto'; });

  function level() { return Math.max(0, Math.min(1, volume * 0.6)); }
  function fade(a, to, ms) {
    const from = a.volume, t0 = performance.now(), id = (a._fadeId || 0) + 1;
    a._fadeId = id; a._fading = to === 0;
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1 && a._fadeId === id) requestAnimationFrame(step);
      else if (a._fadeId === id) { a._fading = false; if (to === 0) a.pause(); }
    })();
  }
  function tick() {
    const a = tracks[cur];
    if (!enabled || a.paused || !a.duration) return;
    if (a.currentTime >= a.duration - OVERLAP) {
      const b = tracks[1 - cur];
      b.currentTime = 0; b.volume = 0;
      const p = b.play(); if (p && p.catch) p.catch(function () {});
      fade(b, level(), OVERLAP * 1000);
      fade(a, 0, OVERLAP * 1000);
      cur = 1 - cur;
    }
  }
  function play() {
    if (!enabled || !want || !started) return;
    const a = tracks[cur];
    if (!a.paused && !a._fading) return;
    a.volume = 0;
    const p = a.play(); if (p && p.catch) p.catch(function () {});
    fade(a, level(), 1500);
    if (!timer) timer = setInterval(tick, 200);
  }
  function stop() { tracks.forEach(function (a) { if (!a.paused) fade(a, 0, 500); }); }
  function start() {
    if (started) return;
    started = true;
    play();
  }
  function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem('AGENT_GAME_BGM', enabled ? 'on' : 'off'); } catch (e) {}
    if (enabled) { started = true; play(); } else stop();
  }
  /* 화면이 바뀔 때 router 가 호출: 선택 화면이면 재생, 아니면 천천히 멈춤 */
  function setRoute(name) {
    want = ROUTES.indexOf(name) !== -1;
    if (want) play(); else stop();
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('AGENT_GAME_BGM_VOL', String(volume)); } catch (e) {}
    tracks.forEach(function (a) { if (!a.paused) a.volume = level(); });
  }
  function bind() {
    const go = function () { start(); document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true); };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }
  return { isPlaying: function () { return tracks.some(function (a) { return !a.paused; }); }, bind: bind, setRoute: setRoute, setEnabled: setEnabled, setVolume: setVolume, isEnabled: function () { return enabled; }, getVolume: function () { return volume; } };
})();
