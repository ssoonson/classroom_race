// 오른쪽 패널: 카메라 모드 선택, 추적할 선수 선택
import { $, $$, escapeHTML } from '../core/dom.js';
import { on } from '../core/events.js';
import { CAMERA_MODES } from '../core/config.js';
import { race, setCameraMode, setFollow } from '../game/race.js';

const SHORT = { auto: '자동', overview: '전체', follow: '선수 추적' };

export function mountCameraPanel(el) {
  el.innerHTML = `
    <div class="panel-title"><strong>🎥 카메라</strong><span class="muted" data-mode-info></span></div>
    <div class="seg">${Object.keys(CAMERA_MODES).map((m) => `<button data-camera="${m}">${SHORT[m]}</button>`).join('')}</div>
    <label class="field-label" for="followSelect">추적할 선수 선택</label>
    <select id="followSelect"></select>`;

  const select = $('#followSelect', el);
  $$('[data-camera]', el).forEach((b) => { b.onclick = () => setCameraMode(b.dataset.camera); });
  select.onchange = () => setFollow(select.value);

  function renderMode() {
    $$('[data-camera]', el).forEach((b) => b.classList.toggle('active', b.dataset.camera === race.cameraMode));
    $('[data-mode-info]', el).textContent = CAMERA_MODES[race.cameraMode];
  }

  function renderFollow() {
    select.innerHTML = `<option value="">선수를 선택하세요</option>${race.runners
      .map((r) => `<option value="${escapeHTML(r.id)}">${escapeHTML(r.name)}</option>`).join('')}`;
    select.value = race.runners.some((r) => r.id === race.followId) ? race.followId : '';
  }

  on('camera:changed', () => { renderMode(); select.value = race.followId; });
  on('race:roster', renderFollow);
  renderMode();
  renderFollow();
}
