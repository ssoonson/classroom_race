// 앱 조립: 화면 모듈을 붙이고, 3D 무대를 만들고, 매 프레임 루프를 돌립니다.
import { $, toast } from './core/dom.js';
import { emit, on } from './core/events.js';
import { refreshBgmFile } from './core/bgm.js';
import { state, isFirstVisit } from './core/store.js';
import { createStage } from './game/stage.js';
import { createCameraDirector } from './game/camera.js';
import { createQualityController, levelName } from './game/quality.js';
import { createEffects } from './game/effects.js';
import { race, isLive, attachStage, updateRace, pauseRace, currentTrack, updateTrackView, orderedRunners, remainingSeconds, updateLabels } from './game/race.js';
import { mountTopbar } from './ui/topbar.js';
import { mountStartScreen } from './ui/start-screen.js';
import { mountHud } from './ui/hud.js';
import { mountCameraPanel } from './ui/camera-panel.js';
import { mountRankingPanel } from './ui/ranking-panel.js';
import { mountSettings } from './ui/settings/index.js';
import { mountResult } from './ui/result.js';
import { mountAnnouncer } from './ui/announcer.js';
import { mountRaceBar } from './ui/race-bar.js';
import { mountRaceSounds } from './ui/race-sounds.js';

// 1) 화면(UI)
mountTopbar($('#topbar'));
mountHud($('#hud'));
mountStartScreen($('#startScreen'));
mountCameraPanel($('#cameraPanel'));
mountRankingPanel($('#rankingPanel'));
mountSettings($('#settings'));
mountResult($('#result'));
mountAnnouncer($('#announcer'), $('.arena'));
mountRaceBar($('#raceBar'));
mountRaceSounds();
refreshBgmFile({ checkFolder: state.bgm === 'file' }); // 고른 음악 파일(과 '내 음악'이면 사이트의 audio/bgm.mp3) 확인

// 2) 3D 무대 + 루프
try {
  const stage = createStage($('#canvasMount'));
  const director = createCameraDirector(stage.camera);
  const quality = createQualityController(stage);
  const effects = createEffects(stage.scene);
  attachStage(stage);

  // 1~3위 골인 때 결승선에서 꽃가루
  on('race:finisher', ({ rank }) => {
    const t = currentTrack();
    if (rank <= 3 && t) effects.burst(t.centerX(t.finishZ), 5, t.finishZ - 1, rank === 1 ? 160 : 70);
  });
  on('race:phase', ({ phase }) => { if (phase === 'ready' || phase === 'countdown') effects.clear(); });
  const debug = new URLSearchParams(location.search).has('debug') ? createDebugOverlay() : null;

  const IDLE_FRAME_MS = 32; // 경기 중이 아닐 때는 약 30fps로만 그려 노트북 배터리·발열을 아낌
  let last = 0;
  let packZ = 26;
  const frame = (time) => {
    requestAnimationFrame(frame);
    const live = isLive();
    if (!live && last && time - last < IDLE_FRAME_MS) return;
    const rawDt = last ? Math.max(0, (time - last) / 1000) : 0;
    last = time;
    quality.sample(rawDt, race.phase === 'running');
    updateRace(rawDt);
    effects.update(Math.min(0.07, rawDt));
    director.update(Math.min(0.07, rawDt), {
      mode: race.cameraMode,
      phase: race.phase,
      remaining: remainingSeconds(),
      reducedMotion: state.reducedMotion,
      track: currentTrack(),
      packZ,
      order: race.phase === 'ready' ? race.runners : orderedRunners(),
      focus: race.runners.find((r) => r.id === race.followId),
    });
    packZ = updateTrackView(stage.camera.position.z);
    updateLabels(stage.camera);
    stage.render();
    debug?.update(rawDt, stage.renderer.info, quality.level, director.shot);
  };
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  const banner = $('#threeError');
  banner.hidden = false;
  banner.textContent = '3D 화면 초기화에 실패했습니다. 브라우저의 WebGL 지원 상태를 확인하세요: ' + err.message;
}

/** 주소 끝에 ?debug 를 붙이면 왼쪽 아래에 fps·그리기 호출·삼각형 수를 표시 */
function createDebugOverlay() {
  const el = document.createElement('div');
  el.className = 'debug-overlay';
  document.body.append(el);
  let frames = 0, time = 0;
  return {
    update(dt, info, level, shot) {
      frames++; time += dt;
      if (time < 0.5) return;
      el.textContent = `${(frames / time).toFixed(0)} fps · 그리기 ${info.render.calls}회 · 삼각형 ${info.render.triangles.toLocaleString()} · 품질 ${levelName(level)}${shot ? ` · 샷 ${shot}` : ''}`;
      frames = 0; time = 0;
    },
  };
}

// 3) 탭을 내리거나 화면이 꺼지면 자동 일시정지 (돌아왔을 때 경기가 한순간에 끝나는 문제 방지)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && race.phase === 'running') {
    pauseRace();
    toast('화면이 가려져서 경기를 일시정지했습니다. ‘▶ 계속’을 누르세요.');
  }
});

// 4) 처음 방문이면 명단 입력부터 안내
if (isFirstVisit) emit('settings:open', { tab: 'students' });
