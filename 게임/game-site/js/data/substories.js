/**
 * 서브 스토리 (캐릭터의 배경 이야기)
 * ─────────────────────────────────────────────────────────────
 * 챕터 선택 화면 아래 [서브 스토리] 탭에 가로로 늘어서는 항목 (모두 같은 형식)
 *  { id, char: 캐릭터 id(없으면 아직 정해지지 않은 칸), title, en, chapter: 들어갈 챕터 id(없으면 잠김) }
 *  · 지금은 시멜만 열려 있음 → 'side-simel' 챕터 (챕터 1과 같은 스테이지 선택 화면, 임시 스테이지 4개)
 *  · 서브 스토리 챕터는 side: true → 책장(메인 스토리)에는 나오지 않음
 */
window.G = window.G || {};
G.DATA = G.DATA || {};

G.DATA.subStories = [
  { id: 'sub-simel', char: 'Character_17', title: '시멜', en: 'SIMEL', chapter: 'side-simel' },
  { id: 'sub-rei', char: 'Character_13', title: '레이', en: 'REI', chapter: null },
  { id: 'sub-03', char: null, chapter: null },
  { id: 'sub-04', char: null, chapter: null },
  { id: 'sub-05', char: null, chapter: null },
  { id: 'sub-06', char: null, chapter: null }
];

/* 시멜 서브 스토리 — 임시 스테이지 1개 (스토리 · 전투 구성은 챕터 1과 같은 방식, 원고를 받으면 교체) */
G.DATA.chapters.push({ id: 'side-simel', no: 1, side: true, title: 'SIDE · 시멜', available: true, requires: null, stages: ['sim-s1'] });
Object.assign(G.DATA.stages, {
  'sim-s1': { id: 'sim-s1', chapter: 'side-simel', no: 1, name: 'STAGE 01', subtitle: '임시 스테이지', desc: '임시 스테이지 — 이야기만 진행됩니다. (원고 대기)', requires: null, story: 'sim-s1', storyOnly: true, temporary: true },
});
Object.assign(G.DATA.stories, {
  'sim-s1': { clearOnEnd: true, lines: [
    { scene: 'SCENE 01', title: '임시 장면', place: '', bg: 'hall' },
    { narrator: true, text: '시멜의 서브 스토리가 들어갈 자리입니다.' },
    { speaker: '시멜', text: '(임시 대사) 아직 이 이야기는 쓰이지 않았어.' }
  ] },
});
