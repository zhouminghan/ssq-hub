// ── 应用入口：装配概览、筛选、走势表与洞察视图 ──
import { qs } from './utils/dom.js';
import { store } from './store.js';
import {
  getDataLoadState, loadIndex, loadLatest, loadRecent, loadYear, loadIssues,
} from './data-loader.js';
import { mountFilterBar } from './filter-bar.js';
import { renderTrend } from './trend-table.js';
import { bindOverlay, bindStickyHeader } from './trend-overlay.js';
import { mountNumberProfile } from './number-profile.js';
import { initTheme } from './theme.js';
import { mountDashboard, bindViewNavigation } from './dashboard.js';
import { mountInsights } from './insights.js';

const $loading = qs('#trend-loading');
const $scroll = qs('#trend-scroll');
const $table = qs('#trend-table');
const $svg = qs('#trend-overlay');
const $stickyHeader = qs('#trend-sticky-header');
const $stickyTrack = qs('#trend-sticky-track');
const $stickyIssue = qs('#trend-sticky-issue');
const $filterBar = qs('#filter-bar');
const $summary = qs('#trend-summary');

/** @type {null | (() => void)} */
let disposeOverlay = null;
let disposeStickyHeader = null;
let renderToken = 0;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

Reflect.set(window, '__ssqBooted', true);

async function init(retryCount = 0) {
  initTheme();

  try {
    const [index, latest] = await Promise.all([loadIndex(), loadLatest()]);
    mountDashboard(index, latest, getDataLoadState());
    await mountFilterBar($filterBar);
    mountNumberProfile();

    bindViewNavigation();
    document.querySelector('[data-view="insights"]').addEventListener('click', () => {
      mountInsights();
    });

    store.subscribe('filter', async () => {
      if (document.documentElement.dataset.view === 'trend') {
        await renderByFilter();
      }
    });

    await renderByFilter();
  } catch (error) {
    console.error(`Application attempt ${retryCount + 1} failed:`, error);
    if (retryCount < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return init(retryCount + 1);
    }
    showError(`数据加载失败：${error.message || error}`, true);
  }
}

async function renderByFilter() {
  const filter = store.get('filter');
  if (!filter) return;
  const token = ++renderToken;
  showLoading();

  let draws;
  let compareMode = false;
  try {
    if (filter.mode === 'recent') {
      draws = await loadRecent(filter.recent || 50);
    } else if (filter.mode === 'year') {
      draws = await loadYear(filter.year);
    } else if (filter.mode === 'compare') {
      compareMode = true;
      draws = filter.compareIssues?.length >= 2
        ? await loadIssues(filter.compareIssues)
        : [];
    } else {
      draws = await loadRecent(50);
    }
  } catch (error) {
    if (token !== renderToken) return;
    console.error(error);
    showError(error.message);
    return;
  }
  if (token !== renderToken) return;

  hideLoading();
  renderTrend($table, draws, { compareMode });
  updateSummary(filter, draws.length);
  if (disposeOverlay) disposeOverlay();
  if (disposeStickyHeader) disposeStickyHeader();
  disposeOverlay = bindOverlay($svg, $table, $scroll);
  disposeStickyHeader = bindStickyHeader(
    $stickyHeader, $stickyTrack, $stickyIssue, $table, $scroll,
  );

  if (draws.length > 0) positionRows(filter.mode);
}

function updateSummary(filter, count) {
  if (filter.mode === 'compare') {
    $summary.textContent = `跨年同期对比 · 已匹配 ${count} 个年份`;
  } else if (filter.mode === 'year') {
    $summary.textContent = `${filter.year} 年 · ${count} 期 · 红球遗漏与结构指标`;
  } else {
    $summary.textContent = `最近 ${count} 期 · 红球遗漏、蓝球轨迹与结构指标`;
  }
}

/** Recent mode opens at the latest row; year/compare modes start at the first. */
function positionRows(mode) {
  if (mode !== 'recent') {
    $scroll.scrollTop = 0;
    return;
  }
  const revealLatest = () => {
    $scroll.scrollTop = $scroll.scrollHeight;
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      revealLatest();
      setTimeout(revealLatest, 80);
    });
  });
}

function showLoading() {
  $loading.hidden = false;
  $loading.className = 'trend-loading';
  $loading.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>正在加载走势数据</span>';
  $scroll.hidden = true;
}

function hideLoading() {
  $loading.hidden = true;
  $scroll.hidden = false;
}

function showError(message, retry = false) {
  $loading.hidden = false;
  $loading.className = 'trend-loading trend-error';
  $loading.innerHTML = '';
  const text = document.createElement('span');
  text.className = 'error-text';
  text.textContent = `加载失败：${message}`;
  $loading.appendChild(text);
  if (retry) {
    const button = document.createElement('button');
    button.id = 'retry-btn';
    button.className = 'btn-retry';
    button.type = 'button';
    button.textContent = '重试';
    button.addEventListener('click', () => location.reload());
    $loading.appendChild(button);
  }
  $scroll.hidden = true;
}

init();
