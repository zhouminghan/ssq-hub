// ── 主入口：装配各模块 ──
import { qs } from './utils/dom.js';
import { store } from './store.js';
import { loadIndex, loadLatest, loadRecent, loadYear, loadIssues } from './data-loader.js';
import { mountFilterBar } from './filter-bar.js';
import { renderTrend } from './trend-table.js';
import { bindOverlay } from './trend-overlay.js';
import { mountPickerInTable } from './picker.js';

const $meta = qs('#meta-info');
const $loading = qs('#trend-loading');
const $scroll = qs('#trend-scroll');
const $table = qs('#trend-table');
const $svg = qs('#trend-overlay');
const $filterBar = qs('#filter-bar');
const $pickerDock = qs('#picker-dock');

let disposeOverlay = null;

async function init() {
  try {
    // 1. 加载基础信息
    const [idx, latest] = await Promise.all([loadIndex(), loadLatest()]);
    const draw = latest.latest_draw;
    const nextIssue = String(Number(draw.issue) + 1).padStart(7, '0');
    $meta.innerHTML = `共 <strong>${idx.total}</strong> 期 · 最新 <strong>${draw.issue}</strong>（${draw.date}）· 下期 <strong>${nextIssue}</strong>`;

    // 2. 装配筛选栏
    await mountFilterBar($filterBar);

    // 3. dock 高度同步给 trend-scroll padding-bottom（picker tfoot 在 renderByFilter 中挂载）
    syncDockHeight();
    new ResizeObserver(syncDockHeight).observe($pickerDock);

    // 4. 订阅 filter 变化 → 重新加载并渲染
    store.subscribe(async (key) => {
      if (key === 'filter') {
        await renderByFilter();
      }
    });

    // 初次渲染
    await renderByFilter();
  } catch (err) {
    console.error(err);
    $loading.innerHTML = `<span style="color:#e34d59">⚠️ 加载失败：${err.message}</span>`;
  }
}

async function renderByFilter() {
  const f = store.get('filter');
  if (!f) return;
  showLoading();

  let draws;
  let compareMode = false;
  try {
    if (f.mode === 'recent') {
      draws = await loadRecent(f.recent || 100);
    } else if (f.mode === 'year') {
      draws = await loadYear(f.year);
    } else if (f.mode === 'compare') {
      compareMode = true;
      if (!f.compareIssues || f.compareIssues.length < 2) {
        draws = [];
      } else {
        draws = await loadIssues(f.compareIssues);
      }
    } else {
      draws = await loadRecent(100);
    }
  } catch (err) {
    console.error(err);
    showError(err.message);
    return;
  }

  hideLoading();
  renderTrend($table, draws, { compareMode });
  // 在表格 tfoot 中挂载 picker 号码行（每次渲染都要重新插入）
  mountPickerInTable($table, $pickerDock);
  if (disposeOverlay) disposeOverlay();
  disposeOverlay = bindOverlay($svg, $table, $scroll);

  // 滚动到底部（最新期数在最下方）
  if (draws.length > 0) {
    requestAnimationFrame(() => {
      $scroll.scrollTop = $scroll.scrollHeight;
    });
  }
}

function showLoading() {
  $loading.hidden = false;
  $loading.innerHTML = '<span class="spinner"></span><span>加载走势数据…</span>';
  $scroll.hidden = true;
}

function hideLoading() {
  $loading.hidden = true;
  $scroll.hidden = false;
}

function showError(msg) {
  $loading.hidden = false;
  $loading.innerHTML = `<span style="color:#e34d59">⚠️ ${msg}</span>`;
  $scroll.hidden = true;
}

/** 把 picker-dock 的实际高度同步到 trend-scroll 的下内边距，避免遮挡 */
function syncDockHeight() {
  const h = $pickerDock.offsetHeight || 56;
  document.documentElement.style.setProperty('--picker-dock-h', `${h}px`);
}

init();
