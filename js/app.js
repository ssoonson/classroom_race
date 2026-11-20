// 앱 조립: 화면 모듈을 붙이고, 3D 무대를 만들고, 매 프레임 루프를 돌립니다.
import { $, toast } from './core/dom.js';
import { emit } from './core/events.js';
import { state, isFirstVisit } from './core/store.js';
import { createStage } from './game/stage.js';
import { createCameraDirector } from './game/camera.js';
import { createQualityController, levelName } from './game/quality.js';
import { race, isLive, attachStage, updateRace, focusRunner, pauseRace, currentTrack, updateTrackView } from './game/race.js';
import { mountTopbar } from './ui/topbar.js';
import { mountStartScreen } from './ui/start-screen.js';
import { mountHud } from './ui/hud.js';
import { mountCameraPanel } from './ui/camera-panel.js';
import { mountRankingPanel } from './ui/ranking-panel.js';
import { mountSettings } from './ui/settings/index.js';
import { mountResult } from './ui/result.js';

// 1) 화면(UI)
mountTopbar($('#topbar'));
mountHud($('#hud'));
mountStartScreen($('#startScreen'));
mountCameraPanel($('#cameraPanel'));
mountRankingPanel($('#rankingPanel'));
mountSettings($('#settings'));
mountResult($('#result'));

// 2) 3D 무대 + 루프
try {
  const stage = createStage($('#canvasMount'));
  const director = createCameraDirector(stage.camera);
  const quality = createQualityController(stage);
  attachStage(stage);
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
    director.update(Math.min(0.07, rawDt), {
      mode: race.cameraMode,
      focus: focusRunner(),
      live: isLive(),
      elapsed: race.elapsed,
      reducedMotion: state.reducedMotion,
      track: currentTrack(),
      packZ,
    });
    packZ = updateTrackView(stage.camera.position.z);
    stage.render();
    debug?.update(rawDt, stage.renderer.info, quality.level);
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
    update(dt, info, level) {
      frames++; time += dt;
      if (time < 0.5) return;
      el.textContent = `${(frames / time).toFixed(0)} fps · 그리기 ${info.render.calls}회 · 삼각형 ${info.render.triangles.toLocaleString()} · 품질 ${levelName(level)}`;
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
