// 여러 화면에서 함께 쓰는 동작 (시작 버튼이 상단 HUD·초기 화면·결과 화면에 모두 있음)
import { startRace } from '../game/race.js';
import { emit } from '../core/events.js';
import { toast } from '../core/dom.js';
import { MIN_PLAYERS } from '../core/config.js';

export function requestStart() {
  const result = startRace();
  if (!result.ok && result.reason === 'min') {
    emit('settings:open', { tab: 'participants' });
    toast(`최소 ${MIN_PLAYERS}명의 참가선수를 선택하세요.`);
  }
  return result.ok;
}

export const openSettings = (tab) => emit('settings:open', { tab });
