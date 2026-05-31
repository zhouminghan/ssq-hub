// ── 走势表渲染 ──
import { h, clear } from './utils/dom.js';
import { structure, pad2, issueYear, issueSeq } from './utils/format.js';
import { showProfile } from './number-profile.js';

/**
 * 渲染走势表
 * @param {HTMLTableElement} table
 * @param {Array} draws  按时间升序的开奖列表
 * @param {Object} opts  { compareMode?: boolean }
 */
export function renderTrend(table, draws, opts = {}) {
  clear(table);

  if (!draws || draws.length === 0) {
    const tbody = h('tbody', null, [
      h('tr', null, [
        h('td', { colspan: 58 }, [
          h('div.trend-empty', null, '暂无数据，请调整筛选条件'),
        ]),
      ]),
    ]);
    table.appendChild(tbody);
    return;
  }

  // ── 表头：单行（期号 + 1..33 红 + 1..16 蓝 + 8 列辅助） ──
  const thead = h('thead');

  const redHeads = [];
  for (let n = 1; n <= 33; n++) {
    redHeads.push(h('th.zone-red', null, pad2(n)));
  }
  const blueHeads = [];
  for (let n = 1; n <= 16; n++) {
    blueHeads.push(h('th.zone-blue', null, pad2(n)));
  }
  const tr = h('tr', null, [
    h('th.col-issue', null, '期号'),
    ...redHeads,
    ...blueHeads,
    h('th.zone-aux', null, '和值'),
    h('th.zone-aux', null, '跨度'),
    h('th.zone-aux', null, '大小形态'),
    h('th.zone-aux', null, '大小比'),
    h('th.zone-aux', null, '奇偶形态'),
    h('th.zone-aux', null, '奇偶比'),
    h('th.zone-aux', null, '质合形态'),
    h('th.zone-aux', null, '质合比'),
  ]);

  thead.appendChild(tr);
  table.appendChild(thead);

  // ── 表体：从老到新；同号纵向遗漏值递增 ──
  const tbody = h('tbody');

  // 同号遗漏：上一行未命中则 +1，命中则置 0
  const redMiss = new Array(34).fill(0);   // index 1..33
  const blueMiss = new Array(17).fill(0);  // index 1..16

  // 最近 5 期高亮：仅对最末 5 行的命中球应用脉冲动效，避免长表全闪干扰阅读
  const total = draws.length;
  const recentThreshold = total - 5;

  for (let i = 0; i < draws.length; i++) {
    const d = draws[i];
    const redSet = new Set(d.red);
    const blue = d.blue;
    const struct = structure(d.red);

    const cells = [];
    // 期号
    const issueCell = h('td.col-issue', null);
    if (opts.compareMode) {
      issueCell.appendChild(h('span.year-tag', null, issueYear(d.issue)));
      issueCell.appendChild(document.createTextNode(issueSeq(d.issue)));
    } else {
      issueCell.appendChild(document.createTextNode(d.issue));
    }
    cells.push(issueCell);

    // 红球 1..33
    for (let n = 1; n <= 33; n++) {
      if (redSet.has(n)) {
        redMiss[n] = 0;
        cells.push(
          h('td.col-red.hit', { dataset: { ball: n, color: 'red' } }, [
            h('span.ball.red', null, pad2(n)),
          ]),
        );
      } else {
        redMiss[n]++;
        const m = redMiss[n];
        const cls = m >= 30 ? 'col-red miss-hot' : m === 0 ? 'col-red' : 'col-red';
        cells.push(
          h('td', { class: cls, dataset: { ball: n, color: 'red' } }, [
            m > 0 ? h('span.miss', null, m) : '',
          ]),
        );
      }
    }

    // 蓝球 1..16
    for (let n = 1; n <= 16; n++) {
      if (blue === n) {
        blueMiss[n] = 0;
        cells.push(
          h('td.col-blue.hit', { dataset: { ball: n, color: 'blue' } }, [
            h('span.ball.blue', null, pad2(n)),
          ]),
        );
      } else {
        blueMiss[n]++;
        const m = blueMiss[n];
        const cls = m >= 16 ? 'col-blue miss-hot' : 'col-blue';
        cells.push(
          h('td', { class: cls, dataset: { ball: n, color: 'blue' } }, [
            m > 0 ? h('span.miss', null, m) : '',
          ]),
        );
      }
    }

    // 辅助列：和值 / 跨度 / 大小形态 / 大小比 / 奇偶形态 / 奇偶比 / 质合形态 / 质合比
    cells.push(h('td.col-aux', null, [h('span.sum-val', null, struct.sum)]));
    cells.push(h('td.col-aux', null, struct.span));
    cells.push(h('td.col-aux.col-shape', null,
      [...struct.bigSmallShape].map((ch) =>
        h(ch === '小' ? 'span.s-small' : 'span.s-big', null, ch))));
    cells.push(h('td.col-aux', null, `${struct.small}:${struct.big}`));
    cells.push(h('td.col-aux.col-shape', null,
      [...struct.oddEvenShape].map((ch) =>
        h(ch === '奇' ? 'span.s-odd' : 'span.s-even', null, ch))));
    cells.push(h('td.col-aux', null, `${struct.odd}:${struct.even}`));
    cells.push(h('td.col-aux.col-shape', null,
      [...struct.primeShape].map((ch) =>
        h(ch === '质' ? 'span.s-prime' : 'span.s-composite', null, ch))));
    cells.push(h('td.col-aux', null, `${struct.prime}:${struct.composite}`));

    const trAttrs = { dataset: { issue: d.issue } };
    if (i >= recentThreshold) trAttrs.class = 'recent-5';
    const tr = h('tr', trAttrs, cells);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);

  // ── 事件代理：点击 tbody 中任意红/蓝号码格 → 打开号码画像抽屉 ──
  // 仅 tbody 触发；thead / tfoot.picker-row 由各自模块接管事件。
  // 用 onclick 直接覆盖，每次 renderTrend 重建 tbody 时事件自动随节点 GC。
  tbody.onclick = (e) => {
    const td = e.target.closest('td.col-red, td.col-blue');
    if (!td) return;
    const num = Number(td.dataset.ball);
    const color = td.dataset.color;
    if (!num || !color) return;
    showProfile(color, num);
  };
}
