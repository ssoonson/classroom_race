// 오른쪽 패널: 실시간 순위 (경기 중에는 추정, 끝나면 확정)
import { $, escapeHTML } from '../core/dom.js';
import { on } from '../core/events.js';
import { race, leaderboard } from '../game/race.js';

const HINT = { ready: '경기 후 순위 확정', running: '추정 현재 순위', paused: '추정 현재 순위', finished: '확정 순위' };

export function mountRankingPanel(el) {
  el.innerHTML = `
    <div class="panel-title"><strong>🏁 실시간 순위</strong><span class="muted" data-hint></span></div>
    <div class="ranking" data-list></div>`;

  function render() {
    $('[data-hint]', el).textContent = HINT[race.phase];
    const list = leaderboard();
    $('[data-list]', el).innerHTML = list.length
      ? list.map((p, i) => `
          <div class="rank-row">
            <span class="rank-num">${i + 1}</span><span>${escapeHTML(p.name)}</span>
            <span class="meter"><i style="width:${Math.round(p.progress * 100)}%"></i></span>
          </div>`).join('')
      : '<div class="placeholder">경기를 시작하면 순위가 표시됩니다.</div>';
  }

  on('race:phase', render);
  on('race:tick', render);
  on('race:roster', render);
  render();
}
