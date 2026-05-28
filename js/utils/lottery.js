// ── 选号工具 ──
export const RED_MAX = 33;
export const BLUE_MAX = 16;
export const RED_PICK = 6;
export const BLUE_PICK = 1;
export const PRICE_PER_BET = 2;

/** 均匀随机生成一注合法投注 */
export function randomPick() {
  const reds = new Set();
  while (reds.size < RED_PICK) {
    reds.add(1 + Math.floor(Math.random() * RED_MAX));
  }
  return {
    red: Array.from(reds).sort((a, b) => a - b),
    blue: 1 + Math.floor(Math.random() * BLUE_MAX),
  };
}

/** 机选 N 注，去重保证 N 注互不相同 */
export function randomPickMany(n) {
  const seen = new Set();
  const result = [];
  let guard = 0;
  while (result.length < n && guard < n * 50) {
    guard++;
    const p = randomPick();
    const key = p.red.join(',') + '|' + p.blue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }
  return result;
}

/** 校验一注合法性 */
export function isValidPick(pick) {
  if (!pick || !Array.isArray(pick.red)) return false;
  if (pick.red.length !== RED_PICK) return false;
  if (new Set(pick.red).size !== RED_PICK) return false;
  if (pick.red.some((n) => n < 1 || n > RED_MAX)) return false;
  if (typeof pick.blue !== 'number' || pick.blue < 1 || pick.blue > BLUE_MAX) return false;
  return true;
}

/** 格式化为字符串："01 02 ... | 07" */
export function fmtPick(pick) {
  const r = pick.red.map((n) => String(n).padStart(2, '0')).join(' ');
  const b = String(pick.blue).padStart(2, '0');
  return `${r} | ${b}`;
}
