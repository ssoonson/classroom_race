// 카메라 감독: 자동 모드에서는 경기 상황에 맞춰 3~5초마다 '샷'을 바꿔 가며 컷 전환합니다.
//
// 샷 종류
//   start   카운트다운: 출발선 앞에서 선수들 얼굴을 낮게
//   chase   선두 바로 뒤에서 낮게 따라가기 (속도감)
//   front   선두 앞에서 뒤돌아보기 (쫓아오는 무리가 보임)
//   side    옆에서 나란히 달리며 보기
//   battle  가장 접전인 두 선수를 가까이
//   overview 무리 전체
//   finish  마지막 10초: 결승선에서 들어오는 선수들을 정면으로
// 수동 모드: overview(전체 보기), follow(고른 선수 또는 선두를 chase로)
// '카메라 움직임 줄이기'를 켜면 컷 전환·흔들림 없이 전체 보기만 씁니다.
import { THREE } from './parts.js';

const SHOT_SECONDS = [3.4, 4.8];
const MID_RACE_SHOTS = ['chase', 'front', 'overview', 'side', 'battle', 'chase', 'front'];
const FINAL_SHOTS = ['finish', 'chase', 'finish', 'battle'];
const FOV_EXTRA = { chase: 10, front: 5, battle: 6, start: 4, side: 0, overview: 0, finish: 2 };

export function createCameraDirector(camera) {
  const look = new THREE.Vector3(0, 0, -38);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  let shot = '';
  let shotUntil = 0;
  let shotIndex = 0;
  let sideSign = 1;
  let fovExtra = 0;
  let clock = 0;
  let lastType = '';

  /** 다음 샷 고르기 (같은 샷이 연달아 나오지 않게) */
  function nextShot(final) {
    const list = final ? FINAL_SHOTS : MID_RACE_SHOTS;
    shotIndex = (shotIndex + 1 + Math.floor(Math.random() * 2)) % list.length;
    let next = list[shotIndex];
    if (next === shot) next = list[(shotIndex + 1) % list.length];
    if (next === 'side') sideSign = -sideSign;
    return next;
  }

  /** 가장 접전인 앞쪽 두 선수 (상위 6명 중 간격이 가장 좁은 쌍) */
  function closestPair(order) {
    const top = order.filter((r) => !r.finished).slice(0, 6);
    let best = null;
    for (let i = 0; i + 1 < top.length; i++) {
      const gap = Math.abs(top[i].group.position.z - top[i + 1].group.position.z);
      if (!best || gap < best.gap) best = { a: top[i], b: top[i + 1], gap };
    }
    return best;
  }

  function aim(type, ctx) {
    const { track, order, focus } = ctx;
    const cx = track ? track.centerX : () => 0;
    const lead = focus || order.find((r) => !r.finished) || order[0];
    const p = lead?.group.position;
    switch (type) {
      case 'start': {
        const z = 13;
        wantPos.set(cx(z) + 4, 3.2, z);
        wantLook.set(cx(29), 1.7, 29);
        return;
      }
      case 'chase': {
        const adv = cx(p.z - 12) - cx(p.z);
        wantPos.set(p.x - adv * 0.3, 4.2, p.z + 9.5);
        wantLook.set(p.x + adv * 0.6, 1.6, p.z - 10);
        return;
      }
      case 'front': {
        const ahead = p.z - 11;
        wantPos.set(cx(ahead) + (p.x - cx(p.z)) * 0.6, 3.3, ahead);
        wantLook.set(p.x, 1.7, p.z + 5);
        return;
      }
      case 'side': {
        const z = p.z - 3;
        wantPos.set(cx(z) + sideSign * 17, 7, z + 2);
        wantLook.set(cx(z), 1.5, z - 1);
        return;
      }
      case 'battle': {
        const pair = closestPair(order);
        if (!pair) return aim('chase', ctx);
        const mx = (pair.a.group.position.x + pair.b.group.position.x) / 2;
        const mz = (pair.a.group.position.z + pair.b.group.position.z) / 2;
        wantPos.set(mx - 7, 4.5, mz + 6.5);
        wantLook.set(mx, 1.6, mz - 2);
        return;
      }
      case 'finish': {
        const fz = track.finishZ;
        if (ctx.phase === 'running' && p.z - fz > 30) { // 선두가 아직 멀면 선두 앞에서 넓게
          const ahead = p.z - 15;
          wantPos.set(cx(ahead) + 3, 4.5, ahead);
          wantLook.set(p.x, 1.6, p.z + 4);
          return;
        }
        wantPos.set(cx(fz) + 6, 3.4, fz - 9);
        const z = Math.max(p.z, fz);
        wantLook.set(p.x * 0.5 + cx(fz) * 0.5, 1.6, (z + fz) / 2 + 4);
        return;
      }
      default: {
        const view = track ? track.overview(ctx.packZ) : { position: [0, 57, 75], target: [0, 0, -38] };
        wantPos.set(...view.position);
        wantLook.set(...view.target);
      }
    }
  }

  return {
    get shot() { return shot; },
    /**
     * ctx: { mode, phase, remaining, reducedMotion, track, packZ, order(앞선 순서의 선수들), focus(고른 선수) }
     */
    update(dt, ctx) {
      clock += dt;
      const { mode, phase, reducedMotion, order } = ctx;
      const live = phase === 'countdown' || phase === 'running' || phase === 'paused';
      const final = phase === 'running' && ctx.remaining <= 10;

      let type;
      if (!order.length) type = 'overview';
      else if (mode === 'follow') type = 'chase';
      else if (mode === 'overview' || reducedMotion) type = 'overview';
      else if (phase === 'countdown') type = 'start';
      else if (phase === 'finished') type = 'finish';
      else if (!live) type = 'overview';
      else {
        if (!shot || clock >= shotUntil || (final && !FINAL_SHOTS.includes(shot))) {
          if (phase === 'running') {
            const [a, b] = SHOT_SECONDS;
            shot = nextShot(final);
            shotUntil = clock + (final ? a : a + Math.random() * (b - a));
          }
        }
        type = shot || 'chase';
      }

      const cut = type !== lastType;
      lastType = type;
      aim(type, ctx);

      // 마지막 10초에는 가까운 샷에서 살짝 흔들림 (긴박감)
      if (final && !reducedMotion && (type === 'chase' || type === 'front')) {
        wantPos.x += Math.sin(clock * 37) * 0.06;
        wantPos.y += Math.sin(clock * 29) * 0.05;
      }

      // 샷이 바뀌면 순간 컷, 같은 샷 안에서는 부드럽게 따라감
      const k = cut && live && !reducedMotion ? 1 : reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
      camera.position.lerp(wantPos, k);
      look.lerp(wantLook, k);
      camera.lookAt(look);

      const targetFov = reducedMotion ? 0 : FOV_EXTRA[type] || 0;
      fovExtra += (targetFov - fovExtra) * (cut ? 1 : Math.min(1, dt * 3));
      const fov = (camera.userData.baseFov || camera.fov) + fovExtra;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
