// 짧은 효과음. 소리 끄기 설정을 따릅니다.
import { state } from './store.js';

let ctx;

export function beep(freq, duration = 0.08) {
  if (!state.sound) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* 소리를 못 내도 게임은 계속 */ }
}

export const sounds = {
  start: () => beep(600),
  finish: () => beep(960, 0.24),
};
