// ── 产品概览：最新一期、数据规模与新鲜度 ──
import { h, qs } from './utils/dom.js';
import { pad2 } from './utils/format.js';

function daysSince(dateText) {
  const then = new Date(`${dateText}T00:00:00+08:00`).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function formatDate(dateText) {
  const parts = String(dateText).split('-');
  return parts.length === 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : dateText;
}

export function mountDashboard(index, latest, loadState = {}) {
  const draw = latest.latest_draw;
  qs('#overview-issue').textContent = draw.issue;
  qs('#overview-date').textContent = formatDate(draw.date);
  qs('#metric-total').textContent = `${latest.total.toLocaleString('zh-CN')} 期`;
  qs('#metric-years').textContent = `${index.years.length} 年`;
  qs('#overview-scale').textContent =
    `${latest.total.toLocaleString('zh-CN')} 期 · ${index.years.length} 年`;

  const balls = qs('#overview-balls');
  balls.replaceChildren();
  for (const number of draw.red) {
    balls.appendChild(h('span.draw-ball.red', {
      'aria-label': `红球 ${pad2(number)}`,
    }, pad2(number)));
  }
  balls.appendChild(h('span.draw-ball-separator', { 'aria-hidden': 'true' }));
  balls.appendChild(h('span.draw-ball.blue', {
    'aria-label': `蓝球 ${pad2(draw.blue)}`,
  }, pad2(draw.blue)));

  const age = daysSince(draw.date);
  const status = qs('#metric-status');
  status.className = 'data-status';
  if (loadState.cached) {
    status.textContent = '使用本地缓存';
    status.classList.add('is-warning');
  } else if (age == null) {
    status.textContent = '日期异常';
    status.classList.add('is-stale');
  } else if (age <= 4) {
    status.textContent = age === 0 ? '今日更新' : `${age} 天前更新`;
    status.classList.add('is-fresh');
  } else if (age <= 10) {
    status.textContent = `${age} 天前更新`;
    status.classList.add('is-warning');
  } else {
    status.textContent = `已 ${age} 天未更新`;
    status.classList.add('is-stale');
  }
  const generatedAt = latest.generated_at
    ? new Date(latest.generated_at).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
    })
    : '未知';
  status.title = loadState.cached
    ? `网络数据源不可用，缓存时间：${loadState.lastLoadedAt || '未知'}`
    : `最新开奖日期：${draw.date}；数据生成：${generatedAt}；来源：${latest.source || '公开开奖记录'}`;
  status.setAttribute('aria-label', status.title);
}

/** 绑定“走势分析 / 数据洞察”主视图。 */
export function bindViewNavigation() {
  /** @type {HTMLElement[]} */
  const buttons = [];
  document.querySelectorAll('.app-nav-item').forEach((element) => {
    if (element instanceof HTMLElement) buttons.push(element);
  });
  const trendView = qs('#trend-view');
  const insightsView = qs('#insights-view');
  const filterBar = qs('#filter-bar');

  const setView = (view) => {
    buttons.forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    trendView.hidden = view !== 'trend';
    insightsView.hidden = view !== 'insights';
    filterBar.hidden = view !== 'trend';
    document.documentElement.dataset.view = view;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button instanceof HTMLElement && button.dataset.view) setView(button.dataset.view);
    });
  });
  setView('trend');
  return setView;
}
