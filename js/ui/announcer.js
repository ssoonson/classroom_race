// 경기장 위 큰 알림: 3·2·1·GO!, 선두 교체, 구간 진입, 마지막 10초, 골인.
// 마지막 10초에는 경기장에 'final' 표시를 붙여 타이머가 빨갛게 깜빡이고 속도선이 나옵니다(CSS).
import { on } from '../core/events.js';
import { escapeHTML } from '../core/dom.js';
import { race } from '../game/race.js';
import { state } from '../core/store.js';

const MEDALS = ['🥇', '🥈', '🥉'];
// 높은 우선순위 알림이 떠 있는 동안에는 낮은 알림이 덮지 않습니다.
const PRIORITY = { stage: 1, leader: 2, final: 3, finisher: 4 };

export function mountAnnouncer(el, arena) {
  el.className = 'announcer';
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="countdown" data-count></div><div class="banner" data-banner></div><div class="speed-lines" aria-hidden="true"></div>';
  const count = el.querySelector('[data-count]');
  const banner = el.querySelector('[data-banner]');
  let bannerTimer, countTimer;
  let current = { priority: 0, until: 0 };

  function show(html, kind, ms = 1700) {
    const now = performance.now();
    const priority = PRIORITY[kind] || 1;
    if (now < current.until && priority < current.priority) return;
    current = { priority, until: now + ms };
    banner.innerHTML = html;
    banner.className = `banner show ${kind}`;
    void banner.offsetWidth; // 같은 알림이 연달아 와도 애니메이션 다시 시작
    banner.classList.add('pop');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.className = 'banner'; }, ms);
  }
  function bigCount(text) {
    count.textContent = text;
    count.className = 'countdown show';
    void count.offsetWidth;
    count.classList.add('pop');
    clearTimeout(countTimer);
    countTimer = setTimeout(() => { count.className = 'countdown'; }, 900);
  }

  on('race:countdown', ({ n }) => bigCount(String(n)));
  on('race:go', () => bigCount('GO!'));
  on('race:leader', ({ name }) => show(`<small>선두 교체!</small>🔥 ${escapeHTML(name)}`, 'leader'));
  on('race:stage', ({ label }) => {
    if (label && race.phase === 'running' && !label.includes('· 1/')) show(`<small>구간 진입</small>${escapeHTML(label.split(' · ')[0])}`, 'stage', 1500);
  });
  on('race:final', () => {
    arena.classList.toggle('calm', state.reducedMotion); // '카메라 움직임 줄이기'면 깜빡임·속도선 없이
    arena.classList.add('final');
    show('<small>막판 스퍼트!</small>⏰ 마지막 10초', 'final', 1800);
  });
  on('race:finisher', ({ rank, name }) => {
    if (rank <= 3) show(`<small>${rank}위 골인!</small>${MEDALS[rank - 1]} ${escapeHTML(name)}`, 'finisher', rank === 1 ? 2600 : 1600);
  });
  on('race:phase', ({ phase }) => {
    if (phase === 'ready' || phase === 'countdown') {
      arena.classList.remove('final');
      banner.className = 'banner';
      current = { priority: 0, until: 0 };
    }
    if (phase === 'finished') arena.classList.remove('final');
    arena.classList.toggle('paused', phase === 'paused');
  });
}
