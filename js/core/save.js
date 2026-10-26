/**
 * 진행 상태 저장 (localStorage)
 * ─────────────────────────────────────────────────────────────
 * 저장 규격 (key: AGENT_GAME_SAVE)
 *  {
 *    v: 1,
 *    cleared: { 'ch1-s1': true, ... },    클리어한 스테이지
 *    team:    ['Character_05', null, null, null],  마지막 편성 (자유 편성 스테이지용)
 *    settings: { speed: 1 | 2, auto: false },
 *    decks:   [{ name: '덱 1', team: [id|null x4] }, ...]   미리 만들어 둔 덱 (최대 10개)
 *  }
 * · 저장 데이터가 손상되었거나 버전이 다르면 안전하게 초기값으로 되돌립니다.
 * · 저장소 접근이 막힌 환경(시크릿 모드 등)에서도 메모리 상태로 계속 플레이할 수 있습니다.
 */
window.G = window.G || {};

G.save = (function () {
  const KEY = 'AGENT_GAME_SAVE';
  const VERSION = 1;

  function fresh() {
    return { v: VERSION, cleared: {}, team: [null, null, null, null], settings: { speed: 1, auto: false }, decks: [] };
  }

  const MAX_DECKS = 10;
  function cleanTeam(arr) {
    const out = [null, null, null, null], seen = {};
    for (let i = 0; i < 4; i++) {
      const id = arr && arr[i];
      if (typeof id === 'string' && G.DATA.characters[id] && G.DATA.roster.indexOf(id) !== -1 && !seen[id]) { out[i] = id; seen[id] = 1; }
    }
    return out;
  }
  function sanitize(raw) {
    const d = fresh();
    if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return d;
    if (raw.cleared && typeof raw.cleared === 'object') {
      for (const k in raw.cleared) {
        const base = k.replace(/:after$/, '');
        if (G.DATA.stages[base] && raw.cleared[k] === true) d.cleared[k] = true;
      }
    }
    if (Array.isArray(raw.team)) {
      for (let i = 0; i < 4; i++) {
        const id = raw.team[i];
        d.team[i] = (typeof id === 'string' && G.DATA.characters[id] && G.DATA.roster.indexOf(id) !== -1) ? id : null;
      }
      /* 같은 캐릭터 중복 편성 제거 */
      const seen = {};
      d.team = d.team.map(function (id) { if (!id || seen[id]) return null; seen[id] = 1; return id; });
    }
    if (Array.isArray(raw.decks)) {
      d.decks = raw.decks.slice(0, MAX_DECKS).filter(function (k) { return k && typeof k === 'object'; }).map(function (k, i) {
        return { name: (typeof k.name === 'string' && k.name.trim() ? k.name.trim().slice(0, 20) : '덱 ' + (i + 1)), team: cleanTeam(k.team) };
      });
    }
    if (raw.settings) {
      d.settings.speed = raw.settings.speed === 2 ? 2 : 1;
      d.settings.auto = raw.settings.auto === true;
    }
    return d;
  }

  let data = fresh();
  function load() {
    try {
      const s = window.localStorage.getItem(KEY);
      data = sanitize(s ? JSON.parse(s) : null);
    } catch (e) {
      data = fresh();
    }
    return data;
  }
  function persist() {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 저장 불가 환경: 메모리로만 유지 */ }
  }

  function isCleared(stageId) { return data.cleared[stageId] === true; }
  function markCleared(stageId) {
    const first = !isCleared(stageId);
    data.cleared[stageId] = true;
    persist();
    return first;
  }

  /* 챕터 해금: 제작된 챕터(available) + 선행 스테이지(requires) 클리어 */
  function isChapterUnlocked(chId) {
    const ch = G.DATA.chapters.find(function (c) { return c.id === chId; });
    if (!ch || !ch.available) return false;
    return !ch.requires || isCleared(ch.requires);
  }

  /* 스테이지 해금 여부: 챕터가 열려 있고, 선행 스테이지가 클리어되어야 함 */
  function isStageUnlocked(stageId) {
    const st = G.DATA.stages[stageId];
    if (!st || !isChapterUnlocked(st.chapter)) return false;
    return !st.requires || isCleared(st.requires);
  }

  function getTeam() { return data.team.slice(); }
  function setTeam(team) { data.team = team.slice(0, 4); persist(); }
  function getSettings() { return Object.assign({}, data.settings); }
  function setSetting(k, v) { data.settings[k] = v; persist(); }
  function getDecks() { return data.decks.map(function (k) { return { name: k.name, team: k.team.slice() }; }); }
  function setDecks(list) { data.decks = list.slice(0, MAX_DECKS).map(function (k, i) { return { name: (k.name || '덱 ' + (i + 1)).slice(0, 20), team: cleanTeam(k.team) }; }); persist(); }
  function reset() { data = fresh(); persist(); }

  /* 기록 내보내기 / 불러오기 (다른 브라우저 · 기기로 옮길 때)
   *  파일 형식: { game: 'AGENT_GAME', exportedAt, save: {저장 규격} }
   *  불러올 때도 sanitize 를 거치므로 잘못된 값 · 없는 스테이지는 걸러짐 */
  function exportData() {
    return { game: 'AGENT_GAME', format: 1, exportedAt: new Date().toISOString(), save: JSON.parse(JSON.stringify(data)) };
  }
  function importData(obj) {
    const raw = obj && obj.game === 'AGENT_GAME' ? obj.save : obj;
    if (!raw || typeof raw !== 'object' || raw.v !== VERSION || typeof raw.cleared !== 'object') throw new Error('이 게임의 기록 파일이 아닙니다.');
    data = sanitize(raw);
    persist();
    return { cleared: Object.keys(data.cleared).filter(function (k) { return k.indexOf(':') === -1; }).length };
  }
  function clearedCount() { return Object.keys(data.cleared).filter(function (k) { return k.indexOf(':') === -1; }).length; }

  return { MAX_DECKS, getDecks, setDecks, exportData, importData, clearedCount, load, isCleared, markCleared, isStageUnlocked, isChapterUnlocked, getTeam, setTeam, getSettings, setSetting, reset };
})();
