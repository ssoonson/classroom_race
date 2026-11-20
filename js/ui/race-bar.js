// 경기장 위 진행 바: 출발~결승 사이에 모든 선수를 색 점으로 표시. 선두는 이름표, 추적 중인 선수는 테두리.
// 학생들이 자기 위치를 바로 찾을 수 있게 합니다.
import { on } from '../core/events.js';
import { escapeHTML } from '../core/dom.js';
import { race, orderedRunners } from '../game/race.js';

export function mountRaceBar(el) {
  el.className = 'race-bar';
  el.hidden = true;
  el.innerHTML = '<span class="flag start">🏁</span><div class="lane" data-lane></div><span class="flag goal">🏆</span>';
  const lane = el.querySelector('[data-lane]');
  let dots = new Map();

  function build() {
    lane.innerHTML = race.runners.map((r) => `
      <i class="dot" data-id="${escapeHTML(r.id)}" style="--c:${r.color || '#fff'}" title="${escapeHTML(r.name)}"></i>`).join('')
      + '<b class="leader-tag" data-leader></b>';
    dots = new Map([...lane.querySelectorAll('.dot')].map((d) => [d.dataset.id, d]));
  }

  function render() {
    const showing = race.phase !== 'ready' && race.phase !== 'countdown';
    el.hidden = !showing;
    if (!showing) return;
    const order = orderedRunners();
    const leader = order[0];
    order.forEach((r, i) => {
      const d = dots.get(r.id);
      if (!d) return;
      d.style.left = `${(r.progress * 100).toFixed(2)}%`;
      d.style.zIndex = String(100 - i); // 앞선 선수가 위에
      d.classList.toggle('lead', r === leader);
      d.classList.toggle('follow', r.id === race.followId);
    });
    const tag = lane.querySelector('[data-leader]');
    if (leader && tag) {
      tag.textContent = `👑 ${leader.name}`;
      tag.style.left = `${(leader.progress * 100).toFixed(2)}%`;
    }
  }

  on('race:roster', () => { build(); render(); });
  on('race:tick', render);
  on('race:phase', render);
  on('camera:changed', render);
  build();
  render();
}
