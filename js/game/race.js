// 경기 진행: 카운트다운·시작·일시정지·종료·초기화, 선수 위치 계산, 실시간 순위, 경기 이벤트.
//
// 공정성: 순위는 startRace()에서 셔플로 미리 확정됩니다. 화면의 추월·역전·점프는 연출일 뿐
// 결과를 바꾸지 않습니다(연출 흔들림은 결승에 가까워질수록 0이 되어, 확정된 순서대로 골인). 경기 시작 순간의 설정(반 이름·트랙·속도·캐릭터·참가자)을
// snapshot으로 고정하므로, 경기 중에 설정을 바꿔도 다음 경기부터 적용됩니다.
import { clearGroup } from './parts.js';
import { buildTrack, animateObstacles } from './tracks/index.js';
import { createRunner, animateRunner, idleRunner } from './characters/index.js';
import { START_Z, laneX, laneRow, jumpHeightAt, dodgeOffsetAt } from './layout.js';
import { state, participants, addHistory } from '../core/store.js';
import { raceSeconds, TRACKS, MIN_PLAYERS } from '../core/config.js';
import { shuffle } from '../core/random.js';
import { emit, on } from '../core/events.js';

const FIRST_FINISH = 0.85; // 1등은 늦어도 경기 시간의 85% 지점에 도착, 꼴찌는 정확히 100%에 도착
const COUNTDOWN_SECONDS = 3; // 3·2·1 (경기 시간에 포함되지 않음)
const FINAL_SECONDS = 10;    // 마지막 10초 연출

// ---- 레이스 연출(긴장감) 세기 ----
// STORY: 경기 중반에 크게 앞서거나 뒤처지는 '이야기' (우승자가 뒤처졌다가 막판 역전하기도 함)
// WAVE : 몇 초마다 순위가 엎치락뒤치락하는 짧은 흔들림
// 둘 다 결승 직전에는 0이 되므로 최종 순위는 바뀌지 않습니다.
const STORY = 0.035;
const WAVE = 0.018;
// 선두 다툼 대본: 경기 6%~82% 사이에 5번, 정해진 선수가 스퍼트해서 선두로 나섭니다.
const SPURTS = 5;
const SPURT_START = 0.06;
const SPURT_GAP = 0.14;    // 스퍼트 시작 간격 (경기 시간 비율)
const SPURT_LENGTH = 0.2;  // 한 번의 스퍼트 길이 (앞뒤가 겹쳐 '바통 터치'처럼 추월)
const SPURT_MARGIN = 0.012; // 선두보다 이만큼 앞서도록
const SPURT_CAP = 0.06;    // 너무 뒤에 있으면 끝까지 따라잡지는 못하고 '맹추격'만
const MAX_FRAME_GAP = 0.5; // 이보다 긴 프레임 공백은 잘라서 시간이 튀지 않게 함
const BASE_RUN_LENGTH = 126; // 기본 코스 길이. 긴 코스(테마 투어)에서도 걸음 빠르기를 맞추는 기준

export const race = {
  phase: 'ready',            // ready | countdown | running | paused | finished
  elapsed: 0,
  duration: raceSeconds(state.speed),
  snapshot: null,            // { className, track, speed, character }
  roster: [],
  finishOrder: [],
  rankById: {},
  finishAt: {},
  runners: [],
  result: null,
  cameraMode: state.camera,
  followId: '',
  stageLabel: '',            // 구간이 있는 트랙(테마 투어)에서 지금 구간 이름
  countdown: 0,              // 카운트다운 남은 초
  leaderId: '',              // 지금 선두
  finishedCount: 0,          // 골인한 선수 수
};

export const isLive = () => race.phase === 'countdown' || race.phase === 'running' || race.phase === 'paused';
export const remainingSeconds = () => Math.max(0, race.duration - race.elapsed);

let stage = null;
let track = null;          // 지금 트랙 정보 (tracks/index.js 참고)
let clock = 0;
let lastTick = -1;
let lastSecond = -1;
let finalAnnounced = false;
let leaderChangedAt = 0;

function setPhase(phase) {
  race.phase = phase;
  emit('race:phase', { phase });
}

// ---------- 3D 구성 ----------
function rebuildTrack(trackId = state.track) {
  if (!stage) return;
  clearGroup(stage.courseGroup);
  track = buildTrack(trackId);
  stage.courseGroup.add(track.group);
  stage.setSky(track.sky, track.fog);
  stage.setTrackShadows(track.shadows);
  setStageLabel('');
}

/** 트랙 중심선을 따라 선수를 놓고, 곡선 방향으로 몸을 돌립니다. x는 중심선 기준 좌우 위치 */
function placeRunner(r, x, z, sway = 0) {
  const c = track.centerX;
  r.group.position.set(x + c(z), 0, z);
  const tangent = track.curved ? Math.atan2(c(z + 1) - c(z - 1), 2) : 0;
  r.group.rotation.y = tangent + sway;
}

function rebuildRunners(list, style = state.character) {
  if (stage) {
    clearGroup(stage.playerGroup);
    race.runners = list.map((p, i) => {
      const r = createRunner(style, i, p.name, state.namesVisible);
      const row = laneRow(i);
      const stagger = track.curved ? ((row % 2) - 0.5) * 0.48 : 0; // 곡선 트랙은 줄마다 살짝 엇갈려 출발
      Object.assign(r, { id: p.id, name: p.name, index: i, baseX: laneX(i) + stagger, startZ: START_Z + row * track.rowGap, progress: 0 });
      placeRunner(r, r.baseX, r.startZ);
      r.shadow.visible = !stage.shadows; // 실시간 그림자가 없을 때만 발밑 원형 그림자
      idleRunner(r);
      stage.playerGroup.add(r.group);
      return r;
    });
  } else {
    race.runners = list.map((p) => ({ id: p.id, name: p.name, progress: 0 }));
  }
  emit('race:roster');
}

export function attachStage(s) {
  stage = s;
  rebuildTrack();
  rebuildRunners(participants());
}

// ---------- 경기 제어 ----------
/** @returns {{ok: boolean, reason?: 'live'|'min'}} */
export function startRace() {
  if (isLive()) return { ok: false, reason: 'live' };
  const list = participants();
  if (list.length < MIN_PLAYERS) return { ok: false, reason: 'min' };

  race.snapshot = { className: state.className, track: state.track, speed: state.speed, character: state.character };
  race.duration = raceSeconds(state.speed);
  race.elapsed = 0;
  race.roster = list;
  race.finishOrder = shuffle(list);
  race.rankById = {};
  race.finishAt = {};
  // 도착 간격: 인원이 적으면 좁혀서 끝까지 접전 (2명이면 1.8초 차, 6명 이상이면 1위~꼴찌 9초 차)
  const last = Math.max(1, list.length - 1);
  const spread = Math.min(1 - FIRST_FINISH, 0.03 * last);
  race.finishOrder.forEach((p, i) => {
    race.rankById[p.id] = i + 1;
    race.finishAt[p.id] = 1 - spread + (i / last) * spread;
  });
  race.result = null;
  race.followId = '';
  race.cameraMode = state.camera;
  race.leaderId = '';
  race.finishedCount = 0;
  race.countdown = COUNTDOWN_SECONDS;
  lastTick = -1;
  lastSecond = -1;
  finalAnnounced = false;
  leaderChangedAt = 0;

  rebuildTrack(race.snapshot.track);
  rebuildRunners(list, race.snapshot.character);
  planDrama();
  setPhase('countdown');
  emit('race:countdown', { n: COUNTDOWN_SECONDS });
  emit('camera:changed', { mode: race.cameraMode, followId: '' });
  return { ok: true };
}

/**
 * 선수마다 이번 경기의 '연출 대본'을 정합니다(결과와 무관, 보기만 바뀜).
 *  story: 중반에 앞서는지(+) 뒤처지는지(-)
 *  waves: 엎치락뒤치락 흔들림의 빠르기와 시작점
 * 우승자는 절반 확률로 '막판 역전', 아니면 '처음부터 선두 다툼'. 2위는 그 반대 역할.
 */
function planDrama() {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const comeback = Math.random() < 0.5;
  race.runners.forEach((r) => {
    const rank = race.rankById[r.id];
    let story = rnd(-1, 1);
    if (rank === 1) story = comeback ? -1 : 0.7;
    else if (rank === 2) story = comeback ? 1 : 0.4;
    else if (rank === 3) story = rnd(0.2, 0.9);
    r.story = story * STORY;
    r.waves = [0, 1].map(() => [rnd(26, 40), rnd(0, Math.PI * 2)]);
    r.finished = false;
    r.lastProgress = 0;
  });

  // 스퍼트할 선수 정하기: 주로 상위권, 가끔 하위권 다크호스. 마지막 스퍼트는
  // '막판 역전'이면 우승자가 아닌 선수(그래서 우승자가 마지막에 역전), 아니면 우승자.
  const byRank = [...race.finishOrder];
  const pool = byRank.slice(0, Math.min(6, byRank.length));
  const darkHorseAt = byRank.length > 6 && Math.random() < 0.4 ? 1 + Math.floor(Math.random() * 2) : -1;
  let prevId = '';
  race.spurts = Array.from({ length: SPURTS }, (_, k) => {
    let pick;
    if (k === darkHorseAt) pick = byRank[6 + Math.floor(Math.random() * (byRank.length - 6))];
    else if (k === SPURTS - 1) pick = comeback ? pool.find((p) => p.id !== byRank[0].id && p.id !== prevId) : byRank[0];
    else {
      const choices = pool.filter((p) => p.id !== prevId);
      pick = choices[Math.floor(Math.random() * choices.length)];
    }
    pick ||= pool.find((p) => p.id !== prevId) || pool[0];
    prevId = pick.id;
    const t0 = SPURT_START + k * SPURT_GAP;
    return { id: pick.id, t0, t1: t0 + SPURT_LENGTH };
  });
}

export function togglePause() {
  if (race.phase !== 'running' && race.phase !== 'paused') return; // 카운트다운 중에는 무시
  setPhase(race.phase === 'paused' ? 'running' : 'paused');
}

export function pauseRace() {
  if (race.phase === 'running') setPhase('paused');
}

export function resetRace() {
  race.elapsed = 0;
  race.duration = raceSeconds(state.speed);
  race.snapshot = null;
  race.roster = [];
  race.finishOrder = [];
  race.result = null;
  race.followId = '';
  race.cameraMode = state.camera;
  race.leaderId = '';
  race.finishedCount = 0;
  rebuildTrack();
  rebuildRunners(participants());
  setPhase('ready');
  emit('camera:changed', { mode: race.cameraMode, followId: '' });
}

function finishRace() {
  race.runners.forEach((r) => { r.progress = 1; });
  const snap = race.snapshot;
  race.result = {
    date: new Date().toLocaleString('ko-KR'),
    className: snap.className,
    trackName: (TRACKS[snap.track] || TRACKS.tour).name,
    speed: snap.speed,
    order: race.finishOrder.map((p) => p.name),
  };
  setPhase('finished');
  addHistory(race.result);
  emit('race:finished', { result: race.result });
}

// ---------- 매 프레임 ----------
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * 연출용 앞뒤 차이. f(원래 진행률)가 0이거나 1에 가까우면 0이 됩니다.
 *  - story: 진행률 0~85% 사이에 크게 부풀었다가 85%에서 0 → 막판 역전·선두 다툼
 *  - waves: 몇 초 간격의 엎치락뒤치락. 결승에 가까울수록 작아짐
 */
function dramaOffset(r, f, t) {
  if (f >= 1) return 0;
  const storyEnvelope = f < 0.85 ? Math.sin((Math.PI * f) / 0.85) ** 2 : 0;
  const waveEnvelope = Math.sin(Math.PI * f) * (1 - f) ** 0.35;
  const wave = r.waves.reduce((sum, [w, phase]) => sum + Math.sin(w * t + phase), 0) / 2;
  return r.story * storyEnvelope + WAVE * waveEnvelope * wave;
}

/** 스퍼트 중인 선수에게 '지금 선두보다 살짝 앞설 만큼'의 추가 거리를 줍니다 (부드럽게 올라갔다 내려옴) */
function applySpurts(t, natural) {
  for (const sp of race.spurts || []) {
    if (t <= sp.t0 || t >= sp.t1) continue;
    const u = (t - sp.t0) / (sp.t1 - sp.t0);
    const bump = Math.sin(Math.PI * u) ** 2;
    let best = 0;
    for (const [id, v] of natural) if (id !== sp.id && v > best) best = v;
    const mine = natural.get(sp.id);
    if (mine === undefined) continue;
    const need = Math.min(SPURT_CAP, Math.max(0, best - mine + SPURT_MARGIN));
    natural.set(sp.id, mine + need * bump);
  }
}

function positionRunners() {
  const t = race.elapsed / race.duration;
  const stepScale = BASE_RUN_LENGTH / (START_Z - track.finishZ);
  // 1) 기본 진행률 + 연출 흔들림, 2) 스퍼트 대본 적용
  const natural = new Map();
  const base = new Map();
  for (const r of race.runners) {
    const f = clamp01(t / (race.finishAt[r.id] || 1));
    base.set(r.id, f);
    natural.set(r.id, f + dramaOffset(r, f, t));
  }
  applySpurts(t, natural);
  race.runners.forEach((r, i) => {
    const f = base.get(r.id);
    // 뒤로 걷지 않도록 진행률은 줄어들지 않게 (잠깐 멈칫하는 것은 괜찮음)
    r.progress = Math.max(r.lastProgress || 0, clamp01(f >= 1 ? 1 : Math.min(natural.get(r.id), 0.995)));
    r.lastProgress = r.progress;
    if (r.progress >= 1 && !r.finished) {
      r.finished = true;
      race.finishedCount++;
      emit('race:finisher', { rank: race.rankById[r.id], name: r.name, id: r.id });
    }
    const z = r.startZ - (r.startZ - track.finishZ) * r.progress;
    const lane = r.baseX + Math.sin(2.5 * t + i * 2.2) * 0.18 * (1 - r.progress);
    const x = lane + dodgeOffsetAt(track.obstacles, lane, z);   // 높은 장애물은 옆으로 비켜 감
    placeRunner(r, x, z, Math.sin(t * 15 + i) * 0.05 * (1 - r.progress));
    if (r.progress >= 1) idleRunner(r); // 결승 후에는 멈춰 서기
    else animateRunner(r, z, jumpHeightAt(track.obstacles, x, z), stepScale);
  });
}

/** rawDt: 지난 프레임부터 흐른 실제 시간(초) */
export function updateRace(rawDt) {
  clock += Math.min(rawDt, 0.07);
  if (track) animateObstacles(track.animated, clock);

  if (race.phase === 'countdown') {
    const before = Math.ceil(race.countdown);
    race.countdown -= Math.min(rawDt, MAX_FRAME_GAP);
    const now = Math.ceil(race.countdown);
    if (race.countdown <= 0) {
      setPhase('running');
      emit('race:go');
    } else if (now !== before) {
      emit('race:countdown', { n: now });
    }
    return;
  }
  if (race.phase !== 'running') return;

  race.elapsed = Math.min(race.duration, race.elapsed + Math.min(rawDt, MAX_FRAME_GAP));
  if (stage) positionRunners();

  const tick = Math.floor(race.elapsed * 3);
  if (tick !== lastTick) {
    lastTick = tick;
    checkLeader();
    emit('race:tick');
  }

  // 마지막 10초: 한 번 알리고, 1초마다 초읽기
  const left = Math.ceil(remainingSeconds());
  if (left <= FINAL_SECONDS && left !== lastSecond && left > 0) {
    lastSecond = left;
    if (!finalAnnounced) { finalAnnounced = true; emit('race:final'); }
    emit('race:second', { left });
  }
  if (race.elapsed >= race.duration) finishRace();
}

/** 선두가 바뀌면 알림 (너무 잦지 않게 2.5초 간격, 출발 직후 2초는 제외) */
function checkLeader() {
  const leader = orderedRunners()[0];
  if (!leader || leader.id === race.leaderId) return;
  const first = !race.leaderId;
  race.leaderId = leader.id;
  if (first || race.elapsed < 2 || race.elapsed - leaderChangedAt < 2.5 || leader.finished) return;
  leaderChangedAt = race.elapsed;
  emit('race:leader', { id: leader.id, name: leader.name });
}

// ---------- 순위·카메라 ----------
/** 지금 앞선 순서대로 정렬한 선수들 (경기 중) */
export function orderedRunners() {
  return [...race.runners].sort((a, b) => b.progress - a.progress || race.rankById[a.id] - race.rankById[b.id]);
}

/** 화면에 보여 줄 순위 [{name, progress}] */
export function leaderboard() {
  if (isLive() && race.phase !== 'countdown') {
    return orderedRunners().map((r) => ({ id: r.id, name: r.name, progress: r.progress, color: r.color }));
  }
  if (race.phase === 'countdown') return [];
  if (race.phase === 'finished') {
    return race.finishOrder.map((p) => ({ id: p.id, name: p.name, progress: 1, color: race.runners.find((r) => r.id === p.id)?.color }));
  }
  return [];
}

/** 카메라가 따라갈 선수: 직접 고른 선수 > 현재 1위 > 첫 선수 */
export function focusRunner() {
  const picked = race.runners.find((r) => r.id === race.followId);
  if (picked) return picked;
  if (race.phase !== 'ready' && race.phase !== 'countdown') return orderedRunners()[0] || race.runners[0];
  return race.runners[0];
}

export const currentTrack = () => track;

/** 이름표 크기를 카메라와의 거리에 맞춤: 가까운 샷에서 화면을 가리지 않게 */
export function updateLabels(camera) {
  for (const r of race.runners) {
    if (!r.label) continue;
    const s = Math.min(1.15, Math.max(0.42, camera.position.distanceTo(r.group.position) / 24));
    r.label.scale.set(2.5 * s, 0.7 * s, 1);
  }
}

function setStageLabel(label) {
  if (label === race.stageLabel) return;
  race.stageLabel = label;
  emit('race:stage', { label });
}

/**
 * 매 프레임 카메라를 움직인 뒤 호출: 구간이 있는 트랙의 하늘색·구간 숨기기·구간 이름을 갱신합니다.
 * @returns 카메라가 기준으로 삼을 선두 z
 */
export function updateTrackView(cameraZ) {
  if (!track || !stage) return START_Z;
  const playing = race.phase !== 'ready' && race.phase !== 'countdown';
  const focus = focusRunner();
  const focusZ = playing && focus?.group ? focus.group.position.z : START_Z;
  track.updateView?.(stage.scene, cameraZ, focusZ);
  if (track.stages) {
    const n = track.stageAt(focusZ);
    const s = track.stages[n];
    setStageLabel(playing ? `${s.icon} ${s.name} · ${n + 1}/${track.stages.length}` : '');
  }
  return focusZ;
}

export function setCameraMode(mode) {
  race.cameraMode = mode;
  emit('camera:changed', { mode, followId: race.followId });
}

export function setFollow(id) {
  race.followId = id;
  if (id) race.cameraMode = 'follow';
  emit('camera:changed', { mode: race.cameraMode, followId: id });
}

// 품질이 바뀌면 원형 그림자 켜기/끄기
on('quality:changed', () => {
  if (stage) race.runners.forEach((r) => { if (r.shadow) r.shadow.visible = !stage.shadows; });
});

// ---------- 설정 변경 반영 ----------
on('state:changed', ({ keys }) => {
  if (keys.includes('namesVisible')) race.runners.forEach((r) => { if (r.label) r.label.visible = state.namesVisible; });
  if (keys.includes('camera')) setCameraMode(state.camera);
  if (isLive()) return; // 경기 중에는 나머지 변경을 다음 경기에 적용

  if (keys.includes('speed')) race.duration = raceSeconds(state.speed);
  const rosterKeys = ['names', 'selected', 'numberCount', 'character'];
  if (keys.some((k) => rosterKeys.includes(k))) {
    resetRace(); // 명단·캐릭터가 바뀌면 출발선 상태로
  } else if (keys.includes('track') && race.phase === 'ready') {
    rebuildTrack();
    rebuildRunners(participants()); // 트랙마다 출발 위치가 달라서 다시 세움
  }
});
