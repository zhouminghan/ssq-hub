// ── 主入口：装配各模块 ──
import { qs } from './utils/dom.js';
import { store } from './store.js';
import { loadIndex, loadLatest, loadRecent, loadYear, loadIssues } from './data-loader.js';
import { mountFilterBar } from './filter-bar.js';
import { renderTrend } from './trend-table.js';
import { bindOverlay } from './trend-overlay.js';
import { mountNumberProfile } from './number-profile.js';
import { nextIssue, nextDrawDate } from './utils/format.js';

const $meta = qs('#meta-info');
const $loading = qs('#trend-loading');
const $scroll = qs('#trend-scroll');
const $table = qs('#trend-table');
const $svg = qs('#trend-overlay');
const $filterBar = qs('#filter-bar');

let disposeOverlay = null;

/* ── 三态主题切换：auto / light / dark ── */

/** 获取用户存储的主题偏好（'light'|'dark'|null=auto），返回有效主题名 */
function getStoredMode() {
  const t = localStorage.getItem('theme');
  return (t === 'light' || t === 'dark') ? t : null; // null = 跟随系统
}

/** 根据 storage 状态返回实际应渲染的主题（light|dark）*/
function getEffectiveTheme() {
  const mode = getStoredMode();
  if (mode) return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeSegmentUI(theme, getStoredMode());
}

function initThemeToggle() {
  const segment = qs('#theme-segment');
  if (!segment) return;

  // 初始化 UI
  const theme = getEffectiveTheme();
  applyTheme(theme);

  // 点击循环：auto(null) → light → dark → auto(null)
  segment.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme]');
    if (!btn) return;
    const chosen = btn.dataset.theme; // 'auto' | 'light' | 'dark'

    if (chosen === 'auto') {
      localStorage.removeItem('theme'); // null = auto
    } else {
      localStorage.setItem('theme', chosen);
    }
    applyTheme(getEffectiveTheme());
  });

  // 系统主题变化时自动跟随（仅 auto 模式）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/** 同步三态分段控制器 UI */
function syncThemeSegmentUI(theme, mode) {
  const segment = qs('#theme-segment');
  if (!segment) return;

  const buttons = segment.querySelectorAll('button[data-theme]');
  buttons.forEach(btn => {
    const bt = btn.dataset.theme;
    const checked =
      (bt === 'auto' && mode === null) ||
      (bt === 'light' && mode === 'light') ||
      (bt === 'dark' && mode === 'dark');
    btn.setAttribute('aria-checked', String(checked));
  });
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

async function init(retryCount = 0) {
  // 尽早初始化主题切换（在数据加载前完成 UI 状态）
  initThemeToggle();

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
    store.subscribe(async (key) => {
      if (key === 'filter') {
        await renderByFilter();
      }
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
    qs('#retry-btn').addEventListener('click', () => location.reload());
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
