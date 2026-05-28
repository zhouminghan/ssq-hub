// ── 期号 / 日期 / 结构特征 ──
export const pad2 = (n) => String(n).padStart(2, '0');

/** 期号 → 年份（"2024055" → "2024"） */
export const issueYear = (issue) => String(issue).slice(0, 4);
/** 期号 → 期内序号（"2024055" → "055"） */
export const issueSeq = (issue) => String(issue).slice(4);
/** 期号格式化为 YYYY-NNN */
export const fmtIssue = (issue) => `${issueYear(issue)}-${issueSeq(issue)}`;

/** 红球范围 1..33 内的质数集合 */
const RED_PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);

/** 计算红球结构特征（和值 / 奇偶 / 大小 / 三区分布 / 质合） */
export function structure(red) {
  const sum = red.reduce((a, b) => a + b, 0);
  const odd = red.filter((n) => n % 2 === 1).length;
  const even = 6 - odd;
  const small = red.filter((n) => n <= 16).length;
  const big = 6 - small;
  const prime = red.filter((n) => RED_PRIMES.has(n)).length;
  const composite = 6 - prime;
  const z1 = red.filter((n) => n <= 11).length;
  const z2 = red.filter((n) => n >= 12 && n <= 22).length;
  const z3 = red.filter((n) => n >= 23 && n <= 33).length;
  return {
    sum, odd, even, small, big, prime, composite,
    zone: `${z1}:${z2}:${z3}`, z1, z2, z3,
  };
}

/** 防抖 */
export function debounce(fn, wait = 100) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** rAF 节流 */
export function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs;
  return function (...args) {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn.apply(this, lastArgs);
    });
  };
}
