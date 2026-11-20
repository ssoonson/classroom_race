// 경기장 위 HUD: 트랙 이름·남은 시간·상태(위), 진행률·시작/일시정지/초기화 버튼(아래)
import { $, formatTime } from '../core/dom.js';
import { on } from '../core/events.js';
import { state, participants } from '../core/store.js';
import { trackLabel, raceSeconds } from '../core/config.js';
import { race, isLive, togglePause, resetRace, remainingSeconds } from '../game/race.js';
import { requestStart } from './actions.js';

const STATUS = { ready: '대기 중', countdown: '출발 준비', running: '경기 중', paused: '일시정지', finished: '경기 종료' };

export function mountHud(el) {
  el.innerHTML = `
    <div class="arena-top">
      <span data-track aria-live="polite"></span><span data-time class="race-time"></span><span data-status class="status"></span>
    </div>
    <div class="bottom-hud">
      <div><span data-people></span><span data-progress-label></span></div>
      <div class="progress"><div data-progress></div></div>
      <div class="buttons">
        <button class="primary" data-start>▶ 경기 시작</button>
        <button data-pause disabled>Ⅱ 일시정지</button>
        <button data-reset>↻ 초기화</button>
      </div>
    </div>`;

  const q = (s) => $(s, el);
  q('[data-start]').onclick = requestStart;
  q('[data-pause]').onclick = togglePause;
  q('[data-reset]').onclick = resetRace;

  function render() {
    const ready = race.phase === 'ready';
    const snap = race.snapshot;
    const percent = ready ? 0 : Math.min(100, Math.round((race.elapsed / race.duration) * 100));
    q('[data-track]').textContent = !ready && race.stageLabel ? race.stageLabel : trackLabel(ready || !snap ? state.track : snap.track);
    q('[data-time]').textContent = formatTime(ready ? raceSeconds(state.speed) : remainingSeconds());
    q('[data-status]').textContent = STATUS[race.phase];
    q('[data-people]').textContent = `${ready ? participants().length : race.roster.length}명 참가`;
    q('[data-progress-label]').textContent = `진행률 ${percent}%`;
    q('[data-progress]').style.width = `${percent}%`;
    q('[data-start]').disabled = isLive();
    q('[data-pause]').disabled = !isLive() || race.phase === 'countdown';
    q('[data-pause]').textContent = race.phase === 'paused' ? '▶ 계속' : 'Ⅱ 일시정지';
  }

  on('race:phase', render);
  on('race:tick', render);
  on('race:stage', render);
  on('race:second', render); // 마지막 10초는 매초 갱신
  on('state:changed', render);
  render();
}
