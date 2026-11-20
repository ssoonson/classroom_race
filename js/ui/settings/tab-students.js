// 설정 > 학생 명단: 반 이름, 명단 입력, 번호 모드, 백업
import { $, escapeHTML, toast, download } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { MAX_STUDENTS, MIN_PLAYERS } from '../../core/config.js';
import {
  state, roster, setClassName, setNames, clearNames, setNumberCount, exportBackup, importBackup,
} from '../../core/store.js';

export const id = 'students';
export const label = '학생 명단';

export function mount(el) {
  el.innerHTML = `
    <h3>우리 반 이름</h3>
    <p class="help">첫 화면 제목에 반 이름이 표시됩니다.</p>
    <div class="inline">
      <input data-class-name placeholder="예: 6학년 3반" maxlength="80"/>
      <button class="yellow" data-save-class>반 이름 저장</button>
    </div>

    <h3>학생 이름 일괄 입력</h3>
    <p class="help">한 줄에 한 명씩 입력하거나 쉼표로 구분하세요. "1. 김민준", "2번 이서연"처럼 번호를 붙여도 됩니다.
      최대 ${MAX_STUDENTS}명이며, 이름이 같은 학생은 번호를 붙여 구분합니다. 명단은 이 브라우저에만 저장됩니다.</p>
    <textarea data-names rows="7" placeholder="김민준&#10;이서연&#10;박지후"></textarea>
    <div class="inline">
      <button class="yellow" data-save-names>명단 저장</button>
      <button data-clear-names>명단 비우기 (번호로 경기)</button>
      <label class="smallfield">번호 모드 인원 <input data-number-count type="number" min="${MIN_PLAYERS}" max="${MAX_STUDENTS}"/></label>
    </div>

    <h3>현재 명단 <span class="muted" data-count></span></h3>
    <div class="chips" data-chips></div>

    <h3>명단·기록 백업</h3>
    <p class="help">JSON 파일로 저장하거나 불러옵니다. 실명이 포함되어 있으므로 안전하게 보관하세요.</p>
    <div class="inline">
      <button class="yellow" data-export>내보내기</button>
      <button data-import>불러오기</button>
      <input type="file" data-import-file accept="application/json,.json" hidden/>
    </div>`;

  const q = (s) => $(s, el);

  function syncFields() {
    q('[data-class-name]').value = state.className;
    q('[data-names]').value = state.names.join('\n');
    q('[data-number-count]').value = state.numberCount;
  }

  function renderChips() {
    const list = roster();
    q('[data-count]').textContent = `${list.length}명`;
    q('[data-chips]').innerHTML = list
      .map((s) => `<span class="chip"><small>${s.index}</small> ${escapeHTML(s.name)}</span>`).join('');
  }

  q('[data-save-class]').onclick = () => { setClassName(q('[data-class-name]').value); toast('반 이름을 저장했습니다.'); };

  q('[data-save-names]').onclick = () => {
    const { count, truncated } = setNames(q('[data-names]').value);
    const hasDuplicates = new Set(state.names).size !== state.names.length;
    toast(truncated ? `앞에서부터 ${MAX_STUDENTS}명만 저장했습니다.`
      : `학생 명단을 저장했습니다. (${count}명${hasDuplicates ? ', 동명이인은 번호로 구분' : ''})`);
  };

  q('[data-clear-names]').onclick = () => {
    if (!confirm('이름 명단을 비우고 번호 모드로 바꾸시겠습니까?')) return;
    clearNames();
    toast('번호 모드로 전환했습니다.');
  };

  q('[data-number-count]').onchange = (e) => { e.target.value = setNumberCount(e.target.value); };

  q('[data-export]').onclick = () => download('classroom-race-backup.json', exportBackup());
  q('[data-import]').onclick = () => q('[data-import-file]').click();
  q('[data-import-file]').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      importBackup(JSON.parse(await file.text()));
      toast('백업을 불러왔습니다.');
    } catch (err) {
      alert('불러오기 실패: ' + (err instanceof SyntaxError ? 'JSON 파일이 아닙니다.' : err.message));
    }
  };

  on('state:changed', ({ keys }) => {
    if (keys.some((k) => ['className', 'names', 'numberCount'].includes(k))) syncFields();
    if (keys.some((k) => ['names', 'numberCount'].includes(k))) renderChips();
  });
  syncFields();
  renderChips();
}
