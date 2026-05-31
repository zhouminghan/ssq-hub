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

/**
 * ── 策略机选 ──
 * 注意：这只是不同的"加权随机抽样策略"，不是预测、不是推荐。
 * 历史频次/遗漏对未来期号在数学上没有任何预测能力。
 * 这里的策略只是给"模拟选号"提供更多玩法，让用户能按个人偏好生成一组号。
 *
 * 支持的策略：
 *   - 'uniform'           均匀随机（与 randomPick 等价）
 *   - 'cold'              偏冷号（近 100 期出现少的红/蓝优先）
 *   - 'hot'               偏热号（近 100 期出现多的红/蓝优先）
 *   - 'bigmiss'           偏长遗漏（当前遗漏越大权重越高）
 *   - 'zonebalanced'      三区均衡（红球 1-11/12-22/23-33 各取 2 个）
 *   - 'oddevenbalanced'   奇偶均衡（红球强制 3:3）
 */
export const STRATEGIES = [
  { id: 'uniform', label: '均匀随机', desc: '完全随机' },
  { id: 'cold', label: '偏冷号', desc: '近 100 期少出号优先' },
  { id: 'hot', label: '偏热号', desc: '近 100 期多出号优先' },
  { id: 'bigmiss', label: '大遗漏', desc: '当前遗漏越大权重越高' },
  { id: 'zonebalanced', label: '三区均衡', desc: '红球 1-11/12-22/23-33 各 2 个' },
  { id: 'oddevenbalanced', label: '奇偶均衡', desc: '红球强制 3 奇 3 偶' },
];

/** 加权随机：从 candidates 里按 weights[i] 抽 1 个（不放回，调用方自己 splice） */
function weightedPickOne(candidates, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    return Math.floor(Math.random() * candidates.length);
  }
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return candidates.length - 1;
}

/**
 * 按权重表抽 k 个（不放回）
 * @param {number[]} pool   候选池（如 [1..33]）
 * @param {Object<number, number>} weightMap  pool 中每个数字的权重，缺省按 1
 * @param {number} k        抽几个
 */
function sampleWithoutReplacement(pool, weightMap, k) {
  const cands = [...pool];
  const weights = cands.map((n) => Math.max(0, weightMap[n] ?? 1));
  const out = [];
  for (let i = 0; i < k && cands.length > 0; i++) {
    const idx = weightedPickOne(cands, weights);
    out.push(cands[idx]);
    cands.splice(idx, 1);
    weights.splice(idx, 1);
  }
  return out;
}

/**
 * 把 stats 转换成"权重表"
 *
 * 设计原则：所有策略权重必须 > 0，避免某个号永远抽不到（用户体验 + 防黑洞）
 * 用 (1 + value) 形式让权重平滑，最小为 1
 */
function buildWeightMaps(stats, strategy) {
  // 默认所有数字权重 = 1（即均匀随机）
  const redW = {};
  const blueW = {};
  for (let n = 1; n <= RED_MAX; n++) redW[n] = 1;
  for (let n = 1; n <= BLUE_MAX; n++) blueW[n] = 1;

  if (!stats || strategy === 'uniform') return { redW, blueW };

  const rpn = stats.red_per_number || {};
  const bpn = stats.blue_per_number || {};
  const pad = (n) => String(n).padStart(2, '0');

  if (strategy === 'hot') {
    for (let n = 1; n <= RED_MAX; n++) {
      redW[n] = 1 + (rpn[pad(n)]?.freq_100 ?? 0);
    }
    for (let n = 1; n <= BLUE_MAX; n++) {
      blueW[n] = 1 + (bpn[pad(n)]?.freq_100 ?? 0);
    }
  } else if (strategy === 'cold') {
    // 反向：用 (max - freq + 1) 让冷号权重高
    let maxR = 0, maxB = 0;
    for (let n = 1; n <= RED_MAX; n++) {
      maxR = Math.max(maxR, rpn[pad(n)]?.freq_100 ?? 0);
    }
    for (let n = 1; n <= BLUE_MAX; n++) {
      maxB = Math.max(maxB, bpn[pad(n)]?.freq_100 ?? 0);
    }
    for (let n = 1; n <= RED_MAX; n++) {
      redW[n] = 1 + (maxR - (rpn[pad(n)]?.freq_100 ?? 0));
    }
    for (let n = 1; n <= BLUE_MAX; n++) {
      blueW[n] = 1 + (maxB - (bpn[pad(n)]?.freq_100 ?? 0));
    }
  } else if (strategy === 'bigmiss') {
    for (let n = 1; n <= RED_MAX; n++) {
      redW[n] = 1 + (rpn[pad(n)]?.current_miss ?? 0);
    }
    for (let n = 1; n <= BLUE_MAX; n++) {
      blueW[n] = 1 + (bpn[pad(n)]?.current_miss ?? 0);
    }
  }
  // zonebalanced / oddevenbalanced 在 pickRedByStrategy 里直接控制结构，
  // 不在权重层处理，所以这里返回 1:1 的 baseline 即可
  return { redW, blueW };
}

/**
 * 按策略生成红球 6 个
 * 大多数策略走 weightMap；zonebalanced / oddevenbalanced 强制结构
 */
function pickRedByStrategy(strategy, redW) {
  if (strategy === 'zonebalanced') {
    // 三区各 2 个
    const z1 = []; for (let n = 1; n <= 11; n++) z1.push(n);
    const z2 = []; for (let n = 12; n <= 22; n++) z2.push(n);
    const z3 = []; for (let n = 23; n <= 33; n++) z3.push(n);
    return [
      ...sampleWithoutReplacement(z1, redW, 2),
      ...sampleWithoutReplacement(z2, redW, 2),
      ...sampleWithoutReplacement(z3, redW, 2),
    ].sort((a, b) => a - b);
  }
  if (strategy === 'oddevenbalanced') {
    const odds = [], evens = [];
    for (let n = 1; n <= RED_MAX; n++) {
      (n % 2 === 1 ? odds : evens).push(n);
    }
    return [
      ...sampleWithoutReplacement(odds, redW, 3),
      ...sampleWithoutReplacement(evens, redW, 3),
    ].sort((a, b) => a - b);
  }
  // uniform / hot / cold / bigmiss
  const pool = [];
  for (let n = 1; n <= RED_MAX; n++) pool.push(n);
  return sampleWithoutReplacement(pool, redW, RED_PICK).sort((a, b) => a - b);
}

function pickBlueByStrategy(blueW) {
  const pool = [];
  for (let n = 1; n <= BLUE_MAX; n++) pool.push(n);
  return sampleWithoutReplacement(pool, blueW, BLUE_PICK)[0];
}

/**
 * 按指定策略生成 N 注（去重）
 * @param {number} n 注数
 * @param {string} strategy 策略 id（见 STRATEGIES）
 * @param {Object} stats stats.json 数据；为空则退化为均匀随机
 */
export function randomPickByStrategy(n, strategy, stats) {
  // 不认识的策略 → 退回 uniform
  const known = STRATEGIES.some((s) => s.id === strategy);
  const strat = known ? strategy : 'uniform';
  const { redW, blueW } = buildWeightMaps(stats, strat);

  const seen = new Set();
  const result = [];
  let guard = 0;
  while (result.length < n && guard < n * 80) {
    guard++;
    const red = pickRedByStrategy(strat, redW);
    const blue = pickBlueByStrategy(blueW);
    if (red.length !== RED_PICK || new Set(red).size !== RED_PICK) continue;
    const key = red.join(',') + '|' + blue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ red, blue });
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
