// ── 顶部筛选栏 ──
import { h, clear } from './utils/dom.js';
import { store } from './store.js';
import { loadIndex, loadLatest } from './data-loader.js';

const QUICK_RANGES = [30, 50, 100, 150, 300];

let idxCache = null;
let latestCache = null;

/** 当前最新实际开奖序号，避免年末生成不存在的下一期。 */
function currentIssueSeq() {
  return latestCache ? latestCache.latest_draw.issue.slice(4) : '001';
}

/** 仅生成当年真实存在该序号的期号，统计值必须与加载行数一致。 */
function defaultCompareIssues(seq) {
  if (!idxCache) return [];
  const sequence = Number(seq);
  const years = [...idxCache.years]
    .filter((item) => Number(item.count) >= sequence)
    .map((item) => Number(item.year))
    .sort((a, b) => a - b);
  return years.map((y) => `${y}${seq}`);
}

export async function mountFilterBar(root) {
  const [idx, latest] = await Promise.all([loadIndex(), loadLatest()]);
  idxCache = idx;
  latestCache = latest;
  const latestYear = idx.years[idx.years.length - 1].year;
  const defaultFilter = {
    mode: 'recent',
    recent: 50,
    year: latestYear,
    compareIssues: defaultCompareIssues(currentIssueSeq()),
  };
  // 默认状态：同期对比默认填入"未开奖最新一期"对应的所有历史同期
  if (!store.get('filter')) {
    store.set('filter', defaultFilter);
  }

  // 三个 Tab
  const tabs = h('div.filter-tabs', { role: 'tablist', 'aria-label': '筛选方式' }, [
    h('button.filter-tab', {
      type: 'button', role: 'tab', 'aria-controls': 'filter-panel', dataset: { mode: 'recent' },
    }, '近 N 期'),
    h('button.filter-tab', {
      type: 'button', role: 'tab', 'aria-controls': 'filter-panel', dataset: { mode: 'year' },
    }, '指定年份'),
    h('button.filter-tab', {
      type: 'button', role: 'tab', 'aria-controls': 'filter-panel', dataset: { mode: 'compare' },
    }, '同期对比'),
  ]);

  const panel = h('div.filter-panel', { id: 'filter-panel', role: 'tabpanel' });
  const reset = h('button.filter-reset', {
    type: 'button',
    'aria-label': '重置筛选条件',
  }, '重置');
  reset.addEventListener('click', () => store.set('filter', { ...defaultFilter }));

  root.appendChild(tabs);
  root.appendChild(panel);
  root.appendChild(reset);

  // 切换 Tab
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.filter-tab');
    if (!t) return;
    const mode = t.dataset.mode;
    const f = { ...store.get('filter'), mode };
    store.set('filter', f);
  });
  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const items = [...tabs.querySelectorAll('.filter-tab')];
    const current = items.indexOf(document.activeElement);
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + items.length) % items.length;
    if (event.key === 'ArrowRight') next = (current + 1) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    event.preventDefault();
    items[next].focus();
    items[next].click();
  });

  // 订阅刷新
  const refresh = () => {
    const f = store.get('filter');
    // 高亮 tab
    tabs.querySelectorAll('.filter-tab').forEach((el) => {
      const active = el.dataset.mode === f.mode;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', String(active));
    });
    // 渲染对应面板
    clear(panel);
    reset.disabled = f.mode === 'recent' && Number(f.recent) === 50;
    if (f.mode === 'recent') renderRecentPanel(panel, f);
    else if (f.mode === 'year') renderYearPanel(panel, f, idx);
    else if (f.mode === 'compare') renderComparePanel(panel, f);
  };

  store.subscribe((k) => { if (k === 'filter') refresh(); });
  refresh();
}

// ── 近 N 期 ──
// 改造为：下拉 select（与"指定年份"风格统一）+ 「自定义…」按钮 popover
// 折叠收益：从 6 个快捷按钮 + 输入框 + 应用 + hint（移动端两行 ~80px）
//          → 一个下拉 + 一个按钮（一行 ~30px），省 ~50px 屏高给走势图
function renderRecentPanel(panel, f) {
  const total = idxCache?.total || 3500;

  const label = h('span.filter-label', null, '范围：');
  const select = h('select.filter-select', { 'aria-label': '最近开奖期数范围' });

  // 预设档位（与原快捷按钮一致），加 "全部"
  for (const n of QUICK_RANGES) {
    const opt = h('option', { value: n }, `近 ${n} 期`);
    if (f.recent === n) opt.selected = true;
    select.appendChild(opt);
  }
  const optAll = h('option', { value: total }, `全部 ${total} 期`);
  if (f.recent >= total) optAll.selected = true;
  select.appendChild(optAll);

  // 如果当前 recent 不在预设档位，加一个"自定义 N 期"项并选中
  const presets = new Set([...QUICK_RANGES, total]);
  if (!presets.has(f.recent)) {
    const optCustom = h('option', { value: f.recent }, `自定义 ${f.recent} 期`);
    optCustom.selected = true;
    select.appendChild(optCustom);
  }

  select.addEventListener('change', () => {
    const v = parseInt(select.value, 10);
    store.set('filter', { ...f, mode: 'recent', recent: v });
  });

  // 「自定义…」按钮：点击展开 popover 输入框
  const customBtn = h('button.btn-ghost.btn-custom', { type: 'button' }, '自定义…');
  customBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCustomPopover(customBtn, f, total);
  });

  panel.appendChild(label);
  panel.appendChild(select);
  panel.appendChild(customBtn);
}

/** 自定义期数 popover：浮在按钮下方，点外侧/Esc/应用后关闭 */
function openCustomPopover(anchor, f, total) {
  // 移除可能残留的旧 popover
  document.querySelectorAll('.custom-popover').forEach((el) => el.remove());

  const input = h('input.filter-input', {
    type: 'number',
    min: 1,
    max: total,
    value: f.recent,
    placeholder: `1 - ${total}`,
    'aria-label': '自定义最近期数',
  });
  const apply = h('button.btn-apply', { type: 'button' }, '应用');
  const hint = h('span.filter-hint', null, `共 ${total} 期`);

  const pop = h('div.custom-popover', null, [
    h('div.custom-popover-row', null, [input, apply]),
    hint,
  ]);

  // 绝对定位到按钮下方
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 220))}px`;

  // 自动 focus + 全选
  setTimeout(() => { input.focus(); input.select(); }, 0);

  const close = () => {
    pop.remove();
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey);
  };
  const onDocClick = (e) => {
    if (!pop.contains(e.target) && e.target !== anchor) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') apply.click();
  };
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKey);

  apply.addEventListener('click', () => {
    let v = parseInt(input.value, 10);
    if (!Number.isFinite(v) || v < 1) v = total;
    if (v > total) v = total;
    store.set('filter', { ...f, mode: 'recent', recent: v });
    close();
  });
}

// ── 指定年份 ──
function renderYearPanel(panel, f, idx) {
  const label = h('span.filter-label', null, '选择年份：');
  const select = h('select.filter-select', { 'aria-label': '选择开奖年份' });
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

// ── 同期对比：展示当前对齐期号与可匹配年份数 ──
function renderComparePanel(panel, f) {
  const issues = f.compareIssues || [];
  const maxSeq = Math.max(...(idxCache?.years || []).map((item) => Number(item.count)), 1);
  const seq = issues[0] ? String(issues[0]).slice(4) : '001';
  const matched = issues.length;
  const select = h('select.filter-select', { 'aria-label': '选择跨年同期期号' });
  for (let number = 1; number <= maxSeq; number++) {
    const value = String(number).padStart(3, '0');
    const option = h('option', { value }, `同期 ${value}`);
    if (value === seq) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    const selected = select.value;
    store.set('filter', {
      ...f,
      mode: 'compare',
      compareIssues: defaultCompareIssues(selected),
    });
  });
  panel.appendChild(select);
  panel.appendChild(h('div.compare-summary', null, [
    h('span.compare-badge', null, `第 ${seq} 期`),
    h('span', null, `对齐 ${matched} 个历史年份的同期开奖`),
  ]));
}
