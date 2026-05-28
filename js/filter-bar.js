// ── 顶部筛选栏 ──
import { h, clear } from './utils/dom.js';
import { store } from './store.js';
import { loadIndex, loadLatest } from './data-loader.js';

const QUICK_RANGES = [30, 50, 100, 150, 300];

let idxCache = null;
let latestCache = null;

/**
 * 计算"未开奖的下一期"序号（用于同期对比默认值）
 * @returns {string} 3 位序号，如 "059"
 */
function nextIssueSeq() {
  if (!latestCache) return '055';
  const cur = latestCache.latest_draw.issue;
  const next = String(Number(cur) + 1).padStart(7, '0');
  return next.slice(4);
}

/** 基于 idx 所有年份 + 给定 seq，生成默认同期对比期号列表 */
function defaultCompareIssues(seq) {
  if (!idxCache) return [];
  const years = [...idxCache.years]
    .map((y) => Number(y.year))
    .sort((a, b) => a - b);
  return years.map((y) => `${y}${seq}`);
}

export async function mountFilterBar(root) {
  const [idx, latest] = await Promise.all([loadIndex(), loadLatest()]);
  idxCache = idx;
  latestCache = latest;
  // 默认状态：同期对比默认填入"未开奖最新一期"对应的所有历史同期
  if (!store.get('filter')) {
    const defaultIssues = defaultCompareIssues(nextIssueSeq());
    store.set('filter', {
      mode: 'recent',
      recent: 100,
      year: idx.years[idx.years.length - 1].year,
      compareIssues: defaultIssues,
    });
  }

  // 三个 Tab
  const tabs = h('div.filter-tabs', null, [
    h('button.filter-tab', { dataset: { mode: 'recent' } }, '近 N 期'),
    h('button.filter-tab', { dataset: { mode: 'year' } }, '指定年份'),
    h('button.filter-tab', { dataset: { mode: 'compare' } }, '同期对比'),
  ]);

  const panel = h('div.filter-panel');

  root.appendChild(tabs);
  root.appendChild(panel);

  // 切换 Tab
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.filter-tab');
    if (!t) return;
    const mode = t.dataset.mode;
    const f = { ...store.get('filter'), mode };
    store.set('filter', f);
  });

  // 订阅刷新
  const refresh = () => {
    const f = store.get('filter');
    // 高亮 tab
    tabs.querySelectorAll('.filter-tab').forEach((el) => {
      el.classList.toggle('active', el.dataset.mode === f.mode);
    });
    // 渲染对应面板
    clear(panel);
    if (f.mode === 'recent') renderRecentPanel(panel, f);
    else if (f.mode === 'year') renderYearPanel(panel, f, idx);
    else if (f.mode === 'compare') renderComparePanel(panel, f);
  };

  store.subscribe((k) => { if (k === 'filter') refresh(); });
  refresh();
}

// ── 近 N 期 ──
function renderRecentPanel(panel, f) {
  const total = idxCache?.total || 3500;

  const quick = h('div.quick-btns');
  for (const n of QUICK_RANGES) {
    const btn = h('button.quick-btn', { dataset: { n } }, `近 ${n} 期`);
    if (f.recent === n) btn.classList.add('active');
    btn.addEventListener('click', () => {
      store.set('filter', { ...f, mode: 'recent', recent: n });
    });
    quick.appendChild(btn);
  }

  // "全部" 快捷
  const allBtn = h('button.quick-btn', { dataset: { n: total } }, `全部 ${total} 期`);
  if (f.recent >= total) allBtn.classList.add('active');
  allBtn.addEventListener('click', () => {
    store.set('filter', { ...f, mode: 'recent', recent: total });
  });
  quick.appendChild(allBtn);

  const customLabel = h('span.filter-label', null, '自定义：');
  // 以总期数为上限；超过自动 cap 为总期数（不报错，直接取所有期）
  const input = h('input.filter-input', {
    type: 'number',
    min: 1,
    max: total,
    value: f.recent,
    placeholder: `1 - ${total}`,
    title: `当前共 ${total} 期，超过将取全部`,
  });
  const hint = h('span.filter-hint', null, `共 ${total} 期`);

  const apply = h('button.btn-apply', null, '应用');
  apply.addEventListener('click', () => {
    let v = parseInt(input.value, 10);
    if (!Number.isFinite(v) || v < 1) v = total;       // 空/非法 → 默认全部
    if (v > total) v = total;                           // 超过总数 → cap 为全部
    input.value = v;                                    // 回填，让用户看到实际生效值
    store.set('filter', { ...f, mode: 'recent', recent: v });
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply.click(); });
  input.addEventListener('blur', () => {
    const v = parseInt(input.value, 10);
    if (Number.isFinite(v) && v > total) input.value = total;
  });

  panel.appendChild(quick);
  panel.appendChild(customLabel);
  panel.appendChild(input);
  panel.appendChild(apply);
  panel.appendChild(hint);
}

// ── 指定年份 ──
function renderYearPanel(panel, f, idx) {
  const label = h('span.filter-label', null, '选择年份：');
  const select = h('select.filter-select');
  // 从新到旧
  const yearsDesc = [...idx.years].sort((a, b) => Number(b.year) - Number(a.year));
  for (const y of yearsDesc) {
    const opt = h('option', { value: y.year }, `${y.year} 年（${y.count} 期）`);
    if (y.year === f.year) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    store.set('filter', { ...f, mode: 'year', year: select.value });
  });
  panel.appendChild(label);
  panel.appendChild(select);
}

// ── 同期对比：默认填入"未开奖最新一期"对应的所有历史同期，无任何二级展示 ──
function renderComparePanel(_panel, _f) {
  // 不展示任何筛选项 / 文案 / 提示；compareIssues 在 store 里依然会被 main.js 用于加载数据
}
