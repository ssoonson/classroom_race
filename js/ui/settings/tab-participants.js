// 설정 > 참가선수: 이번 경기에 뛸 학생 선택
import { $, escapeHTML } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { MIN_PLAYERS } from '../../core/config.js';
import { state, roster, participants, setSelected, toggleSelected } from '../../core/store.js';

export const id = 'participants';
export const label = '참가선수';

export function mount(el) {
  el.innerHTML = `
    <h3>이번 경기 참가선수</h3>
    <p class="help">선택한 선수만 경기에 참가합니다. 최소 ${MIN_PLAYERS}명 이상 선택하세요.</p>
    <div class="inline">
      <button data-all>전체 선택</button>
      <button data-none>전체 해제</button>
      <span class="muted" data-count></span>
    </div>
    <div class="checkbox-grid" data-list></div>`;

  const list = $('[data-list]', el);

  function render() {
    const chosen = new Set(state.selected);
    $('[data-count]', el).textContent = `${participants().length}명 선택됨`;
    list.innerHTML = roster().map((s) => `
      <label><input type="checkbox" data-player="${s.id}" ${chosen.has(s.id) ? 'checked' : ''}/> ${escapeHTML(s.name)}</label>`).join('');
  }

  list.addEventListener('change', (e) => {
    const id = e.target.dataset.player;
    if (id) toggleSelected(id, e.target.checked);
  });
  $('[data-all]', el).onclick = () => setSelected(roster().map((s) => s.id));
  $('[data-none]', el).onclick = () => setSelected([]);

  on('state:changed', ({ keys }) => {
    if (keys.some((k) => ['names', 'numberCount', 'selected'].includes(k))) render();
  });
  render();
}
