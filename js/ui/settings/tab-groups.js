// 설정 > 모둠 나누기 (경기 순위와 무관)
import { $, escapeHTML, toast } from '../../core/dom.js';
import { shuffle } from '../../core/random.js';
import { participants } from '../../core/store.js';

export const id = 'groups';
export const label = '모둠 나누기';

export function mount(el) {
  el.innerHTML = `
    <h3>모둠 나누기</h3>
    <p class="help">현재 참가선수를 무작위로 나눕니다. 게임 순위에는 영향을 주지 않습니다.</p>
    <div class="inline">
      <label class="smallfield">모둠 수 <input data-count type="number" min="2" max="20" value="5"/></label>
      <button class="yellow" data-make>모둠 무작위 생성</button>
    </div>
    <div class="group-grid" data-result></div>`;

  $('[data-make]', el).onclick = () => {
    const chosen = participants();
    if (chosen.length < 2) return toast('모둠을 나누려면 참가선수가 2명 이상 필요합니다.');
    const wanted = Math.max(2, Math.min(20, Number($('[data-count]', el).value) || 5));
    const count = Math.min(chosen.length, wanted); // 빈 모둠이 생기지 않게
    const groups = Array.from({ length: count }, () => []);
    shuffle(chosen).forEach((s, i) => groups[i % count].push(s.name));
    $('[data-result]', el).innerHTML = groups.map((g, i) => `
      <div class="group-item"><strong>🌟 ${i + 1}모둠</strong>${g.map((n) => `<p>${escapeHTML(n)}</p>`).join('')}</div>`).join('');
  };
}
