// ── 主入口：装配各模块 ──
import { qs } from './utils/dom.js';
import { store } from './store.js';
import { loadIndex, loadLatest, loadRecent, loadYear, loadIssues } from './data-loader.js';
import { mountFilterBar } from './filter-bar.js';
import { renderTrend } from './trend-table.js';
import { bindOverlay } from './trend-overlay.js';
import { mountPickerInTable } from './picker.js';
import { nextIssue } from './utils/format.js';

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
    const next = nextIssue(draw.issue, idx);
    $meta.innerHTML = `共 <strong>${idx.total}</strong> 期 · 最新 <strong>${draw.issue}</strong>（${draw.date}）· 下期 <strong>${next}</strong>`;

    // 2. 装配筛选栏
    await mountFilterBar($filterBar);

    // 3. dock 高度同步给 trend-scroll padding-bottom（picker tfoot 在 renderByFilter 中挂载）
    syncDockHeight();
    new ResizeObserver(syncDockHeight).observe($pickerDock);
    // picker.js 折叠/展开/数据变更后会派发，主动触发一次重算
    window.addEventListener('picker:layoutChange', syncDockHeight);

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
  // 注意：renderTrend → mountPickerInTable → bindOverlay 后，布局还在收敛中，
  // 单次 rAF 拿到的 scrollHeight 不一定是最终值。这里用双 rAF + 一次延迟兜底，
  // 确保字体/sticky tfoot/SVG overlay 全部 layout 完成后再定位。
  if (draws.length > 0) {
    scrollToBottom();
  }
}

/** 滚到走势表底部（多次兜底，确保布局收敛后是真正的底） */
function scrollToBottom() {
  const stick = () => {
    $scroll.scrollTop = $scroll.scrollHeight;
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      stick();
      // 再兜一次，防止 ResizeObserver 触发的 dock 高度变化让底部又长出来
      setTimeout(stick, 80);
    });
  });
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
