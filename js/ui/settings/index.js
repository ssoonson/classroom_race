// 설정 창: 틀(제목·탭·하단 버튼)만 담당하고, 탭 내용은 tab-*.js 파일이 각자 그립니다.
// 탭을 추가하려면 tab-*.js 파일을 만들고(id, label, mount) 아래 TABS에 넣으세요.
import { $, $$ } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { isLive } from '../../game/race.js';
import * as students from './tab-students.js';
import * as participants from './tab-participants.js';
import * as groups from './tab-groups.js';
import * as history from './tab-history.js';
import * as display from './tab-display.js';

const TABS = [students, participants, groups, history, display];

export function mountSettings(el) {
  el.className = 'overlay';
  el.hidden = true;
  el.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="dialog-head">
        <h2 id="settingsTitle">⚙ 설정</h2>
        <button class="xbtn" data-close aria-label="닫기">×</button>
      </div>
      <nav class="tabs">${TABS.map((t) => `<button data-tab="${t.id}">${t.label}</button>`).join('')}</nav>
      <div class="dialog-content">${TABS.map((t) => `<section class="tab-content" data-panel="${t.id}" hidden></section>`).join('')}</div>
      <div class="dialog-footer">
        <span class="muted notice" data-live-notice></span>
        <button class="primary" data-close>설정 완료</button>
      </div>
    </div>`;

  TABS.forEach((t) => t.mount($(`[data-panel="${t.id}"]`, el)));

  let current = TABS[0].id;
  function select(id) {
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    current = tab.id;
    $$('[data-tab]', el).forEach((b) => b.classList.toggle('selected', b.dataset.tab === current));
    $$('[data-panel]', el).forEach((p) => { p.hidden = p.dataset.panel !== current; });
    tab.onShow?.();
  }

  function renderNotice() {
    $('[data-live-notice]', el).textContent = isLive()
      ? '경기 중입니다. 명단·참가선수·속도·캐릭터·트랙 변경은 다음 경기부터 적용됩니다.'
      : '';
  }

  const close = () => { el.hidden = true; };
  $$('[data-tab]', el).forEach((b) => { b.onclick = () => select(b.dataset.tab); });
  $$('[data-close]', el).forEach((b) => { b.onclick = close; });
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) close(); });

  on('settings:open', ({ tab }) => {
    el.hidden = false;
    select(tab || current);
    renderNotice();
  });
  on('race:phase', renderNotice);
  select(current);
}
