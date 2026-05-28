// ── 数据加载层（按年份 LRU 缓存） ──
const DATA_BASE = './data';
const yearCache = new Map(); // year -> draws[]
let indexCache = null;
let latestCache = null;

async function fetchJson(url) {
  // 加 cache-buster：deploy-pages 部署后 24h 内浏览器可能命中旧版
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.json();
}

/** 加载 history_index.json */
export async function loadIndex() {
  if (indexCache) return indexCache;
  indexCache = await fetchJson(`${DATA_BASE}/history_index.json`);
  return indexCache;
}

/** 加载某年的全部开奖数据 */
export async function loadYear(year) {
  const y = String(year);
  if (yearCache.has(y)) return yearCache.get(y);
  const draws = await fetchJson(`${DATA_BASE}/history/${y}.json`);
  yearCache.set(y, draws);
  return draws;
}

/** 加载 latest.json */
export async function loadLatest() {
  if (latestCache) return latestCache;
  latestCache = await fetchJson(`${DATA_BASE}/latest.json`);
  return latestCache;
}

/**
 * 加载最近 N 期：从最新年份倒着累积，直到凑够 N 期
 * 返回按时间升序排列的 draws[]
 */
export async function loadRecent(n) {
  const idx = await loadIndex();
  const yearsDesc = idx.years.map((y) => y.year).sort((a, b) => Number(b) - Number(a));
  const buckets = [];
  let total = 0;
  for (const y of yearsDesc) {
    const draws = await loadYear(y);
    buckets.unshift(draws);
    total += draws.length;
    if (total >= n) break;
  }
  const all = buckets.flat();
  return all.slice(-n);
}

/**
 * 按指定期号集合加载（用于同期对比）
 * issues: ["2023055", "2024055", ...]
 * 返回按 issue 升序的 draws[]，找不到的期号被忽略
 */
export async function loadIssues(issues) {
  const yearsNeeded = new Set(issues.map((i) => String(i).slice(0, 4)));
  const yearLoaded = await Promise.all(
    Array.from(yearsNeeded).map(async (y) => [y, await loadYear(y)]),
  );
  const map = new Map();
  for (const [, draws] of yearLoaded) {
    for (const d of draws) map.set(d.issue, d);
  }
  return issues
    .map((i) => map.get(String(i)))
    .filter(Boolean)
    .sort((a, b) => a.issue.localeCompare(b.issue));
}

/** 加载某年（以及所有可用期号）— 用于同期对比的"期号自动补全提示" */
export async function listAllIssues() {
  const idx = await loadIndex();
  const all = [];
  for (const y of idx.years.map((y) => y.year)) {
    const draws = await loadYear(y);
    for (const d of draws) all.push(d.issue);
  }
  return all;
}
