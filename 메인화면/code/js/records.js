/**
 * 축음기 (레코드) 화면 — #records
 * ─────────────────────────────────────────────────────────────
 *  · 왼쪽: 배경 음악 목록 (MAIN.TRACKS, code/js/data.js)
 *  · 가운데: 레코드판 (가운데 라벨 = 앨범 로고) · 톤암
 *      목록에서 다른 곡을 고르면 오른쪽 앨범 · 설명만 바뀌고, 지금 곡은 계속 재생됨
 *      [재생] → (다른 곡이 돌고 있으면 톤암이 올라가고 판 라벨이 바뀐 뒤) 톤암이 내려와 닿으면 판이 돌며 재생
 *      [멈춤] → 톤암이 제자리로 돌아가고 판이 멈춤
 *  · 오른쪽: 앨범 그림 · 곡 정보 · 설명 · 재생 위치
 *  · 재생한 곡이 메인화면 배경 음악이 됨 (G.bgm.setTrack → 저장 · 게임에 다녀와도 유지)
 *  MAIN.records = { init, open, close }
 */
window.MAIN = window.MAIN || {};

MAIN.records = (function () {
  const U = G.util;
  const $ = function (id) { return document.getElementById(id); };
  const ARM_MS = 900;          // 톤암이 내려오는 시간 (CSS 와 같게)
  let sel = null;              // 목록에서 고른 곡
  let busy = false, target = null;   // 톤암이 움직이는 중 · 올릴 곡
  let raf = 0, armTimer = 0, opened = false;

  function track(id) { return MAIN.TRACKS.find(function (t) { return t.id === id; }) || MAIN.TRACKS[0]; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  /* 지금 이 곡이 실제로 돌고 있는지 */
  /* 이 곡이 지금 판에 올라가 재생 중인지 (톤암이 내려가 있고, 판의 곡이 이 곡) */
  function isLive(t) { return !busy && G.bgm.getTrack() === t.id && $('rc-arm').classList.contains('is-down'); }

  function renderList() {
    const ol = $('rc-tracks');
    ol.innerHTML = '';
    MAIN.TRACKS.forEach(function (t, i) {
      const now = G.bgm.getTrack() === t.id;
      const li = U.el('li');
      const b = U.el('button', 'rc-track' + (t.id === sel ? ' is-on' : ''), { type: 'button', 'data-sfx': 'page' });
      b.innerHTML =
        '<span class="rc-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<img src="' + t.cover + '" alt="">' +
        '<span class="rc-name"><b>' + U.esc(t.title) + '</b><small>' + U.esc(t.ko) + (now ? '<em>NOW</em>' : '') + '</small></span>' +
        '<span class="rc-time">' + t.time + '</span>';
      b.addEventListener('click', function () { pick(t.id); });
      li.appendChild(b);
      ol.appendChild(li);
    });
  }

  function renderInfo() {
    const t = track(sel);
    $('rc-cover').src = t.cover;
    $('rc-title').textContent = t.title;
    $('rc-ko').textContent = t.ko;
    $('rc-desc').textContent = t.desc;
    $('rc-dur').textContent = t.time;
  }
  /* 판 라벨 = 지금 판에 올라가 있는 곡 (목록에서 고르기만 해서는 바뀌지 않음) */
  function renderLabel() { $('rc-label-title').textContent = track(G.bgm.getTrack()).title; }

  /* 톤암 · 판: 지금 판이 재생 중인지에 맞춤 (now = 애니메이션 없이 바로) */
  function setArm(down, now) {
    const arm = $('rc-arm');
    if (now) arm.classList.add('is-now');
    arm.classList.toggle('is-down', down);
    if (now) { void arm.offsetWidth; requestAnimationFrame(function () { arm.classList.remove('is-now'); }); }
  }
  function spin(on) { $('rc-disc').classList.toggle('is-spinning', on); }
  /* 오른쪽 버튼 · '재생 중': 고른 곡 기준 */
  function renderButton() {
    const live = isLive(track(sel)) || (busy && target === sel);
    $('rc-play').textContent = live ? '멈춤' : '재생';
    $('rc-play').classList.toggle('is-stop', live);
    $('rc-state').hidden = !(isLive(track(sel)));
  }

  /* 목록에서 고르기: 오른쪽 앨범 · 설명만 바뀜 (판 · 재생 중인 곡은 그대로) */
  function pick(id) {
    if (id === sel) return;
    sel = id;
    renderList(); renderInfo(); renderButton();
  }

  function lower(t) {
    /* 바늘 내리기 → 닿으면 판이 돌며 재생 */
    if (!G.bgm.isEnabled()) G.bgm.setEnabled(true);    // 설정에서 꺼 두었으면 켜서 재생
    G.sfx.play('tonearm_down');                         // 톤암이 내려가는 소리 · 바늘이 닿는 '툭' (0.9초)
    setArm(true, false);
    armTimer = setTimeout(function () {
      if (!opened) return;
      G.bgm.setTrack(t.id);
      G.bgm.setPaused(false);
      spin(true);
      busy = false; target = null;
      renderList(); renderButton();
    }, ARM_MS);
  }

  function toggle() {
    if (busy) return;
    const t = track(sel);
    clearTimeout(armTimer);
    if (isLive(t)) {
      /* 멈춤: 소리가 멈추고 → 판이 멈추고 → 톤암이 제자리로 */
      G.sfx.play('tonearm_up');
      G.bgm.setPaused(true);
      spin(false);
      setArm(false, false);
      renderList(); renderButton();
      return;
    }
    busy = true; target = t.id;
    renderButton();
    if ($('rc-arm').classList.contains('is-down')) {
      /* 다른 곡이 돌고 있으면: 톤암을 올리고(지금 곡 멈춤) → 판 라벨을 이 곡으로 바꾸고 → 다시 내림 */
      G.sfx.play('tonearm_up');
      G.bgm.setPaused(true);
      spin(false);
      setArm(false, false);
      armTimer = setTimeout(function () {
        if (!opened) return;
        $('rc-label-title').textContent = t.title;
        armTimer = setTimeout(function () { if (opened) lower(t); }, 250);
      }, ARM_MS);
    } else {
      $('rc-label-title').textContent = t.title;
      lower(t);
    }
  }

  /* 재생 위치 */
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = track(sel), a = G.bgm.audio();
    const on = G.bgm.getTrack() === t.id && !busy && a && a.duration;
    $('rc-cur').textContent = on ? fmt(a.currentTime) : '0:00';
    $('rc-bar').style.width = on ? (a.currentTime / a.duration * 100) + '%' : '0%';
  }

  function open() {
    opened = true;
    busy = false; target = null;
    sel = G.bgm.getTrack();
    syncVol();
    renderList(); renderInfo(); renderLabel();
    const playing = !G.bgm.isPaused() && G.bgm.isEnabled();
    setArm(playing, true); spin(playing);
    renderButton();
    cancelAnimationFrame(raf); loop();
  }
  /* 화면을 나갈 때: 멈춰 두었으면 메인 화면 배경 음악은 다시 나오게 (고른 곡 그대로) */
  function close() {
    opened = false;
    clearTimeout(armTimer);
    cancelAnimationFrame(raf);
    if (G.bgm.isPaused()) G.bgm.setPaused(false);
  }

  /* 배경 음악 음량 — 설정 창의 음량 바와 같은 값 (여기서 바로 조절) */
  function syncVol() {
    const r = document.querySelector('#rc-vol input'), o = document.querySelector('#rc-vol output');
    r.value = Math.round(G.bgm.getVolume() * 100); o.textContent = r.value; r.style.setProperty('--p', r.value + '%');
  }
  function init(opts) {
    const vr = document.querySelector('#rc-vol input');
    vr.addEventListener('input', function () {
      G.bgm.setVolume(vr.value / 100);
      document.querySelector('#rc-vol output').textContent = vr.value;
      vr.style.setProperty('--p', vr.value + '%');
    });
    $('rc-play').addEventListener('click', toggle);
    $('rc-back').addEventListener('click', function () { opts.back(); });
    $('rc-set').addEventListener('click', function (e) { e.stopPropagation(); G.settings.open(opts.stage); });
    /* 저장된 곡이 목록에 없으면 첫 곡으로 */
    if (!MAIN.TRACKS.some(function (t) { return t.id === G.bgm.getTrack(); })) G.bgm.setTrack(MAIN.TRACKS[0].id);
  }

  return { init: init, open: open, close: close };
})();
