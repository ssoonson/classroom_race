// Web Crypto 기반, 편향 없는 Fisher–Yates 셔플.
// 거부 샘플링으로 모듈로 편향을 없앱니다. 경기 순위의 공정성은 전부 이 함수에 달려 있습니다.

export function shuffle(items) {
  const a = [...items];
  const r = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    const range = 0x100000000;
    const limit = range - (range % (i + 1));
    do crypto.getRandomValues(r); while (r[0] >= limit);
    const j = r[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
