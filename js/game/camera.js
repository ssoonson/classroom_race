// 카메라 연출: 자동 전환 / 전체 보기 / 선수 추적
// 전체 보기 위치는 트랙마다 다르므로 트랙 정보의 overview()를 씁니다.
import { THREE } from './parts.js';

const AUTO_SWITCH_SECONDS = 8;

export function createCameraDirector(camera) {
  const look = new THREE.Vector3(0, 0, -38);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();

  return {
    /**
     * dt: 프레임 간격(초), mode: auto|overview|follow, focus: 따라갈 선수,
     * track: 트랙 정보, packZ: 선두 무리 위치(구간 트랙의 전체 보기용)
     */
    update(dt, { mode, focus, live, elapsed, reducedMotion, track, packZ }) {
      let m = mode;
      if (m === 'auto') {
        m = live && !reducedMotion && Math.floor(elapsed / AUTO_SWITCH_SECONDS) % 2 === 1 ? 'follow' : 'overview';
      }
      if (m === 'follow' && focus?.group) {
        const { x, z } = focus.group.position;
        const advance = track?.curved ? track.centerX(z - 15) - track.centerX(z) : 0; // 곡선 앞쪽을 바라봄
        wantPos.set(x + 6, 8, z + 18);
        wantLook.set(x + advance, 1.9, z - 15);
      } else {
        const view = track ? track.overview(packZ) : { position: [0, 57, 75], target: [0, 0, -38] };
        wantPos.set(...view.position);
        wantLook.set(...view.target);
      }
      const k = reducedMotion ? 1 : Math.min(1, dt * 2.5 + 0.015);
      camera.position.lerp(wantPos, k);
      look.lerp(wantLook, k);
      camera.lookAt(look);
    },
  };
}
