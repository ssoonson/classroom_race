// 설정 > 화면·소리: 캐릭터, 트랙, 속도, 카메라, 효과음, 이름표, 카메라 움직임
import { $, $$, toast } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { TRACKS, CHARACTER_LABELS, SPEEDS, CAMERA_MODES, QUALITY_LABELS, raceSeconds } from '../../core/config.js';
import { levelName } from '../../game/quality.js';
import { state, setSetting } from '../../core/store.js';
import { isLive } from '../../game/race.js';

export const id = 'display';
export const label = '화면·소리';

const options = (entries) => entries.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');

// [설정 키, 화면 이름, 선택지]  — 선택지를 늘리려면 core/config.js를 고치면 됩니다.
const SELECTS = [
  ['character', '캐릭터 스타일', Object.entries(CHARACTER_LABELS)],
  ['track', '트랙 선택', Object.entries(TRACKS).map(([k, t]) => [k, `${t.emoji} ${t.name}`])],
  ['speed', '게임 속도', SPEEDS.map((s) => [s, `${s}배 (${raceSeconds(s)}초)`])],
  ['camera', '카메라 기본 모드', Object.entries(CAMERA_MODES)],
  ['quality', '그래픽 품질', Object.entries(QUALITY_LABELS)],
];
const CHECKS = [
  ['sound', '게임 효과음 사용'],
  ['namesVisible', '캐릭터 이름표 표시'],
  ['reducedMotion', '카메라 움직임 줄이기'],
];
const NEXT_RACE_KEYS = ['character', 'track', 'speed'];

export function mount(el) {
  el.innerHTML = `
    <h3>화면·소리</h3>
    <div class="control-grid">
      ${SELECTS.map(([key, text, opts]) => `<label>${text}<select data-key="${key}">${options(opts)}</select></label>`).join('')}
    </div>
    <div class="checkbox-row">
      ${CHECKS.map(([key, text]) => `<label><input type="checkbox" data-key="${key}"/> ${text}</label>`).join('')}
    </div>
    <p class="help">설정은 즉시 저장됩니다. 테마 투어는 한 경기에서 다섯 배경이 이어지는 코스입니다. 경기 중에 속도·캐릭터·트랙을 바꾸면 다음 경기부터 적용됩니다.</p>
    <p class="help" data-quality-now></p>`;

  function sync() {
    $$('[data-key]', el).forEach((input) => {
      const v = state[input.dataset.key];
      if (input.type === 'checkbox') input.checked = v;
      else input.value = String(v);
    });
  }

  el.addEventListener('change', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    const raw = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSetting(key, key === 'speed' ? Number(raw) : raw);
    toast(isLive() && NEXT_RACE_KEYS.includes(key) ? '저장했습니다. 다음 경기부터 적용됩니다.' : '설정을 저장했습니다.');
  });

  on('state:changed', sync);
  on('quality:changed', ({ level, auto }) => {
    $('[data-quality-now]', el).textContent = `현재 그래픽 품질: ${levelName(level)}${auto ? ' (자동)' : ''}. 화면이 끊기면 '낮음'을 고르세요.`;
  });
  sync();
}
