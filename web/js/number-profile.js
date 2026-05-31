// ── 号码画像（点击走势表号码后弹出右侧抽屉）──
//
// 数据来源：stats.json 中的 red_per_number / blue_per_number
// 视图：右侧 360px 抽屉（移动端全屏），背景遮罩，ESC / 点遮罩 / × 关闭
//
// 仅做"历史数据展示"，不做任何"推荐"/"预测"措辞——这是项目红线
import { h, qs, clear } from './utils/dom.js';
import { loadStats } from './data-loader.js';
import { pad2 } from './utils/format.js';

const RED_MAX = 33;
const BLUE_MAX = 16;

let mounted = false;
let rootEl = null;
let panelEl = null;
let bodyEl = null;
let cachedStats = null;

/**
 * 在 document.body 挂载抽屉容器（仅一次）
 */
export function mountNumberProfile() {
  if (mounted) return;

  rootEl = h('div.np-root', { id: 'np-root', hidden: '' }, [
    h('div.np-mask', { id: 'np-mask' }),
    h('aside.np-panel', { id: 'np-panel', role: 'dialog', 'aria-modal': 'true' }, [
      h('header.np-head', null, [
        h('div.np-title', { id: 'np-title' }, '号码画像'),
        h('button.np-close', {
          id: 'np-close', type: 'button', 'aria-label': '关闭',
        }, '×'),
      ]),
      h('div.np-body', { id: 'np-body' }),
      h('footer.np-foot', null, [
        h('span', null, '历史数据，不预测未来 · 仅供学习参考'),
      ]),
    ]),
  ]);
  document.body.appendChild(rootEl);

  panelEl = qs('#np-panel', rootEl);
  bodyEl = qs('#np-body', rootEl);

  // 关闭交互：遮罩 / × / ESC
  qs('#np-mask', rootEl).addEventListener('click', closeProfile);
  qs('#np-close', rootEl).addEventListener('click', closeProfile);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !rootEl.hidden) closeProfile();
  });

  mounted = true;
}

/**
 * 显示某个号码的画像
 * @param {'red'|'blue'} color
 * @param {number} num 1-33（红） / 1-16（蓝）
 */
export async function showProfile(color, num) {
  if (!mounted) mountNumberProfile();

  // 先打开壳，加载中态
  qs('#np-title', rootEl).textContent = `${color === 'red' ? '红球' : '蓝球'} ${pad2(num)}`;
  clear(bodyEl);
  bodyEl.appendChild(h('div.np-loading', null, '加载数据中…'));
  rootEl.hidden = false;
  // 触发动画：下一帧加 .is-open
  requestAnimationFrame(() => rootEl.classList.add('is-open'));

  try {
    if (!cachedStats) cachedStats = await loadStats();
    renderBody(color, num, cachedStats);
  } catch (err) {
    clear(bodyEl);
    bodyEl.appendChild(
      h('div.np-error', null, `加载失败：${err.message || err}`),
    );
  }
}

function closeProfile() {
  if (!rootEl) return;
  rootEl.classList.remove('is-open');
  // 等动画结束再 hidden
  setTimeout(() => { rootEl.hidden = true; }, 220);
}

/**
 * 根据 stats 渲染抽屉正文
 * 拆 4 块：基础卡 / 频次对比 / 遗漏卡 / 最近 5 次出现
 */
function renderBody(color, num, stats) {
  const key = pad2(num);
  const bucket = color === 'red' ? stats.red_per_number : stats.blue_per_number;
  const info = bucket && bucket[key];
  const totalDraws = stats.total || 0;
  const ballMax = color === 'red' ? RED_MAX : BLUE_MAX;
  // 双色球红球每期 6 个，蓝球 1 个 → 期望命中率
  const expectFreq = color === 'red'
    ? totalDraws * 6 / ballMax
    : totalDraws / ballMax;

  clear(bodyEl);

  if (!info) {
    bodyEl.appendChild(h('div.np-error', null, '该号码暂无统计数据'));
    return;
  }

  // ── 1) 顶部大球 + 摘要 ──
  const headBall = h(
    `div.np-bigball.${color}`,
    null,
    [h('span', null, key)],
  );
  const headStats = h('div.np-headstats', null, [
    h('div.np-stat', null, [
      h('span.np-stat-num', null, info.freq_global),
      h('span.np-stat-label', null, '历史出现'),
    ]),
    h('div.np-stat', null, [
      h('span.np-stat-num', null, info.current_miss),
      h('span.np-stat-label', null, '当前遗漏'),
    ]),
    h('div.np-stat', null, [
      h('span.np-stat-num', null, info.max_miss),
      h('span.np-stat-label', null, '历史最长'),
    ]),
  ]);

  bodyEl.appendChild(h('section.np-head-card', null, [headBall, headStats]));

  // ── 2) 频次对比卡：全局 / 近 100 / 近 50（横向 bar） ──
  // 用各档"实际/期望"对比，避免误读为"该买/不该买"
  const card1 = h('section.np-card', null, [
    h('h3.np-card-title', null, '出现频次'),
    h('div.np-card-sub', null,
      `理论期望：每 ${ballMax} 期约出现 ${color === 'red' ? '6' : '1'} 次`),
    barRow('全部', info.freq_global, expectFreq, `${totalDraws} 期`),
    barRow('近 100 期', info.freq_100, color === 'red' ? 100 * 6 / ballMax : 100 / ballMax, '100 期'),
    barRow('近 50 期', info.freq_50, color === 'red' ? 50 * 6 / ballMax : 50 / ballMax, '50 期'),
  ]);
  bodyEl.appendChild(card1);

  // ── 3) 遗漏详情 ──
  const card2 = h('section.np-card', null, [
    h('h3.np-card-title', null, '遗漏分析'),
    h('div.np-kv', null, [
      h('span.np-k', null, '当前遗漏'),
      h('span.np-v', null, `${info.current_miss} 期`),
    ]),
    h('div.np-kv', null, [
      h('span.np-k', null, '历史最长遗漏'),
      h('span.np-v', null, `${info.max_miss} 期`),
    ]),
    h('div.np-kv', null, [
      h('span.np-k', null, '最长遗漏发生在'),
      h('span.np-v', null,
        info.max_miss_issue ? `第 ${info.max_miss_issue} 期出现时打破` : '至今仍未打破'),
    ]),
  ]);
  bodyEl.appendChild(card2);

  // ── 4) 最近 5 次出现 ──
  const recent = info.recent_5_issues || [];
  const card3 = h('section.np-card', null, [
    h('h3.np-card-title', null, '最近 5 次出现'),
  ]);
  if (recent.length === 0) {
    card3.appendChild(h('div.np-card-sub', null, '暂无记录'));
  } else {
    const list = h('ol.np-recent');
    recent.forEach((issue) => {
      list.appendChild(h('li', null, [
        h('span.np-recent-idx', null, '·'),
        h('span.np-recent-issue', null, issue),
      ]));
    });
    card3.appendChild(list);
  }
  bodyEl.appendChild(card3);
}

/** 一行频次条形图：左标题 + 中间 bar + 右数值 */
function barRow(label, value, expect, sample) {
  // 用相对期望的比例做宽度，1.0 = 与期望持平
  const ratio = expect > 0 ? value / expect : 0;
  // 视觉上限 2.0（200%），避免极端值撑爆
  const w = Math.min(ratio, 2) / 2;  // 0~1
  const pct = Math.round(w * 100);
  const isHigh = ratio >= 1.05;
  const isLow = ratio <= 0.95;
  const stateClass = isHigh ? 'is-high' : isLow ? 'is-low' : 'is-mid';

  // 期望刻度线在 50%（即 ratio=1 的位置）
  return h('div.np-bar-row', null, [
    h('span.np-bar-label', null, label),
    h('div.np-bar-track', null, [
      h('div.np-bar-expect-mark', { title: '理论期望刻度' }),
      h(`div.np-bar-fill.${stateClass}`, { style: `width:${pct}%` }),
    ]),
    h('span.np-bar-value', null,
      `${value} / ${expect.toFixed(1)} (${sample})`),
  ]);
}
