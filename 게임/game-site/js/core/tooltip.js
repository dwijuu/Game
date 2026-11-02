/**
 * 전역 툴팁 (기존 사이트 .js-global-tooltip 과 같은 스타일)
 * 요소에 el._tip = function () { return html; } 을 지정하면 호버 시 표시됩니다.
 * 리스너는 문서 전체에 1회만 등록 (요소마다 리스너를 만들지 않음)
 */
window.G = window.G || {};

G.tip = (function () {
  let box = null, current = null;
  const listeners = [];

  function find(t) {
    while (t && t !== document.body) {
      if (t._tip) return t;
      t = t.parentNode;
    }
    return null;
  }

  function show(target) {
    const html = target._tip();
    if (!html) { hide(); return; }
    current = target;
    /* 이전 위치(화면 오른쪽 끝 등)에서 폭이 줄어든 채로 측정되지 않도록 먼저 왼쪽 위로 옮긴 뒤 측정 */
    box.style.left = '0px';
    box.style.top = '0px';
    box.innerHTML = html;
    box.classList.add('visible');
    position(target);
    listeners.forEach(function (fn) { try { fn(target); } catch (e) {} });
  }

  function position(target) {
    const r = target.getBoundingClientRect();
    const bw = box.offsetWidth, bh = box.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = r.left + r.width / 2 - bw / 2;
    let y = r.top - bh - 10;
    if (y < 8) y = r.bottom + 10;
    /* 화면 안에 들어오도록 보정 (오른쪽 끝 요소는 왼쪽으로, 아래쪽 끝 요소는 위로) */
    x = Math.max(8, Math.min(vw - bw - 8, x));
    y = Math.max(8, Math.min(vh - bh - 8, y));
    box.style.left = x + 'px';
    box.style.top = y + 'px';
  }

  function hide() {
    current = null;
    if (box) box.classList.remove('visible');
  }

  /* 터치(모바일): 호버가 없으므로 누르면 표시, 다른 곳을 누르면 닫힘, 잠시 뒤 자동으로 닫힘
   *  터치 뒤에 브라우저가 흉내 내는 mouseover · mousedown 은 무시 (바로 닫혀 버리지 않도록) */
  let lastTouch = 0, autoHide = 0;
  function init() {
    box = document.getElementById('g-tooltip');
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      lastTouch = Date.now();
      clearTimeout(autoHide);
      const t = find(e.target);
      if (t) {
        show(t);
        autoHide = setTimeout(function () { if (current === t) hide(); }, 6000);
      } else hide();
    }, true);
    document.addEventListener('mouseover', function (e) {
      if (Date.now() - lastTouch < 900) return;
      const t = find(e.target);
      if (t === current) return;
      if (t) show(t); else hide();
    });
    document.addEventListener('mousedown', function () { if (Date.now() - lastTouch < 900) return; hide(); });
    window.addEventListener('blur', hide);
  }

  /* 툴팁이 표시될 때 알림 (튜토리얼에서 '호버해 보기' 단계 진행용) */
  function onShow(fn) { listeners.push(fn); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

  return { init, hide, onShow };
})();
