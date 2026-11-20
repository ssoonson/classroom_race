// 앱 전체에서 공유하는 상수. 트랙·캐릭터·속도를 추가할 때 이 파일부터 고치세요.

export const STORAGE_KEY = 'classroom-race-v1';
export const BACKUP_FORMAT = 'classroom-race-v1';

export const MAX_STUDENTS = 40;
export const MIN_PLAYERS = 2;
export const MAX_HISTORY = 100;
export const MAX_NAME_LENGTH = 30;
export const BASE_RACE_SECONDS = 60; // 1배속 경기 시간

export const TRACKS = {
  tour: { emoji: '🎡', name: '테마 투어' },            // 다섯 배경이 이어지는 곡선 코스 (기본)
  rainbow: { emoji: '🌈', name: '무지개 운동장' },
  space: { emoji: '🚀', name: '우주 스피드웨이' },
  ocean: { emoji: '🌊', name: '바다 산책로' },
};

export const CHARACTER_LABELS = {
  block: '라운드 블록 레이서',
  jelly: '젤리 헬멧 레이서',
};

export const SPEEDS = [1, 1.5, 2];

export const CAMERA_MODES = {
  auto: '자동 전환',
  overview: '전체 보기',
  follow: '선수 추적',
};

// 그래픽 품질. auto는 '높음'으로 시작해 경기 중 화면이 끊기면 스스로 한 단계씩 낮춥니다.
export const QUALITY_LABELS = {
  auto: '자동 (느리면 알아서 낮춤)',
  high: '높음 (선명 + 그림자)',
  medium: '보통 (그림자, 해상도 1배)',
  low: '낮음 (그림자 끔, 해상도 낮춤)',
};

export const DEFAULT_STATE = {
  className: '우리 반',
  names: [],
  selected: [],
  numberCount: 26,
  character: 'jelly',
  track: 'tour',
  speed: 1,
  camera: 'auto',
  sound: true,
  namesVisible: true,
  reducedMotion: false,
  quality: 'auto',
  history: [],
};

export const trackLabel = (id) => {
  const t = TRACKS[id] || TRACKS.tour;
  return `${t.emoji} ${t.name}`;
};

export const raceSeconds = (speed) => BASE_RACE_SECONDS / (SPEEDS.includes(speed) ? speed : 1);
