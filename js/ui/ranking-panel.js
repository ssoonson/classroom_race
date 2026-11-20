// 오른쪽 패널: 실시간 순위 (경기 중에는 추정, 끝나면 확정)
// 순위가 오르면 ▲, 내려가면 ▼를 잠깐 보여 줘서 추월이 눈에 띄게 합니다.
import { $, escapeHTML } from '../core/dom.js';
import { on } from '../core/events.js';
import { race, leaderboard } from '../game/race.js';

const HINT = { ready: '경기 후 순위 확정', countdown: '곧 출발!', running: '추정 현재 순위', paused: '추정 현재 순위', finished: '확정 순위' };
const ARROW_MS = 1200;

export function mountRankingPanel(el) {
  el.innerHTML = `
    <div class="panel-title"><strong>🏁 실시간 순위</strong><span class="muted" data-hint></span></div>
    <div class="ranking" data-list></div>`;

  let previous = new Map();   // id → 지난번 순위
  const moved = new Map();    // id → { dir, until }

  function render() {
    $('[data-hint]', el).textContent = HINT[race.phase];
    const list = leaderboard();
    const now = performance.now();
    if (race.phase === 'running') {
      list.forEach((p, i) => {
        const before = previous.get(p.id);
        if (before !== undefined && before !== i) moved.set(p.id, { dir: before > i ? 'up' : 'down', until: now + ARROW_MS });
      });
    } else {
      moved.clear();
    }
    previous = new Map(list.map((p, i) => [p.id, i]));

    $('[data-list]', el).innerHTML = list.length
      ? list.map((p, i) => {
        const m = moved.get(p.id);
        const arrow = m && m.until > now ? `<b class="move ${m.dir}">${m.dir === 'up' ? '▲' : '▼'}</b>` : '<b class="move"></b>';
        return `
          <div class="rank-row${i < 3 ? ' top' : ''}${race.followId === p.id ? ' followed' : ''}">
            <span class="rank-num">${i + 1}</span>${arrow}
            <i class="swatch" style="--c:${p.color || '#ccc'}"></i><span class="rank-name">${escapeHTML(p.name)}</span>
            <span class="meter"><i style="width:${Math.round(p.progress * 100)}%"></i></span>
          </div>`;
      }).join('')
      : `<div class="placeholder">${race.phase === 'countdown' ? '출발 준비 중…' : '경기를 시작하면 순위가 표시됩니다.'}</div>`;
  }

  on('race:phase', render);
  on('race:tick', render);
  on('race:roster', () => { previous = new Map(); render(); });
  render();
}
