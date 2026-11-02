/**
 * 메인화면 설정 데이터
 * ─────────────────────────────────────────────────────────────
 * 캐릭터의 이름 · 속성 · 역할 · 전투 수치 · 스킬은 게임 데이터 한 곳에서만 관리합니다.
 *   → ../게임/game-site/js/data/characters.js  (G.DATA.characters / G.DATA.roster)
 *   게임에서 캐릭터를 추가 · 수정하면 메인화면 캐릭터 목록에도 그대로 반영됩니다.
 *
 * 이 파일에는 메인화면에서만 쓰는 값만 적습니다.
 *  · PLAYER  : 왼쪽 위 플레이어 정보
 *  · LOBBY   : 메인 화면 배경 · 중앙 캐릭터 · 메뉴 카드 그림 · 이벤트 배너
 *  · CODEX   : 캐릭터별 목록 이미지(스프라이트) · CD 원판 그림 · 음악(유튜브) 목록
 *
 * 경로는 메인화면/index.html 기준입니다.
 *  · 캐릭터 스프라이트 : ../게임/캐릭터스프라이트/<이름>/<이름>_기본.png · _공격.png
 *  · 스프라이트가 아직 없는 캐릭터(레이 · 실반)는 게임 폴더의 임시 실루엣(full.svg)을 씁니다.
 */
window.MAIN = window.MAIN || {};

MAIN.PLAYER = { level: 28, levelProgress: 0.42, nick: 'Dw', uid: '28358237' };

MAIN.LOBBY = {
  background: '../게임/배경/강의실.png',
  hero: 'character/Character_06/시멜_스탠딩.png',
  cards: {
    story:    '../게임/game-site/assets/bg/forest.webp',
    training: '../게임/game-site/assets/bg/training.webp',
    lesson:   '../게임/game-site/assets/bg/corridor.webp',
    diary:    '../게임/game-site/assets/bg/garden.webp'
  },
  banners: [
    { image: '../게임/game-site/assets/bg/forest.webp',   tag: 'CHRONICLE', name: '제1권 · 여정의 시작',     date: '2026.10.01 – 2026.11.30' },
    { image: '../게임/game-site/assets/bg/training.webp', tag: 'EVENT',     name: '훈련장 특별 개방',         date: '2026.10.20 – 2026.11.16' },
    { image: '../게임/game-site/assets/bg/corridor.webp', tag: 'NOTICE',    name: '보충 수업 시간표 안내',     date: '2026.11.02' },
    { image: '../게임/game-site/assets/bg/garden.webp',   tag: 'UPDATE',    name: '정원 산책 · 새 캐릭터 기록', date: '2026.11.05' }
  ]
};

(function () {
  const SP = '../게임/캐릭터스프라이트/';
  const GA = '../게임/game-site/assets/characters/';
  function sprite(name, attack) {
    return { base: SP + name + '/' + name + '_기본.png', attack: SP + name + '/' + (attack || name + '_공격.png') };
  }

  MAIN.CODEX = {
    Character_05: Object.assign(sprite('아르덴'), {
      cd: 'character/Character_05/CD_01.png',
      playlist: [{ title: '2:23AM', artist: 'Sharou', url: 'https://youtu.be/slt_Bav8nsQ?si=iyFDGrp3VivsbBUQ' }]
    }),
    Character_10: sprite('샤린'),
    Character_11: sprite('나즈나'),
    Character_12: sprite('알리제'),
    Character_13: { base: GA + 'Character_13/full.svg', placeholder: true },
    Character_14: sprite('코루스코'),
    Character_15: sprite('페델레', '무제1731_20261029150619.png'),
    Character_16: { base: GA + 'Character_16/full.svg', placeholder: true },
    Character_17: (function () {
      const d = SP + '시멜/Send Anywhere (2026-10-29 18-56-00)/';
      return { base: d + '시멜_기본.png', attack: d + '시멜_공격.png' };
    })()
  };
})();

/* ── 축음기 (레코드) 화면: 메인화면 배경 음악 목록 ───────────────
 *  file: 게임/game-site/assets/bgm/<id>.mp3 · cover: images/records/<id>.jpg
 *  새 곡을 넣으려면 mp3 를 bgm 폴더에 두고 여기에 한 줄 추가하면 됩니다. */
MAIN.TRACKS = [
  { id: 'afternoon_letters', title: 'Afternoon Letters', ko: '오후의 편지', time: '2:13', key: 'B minor', bpm: 72,
    cover: 'images/records/afternoon_letters.jpg',
    desc: '정원에 오후 햇살이 기울 무렵, 책상 위에 쌓인 편지를 한 장씩 읽어 내려가는 시간. 잔잔한 피아노로 만든 이 게임의 첫 배경 음악입니다.' },
  { id: 'morning_letters', title: 'Morning Letters', ko: '아침의 편지', time: '2:37', key: 'D major', bpm: 76,
    cover: 'images/records/morning_letters.jpg',
    desc: '창으로 아침 햇살이 드는 복도에서 막 도착한 편지를 펼쳐 보는 순간. 나일론 기타와 피아노, 플루트가 함께하는 밝은 곡입니다.' },
  { id: 'lantern_at_dusk', title: 'Lantern at Dusk', ko: '해 질 녘의 등불', time: '2:25', key: 'C minor', bpm: 70,
    cover: 'images/records/lantern_at_dusk.jpg',
    desc: '어둠이 내려앉는 숲길에 하나둘 켜지는 등불. 낮고 무거운 첼로로 시작해, 현악과 호른이 함께 떠오르며 끝내 밝아지는 곡입니다.' },
  { id: 'briar_lullaby', title: 'Briar Lullaby', ko: '가시덤불 자장가', time: '2:11', key: 'E minor', bpm: 62,
    cover: 'images/records/briar_lullaby.jpg',
    desc: '오래된 지도와 카드가 펼쳐진 책상 위로 흘러나오는 옛이야기. 기타 위로 리코더와 바이올린, 휘슬이 차례로 이야기를 이어받는 어둡고 동화 같은 곡입니다.' }
];
