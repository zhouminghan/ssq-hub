// ── 数据洞察：结构分布、AC 值、形态与近期频次 ──
import { h, qs } from './utils/dom.js';
import { loadStats } from './data-loader.js';
import { pad2 } from './utils/format.js';

const RED_MAX = 33;
const BLUE_MAX = 16;

let rendered = false;
let activeColor = 'red';

function percentage(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function card(title, description, flag, content) {
  return h('article.insight-card', null, [
    h('div.insight-card-head', null, [
      h('div', null, [
        h('h3', null, title),
        description ? h('p.insight-card-description', null, description) : null,
      ]),
      flag ? h('span.insight-flag', null, flag) : null,
    ]),
    content,
  ]);
}

function structureRow(label, parts, total, valueText) {
  const bar = h('div.structure-bar', {
    role: 'img',
    'aria-label': `${label}，${valueText}`,
  });
  for (const part of parts) {
    const segment = h(`span.${part.className}`);
    segment.style.width = `${percentage(part.value, total)}%`;
    bar.appendChild(segment);
  }
  return h('div.structure-row', null, [
    h('span.structure-label', null, label),
    bar,
    h('span.structure-value', null, valueText),
  ]);
}

function structureCard(stats) {
  const s = stats.structure_recent_50;
  const ballTotal = s.total_balls || 300;
  return card(
    '结构构成',
    '最近 50 期红球的位置、奇偶与大小分布',
    '近 50 期',
    h('div.structure-list', null, [
      structureRow('三区分布', [
        { className: 'seg-red', value: s.zone1 },
        { className: 'seg-blue', value: s.zone2 },
        { className: 'seg-gold', value: s.zone3 },
      ], ballTotal, `${s.zone1}:${s.zone2}:${s.zone3}`),
      structureRow('奇偶结构', [
        { className: 'seg-red', value: s.odd },
        { className: 'seg-muted', value: s.even },
      ], ballTotal, `${s.odd}:${s.even}`),
      structureRow('大小结构', [
        { className: 'seg-blue', value: s.small },
        { className: 'seg-muted', value: s.big },
      ], ballTotal, `${s.small}:${s.big}`),
    ]),
  );
}

function acCard(stats) {
  const entries = Object.entries(stats.ac_distribution)
    .map(([value, count]) => [Number(value), Number(count)])
    .sort((a, b) => a[0] - b[0]);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  const chart = h('div.ac-chart', {
    role: 'img',
    'aria-label': `AC 值分布，${entries.map(([value, count]) => `AC ${value} 有 ${count} 期`).join('，')}`,
  });
  for (const [value, count] of entries) {
    const bar = h('div.ac-bar');
    bar.style.height = `${Math.max(4, (count / max) * 105)}px`;
    chart.appendChild(h('div.ac-column', null, [
      h('span.ac-value', null, String(count)),
      bar,
      h('span.ac-label', null, String(value)),
    ]));
  }
  return card('AC 值分布', '号码离散度分布，基于最近 100 期', '近 100 期', chart);
}

function patternCard(stats) {
  const consecutive = stats.consecutive || {};
  const sameTail = stats.same_tail || {};
  return card(
    '形态信号',
    '连号与同尾在近期开奖中的覆盖比例',
    `${consecutive.window || 100} 期`,
    h('div.pattern-pairs', null, [
      h('div.pattern-stat', null, [
        h('strong', null, `${Math.round((consecutive.ratio || 0) * 100)}%`),
        h('span', null, '出现连号'),
        h('small', null, `${consecutive.with_consec_count || 0} / ${consecutive.window || 100} 期`),
      ]),
      h('div.pattern-stat', null, [
        h('strong', null, `${Math.round((sameTail.ratio || 0) * 100)}%`),
        h('span', null, '出现同尾'),
        h('small', null, `${sameTail.with_same_tail_count || 0} / ${sameTail.window || 100} 期`),
      ]),
    ]),
  );
}

function frequencyList(stats, color) {
  const bucket = color === 'red' ? stats.red_freq_50 : stats.blue_freq_50;
  const total = color === 'red' ? RED_MAX : BLUE_MAX;
  const rows = Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    return [number, Number(bucket[pad2(number)] || 0)];
  })
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, color === 'red' ? 8 : 6);
  const max = Math.max(...rows.map(([, count]) => count), 1);

  const list = h('div.frequency-list');
  for (const [number, count] of rows) {
    const fill = h(`div.frequency-fill.${color}`);
    fill.style.width = `${Math.max(4, (count / max) * 100)}%`;
    list.appendChild(h('div.frequency-row', null, [
      h(`span.frequency-ball.${color}`, null, pad2(number)),
      h('div.frequency-track', null, fill),
      h('span.frequency-count', null, String(count)),
    ]));
  }
  return list;
}

function frequencyCard(stats) {
  const content = h('div.frequency-content');
  const tabs = h('div.frequency-tabs', {
    role: 'tablist',
    'aria-label': '号码类型',
  }, [
    h('button.frequency-tab.active', {
      type: 'button', role: 'tab', 'aria-selected': 'true', dataset: { color: 'red' },
    }, '红球'),
    h('button.frequency-tab', {
      type: 'button', role: 'tab', 'aria-selected': 'false', dataset: { color: 'blue' },
    }, '蓝球'),
  ]);

  const render = (color) => {
    activeColor = color;
    tabs.querySelectorAll('.frequency-tab').forEach((tab) => {
      const active = tab.dataset.color === color;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    content.replaceChildren(frequencyList(stats, color));
  };

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('.frequency-tab');
    if (button) render(button.dataset.color);
  });
  render(activeColor);

  return card(
    '近期高频号码',
    '最近 50 期出现次数，仅供历史数据阅读',
    '近 50 期',
    h('div', null, [tabs, content]),
  );
}

function footerNote(stats) {
  return h('div.insight-note', null, [
    h('span', null, [
      h('strong', null, `${stats.total.toLocaleString('zh-CN')} 期`),
      ' 历史样本，最近更新于 ',
      h('strong', null, stats.updated),
    ]),
    h('span', null, '统计结果由 Python 数据管线生成；历史频次不代表未来概率。'),
  ]);
}

export async function mountInsights({ force = false } = {}) {
  if (rendered && !force) return;
  const grid = qs('#insights-grid');
  grid.replaceChildren(
    h('div.insights-loading', null, [
      h('span.spinner', { 'aria-hidden': 'true' }),
      '正在计算概览',
    ]),
  );
  try {
    const stats = await loadStats();
    grid.replaceChildren(
      structureCard(stats),
      acCard(stats),
      patternCard(stats),
      frequencyCard(stats),
      footerNote(stats),
    );
    qs('#insights-window').textContent = `近 ${stats.consecutive?.window || 100} 期`;
    rendered = true;
  } catch (error) {
    grid.replaceChildren(
      h('div.insights-error', null, `统计加载失败：${error.message || error}`),
    );
  }
}
