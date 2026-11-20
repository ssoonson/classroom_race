// 경기 이벤트에 맞춰 효과음을 내고 배경음악을 켜고 끕니다.
import { on } from '../core/events.js';
import { sounds } from '../core/audio.js';
import { startBgm, pauseBgm, resumeBgm, finalBgm, stopBgm } from '../core/bgm.js';
import { race } from '../game/race.js';

export function mountRaceSounds() {
  on('race:countdown', () => sounds.count());
  on('race:go', () => { sounds.go(); startBgm(); });
  on('race:leader', () => sounds.lead());
  on('race:stage', ({ label }) => { if (label && race.phase === 'running' && !label.includes('· 1/')) sounds.stage(); });
  on('race:final', () => { sounds.final(); finalBgm(); });
  on('race:second', ({ left }) => sounds.tick(left));
  on('race:finisher', ({ rank }) => sounds.finisher(rank));

  let previous = race.phase;
  on('race:phase', ({ phase }) => {
    if (phase === 'paused') pauseBgm();
    else if (phase === 'running' && previous === 'paused') resumeBgm();
    else if (phase === 'finished') stopBgm(2.5);
    else if (phase === 'ready') stopBgm(0.4);
    previous = phase;
  });
}
