// 명단·설정·기록 상태와 LocalStorage 저장, 백업 불러오기/내보내기.
// 상태를 바꿀 때는 반드시 이 파일의 함수를 사용하세요. 바뀌면 'state:changed' 이벤트가 나갑니다.
import {
  STORAGE_KEY, BACKUP_FORMAT, MAX_STUDENTS, MIN_PLAYERS, MAX_HISTORY, MAX_NAME_LENGTH,
  DEFAULT_STATE, TRACKS, CHARACTER_LABELS, SPEEDS, CAMERA_MODES, QUALITY_LABELS,
} from './config.js';
import { emit } from './events.js';

// ---------- 값 검증 (저장 데이터·백업 파일 모두 여기를 거칩니다) ----------
const clampCount = (n) => Math.min(MAX_STUDENTS, Math.max(MIN_PLAYERS, Number(n) || DEFAULT_STATE.numberCount));
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const cleanString = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanHistoryEntry(h) {
  if (!h || typeof h !== 'object' || !Array.isArray(h.order)) return null;
  const order = h.order.filter((x) => typeof x === 'string').map((x) => x.slice(0, MAX_NAME_LENGTH + 8));
  if (!order.length) return null;
  return {
    date: cleanString(h.date, 40),
    className: cleanString(h.className, 80),
    trackName: cleanString(h.trackName, 40),
    speed: oneOf(Number(h.speed), SPEEDS, 1),
    order,
  };
}

function sanitize(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    className: cleanString(d.className, 80) || DEFAULT_STATE.className,
    names: Array.isArray(d.names)
      ? d.names.map((x) => cleanString(x, MAX_NAME_LENGTH)).filter(Boolean).slice(0, MAX_STUDENTS)
      : [],
    selected: Array.isArray(d.selected) ? d.selected.filter((x) => typeof x === 'string') : [],
    numberCount: clampCount(d.numberCount),
    character: oneOf(d.character, Object.keys(CHARACTER_LABELS), DEFAULT_STATE.character),
    track: oneOf(d.track, Object.keys(TRACKS), DEFAULT_STATE.track),
    speed: oneOf(Number(d.speed), SPEEDS, DEFAULT_STATE.speed),
    camera: oneOf(d.camera, Object.keys(CAMERA_MODES), DEFAULT_STATE.camera),
    sound: typeof d.sound === 'boolean' ? d.sound : DEFAULT_STATE.sound,
    namesVisible: typeof d.namesVisible === 'boolean' ? d.namesVisible : DEFAULT_STATE.namesVisible,
    reducedMotion: typeof d.reducedMotion === 'boolean' ? d.reducedMotion : DEFAULT_STATE.reducedMotion,
    quality: oneOf(d.quality, Object.keys(QUALITY_LABELS), DEFAULT_STATE.quality),
    history: Array.isArray(d.history) ? d.history.map(cleanHistoryEntry).filter(Boolean).slice(0, MAX_HISTORY) : [],
  };
}

// ---------- 상태 ----------
let savedRaw = null;
try { savedRaw = localStorage.getItem(STORAGE_KEY); } catch { /* 저장소 사용 불가 */ }

/** 이 브라우저에 저장된 데이터가 없으면 true (첫 화면에서 명단 입력을 안내) */
export const isFirstVisit = !savedRaw;

function load() {
  try { return sanitize(JSON.parse(savedRaw || '{}')); }
  catch { return sanitize({}); }
}

export const state = load();
repairSelections();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

function commit(keys) {
  const ok = save();
  emit('state:changed', { keys, saveFailed: !ok });
  return ok;
}

/** 단순 설정값 변경 (트랙, 캐릭터, 속도, 카메라, 소리 등) */
export function setSetting(key, value) {
  const next = sanitize({ ...state, [key]: value });
  state[key] = next[key];
  return commit([key]);
}

// ---------- 명단 ----------
/**
 * 전체 명단. 이름 모드면 입력한 이름, 아니면 "1번, 2번 …".
 * 동명이인은 지우지 않고 화면용 이름 뒤에 번호를 붙여 구분합니다. 예) 김민준(3번)
 */
export function roster() {
  if (!state.names.length) {
    return Array.from({ length: state.numberCount }, (_, i) => ({ id: 'n' + i, name: `${i + 1}번`, index: i + 1 }));
  }
  const counts = {};
  state.names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
  return state.names.map((name, i) => ({
    id: 's' + i,
    name: counts[name] > 1 ? `${name}(${i + 1}번)` : name,
    index: i + 1,
  }));
}

export const participants = () => {
  const chosen = new Set(state.selected);
  return roster().filter((s) => chosen.has(s.id));
};

function repairSelections() {
  const valid = new Set(roster().map((s) => s.id));
  state.selected = state.selected.filter((id) => valid.has(id));
  if (!state.selected.length) state.selected = [...valid];
}

/**
 * "1. 김민준", "2번 이서연", "3) 박지후", "4 최수아" 처럼 앞에 붙은 번호를 떼어 냅니다.
 * 번호 뒤에 구분 기호나 공백이 있을 때만 떼므로 "3반장" 같은 이름은 그대로 둡니다.
 */
export function parseNames(raw) {
  const tokens = String(raw).split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
  const names = tokens
    .map((v) => v.replace(/^\d+\s*(?:[.\-:)]|번)\s*|^\d+\s+/, '').trim().slice(0, MAX_NAME_LENGTH))
    .filter(Boolean);
  return { names: names.slice(0, MAX_STUDENTS), truncated: names.length > MAX_STUDENTS };
}

export function setNames(raw) {
  const { names, truncated } = parseNames(raw);
  state.names = names;
  state.selected = roster().map((s) => s.id);
  commit(['names', 'selected']);
  return { count: names.length, truncated };
}

export function clearNames() {
  state.names = [];
  state.selected = [];
  repairSelections();
  commit(['names', 'selected']);
}

export function setNumberCount(n) {
  state.numberCount = clampCount(n);
  if (!state.names.length) { state.selected = []; repairSelections(); }
  commit(['numberCount', 'selected']);
  return state.numberCount;
}

export function setClassName(name) {
  state.className = cleanString(name, 80) || DEFAULT_STATE.className;
  commit(['className']);
}

export function setSelected(ids) {
  const valid = new Set(roster().map((s) => s.id));
  state.selected = ids.filter((id) => valid.has(id));
  commit(['selected']);
}

export function toggleSelected(id, on) {
  const set = new Set(state.selected);
  on ? set.add(id) : set.delete(id);
  setSelected([...set]);
}

// ---------- 기록 ----------
export function addHistory(entry) {
  const clean = cleanHistoryEntry(entry);
  if (!clean) return;
  state.history = [clean, ...state.history].slice(0, MAX_HISTORY);
  commit(['history']);
}

export function clearHistory() {
  state.history = [];
  commit(['history']);
}

// ---------- 백업 ----------
export const exportBackup = () => JSON.stringify({ format: BACKUP_FORMAT, ...state }, null, 2);

/** 백업 JSON을 검증해서 적용합니다. 형식이 틀리면 Error를 던집니다. */
export function importBackup(data) {
  if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.names) || !Array.isArray(data.history)) {
    throw new Error('지원하지 않는 백업 형식입니다.');
  }
  Object.assign(state, sanitize(data));
  repairSelections();
  commit(Object.keys(DEFAULT_STATE));
}
