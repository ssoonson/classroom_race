// 경기 진행: 시작·일시정지·종료·초기화, 선수 위치 계산, 실시간 순위.
//
// 공정성: 순위는 startRace()에서 셔플로 미리 확정됩니다. 화면의 추월·점프는 연출일 뿐
// 결과를 바꾸지 않습니다. 경기 시작 순간의 설정(반 이름·트랙·속도·캐릭터·참가자)을
// snapshot으로 고정하므로, 경기 중에 설정을 바꿔도 다음 경기부터 적용됩니다.
import { clearGroup } from './parts.js';
import { buildTrack, animateObstacles } from './tracks/index.js';
import { createRunner, animateRunner, idleRunner } from './characters/index.js';
import { START_Z, laneX, laneRow, jumpHeightAt, dodgeOffsetAt } from './layout.js';
import { state, participants, addHistory } from '../core/store.js';
import { raceSeconds, TRACKS, MIN_PLAYERS } from '../core/config.js';
import { shuffle } from '../core/random.js';
import { emit, on } from '../core/events.js';
import { sounds } from '../core/audio.js';

const FIRST_FINISH = 0.82; // 1등은 경기 시간의 82% 지점에 도착, 꼴찌는 100%에 도착
const MAX_FRAME_GAP = 0.5; // 이보다 긴 프레임 공백은 잘라서 시간이 튀지 않게 함
const BASE_RUN_LENGTH = 126; // 기본 코스 길이. 긴 코스(테마 투어)에서도 걸음 빠르기를 맞추는 기준

export const race = {
  phase: 'ready',            // ready | running | paused | finished
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
};

export const isLive = () => race.phase === 'running' || race.phase === 'paused';

let stage = null;
let track = null;          // 지금 트랙 정보 (tracks/index.js 참고)
let clock = 0;
let lastTick = -1;

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
  const last = Math.max(1, list.length - 1);
  race.finishOrder.forEach((p, i) => {
    race.rankById[p.id] = i + 1;
    race.finishAt[p.id] = FIRST_FINISH + (i / last) * (1 - FIRST_FINISH);
  });
  race.result = null;
  race.followId = '';
  race.cameraMode = state.camera;
  lastTick = -1;

  rebuildTrack(race.snapshot.track);
  rebuildRunners(list, race.snapshot.character);
  setPhase('running');
  emit('camera:changed', { mode: race.cameraMode, followId: '' });
  sounds.start();
  return { ok: true };
}

export function togglePause() {
  if (!isLive()) return;
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
  sounds.finish();
}

// ---------- 매 프레임 ----------
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function positionRunners() {
  const t = race.elapsed / race.duration;
  const stepScale = BASE_RUN_LENGTH / (START_Z - track.finishZ);
  race.runners.forEach((r, i) => {
    const f = clamp01(t / (race.finishAt[r.id] || 1));
    // 추월 연출: 출발·도착 지점에서는 0이 되는 작은 흔들림
    const wobble = 0.027 * Math.sin(t * 18 + i * 1.9) * Math.sin(Math.PI * f) * (1 - f);
    r.progress = clamp01(f + wobble);
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
  if (race.phase !== 'running') return;

  race.elapsed = Math.min(race.duration, race.elapsed + Math.min(rawDt, MAX_FRAME_GAP));
  if (stage) positionRunners();

  const tick = Math.floor(race.elapsed * 3);
  if (tick !== lastTick) { lastTick = tick; emit('race:tick'); }
  if (race.elapsed >= race.duration) finishRace();
}

// ---------- 순위·카메라 ----------
/** 화면에 보여 줄 순위 [{name, progress}] */
export function leaderboard() {
  if (isLive()) {
    return [...race.runners]
      .sort((a, b) => b.progress - a.progress || race.rankById[a.id] - race.rankById[b.id])
      .map((r) => ({ id: r.id, name: r.name, progress: r.progress }));
  }
  if (race.phase === 'finished') return race.finishOrder.map((p) => ({ id: p.id, name: p.name, progress: 1 }));
  return [];
}

/** 카메라가 따라갈 선수: 직접 고른 선수 > 현재 1위 > 첫 선수 */
export function focusRunner() {
  const picked = race.runners.find((r) => r.id === race.followId);
  if (picked) return picked;
  if (race.phase !== 'ready') {
    const leaderId = leaderboard()[0]?.id;
    return race.runners.find((r) => r.id === leaderId) || race.runners[0];
  }
  return race.runners[0];
}

export const currentTrack = () => track;

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
  const playing = race.phase !== 'ready';
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
