/**
 * 효과음 (assets/sfx/*.mp3 — 중세 판타지풍으로 직접 합성한 소리)
 * ─────────────────────────────────────────────────────────────
 *  G.sfx.play('이름', 볼륨배율)
 *   · 같은 소리가 아주 짧은 간격으로 겹치면(연타 피해 등) 한 번만 재생
 *   · 소리마다 Audio 몇 개를 돌려 써서 겹쳐 재생 가능 (file:// 에서도 동작)
 *   · 켜기/끄기는 localStorage 'AGENT_GAME_SFX' 에 저장 (챕터 선택 화면 오른쪽 위 버튼)
 *  G.sfx.skill(skill) : 스킬 anim 이름으로 'sk_<anim>' 을 찾고, 없으면 속성 · 종류로 대신함
 *
 *  버튼 효과음은 문서 전체 클릭을 한 곳에서 처리 (data-sfx="이름|none" 으로 버튼마다 지정 가능)
 *  · 덱 선택 · 캐릭터 선택 창 안의 클릭에는 소리를 넣지 않음
 */
window.G = window.G || {};

G.sfx = (function () {
  const BASE = 'assets/sfx/';
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
