// ── 期号 / 日期 / 结构特征 ──
export const pad2 = (n) => String(n).padStart(2, '0');

/** 期号 → 年份（"2024055" → "2024"） */
export const issueYear = (issue) => String(issue).slice(0, 4);
/** 期号 → 期内序号（"2024055" → "055"） */
export const issueSeq = (issue) => String(issue).slice(4);
/** 期号格式化为 YYYY-NNN */
export const fmtIssue = (issue) => `${issueYear(issue)}-${issueSeq(issue)}`;

/**
 * 推算下一期期号，处理跨年进位
 * @param {string} latestIssue  最新已开期号，如 "2025158"
 * @param {Object} idx          history_index.json 内容
 * @returns {string}            7 位下期期号
 *
 * 规则：
 * - 若 latest 序号 < 当年总期数（count）→ 同年序号 + 1（保险，理论不会发生）
 * - 若 latest 序号 == 当年总期数 → 视为今年最后一期，下期为下一年 001
 *   （仅当 idx.years 已收录次年时进位；否则保守同年 +1，等下次抓取自然纠正）
 * - 若 latest 序号 > count（index 还没刷新）→ 同年 +1 兜底
 */
export function nextIssue(latestIssue, idx) {
  const year = issueYear(latestIssue);
  const seq = Number(issueSeq(latestIssue));
  const yearEntry = idx?.years?.find((y) => String(y.year) === year);
  const count = yearEntry?.count ?? Infinity;

  if (seq >= count) {
    const nextYear = String(Number(year) + 1);
    const hasNextYear = idx?.years?.some((y) => String(y.year) === nextYear);
    if (hasNextYear) return `${nextYear}001`;
    // 次年还没数据：保守用同年 +1，下次刷新自然纠正
  }
  return `${year}${String(seq + 1).padStart(3, '0')}`;
}

/**
 * 推算下一期开奖日期，考虑春节等特殊节假日停售
 * @param {string} latestDate 最新开奖日期，格式 "YYYY-MM-DD"
 * @returns {string} 下期开奖日期，格式 "YYYY-MM-DD"
 */
export function nextDrawDate(latestDate) {
  // 用本地 midnight 解析，避免 `new Date('YYYY-MM-DD')` 解析为 UTC midnight
  // 导致非 UTC+8 时区 getDate()/getDay() 差一天
  const [y, m, d] = latestDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  // 双色球开奖规律：周二、周四、周日
  const nextDay = new Date(y, m - 1, d);
  
  // 计算下一个开奖日
  const dayOfWeek = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
  
  if (dayOfWeek === 0) { // 周日 → 周二
    nextDay.setDate(date.getDate() + 2);
  } else if (dayOfWeek === 2) { // 周二 → 周四
    nextDay.setDate(date.getDate() + 2);
  } else if (dayOfWeek === 4) { // 周四 → 周日
    nextDay.setDate(date.getDate() + 3);
  } else {
    // 如果不是开奖日，找到下一个开奖日
    if (dayOfWeek === 1) nextDay.setDate(date.getDate() + 1); // 周一 → 周二
    else if (dayOfWeek === 3) nextDay.setDate(date.getDate() + 1); // 周三 → 周四
    else if (dayOfWeek === 5) nextDay.setDate(date.getDate() + 2); // 周五 → 周日
    else if (dayOfWeek === 6) nextDay.setDate(date.getDate() + 1); // 周六 → 周日
  }
  
  // 直接返回下一个开奖日，不做节假日停售判断。
  // 节假日期间显示可能偏差 3-10 天，属"预估"语义的正常误差，
  // 数据源会在开奖日自动更新，无需硬编码维护农历/国庆停售表。
  return formatDate(nextDay);
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 红球范围 1..33 内的质数集合 */
const RED_PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);

/** 计算红球结构特征（和值 / 跨度 / 奇偶 / 大小 / 三区分布 / 质合 / 各类形态） */
export function structure(red) {
  const sorted = [...red].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const span = sorted[sorted.length - 1] - sorted[0]; // 跨度：最大 - 最小

  const odd = sorted.filter((n) => n % 2 === 1).length;
  const even = 6 - odd;
  const small = sorted.filter((n) => n <= 16).length;
  const big = 6 - small;
  const prime = sorted.filter((n) => RED_PRIMES.has(n)).length;
  const composite = 6 - prime;
  const z1 = sorted.filter((n) => n <= 11).length;
  const z2 = sorted.filter((n) => n >= 12 && n <= 22).length;
  const z3 = sorted.filter((n) => n >= 23 && n <= 33).length;

  // 形态：按号码升序排列后的逐位类型串（如 "小小小大大大"、"奇偶奇奇偶奇"、"质合合质合合"）
  const bigSmallShape = sorted.map((n) => (n <= 16 ? '小' : '大')).join('');
  const oddEvenShape = sorted.map((n) => (n % 2 === 1 ? '奇' : '偶')).join('');
  const primeShape = sorted.map((n) => (RED_PRIMES.has(n) ? '质' : '合')).join('');

  return {
    sum, span,
    odd, even, small, big, prime, composite,
    zone: `${z1}:${z2}:${z3}`, z1, z2, z3,
    bigSmallShape, oddEvenShape, primeShape,
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
