// ── 主入口：装配各模块 ──
import { qs } from './utils/dom.js';
import { store } from './store.js';
import { loadIndex, loadLatest, loadRecent, loadYear, loadIssues } from './data-loader.js';
import { mountFilterBar } from './filter-bar.js';
import { renderTrend } from './trend-table.js';
import { bindOverlay } from './trend-overlay.js';
import { mountNumberProfile } from './number-profile.js';
import { nextIssue, nextDrawDate } from './utils/format.js';
import { initTheme } from './theme.js';

const $meta = qs('#meta-info');
const $loading = qs('#trend-loading');
const $scroll = qs('#trend-scroll');
const $table = qs('#trend-table');
const $svg = qs('#trend-overlay');
const $filterBar = qs('#filter-bar');

let disposeOverlay = null;

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

async function init(retryCount = 0) {
  // 尽早初始化主题（在数据加载前完成 UI 状态）
  initTheme();

  try {
    // 1. 加载基础信息
    const [idx, latest] = await Promise.all([loadIndex(), loadLatest()]);
    const draw = latest.latest_draw;
    const next = nextIssue(draw.issue, idx);
    const nextDate = nextDrawDate(draw.date);
    $meta.innerHTML = `下期 <strong>${next}</strong>（${nextDate}）`;

    // 2. 装配筛选栏
    await mountFilterBar($filterBar);

    // 装配号码画像抽屉（一次性挂到 body，按需打开）
    mountNumberProfile();

    // 3. 订阅 filter 变化 → 重新加载并渲染
    store.subscribe('filter', async () => {
      await renderByFilter();
    });

    // 初次渲染
    await renderByFilter();
  } catch (err) {
    console.error(`Attempt ${retryCount + 1} failed:`, err);
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY * (retryCount + 1)}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return init(retryCount + 1);
    }
    $loading.hidden = false;
    $scroll.hidden = true;
    $loading.innerHTML = `
      <span class="error-text">⚠️ 加载失败：${err.message}</span>
      <button id="retry-btn" class="btn-retry">重试</button>
    `;
    const btn = qs('#retry-btn');
    if (btn) btn.addEventListener('click', () => location.reload());
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
      draws = await loadRecent(f.recent || 50);
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
      draws = await loadRecent(50);
    }
  } catch (err) {
    console.error(err);
    showError(err.message);
    return;
  }

  hideLoading();
  renderTrend($table, draws, { compareMode });
  if (disposeOverlay) disposeOverlay();
  disposeOverlay = bindOverlay($svg, $table, $scroll);

  // 滚动到底部（最新期数在最下方）
  if (draws.length > 0) {
    scrollToBottom();
  }
}

/** 滚到走势表底部（多次兜底确保布局收敛） */
function scrollToBottom() {
  const stick = () => {
    $scroll.scrollTop = $scroll.scrollHeight;
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      stick();
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
  $loading.innerHTML = `<span class="error-text">⚠️ ${msg}</span>`;
  $scroll.hidden = true;
}

init();
