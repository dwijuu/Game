/**
 * 로딩 화면 (타이틀 · 메인화면 · 게임 공용)
 * ─────────────────────────────────────────────────────────────
 *  · 사이트를 옮길 때(타이틀 → 메인화면, 메인화면 ↔ 게임)만 씁니다. 같은 사이트 안의 화면 이동은 바로 바뀌므로 띄우지 않습니다.
 *  · 배경: 배경/화이트.png · 오른쪽 아래에 불러오는 중 표시(돌아가는 선 + Loading)
 *  · 도착한 페이지는 그림 · 글꼴을 다 불러온 뒤 로딩 화면을 걷어 냄
 *  · 사이트를 옮기지 않고 처음 열었을 때는, 불러오기가 0.25초 넘게 걸릴 때만 로딩 화면이 보임
 *  · body 맨 앞에서 불러와야 합니다 (화면이 그려지기 전에 덮도록).
 *
 *  G.loading.go(주소)  → 로딩 화면을 띄우고 이동 (기록도 함께 실어 보냄: sync.js)
 */
window.G = window.G || {};

G.loading = (function () {
  const FLAG = 'AGENT_LOADING';
  const base = (document.currentScript && document.currentScript.src) || location.href;
  const WHITE = new URL('../../../배경/화이트.png', base).href;

  const css =
    '.g-loading{position:fixed;inset:0;z-index:100000;opacity:0;visibility:hidden;pointer-events:none;' +
      'background:#ecebe8 url("' + WHITE + '") center/cover no-repeat;transition:opacity .3s ease,visibility 0s linear .3s}' +
    '.g-loading.is-on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .2s ease}' +
    '.g-loading.is-now{transition:none}' +
    '.g-loading-mark{position:absolute;right:56px;bottom:36px;display:flex;align-items:center;gap:14px;' +
      'font:italic 500 21px "Cormorant Garamond",serif;letter-spacing:.06em;color:#5f5b54}' +
    '.g-loading-ring{width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(43,41,37,.16);border-top-color:#2b2925;animation:gLoadSpin .9s linear infinite}' +
    '@keyframes gLoadSpin{to{transform:rotate(360deg)}}';

  const style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  const el = document.createElement('div');
  el.className = 'g-loading';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="g-loading-mark"><i class="g-loading-ring"></i><span>Loading</span></div>';
  (document.body || document.documentElement).appendChild(el);

  function show(now) {
    if (now) { el.classList.add('is-now'); void el.offsetWidth; }
    el.classList.add('is-on');
    if (now) requestAnimationFrame(function () { el.classList.remove('is-now'); });
  }
  function hide() { el.classList.remove('is-on'); }

  /* 도착: 다른 사이트에서 넘어왔으면 바로 덮고, 처음 열었으면 0.25초 넘게 걸릴 때만 */
  let arrived = false;
  try { arrived = sessionStorage.getItem(FLAG) === '1'; sessionStorage.removeItem(FLAG); } catch (e) {}
  let slowTimer = 0;
  if (document.readyState !== 'complete') {
    if (arrived) show(true);
    else slowTimer = setTimeout(function () { show(false); }, 250);
  }
  function done() {
    clearTimeout(slowTimer);
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fonts.then(function () { requestAnimationFrame(hide); });
  }
  if (document.readyState === 'complete') done();
  else window.addEventListener('load', done, { once: true });
  /* 뒤로 가기로 돌아온 페이지(브라우저 저장본)에서는 로딩 화면을 걷어 냄 */
  window.addEventListener('pageshow', function (e) { if (e.persisted) { clearTimeout(slowTimer); hide(); } });

  function go(url) {
    const target = G.sync ? G.sync.url(url) : url;
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) {}
    show(false);
    setTimeout(function () { location.href = target; }, 220);   // 로딩 화면이 다 덮인 뒤 이동
  }

  return { go: go, show: show, hide: hide };
})();
