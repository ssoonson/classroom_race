// 상단 바: 반 이름 제목, 설정·전체화면 버튼
import { $ } from '../core/dom.js';
import { on } from '../core/events.js';
import { state } from '../core/store.js';
import { openSettings } from './actions.js';

export function mountTopbar(el) {
  el.innerHTML = `
    <div class="brand">
      <span class="brand-icon">✦</span>
      <div><strong data-heading></strong><small>RANDOM 3D CLASSROOM RACE</small></div>
    </div>
    <div class="top-actions">
      <button class="ghost" data-settings>⚙ 설정</button>
      <button class="ghost" data-fullscreen>⛶ 전체화면</button>
    </div>`;

  const render = () => {
    const title = `${state.className} 콩콩 달리기`;
    $('[data-heading]', el).textContent = title;
    document.title = title;
  };

  $('[data-settings]', el).onclick = () => openSettings();
  $('[data-fullscreen]', el).onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  on('state:changed', ({ keys }) => { if (keys.includes('className')) render(); });
  render();
}
