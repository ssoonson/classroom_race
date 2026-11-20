// 설정 > 배경음악: 기본 음악 / 내 음악 파일 / 끄기, 음량, 미리 듣기
import { $, toast } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { BGM_LABELS } from '../../core/config.js';
import { state, setSetting } from '../../core/store.js';
import { saveBgmFile, clearBgmFile } from '../../core/media-store.js';
import { refreshBgmFile, bgmFile, startBgm, stopBgm, setBgmVolume, isBgmPlaying } from '../../core/bgm.js';
import { isLive } from '../../game/race.js';

export const id = 'music';
export const label = '배경음악';

const PREVIEW_SECONDS = 12;
const MAX_FILE_MB = 30;

/** 탭을 열 때마다 사이트의 audio/bgm.mp3가 새로 올라왔는지 확인 */
export const onShow = () => refreshBgmFile();

export function mount(el) {
  el.innerHTML = `
    <h3>배경음악</h3>
    <p class="help">경기가 출발하면 음악이 나오고, 마지막 10초에는 더 빨라집니다. 효과음은 ‘화면·소리’ 탭에서 켜고 끕니다.</p>
    <div class="control-grid">
      <label>음악 종류<select data-bgm>${Object.entries(BGM_LABELS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
      <label>음량 <span data-volume-text></span><input type="range" min="0" max="100" step="5" data-volume/></label>
    </div>
    <div class="inline">
      <button data-preview>▶ 미리 듣기</button>
    </div>

    <h3>내 음악 파일</h3>
    <p class="help" data-file-status></p>
    <div class="inline">
      <button class="yellow" data-pick>음악 파일 고르기</button>
      <button data-remove>고른 파일 지우기</button>
      <input type="file" data-file accept="audio/*,.mp3,.m4a,.ogg,.wav" hidden/>
    </div>
    <p class="help">
      · <b>이 컴퓨터에서만</b> 쓰려면: 위 버튼으로 파일을 고르세요. 이 브라우저에 보관되며 인터넷에 올라가지 않습니다.<br>
      · <b>어느 컴퓨터에서나</b> 같은 음악을 쓰려면: GitHub 저장소에 <code>audio/bgm.mp3</code> 이름으로 올리세요.<br>
      · 저작권: 수업용이라도 공유되는 사이트에 올리는 음악은 무료 이용이 허락된 곡(예: 유튜브 오디오 보관함, 공유마당 자유이용 음원)을 쓰세요.
    </p>`;

  const q = (s) => $(s, el);
  let previewTimer;

  function sync() {
    q('[data-bgm]').value = state.bgm;
    q('[data-volume]').value = state.bgmVolume;
    q('[data-volume-text]').textContent = `${state.bgmVolume}%`;
  }
  function renderFile() {
    const f = bgmFile();
    q('[data-file-status]').textContent = f.source === 'browser' ? `지금 파일: ${f.name} (이 브라우저에 보관됨)`
      : f.source === 'folder' ? `지금 파일: 사이트의 ${f.name}`
      : '아직 음악 파일이 없습니다. ‘내 음악 파일’을 골라도 파일이 없으면 기본 음악이 나옵니다.';
    q('[data-remove]').disabled = f.source !== 'browser';
  }
  function stopPreview() {
    clearTimeout(previewTimer);
    if (!isLive()) stopBgm(0.3);
    q('[data-preview]').textContent = '▶ 미리 듣기';
  }

  q('[data-bgm]').onchange = (e) => { setSetting('bgm', e.target.value); toast('배경음악 설정을 저장했습니다.'); };
  q('[data-volume]').oninput = (e) => {
    q('[data-volume-text]').textContent = `${e.target.value}%`;
    setBgmVolume(Number(e.target.value));
  };
  q('[data-volume]').onchange = (e) => setSetting('bgmVolume', Number(e.target.value));

  q('[data-preview]').onclick = () => {
    if (isLive()) return toast('경기 중에는 미리 듣기를 할 수 없습니다.');
    if (isBgmPlaying()) return stopPreview();
    if (state.bgm === 'off') return toast('음악 종류가 ‘끄기’로 되어 있습니다.');
    startBgm();
    q('[data-preview]').textContent = '■ 멈추기';
    previewTimer = setTimeout(stopPreview, PREVIEW_SECONDS * 1000);
  };

  q('[data-pick]').onclick = () => q('[data-file]').click();
  q('[data-file]').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) return toast('음악 파일(mp3, m4a, ogg, wav)을 골라 주세요.');
    if (file.size > MAX_FILE_MB * 1024 * 1024) return toast(`${MAX_FILE_MB}MB 이하의 파일을 골라 주세요.`);
    try {
      await saveBgmFile(file);
      await refreshBgmFile();
      setSetting('bgm', 'file');
      toast(`‘${file.name}’을(를) 배경음악으로 정했습니다.`);
    } catch {
      toast('파일을 보관하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
    }
  };
  q('[data-remove]').onclick = async () => {
    await clearBgmFile().catch(() => {});
    await refreshBgmFile();
    toast('고른 음악 파일을 지웠습니다.');
  };

  on('state:changed', ({ keys }) => { if (keys.includes('bgm') || keys.includes('bgmVolume')) sync(); });
  on('bgm:file', renderFile);
  on('race:phase', ({ phase }) => { if (phase === 'countdown') { clearTimeout(previewTimer); q('[data-preview]').textContent = '▶ 미리 듣기'; } });
  sync();
  renderFile();
}
