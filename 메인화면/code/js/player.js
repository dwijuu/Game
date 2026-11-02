/**
 * 캐릭터 음악 플레이어 (유튜브 IFrame API · 화면에는 CD 만 보임)
 * ─────────────────────────────────────────────────────────────
 *  MAIN.player.setPlaylist([{ url, title, artist, thumbnail? }], fallbackArt)
 *  MAIN.player.pause()
 *  · 재생 중에는 CD 가 돌고, 배경 음악(G.bgm)은 잠시 멈췄다가 멈추면 다시 나옵니다.
 *  · 곡이 끝나면 다음 곡으로 넘어갑니다.
 */
window.MAIN = window.MAIN || {};

MAIN.player = (function () {
  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    wrap: $('cx-player'), art: $('cx-player-art'), title: $('cx-player-title'), artist: $('cx-player-artist'),
    bar: $('cx-player-bar'), progress: $('cx-player-progress'), play: $('cx-player-play'), playIco: $('cx-player-play-ico'),
    prev: $('cx-player-prev'), next: $('cx-player-next'), mute: $('cx-player-mute'), vol: $('cx-player-vol')
  };
  const ICON = {
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M6 19h4V5H6zm8-14v14h4V5z"/>',
    vol: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"/>',
    mute: '<path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z"/>'
  };
  const st = { yt: null, ready: false, playing: false, list: [], index: 0, timer: 0, pending: null, auto: false, fallback: '' };

  function ytId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function create() {
    if (st.yt || !(window.YT && YT.Player)) return;
    try {
      st.yt = new YT.Player('yt-player-host', {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: function () {
            st.ready = true;
            if (st.pending) { const id = st.pending; st.pending = null; st.auto ? st.yt.loadVideoById(id) : st.yt.cueVideoById(id); }
          },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            else if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
            else if (e.data === YT.PlayerState.ENDED) { setPlaying(false); step(1, true); }
          },
          onError: function () { setPlaying(false); if (st.list.length > 1) setTimeout(function () { step(1, true); }, 800); }
        }
      });
    } catch (e) { /* 오프라인 등: 플레이어 없이 계속 */ }
  }
  window.onYouTubeIframeAPIReady = create;

  function setPlaying(on) {
    st.playing = on;
    ui.playIco.innerHTML = on ? ICON.pause : ICON.play;
    ui.art.classList.toggle('spinning', on);
    clearInterval(st.timer);
    if (on) st.timer = setInterval(tick, 350);
    if (G.bgm) G.bgm.setRoute(on ? 'music' : 'select');
  }
  function tick() {
    if (!st.ready) return;
    try {
      const d = st.yt.getDuration() || 0;
      if (d > 0) ui.progress.style.width = Math.min(100, st.yt.getCurrentTime() / d * 100) + '%';
    } catch (e) {}
  }

  function load(i, auto) {
    if (!st.list.length) return;
    st.index = (i + st.list.length) % st.list.length;
    const t = st.list[st.index], id = ytId(t.url);
    ui.title.textContent = t.title || 'Track ' + (st.index + 1);
    ui.title.title = ui.title.textContent;
    ui.artist.textContent = t.artist || '';
    ui.progress.style.width = '0%';
    const art = t.thumbnail || st.fallback || (id ? 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg' : '');
    ui.art.src = art;
    if (!id) return;
    if (st.ready) { try { auto ? st.yt.loadVideoById(id) : st.yt.cueVideoById(id); } catch (e) {} }
    else { st.pending = id; st.auto = auto; create(); }
  }
  function step(d, auto) { if (st.list.length) load(st.index + d, auto); }

  function setPlaylist(list, fallbackArt) {
    st.list = Array.isArray(list) ? list : [];
    st.fallback = fallbackArt || '';
    ui.wrap.hidden = !st.list.length;
    if (!st.list.length) { pause(); return; }
    load(0, st.playing);
  }
  function pause() {
    if (st.playing && st.ready) { try { st.yt.pauseVideo(); } catch (e) {} }
  }

  ui.play.addEventListener('click', function () {
    if (!st.ready) { create(); return; }
    try { st.playing ? st.yt.pauseVideo() : st.yt.playVideo(); } catch (e) {}
  });
  ui.prev.addEventListener('click', function () { step(-1, true); });
  ui.next.addEventListener('click', function () { step(1, true); });
  ui.mute.addEventListener('click', function () {
    if (!st.ready) return;
    const m = st.yt.isMuted();
    m ? st.yt.unMute() : st.yt.mute();
    ui.vol.innerHTML = m ? ICON.vol : ICON.mute;
    ui.mute.classList.toggle('is-muted', !m);
  });
  ui.bar.addEventListener('click', function (e) {
    if (!st.ready) return;
    const r = ui.bar.getBoundingClientRect(), k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const d = st.yt.getDuration() || 0;
    if (d > 0) { st.yt.seekTo(k * d, true); ui.progress.style.width = k * 100 + '%'; }
  });
  ui.vol.innerHTML = ICON.vol;

  return { setPlaylist: setPlaylist, pause: pause };
})();
