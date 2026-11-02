/**
 * 설정 창 (톱니바퀴 아이콘)
 * ─────────────────────────────────────────────────────────────
 *  · 배경 음악 · 효과음 켜기 / 끄기와 음량 바 · 기록 내보내기 · 불러오기
 *  · 챕터 선택(책장) · 스토리 · 편성 · 전투 화면 오른쪽 위에서 같은 창을 엶
 *  G.settings.button(container, { onOpen, onClose }) → 톱니바퀴 버튼 (container 위에 창을 띄움)
 *  G.settings.open(container, opts)
 */
window.G = window.G || {};

G.settings = (function () {
  const U = G.util;

  function row(k, label) {
    return '<div class="g-set-row"><span class="g-set-label">' + label + '</span>' +
      '<button type="button" class="g-set-toggle" data-k="' + k + '" aria-label="' + label + ' 켜기/끄기"><i></i><b class="on">ON</b><b class="off">OFF</b></button></div>';
  }
  function slider(k, label) {
    return '<div class="g-set-row"><span class="g-set-label">' + label + '</span>' +
      '<div class="g-set-slider" data-k="' + k + '"><input type="range" min="0" max="100" step="1"><output></output></div></div>';
  }
  function open(container, o) {
    o = o || {};
    if (container.querySelector('.g-settings')) return;
    if (o.onOpen) o.onOpen();
    const m = U.el('div', 'g-settings');
    const box = U.el('div', 'g-settings-box g-panel');
    box.innerHTML =
      '<div class="g-set-title"><b>Settings</b><span>설정</span></div>' +
      '<div class="g-set-h">사운드 <em>Sound</em></div>' +
      row('bgm', '배경 음악') + slider('bgm', '배경 음악 음량') +
      row('sfx', '효과음') + slider('sfx', '효과음 음량') +
      '<div class="g-set-h">기록 <em>Record</em></div>' +
      '<div class="g-set-row g-set-io"></div>';
    const API = { sfx: G.sfx, bgm: G.bgm };
    function sync() {
      Object.keys(API).forEach(function (k) {
        const on = API[k].isEnabled();
        const tg = box.querySelector('.g-set-toggle[data-k="' + k + '"]');
        const sl = box.querySelector('.g-set-slider[data-k="' + k + '"]');
        const range = sl.querySelector('input');
        tg.classList.toggle('is-on', on);
        sl.classList.toggle('is-off', !on);
        range.disabled = !on;
        range.value = Math.round(API[k].getVolume() * 100);
        sl.querySelector('output').textContent = range.value;
        range.style.setProperty('--p', range.value + '%');
      });
    }
    Object.keys(API).forEach(function (k) {
      const tg = box.querySelector('.g-set-toggle[data-k="' + k + '"]');
      const sl = box.querySelector('.g-set-slider[data-k="' + k + '"]');
      const range = sl.querySelector('input'), out = sl.querySelector('output');
      tg.addEventListener('click', function () { API[k].setEnabled(!API[k].isEnabled()); sync(); G.sfx.play('ui_click'); });
      range.addEventListener('input', function () { API[k].setVolume(range.value / 100); out.textContent = range.value; range.style.setProperty('--p', range.value + '%'); });
      if (k === 'sfx') range.addEventListener('change', function () { G.sfx.play('card_pick'); });   // 놓았을 때 음량 확인용 소리
    });
    /* 기록 내보내기 · 불러오기 (chapter-select.js 의 G.saveIO) */
    const io = box.querySelector('.g-set-io');
    const ex = U.el('button', 'g-btn', { type: 'button', html: '<span>기록 내보내기</span>' });
    const im = U.el('button', 'g-btn', { type: 'button', html: '<span>기록 불러오기</span>' });
    ex._tip = function () { return '<div class="tt-title">기록 내보내기</div>클리어한 스테이지 · 편성 · 설정을 파일(.json)로 저장합니다.'; };
    im._tip = function () { return '<div class="tt-title">기록 불러오기</div>내보낸 기록 파일을 불러와 지금 기록을 덮어씁니다. 다른 브라우저나 기기에서도 이어서 할 수 있습니다.'; };
    ex.addEventListener('click', function () { close(); G.saveIO.exportSave(container); });
    im.addEventListener('click', function () { close(); G.saveIO.pickImport(container); });
    io.append(ex, im);
    const cl = U.el('button', 'g-btn g-btn-primary g-set-close', { type: 'button', text: '닫기' });
    cl.addEventListener('click', close);
    const x = U.el('button', 'g-set-x', { type: 'button', 'aria-label': '닫기', html: G.lineIcon('close') });
    x.addEventListener('click', close);
    box.append(cl, x);
    m.appendChild(box);
    /* 뒤쪽 화면(스토리 대사 넘김 등)으로 클릭이 새지 않도록 */
    m.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === m) close(); });
    m.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    function close() {
      if (!m.isConnected) return;
      G.tip.hide();
      m.remove();
      document.removeEventListener('keydown', onKey, true);
      if (o.onClose) o.onClose();
    }
    /* 열려 있는 동안 스페이스 · 엔터로 대사가 넘어가지 않도록 */
    m.addEventListener('keydown', function (e) { e.stopPropagation(); });
    sync();
    container.appendChild(m);
    return { close: close };
  }

  function button(container, o) {
    /* 메인 화면과 같은 모양: 상자 · 글씨 없이 톱니 아이콘만 */
    const b = U.el('button', 'g-set-btn g-ico-only', { type: 'button', 'aria-label': '설정', html: G.lineIcon('gear') });
    b.addEventListener('click', function (e) { e.stopPropagation(); open(container, o); });
    return b;
  }

  return { open: open, button: button };
})();
