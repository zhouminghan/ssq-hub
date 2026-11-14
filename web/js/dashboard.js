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

export function mountDashboard(index, latest, loadState = {}, calendar = {}) {
  const draw = latest.latest_draw;
  qs('#overview-issue').textContent = draw.issue;
  qs('#overview-date').textContent = formatDate(draw.date);
  qs('#metric-total').textContent = `${latest.total.toLocaleString('zh-CN')} 期`;
  qs('#metric-years').textContent = `${index.years.length} 年`;
  qs('#overview-scale').textContent =
    `${latest.total.toLocaleString('zh-CN')} 期 · ${index.years.length} 年`;
  if (calendar.nextIssue && calendar.nextDate) {
    const next = qs('#overview-next');
    const note = calendar.estimateNote ? ` · ${calendar.estimateNote}` : '';
    next.textContent =
      `预计下期 ${calendar.nextIssue} · ${formatDate(calendar.nextDate)}${note}`;
    next.title = calendar.estimateNote
      ? `开奖日期估算：${calendar.estimateNote}`
      : '按周二、周四、周日开奖规律和已配置停售窗口估算';
  }

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
  const detail = qs('#metric-status-detail');
  if (loadState.source === 'browser-cache') {
    status.textContent = '本地缓存';
    status.classList.add('is-warning');
    const cachedAt = loadState.cacheAt
      ? new Date(loadState.cacheAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      : '时间未知';
    detail.textContent = `缓存于 ${cachedAt}`;
  } else if (loadState.source === 'cdn') {
    status.textContent = '备用镜像';
    status.classList.add('is-warning');
    detail.textContent = '本次已切换备用';
  } else if (age == null) {
    status.textContent = '日期异常';
    status.classList.add('is-stale');
    detail.textContent = '';
  } else if (age <= 4) {
    status.textContent = age === 0 ? '今日更新' : `${age} 天前更新`;
    status.classList.add('is-fresh');
    detail.textContent = '来源已核验';
  } else if (age <= 10) {
    status.textContent = `${age} 天前更新`;
    status.classList.add('is-warning');
    detail.textContent = '请留意停售期';
  } else {
    status.textContent = `已 ${age} 天未更新`;
    status.classList.add('is-stale');
    detail.textContent = '更新可能异常';
  }
  const generatedAt = latest.generated_at
    ? new Date(latest.generated_at).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
    })
    : '未知';
  status.title = loadState.cached
    ? `本次会话使用浏览器缓存；缓存时间：${loadState.cacheAt || '未知'}`
    : loadState.source === 'cdn'
      ? `本次会话已切换备用镜像；最新开奖日期：${draw.date}`
      : `最新开奖日期：${draw.date}；数据生成：${generatedAt}；来源：${latest.source || '公开开奖记录'}`;
  status.setAttribute('aria-label', status.title);
}

export function markDashboardUnavailable() {
  qs('#overview-issue').textContent = '不可用';
  qs('#overview-date').textContent = '数据源连接失败';
  qs('#overview-next').textContent = '';
  qs('#overview-balls').replaceChildren();
  const status = qs('#metric-status');
  status.className = 'data-status is-stale';
  status.textContent = '数据不可用';
  status.removeAttribute('title');
  status.setAttribute('aria-label', '数据不可用，请检查网络后重试');
  qs('#metric-status-detail').textContent = '请稍后重试';
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
