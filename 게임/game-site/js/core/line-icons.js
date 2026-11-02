/**
 * 선 아이콘 (메인 화면 code/js/icons.js 와 같은 모양 · 24 x 24 · 가는 선 · 둥근 끝)
 * 설정 · 캐릭터 목록 · 덱 추천 등 화면 위쪽 버튼에 씁니다. 장식 없이 한 눈에 알아보는 모양만 둡니다.
 *  G.lineIcon('gear') → <svg ...>
 */
window.G = window.G || {};

G.LINE_ICONS = {
  gear:    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  back:    '<path d="M20 12H5M11 5l-7 7 7 7"/>',
  friends: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.5 2.6 3.5 5.2"/>',
  deck:    '<rect x="7" y="3.5" width="12" height="16" rx="1"/><path d="M4.5 7v12.5a1 1 0 0 0 1 1H15"/>',
  codex:   '<path d="M12 6.5C10 5 7 4.5 3.5 5v14c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v14"/>',
  close:   '<path d="M6 6l12 12M18 6 6 18"/>'
};

G.lineIcon = function (key, cls) {
  return '<svg class="' + (cls || 'g-icon g-line-ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (G.LINE_ICONS[key] || '') + '</svg>';
};
