// 경기 결과 창
import { $, escapeHTML, toast } from '../core/dom.js';
import { on } from '../core/events.js';
import { race, resetRace } from '../game/race.js';
import { requestStart } from './actions.js';

const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}위`;

export function mountResult(el) {
  el.className = 'result-overlay';
  el.hidden = true;
  el.innerHTML = `
    <div class="result-card" role="dialog" aria-modal="true" aria-labelledby="resultTitle">
      <div class="result-head"><h2 id="resultTitle">🏆 경기 결과</h2><button class="xbtn" data-close aria-label="닫기">×</button></div>
      <p data-summary></p>
      <div class="result-list" data-list></div>
      <div class="inline">
        <button data-copy>순위 복사</button>
        <button class="primary" data-replay>↻ 다시 달리기</button>
      </div>
    </div>`;

  $('[data-close]', el).onclick = () => { el.hidden = true; };
  $('[data-replay]', el).onclick = () => { el.hidden = true; resetRace(); requestStart(); };
  $('[data-copy]', el).onclick = () => {
    const text = (race.result?.order || []).map((n, i) => `${i + 1}. ${n}`).join('\n');
    navigator.clipboard?.writeText(text)
      .then(() => toast('순위를 복사했습니다.'))
      .catch(() => toast('클립보드 권한을 확인해 주세요.'));
  };

  on('race:finished', ({ result }) => {
    $('[data-summary]', el).textContent = `${result.className} · ${result.trackName} · ${result.order.length}명 완주`;
    $('[data-list]', el).innerHTML = result.order
      .map((name, i) => `<div class="result-item">${medal(i)} <strong>${escapeHTML(name)}</strong></div>`).join('');
    el.hidden = false;
  });
  on('race:phase', ({ phase }) => { if (phase !== 'finished') el.hidden = true; });
}
