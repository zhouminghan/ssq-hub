// ── 数据加载层（按年份 LRU 缓存 + CDN 兜底） ──
//
// 数据源策略（按顺序回退）：
//   1) 同源相对路径 `./data/...`     ← GitHub Pages 主路径
//   2) jsDelivr CDN 镜像             ← 国内访问 GitHub Pages 偶尔被墙时兜底
//
// 仅当主路径 fetch 抛错（网络层失败 / 4xx / 5xx）才切到 CDN，
// 成功后整页 session 内"主源是否健康"会被记录，避免每次都 retry 主源。
const DATA_BASE = './data';

// jsDelivr CDN 镜像（GitHub raw 内容，cache 12h）
// 触发场景：用户在 GitHub Pages 被墙时，浏览器加载 index.html 用的是
// Pages 域名（已成功），但 fetch 自己的 data/*.json 偶尔会因为 CDN 节点问题失败
// 这里给一个稳定备份：jsdelivr 用的是 GitHub raw + 它自己的全球 CDN
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/zhouminghan/ssq-hub@main/web/data';

const yearCache = new Map(); // year -> draws[]
let indexCache = null;
let latestCache = null;
let statsCache = null;

// 主源是否健康：null=未试过 / true=用主源 / false=已退化到 CDN
// 只在首次失败时切换；切换后整 session 都用 CDN，避免反复试探
let primaryHealthy = null;

/**
 * 取一个相对路径（如 'history_index.json' / 'history/2026.json'），
 * 自动选用主源或 CDN 拼成完整 URL
 */
function resolveUrl(relPath) {
  const base = primaryHealthy === false ? CDN_BASE : DATA_BASE;
  return `${base}/${relPath}`;
}

async function fetchJson(relPath, cacheBuster) {
  // 主源：相对路径 fetch（cache: 'no-cache' 避免部署后 24h 浏览器命中旧版）
  if (primaryHealthy !== false) {
    try {
      const url = cacheBuster ? `${DATA_BASE}/${relPath}?v=${cacheBuster}` : `${DATA_BASE}/${relPath}`;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      primaryHealthy = true;
      return await res.json();
    } catch (err) {
      // 仅在第一次失败时打印，避免后续 N 次 fetch 都刷一遍 console
      if (primaryHealthy !== false) {
        console.warn(
          `[data-loader] 主源 ${DATA_BASE}/${relPath} 失败（${err.message}），`
          + `本 session 后续请求改走 CDN：${CDN_BASE}`,
        );
      }
      primaryHealthy = false;
    }
  }

  // CDN 兜底（jsDelivr 自带 CDN，无需 cache-buster；Pages 部署后最多 12h 同步延迟可接受）
  const cdnUrl = `${CDN_BASE}/${relPath}`;
  const res = await fetch(cdnUrl);
  if (!res.ok) throw new Error(`fetch ${cdnUrl} failed: ${res.status}`);
  return res.json();
}

/** 加载 history_index.json */
export async function loadIndex(cacheBuster) {
  if (indexCache && !cacheBuster) return indexCache;
  indexCache = await fetchJson('history_index.json', cacheBuster);
  return indexCache;
}

/** 加载某年的全部开奖数据 */
export async function loadYear(year) {
  const y = String(year);
  if (yearCache.has(y)) return yearCache.get(y);
  const draws = await fetchJson(`history/${y}.json`);
  yearCache.set(y, draws);
  return draws;
}

/** 加载 latest.json */
export async function loadLatest(cacheBuster) {
  if (latestCache && !cacheBuster) return latestCache;
  latestCache = await fetchJson('latest.json', cacheBuster);
  return latestCache;
}

/** 加载 stats.json（每号画像 + 全局/近 N 频次/遗漏） */
export async function loadStats() {
  if (statsCache) return statsCache;
  statsCache = await fetchJson('stats.json');
  return statsCache;
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
