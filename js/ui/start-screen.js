// 초기 접속 화면: 경기장 가운데 READY 카드. 대기 상태에서만 보입니다.
import { $, escapeHTML } from '../core/dom.js';
import { on } from '../core/events.js';
import { state, participants } from '../core/store.js';
import { trackLabel, raceSeconds, CHARACTER_LABELS } from '../core/config.js';
import { race } from '../game/race.js';
import { requestStart, openSettings } from './actions.js';

export function mountStartScreen(el) {
  el.classList.add('start-screen');

  function render() {
    el.hidden = race.phase !== 'ready';
    if (el.hidden) return;
    const count = participants().length;
    const hint = state.names.length
      ? '참가선수와 트랙을 확인하고 경기를 시작하세요!'
      : '아직 학생 명단이 없어서 번호(1번, 2번 …)로 경기합니다. ‘명단·설정’에서 이름을 넣을 수 있어요.';
    el.innerHTML = `
      <div class="start-card">
        <div class="badge-large">READY?</div>
        <h2>${escapeHTML(state.className)} 콩콩 달리기</h2>
        <div class="start-summary">
          <span>👥 ${count}명 참가</span>
          <span>${trackLabel(state.track)}</span>
          <span>⏱ ${state.speed}배속 · ${raceSeconds(state.speed)}초</span>
          <span>🧸 ${CHARACTER_LABELS[state.character]}</span>
        </div>
        <p>${hint}</p>
        <div class="start-actions">
          <button class="primary" data-start>▶ 경기 시작</button>
          <button data-open-settings>⚙ 명단·설정</button>
        </div>
      </div>`;
    $('[data-start]', el).onclick = requestStart;
    $('[data-open-settings]', el).onclick = () => openSettings(state.names.length ? undefined : 'students');
  }

  on('race:phase', render);
  on('state:changed', render);
  render();
}
