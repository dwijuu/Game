/* 공통 유틸 — DOM 생성, 취소 가능한 대기, 난수 */
window.G = window.G || {};

G.util = (function () {
  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) {
      for (const k in attrs) {
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'style') n.style.cssText = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  function svgIcon(id, cls) {
    return '<svg class="' + (cls || 'g-ico') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  /* AbortSignal 로 취소 가능한 대기. 화면 전환 시 진행 중인 연출을 모두 끊기 위해 사용 */
  function wait(ms, signal) {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) { reject(abortErr()); return; }
      const t = setTimeout(function () {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, Math.max(0, ms));
      function onAbort() { clearTimeout(t); reject(abortErr()); }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }
  function abortErr() { const e = new Error('aborted'); e.name = 'AbortError'; return e; }
  function isAbort(e) { return e && e.name === 'AbortError'; }

  /* 재현 가능한 난수 (mulberry32) */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 1920x920 캔버스를 창에 맞춰 균일 스케일 (기존 사이트 fitAllCanvases 와 동일한 방식) */
  const BASE_W = 1920, BASE_H = 920;
  let scale = 1, rafId = 0;
  function fitCanvas() {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    scale = Math.min(w / BASE_W, h / BASE_H);
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    /* 작은 화면(휴대폰 · 작은 태블릿): 캔버스가 많이 줄어들어 글씨 · 버튼이 작아지므로
     * html.g-mobile + --m(확대 배율)로 css/mobile.css 의 확대 규칙을 켬 */
    const root = document.documentElement;
    const mobile = scale < 0.62;
    root.classList.toggle('g-mobile', mobile);
    root.style.setProperty('--m', mobile ? Math.min(1.4, Math.max(1.15, 0.58 / scale)).toFixed(3) : '1');
  }
  function bindFit() {
    fitCanvas();
    window.addEventListener('resize', function () {
      if (rafId) return;
      rafId = requestAnimationFrame(function () { rafId = 0; fitCanvas(); });
    });
  }

  return { el, svgIcon, wait, isAbort, rng, clamp, esc, bindFit, getScale: function () { return scale; } };
})();
