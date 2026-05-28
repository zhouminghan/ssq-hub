// ── 走势表渲染 ──
import { h, clear } from './utils/dom.js';
import { structure, pad2, issueYear, issueSeq } from './utils/format.js';

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
        h('td', { colspan: 55 }, [
          h('div.trend-empty', null, '暂无数据，请调整筛选条件'),
        ]),
      ]),
    ]);
    table.appendChild(tbody);
    return;
  }

  // ── 表头：单行（期号 + 1..33 红 + 1..16 蓝 + 4 列辅助） ──
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
    h('th.zone-aux', null, '奇偶'),
    h('th.zone-aux', null, '大小'),
    h('th.zone-aux', null, '区间'),
    h('th.zone-aux', null, '质合'),
  ]);

  thead.appendChild(tr);
  table.appendChild(thead);

  // ── 表体：从老到新；同号纵向遗漏值递增 ──
  const tbody = h('tbody');

  // 同号遗漏：上一行未命中则 +1，命中则置 0
  const redMiss = new Array(34).fill(0);   // index 1..33
  const blueMiss = new Array(17).fill(0);  // index 1..16

  for (const d of draws) {
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

    // 辅助列：和值 / 奇偶 / 大小 / 区间 / 质合
    cells.push(h('td.col-aux', null, [h('span.sum-val', null, struct.sum)]));
    cells.push(h('td.col-aux', null, `${struct.odd}:${struct.even}`));
    cells.push(h('td.col-aux', null, `${struct.small}:${struct.big}`));
    cells.push(h('td.col-aux', null, struct.zone));
    cells.push(h('td.col-aux', null, `${struct.prime}:${struct.composite}`));

    const tr = h('tr', { dataset: { issue: d.issue } }, cells);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
}
