// 설정 > 순서 기록: 지난 경기 결과, CSV 내보내기
import { $, escapeHTML, download } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { state, clearHistory } from '../../core/store.js';

export const id = 'history';
export const label = '순서 기록';

function toCSV(history) {
  const rows = [['날짜', '반', '트랙', '속도', '순위', '학생']];
  history.forEach((h) => h.order.forEach((name, i) => rows.push([h.date, h.className, h.trackName, h.speed, i + 1, name])));
  // 엑셀에서 =, +, -, @로 시작하는 값이 수식으로 실행되지 않게 앞에 ' 를 붙임
  const cell = (v) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function mount(el) {
  el.innerHTML = `
    <h3>순서 기록</h3>
    <p class="help">이 브라우저에 저장된 최근 경기 결과입니다. 전체 기록을 JSON으로 백업할 수 있습니다.</p>
    <div class="inline">
      <button class="yellow" data-csv>결과 CSV 내보내기</button>
      <button data-clear>기록 비우기</button>
    </div>
    <div data-list></div>`;

  function render() {
    $('[data-list]', el).innerHTML = state.history.length
      ? state.history.map((h) => `
          <div class="history-item">
            <strong>${escapeHTML(h.className)} · ${escapeHTML(h.trackName)} · ${escapeHTML(h.speed)}배</strong>
            <span class="muted">${escapeHTML(h.date)} · 참가 ${h.order.length}명</span>
            <div>${h.order.map((x, j) => `${j + 1}. ${escapeHTML(x)}`).join('　')}</div>
          </div>`).join('')
      : '<div class="placeholder">아직 경기 기록이 없습니다.</div>';
  }

  $('[data-csv]', el).onclick = () => download('classroom-race-history.csv', toCSV(state.history), 'text/csv;charset=utf-8');
  $('[data-clear]', el).onclick = () => { if (confirm('경기 기록을 모두 삭제하시겠습니까?')) clearHistory(); };

  on('state:changed', ({ keys }) => { if (keys.includes('history')) render(); });
  render();
}
