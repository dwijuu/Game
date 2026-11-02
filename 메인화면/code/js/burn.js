/**
 * 사진이 타들어 가는 효과
 * ─────────────────────────────────────────────────────────────
 *  MAIN.burn(el, { x, y, duration }, done)
 *   · x, y : 불이 붙는 위치 (요소 안의 0 ~ 1 비율, 보통 누른 자리)
 *   · 불길 가장자리를 노이즈로 불규칙하게 만들고, 타는 앞쪽은 밝은 불씨 → 그을음 → 사라짐 순서
 *   · 마스크(타서 없어지는 부분)와 불씨는 작은 캔버스에 그린 뒤 크게 늘려 부드럽게 보이게 함
 */
window.MAIN = window.MAIN || {};

MAIN.burn = function (el, opts, done) {
  const o = opts || {};
  const W = el.offsetWidth, H = el.offsetHeight;
  const gw = 96, gh = Math.max(20, Math.round(gw * H / W));
  const dur = o.duration || 1150;

  /* 부드러운 값 노이즈 (2옥타브) */
  function grid(cw, ch) {
    const g = new Float32Array((cw + 1) * (ch + 1));
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    return function (u, v) {
      const x = u * cw, y = v * ch, x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const i = y0 * (cw + 1) + x0;
      const a = g[i], b = g[i + 1], c = g[i + cw + 1], d = g[i + cw + 2];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  const n1 = grid(6, Math.round(6 * H / W)), n2 = grid(16, Math.round(16 * H / W));
  const ox = o.x == null ? 0.5 : o.x, oy = o.y == null ? 0.75 : o.y;
  const aspect = H / W;

  /* 불이 닿는 순서 (0 = 가장 먼저) */
  const field = new Float32Array(gw * gh);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const u = (i + 0.5) / gw, v = (j + 0.5) / gh;
    const d = Math.hypot(u - ox, (v - oy) * aspect);
    const f = d + (n1(u, v) - 0.5) * 0.55 + (n2(u, v) - 0.5) * 0.18;
    field[j * gw + i] = f;
    if (f < mn) mn = f; if (f > mx) mx = f;
  }
  for (let k = 0; k < field.length; k++) field[k] = (field[k] - mn) / (mx - mn);

  const mask = document.createElement('canvas'); mask.width = gw; mask.height = gh;
  const mctx = mask.getContext('2d'), mimg = mctx.createImageData(gw, gh);
  const fx = document.createElement('canvas'); fx.width = gw; fx.height = gh; fx.className = 'ph-burn';
  const fctx = fx.getContext('2d'), fimg = fctx.createImageData(gw, gh);
  el.appendChild(fx);
  el.style.webkitMaskSize = el.style.maskSize = '100% 100%';
  el.style.webkitMaskRepeat = el.style.maskRepeat = 'no-repeat';

  const EMBER = 0.05, CHAR = 0.16;
  const t0 = performance.now();
  (function frame(now) {
    const k = Math.min(1, (now - t0) / dur);
    const p = -0.04 + Math.pow(k, 1.35) * 1.12;   // 처음엔 천천히, 점점 빠르게
    for (let q = 0; q < field.length; q++) {
      const f = field[q], t = f - p, a = q * 4;
      /* 마스크: 탄 곳은 투명 */
      mimg.data[a] = mimg.data[a + 1] = mimg.data[a + 2] = 0;
      mimg.data[a + 3] = t <= 0 ? 0 : 255;
      /* 불씨 · 그을음 */
      let r = 0, g = 0, b = 0, al = 0;
      if (t > 0 && t < EMBER) {
        const s = t / EMBER;   // 0: 가장 앞(밝음) → 1
        r = 255; g = Math.round(236 - s * 120); b = Math.round(160 - s * 140); al = 255;
      } else if (t >= EMBER && t < CHAR) {
        const s = (t - EMBER) / (CHAR - EMBER);
        r = Math.round(70 - s * 20); g = Math.round(34 - s * 10); b = 14; al = Math.round(235 * (1 - s));
      }
      fimg.data[a] = r; fimg.data[a + 1] = g; fimg.data[a + 2] = b; fimg.data[a + 3] = al;
    }
    mctx.putImageData(mimg, 0, 0);
    fctx.putImageData(fimg, 0, 0);
    const url = 'url(' + mask.toDataURL() + ')';
    el.style.webkitMaskImage = el.style.maskImage = url;
    el.style.filter = 'sepia(' + (k * 0.6) + ') brightness(' + (1 - k * 0.15) + ')';
    if (k < 1) requestAnimationFrame(frame);
    else if (done) done();
  })(t0);
};
