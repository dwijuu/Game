/**
 * 메인화면 사운드 — 게임과 같은 배경 음악 · 효과음
 * ─────────────────────────────────────────────────────────────
 * 게임의 js/core/sfx.js · bgm.js 를 그대로 옮기고, 소리 파일 경로만 메인화면 기준으로 바꿨습니다.
 *  (게임 파일은 'assets/...' 를 페이지 기준으로 불러오므로 메인화면에서 직접 쓸 수 없음)
 *  · 소리 파일은 게임 폴더의 것을 함께 씁니다 → ../게임/game-site/assets/
 *  · 켜기/끄기 · 음량은 게임과 같은 저장 키(AGENT_GAME_BGM 등)를 써서 설정이 공유됩니다.
 *  · 메인화면에서는 모든 화면에서 배경 음악이 나오고, 캐릭터 음악(유튜브)을 재생하는 동안만 잠시 멈춥니다.
 */
window.G = window.G || {};
G.AUDIO_BASE = '../게임/game-site/assets/';


G.sfx = (function () {
  const BASE = G.AUDIO_BASE + 'sfx/';
  const MASTER = 0.55;
  /* 소리별 기본 볼륨 (자주 나는 소리는 작게) */
  const VOL = {
    ui_click: 0.45, ui_back: 0.45, page: 0.6, card_pick: 0.75, card_cancel: 0.6, card_hover: 0.35, target: 0.45,
    hit: 0.5, hit_heavy: 0.7, heal: 0.5, st_pop: 0.45,
    st_scene: 0.55, st_rustle: 0.7, st_step: 0.6, st_run: 0.6
  };
  const SKILLS = ['pyro_shell', 'earth_guard', 'overheat', 'meteor', 'water_bolt', 'mana_trace', 'clear_stream', 'undertow',
    'thorn_vine', 'vine_leap', 'root_ward', 'forest', 'wind_kick', 'knuckle_inferno', 'oxygen_ignition', 'ignition_cyclone', 'afterburn_chase',
    'volt_shot', 'overcharge', 'hyper_charge', 'thunder_buster', 'chain_lightning', 'voltage_plug', 'hv_setup', 'thunder_cloud', 'corusco_finale',
    'gravity_shot', 'absolute_field', 'gravity_burst', 'grand_pressure', 'neural_link', 'cell_wall', 'life_cycle', 'world_tree',
    'hymn16', 'subtle_lie', 'page666', 'poet_reading', 'shadow_strike',
    'mb_drip_shot', 'mb_clone', 'mb_blessing', 'mb_tidal_dragon', 'light_share'];
  const ELEM = { fire: 'sk_pyro_shell', water: 'sk_water_bolt', nature: 'sk_thorn_vine', wind: 'sk_wind_kick', earth: 'sk_gravity_shot', lightning: 'sk_volt_shot', gold: 'sk_light_share', black: 'sk_shadow_strike' };

  const pools = {}, lastAt = {};
  let enabled = true, volume = 0.8;   // volume: 설정 창의 음량 바 (0 ~ 1)
  try { enabled = localStorage.getItem('AGENT_GAME_SFX') !== 'off'; } catch (e) {}
  try { const v = parseFloat(localStorage.getItem('AGENT_GAME_SFX_VOL')); if (v >= 0 && v <= 1) volume = v; } catch (e) {}

  function get(name) {
    let p = pools[name];
    if (!p) { p = pools[name] = []; }
    for (let i = 0; i < p.length; i++) if (p[i].paused || p[i].ended) return p[i];
    if (p.length >= 4) return p[0];
    const a = new Audio(BASE + name + '.mp3');
    a.preload = 'auto';
    p.push(a);
    return a;
  }
  function play(name, vol) {
    if (!enabled || !name || name === 'none' || volume <= 0) return;
    const now = performance.now();
    if (lastAt[name] && now - lastAt[name] < (name === 'card_hover' ? 90 : 45)) return;
    lastAt[name] = now;
    try {
      const a = get(name);
      a.volume = Math.max(0, Math.min(1, MASTER * volume / 0.8 * (VOL[name] || 0.8) * (vol == null ? 1 : vol)));
      a.currentTime = 0;
      const pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
  }
  function skill(sk) {
    if (!sk) return;
    if (sk.anim && SKILLS.indexOf(sk.anim) !== -1) return play('sk_' + sk.anim);
    if (sk.type === 'heal') return play('heal', 1.4);
    play(ELEM[sk.element] || 'sk_shadow_strike');
  }
  /* 처음 화면을 누를 때 자주 쓰는 소리를 미리 불러 둠 */
  function preload() {
    ['ui_click', 'ui_back', 'ui_confirm', 'page', 'card_pick', 'card_cancel', 'hit', 'turn_start'].forEach(function (n) { get(n).load(); });
  }
  function setEnabled(v) { enabled = !!v; try { localStorage.setItem('AGENT_GAME_SFX', enabled ? 'on' : 'off'); } catch (e) {} }

  /* 버튼 효과음 (문서 전체에서 한 번) */
  function bindClicks() {
    document.addEventListener('click', function (e) {
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      /* 덱 선택 · 캐릭터 선택 · 덱 추천 창 안: 소리 없음 */
      if (t.closest('.cl-overlay, .dk-overlay, .cs-rec, .fm2-slot, .g-settings-box')) return;
      const b = t.closest('[data-sfx], button, .cm-node');
      if (!b || b.disabled) return;
      if (b.dataset && b.dataset.sfx) { play(b.dataset.sfx); return; }
      if (b.classList.contains('cm-node')) return play('page');
      if (b.classList.contains('bt-card') || b.closest('.bt-hand, .bt-slots, .bt-bench, .bt-sprite, .bt-shuffle-btn, .bt-swap-item')) return;   // 전투 쪽은 battle-ui 에서
      if (b.classList.contains('g-back') && !b.classList.contains('cs-rec-btn') && !b.classList.contains('cs-io-btn')) return play('ui_back');
      if (b.classList.contains('cm-popup-close') || b.classList.contains('dk-close')) return play('ui_back');
      if (b.classList.contains('g-btn-primary')) return play('ui_confirm');
      play('ui_click');
    }, true);
    document.addEventListener('pointerdown', function once() { preload(); document.removeEventListener('pointerdown', once); });
  }

  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); try { localStorage.setItem('AGENT_GAME_SFX_VOL', String(volume)); } catch (e) {} }
  return { getVolume: function () { return volume; }, setVolume: setVolume, play: play, skill: skill, bindClicks: bindClicks, setEnabled: setEnabled, isEnabled: function () { return enabled; } };
})();


G.bgm = (function () {
  /* 메인화면 배경 음악은 축음기 화면(레코드)에서 고를 수 있음 — 고른 곡은 AGENT_MAIN_BGM 에 저장
   * (사이트를 옮길 때 sync.js 가 함께 넘겨 주므로 게임에 다녀와도 유지) */
  const KEY = 'AGENT_MAIN_BGM';
  const DEFAULT = 'afternoon_letters';
  let trackId = DEFAULT;
  try { const t = localStorage.getItem(KEY); if (t && /^[a-z0-9_]+$/.test(t)) trackId = t; } catch (e) {}
  if (window.MAIN && MAIN.TRACKS && !MAIN.TRACKS.some(function (t) { return t.id === trackId; })) trackId = DEFAULT;
  function srcOf(id) { return G.AUDIO_BASE + 'bgm/' + id + '.mp3'; }
  const SRC = srcOf(trackId);
  let paused = false;   // 축음기 화면에서 바늘을 들어 올려 멈춘 상태
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
    if (!enabled || !want || !started || paused) return;
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
  /* 곡 바꾸기: 지금 곡을 천천히 줄이고 새 곡으로 (저장됨) */
  function setTrack(id) {
    if (!id) return;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    if (id === trackId) return;
    trackId = id;
    tracks.forEach(function (a) { a._fadeId = (a._fadeId || 0) + 1; a.pause(); a.src = srcOf(id); a.load(); });
    cur = 0;
    play();
  }
  /* 축음기 바늘: 들어 올리면 멈춤, 내리면 재생 (started 전이면 첫 조작으로 시작) */
  function setPaused(v) {
    paused = !!v;
    if (paused) stop();
    else { started = true; play(); }
  }
  return {
    isPlaying: function () { return tracks.some(function (a) { return !a.paused && !a._fading; }); },
    bind: bind, setRoute: setRoute, setEnabled: setEnabled, setVolume: setVolume,
    isEnabled: function () { return enabled; }, getVolume: function () { return volume; },
    setTrack: setTrack, getTrack: function () { return trackId; }, setPaused: setPaused, isPaused: function () { return paused; },
    audio: function () { return tracks[cur]; }
  };
})();
