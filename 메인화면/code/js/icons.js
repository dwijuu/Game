/**
 * 메인 화면 아이콘 (24 x 24 · 가는 선 · 둥근 끝)
 * 정보창 레퍼런스처럼 장식 없이 한 눈에 알아보는 모양만 씁니다.
 * HTML 에 data-icon="키" 를 적으면 app.js 가 이 모양으로 채웁니다. 없는 키는 게임 아이콘(G.icons)에서 찾습니다.
 */
window.MAIN = window.MAIN || {};

MAIN.ICONS = {
  notice:  '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M19 7a7 7 0 0 1 0 10"/>',
  mail:    '<rect x="3" y="5.5" width="18" height="13" rx="1"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  event:   '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shop:    '<path d="M5 8h14l-1 12H6z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  season:  '<path d="M7 3.5h10v17l-5-3.5-5 3.5z"/>',
  grid:    '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear:    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  codex:   '<path d="M12 6.5C10 5 7 4.5 3.5 5v14c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v14"/>',
  friends: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.5 2.6 3.5 5.2"/>',
  trophy:  '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5"/><path d="M12 14v4M8.5 20.5h7"/>',
  guild:   '<path d="M12 3 19.5 6v5.5c0 4.5-3.2 7.8-7.5 9.5-4.3-1.7-7.5-5-7.5-9.5V6z"/>',
  guide:   '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6"/><path d="M12 17h.01"/>',
  stamina: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  coin:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h5M9.5 14.5h5"/>',
  gem:     '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18"/>',
  gramophone: '<path d="M3.5 15.5h11v5h-11z"/><path d="M2.5 15.5h13"/><path d="M9 15.5v-1.8"/><path d="M8.4 13.7C9.4 10.4 11 6.6 13.2 3.4"/><path d="M9.8 14.3c2.9-1.1 6.4-2.2 9.9-4.5"/><ellipse cx="16.45" cy="6.6" rx="4.6" ry="1.7" transform="rotate(45 16.45 6.6)"/>',
  lock:    '<rect x="5.5" y="10.5" width="13" height="10" rx="1"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>'
};

MAIN.icon = function (key, cls) {
  const p = MAIN.ICONS[key];
  if (!p) return G.icons.svg(key, cls);
  return '<svg class="' + (cls || 'g-icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
};
