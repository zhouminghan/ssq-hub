// ── 模拟选号 ──
// 布局：
//   走势表内 <tfoot> 中的 sticky bottom <tr class="picker-row">
//     —— 与 thead/tbody 共用 colgroup/列宽，号码列与表头 1:1 完全对齐
//     —— 期号列单元格 sticky-left z-index 高于普通行，实现冻结
//   #picker-dock：浮在 trend-wrap 底部
//     · picker-result：投注结果面板，左单式 + 右复式 + 底部合计
//       —— 单式区 head 内嵌 [机选 1] [机选 5] [清空]
//       —— 复式区 head 内嵌 [清空]（不再有 + 加注，按钮挪到草稿条）
//       —— 用户在表格点选后，根据 r/b 数量自动归到单式或复式（草稿态浅色）
//       —— 草稿条上有 [+ 加注] 按钮：合法→点了把它确认入位；不合法→禁用
//     · 列表区使用固定高度 + 内部滚动，dock 总高度恒定不溢出
//
// 顺序约定（重要）：
//   · state.bets 内部按"老→新"push（最新加入的在数组尾部）
//   · 渲染时倒序展示——新加入的显示在 #1（顶部），老的下沉
//   · 草稿条永远在最顶部（实条目之前）
//   · 单式满 5 注后再加，淘汰数组头部（视觉上的 #5，即最旧的一注）

import { h, qs, clear } from './utils/dom.js';
import { pad2 } from './utils/format.js';
import {
  randomPickByStrategy, STRATEGIES,
  RED_MAX, BLUE_MAX, RED_PICK, BLUE_PICK, PRICE_PER_BET,
} from './utils/lottery.js';
import { loadStats } from './data-loader.js';

/** 单式区最大条目数 */
const MAX_SINGLE = 5;

/** 组合数 C(n, k) */
function combination(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

/**
 * bets 中的每一项：
 *   单式 { type: 'single', red: [6], blue: number }
 *   复式 { type: 'multi',  reds: [r..], blues: [b..], count, cost }
 */

// 模块级状态
const state = {
  reds: new Set(),
  blues: new Set(),
  bets: [],
  // dock 折叠态（仅移动端生效）：默认折叠，点击 toggle 展开
  // 桌面端通过 CSS 强制不折叠（display），不读这个值
  collapsed: true,
  // 当前机选策略 id，默认均匀随机；用户从下拉切换
  strategy: 'uniform',
};

// stats 数据缓存（首次点策略机选时按需加载，失败则退回 uniform）
let statsForStrategy = null;
let statsLoading = null;
async function ensureStats() {
  if (statsForStrategy) return statsForStrategy;
  if (!statsLoading) {
    statsLoading = loadStats()
      .then((s) => { statsForStrategy = s; return s; })
      .catch(() => null);
  }
  return statsLoading;
}

let dockEl = null;
let inited = false;

export function mountPickerInTable(table, dock) {
  if (!inited) {
    dockEl = dock;
    initDock(dock);
    inited = true;
  }

  const existed = table.querySelector('tfoot.picker-tfoot');
  if (existed) existed.remove();

  const tfoot = h('tfoot.picker-tfoot');
  const tr = h('tr.picker-row');

  tr.appendChild(
    h('td.col-issue.picker-title-cell', null, [
      h('span.title-main', null, '🎟 模拟选号'),
    ]),
  );

  for (let n = 1; n <= RED_MAX; n++) {
    tr.appendChild(
      h('td.col-red.picker-cell', { dataset: { ball: n, color: 'red' } }, [
        h('span.pick-ball.red', null, pad2(n)),
      ]),
    );
  }
  for (let n = 1; n <= BLUE_MAX; n++) {
    tr.appendChild(
      h('td.col-blue.picker-cell', { dataset: { ball: n, color: 'blue' } }, [
        h('span.pick-ball.blue', null, pad2(n)),
      ]),
    );
  }
  tr.appendChild(h('td.col-aux.picker-aux-fill', { colspan: 8 }));

  tfoot.appendChild(tr);
  table.appendChild(tfoot);

  applySelection(tr);

  tr.addEventListener('click', (e) => {
    const t = e.target.closest('.picker-cell');
    if (!t) return;
    const n = Number(t.dataset.ball);
    const color = t.dataset.color;
    const set = color === 'red' ? state.reds : state.blues;
    if (set.has(n)) set.delete(n); else set.add(n);
    applySelection(tr);
    refreshDock();
  });
}

function applySelection(tr) {
  Array.from(tr.querySelectorAll('.picker-cell')).forEach((td) => {
    const n = Number(td.dataset.ball);
    const color = td.dataset.color;
    const set = color === 'red' ? state.reds : state.blues;
    td.classList.toggle('selected', set.has(n));
  });
}

function initDock(dock) {
  clear(dock);

  // ── 折叠条（仅移动端可见，CSS 控制）──
  // 显示当前合计（让用户在折叠态也能看到金额），点击切换展开/折叠
  const toggleBar = h('button.picker-toggle', { id: 'picker-toggle', type: 'button' }, [
    h('span.toggle-label', null, '🎲 模拟选号'),
    h('span.toggle-summary', { id: 'toggle-summary' }, '0 注 · ¥0'),
    h('span.toggle-caret', { id: 'toggle-caret' }, '▾'),
  ]);
  dock.appendChild(toggleBar);
  toggleBar.addEventListener('click', () => {
    state.collapsed = !state.collapsed;
    syncCollapsedClass();
  });

  // 投注结果面板：左单式 / 右复式 / 底部合计
  const resultPanel = h('div.picker-result', { id: 'picker-result' }, [
    h('div.result-cols', null, [
      // ── 左：单式 ──
      h('div.result-col.col-single', null, [
        h('div.result-col-head', null, [
          h('span.head-title', null, '🎯 单式'),
          h('span.head-meta', { id: 'single-meta' }, '0 / 5'),
          h('span.head-actions', null, [
            buildStrategySelect(),
            h('button.btn-mini', { id: 'pick-rand1', title: '按当前策略机选 1 注（追加）' }, '机选 1'),
            h('button.btn-mini', { id: 'pick-rand5', title: '按当前策略机选 5 注（直接填满）' }, '机选 5'),
            h('button.btn-mini.danger', { id: 'clear-single', title: '清空单式' }, '清空'),
          ]),
        ]),
        h('div.result-list', { id: 'single-list' }),
      ]),
      // ── 右：复式 ──
      h('div.result-col.col-multi', null, [
        h('div.result-col-head', null, [
          h('span.head-title', null, '🧩 复式'),
          h('span.head-meta', { id: 'multi-meta' }, '0 组'),
          h('span.head-actions', null, [
            h('button.btn-mini.danger', { id: 'clear-multi', title: '清空复式' }, '清空'),
          ]),
        ]),
        h('div.result-list', { id: 'multi-list' }),
      ]),
    ]),
    h('div.result-total', null, [
      h('span.total-label', null, '合计：'),
      h('span.total-detail', { id: 'total-detail' }, '单式 ¥0 + 复式 ¥0'),
      h('span.total-eq', null, '='),
      h('span.total-amount', { id: 'bet-total' }, '¥0'),
    ]),
  ]);

  dock.appendChild(resultPanel);

  // 机选 1：按当前策略追加 1 注（不动当前 reds/blues 草稿）；满 5 替换最旧
  qs('#pick-rand1', dock).addEventListener('click', async () => {
    await addSingleBets(1);
    refreshDock();
  });

  // 机选 5：直接覆盖为 5 注按当前策略新机选
  qs('#pick-rand5', dock).addEventListener('click', async () => {
    state.bets = state.bets.filter((e) => e.type !== 'single');
    await addSingleBets(MAX_SINGLE);
    refreshDock();
  });

  // 策略下拉：切换 state.strategy；非 uniform 时预热 stats（首次切换会触发加载）
  const sel = qs('#pick-strategy', dock);
  if (sel) {
    sel.addEventListener('change', () => {
      state.strategy = sel.value;
      if (state.strategy !== 'uniform') ensureStats();
    });
  }

  // 清空单式
  qs('#clear-single', dock).addEventListener('click', () => {
    state.bets = state.bets.filter((e) => e.type !== 'single');
    refreshDock();
  });

  // 清空复式（同时清掉表格上的草稿选号——避免视觉错位）
  qs('#clear-multi', dock).addEventListener('click', () => {
    state.bets = state.bets.filter((e) => e.type !== 'multi');
    state.reds = new Set();
    state.blues = new Set();
    applyAndRefresh();
  });

  syncCollapsedClass();
  refreshDock();
}

/** 同步折叠态到 dock 根元素的 class（CSS 据此显示/隐藏 result 面板）
 *  桌面端 CSS 用 media query 强制忽略此 class，永远展开 */
function syncCollapsedClass() {
  if (!dockEl) return;
  dockEl.classList.toggle('is-collapsed', state.collapsed);
  const caret = qs('#toggle-caret', dockEl);
  if (caret) caret.textContent = state.collapsed ? '▾' : '▴';
  // 高度变了通知 main.js 重算 trend-scroll padding
  window.dispatchEvent(new CustomEvent('picker:layoutChange'));
}

/** 构建策略下拉（独立小函数：dock 创建时 inline 调用） */
function buildStrategySelect() {
  const sel = h('select.btn-mini.strategy-select', {
    id: 'pick-strategy',
    title: '机选策略：选择不同的加权方式（仅娱乐，无预测意义）',
  });
  for (const s of STRATEGIES) {
    const opt = h('option', { value: s.id, title: s.desc }, s.label);
    if (s.id === state.strategy) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

async function addSingleBets(n) {
  // uniform 不需要 stats；其它策略懒加载（失败/超时退回 uniform）
  let stats = null;
  if (state.strategy !== 'uniform') {
    stats = await ensureStats();
  }
  const picks = randomPickByStrategy(n, state.strategy, stats);
  for (const p of picks) {
    state.bets.push({ type: 'single', red: p.red, blue: p.blue });
  }
  // 单式总数 cap 在 MAX_SINGLE
  // 数组顺序"老→新"，超出时切尾保留最新 MAX_SINGLE 项（淘汰最旧）
  // 渲染时倒序，所以视觉上：新加的在 #1，被淘汰的是 #5（最旧的那条）
  const singles = state.bets.filter((e) => e.type === 'single');
  const others = state.bets.filter((e) => e.type !== 'single');
  if (singles.length > MAX_SINGLE) {
    state.bets = [...others, ...singles.slice(-MAX_SINGLE)];
  }
}

function applyAndRefresh() {
  const tr = document.querySelector('tr.picker-row');
  if (tr) applySelection(tr);
  refreshDock();
}

/**
 * 根据当前 reds/blues 数量判断草稿应该归入哪一栏：
 *   - 双方都为 0 → null（不显示草稿）
 *   - 红 ≤ 6 且 蓝 ≤ 1 → 单式草稿
 *   - 红 ≥ 7 或 蓝 ≥ 2 → 复式草稿
 */
function classifyDraft() {
  const r = state.reds.size;
  const b = state.blues.size;
  if (r === 0 && b === 0) return null;
  if (r <= RED_PICK && b <= BLUE_PICK) return 'single';
  return 'multi';
}

/** 草稿提示文案（缺什么、超什么） */
function draftHint(target) {
  const r = state.reds.size;
  const b = state.blues.size;
  if (target === 'single') {
    const needR = Math.max(0, RED_PICK - r);
    const needB = Math.max(0, BLUE_PICK - b);
    if (needR === 0 && needB === 0) return '✓ 单式';
    const parts = [];
    if (needR > 0) parts.push(`${needR} 红`);
    if (needB > 0) parts.push(`${needB} 蓝`);
    return `还需 ${parts.join(' + ')}`;
  }
  // multi
  if (r < RED_PICK) return `复式至少 ${RED_PICK + 1} 红，还差 ${RED_PICK + 1 - r} 红`;
  if (b < BLUE_PICK) return `还需至少 ${BLUE_PICK} 蓝`;
  // 合法复式
  const cnt = combination(r, RED_PICK) * combination(b, BLUE_PICK);
  return `✓ ${r}+${b} = ${cnt} 注 ¥${cnt * PRICE_PER_BET}`;
}

/** 当前选号是否已构成合法投注（可加注） */
function isDraftValid() {
  const r = state.reds.size;
  const b = state.blues.size;
  return r >= RED_PICK && b >= BLUE_PICK;
}

/** 渲染一条草稿行（浅色 + 自带 [+ 加注] 主动作） */
function renderDraftRow(target) {
  const reds = [...state.reds].sort((a, b) => a - b);
  const blues = [...state.blues].sort((a, b) => a - b);
  const valid = isDraftValid();

  const ballsChildren = [];
  reds.forEach((n) => ballsChildren.push(h('span.mini-ball.red', null, pad2(n))));
  if (reds.length > 0 && blues.length > 0) {
    ballsChildren.push(h('span.sep', null, '|'));
  }
  blues.forEach((n) => ballsChildren.push(h('span.mini-ball.blue', null, pad2(n))));

  // + 加注 按钮：合法时启用，不合法时禁用并加 disabled 类
  const addBtnAttrs = {
    title: valid ? '加入投注' : '选号未完成',
    dataset: { action: 'add' },
  };
  if (!valid) addBtnAttrs.disabled = '';

  return h('div.result-item.draft', { dataset: { kind: target } }, [
    h('span.idx', null, '草稿'),
    h('span.balls', null, ballsChildren),
    h('span.draft-hint', null, draftHint(target)),
    h('button.btn-draft-add', addBtnAttrs, '+ 加注'),
    h('button.del', { 'aria-label': '清除草稿', dataset: { action: 'clear' }, title: '清除当前选号' }, '×'),
  ]);
}

/** 把当前 reds/blues 转一条 entry */
function currentToEntry() {
  const r = state.reds.size;
  const b = state.blues.size;
  if (r < RED_PICK || b < BLUE_PICK) return null;
  const reds = [...state.reds].sort((a, b) => a - b);
  const blues = [...state.blues].sort((a, b) => a - b);
  const isMulti = r > RED_PICK || b > BLUE_PICK;
  if (!isMulti) {
    return { type: 'single', red: reds, blue: blues[0] };
  }
  const count = combination(r, RED_PICK) * combination(b, BLUE_PICK);
  return {
    type: 'multi',
    reds, blues, count,
    cost: count * PRICE_PER_BET,
  };
}

/** 草稿 + 加注按钮的统一处理：把 entry 加入相应栏，并清空当前草稿 */
function commitDraft() {
  const entry = currentToEntry();
  if (!entry) return;
  if (entry.type === 'single') {
    const curSingleCount = state.bets.filter((e) => e.type === 'single').length;
    if (curSingleCount >= MAX_SINGLE) {
      const idx = state.bets.findIndex((e) => e.type === 'single');
      if (idx >= 0) state.bets.splice(idx, 1);
    }
  }
  state.bets.push(entry);
  state.reds = new Set();
  state.blues = new Set();
  applyAndRefresh();
}

function refreshDock() {
  if (!dockEl) return;

  const draftKind = classifyDraft();

  // ── 单式区 ──（草稿条在顶部 → 最新注 → 最老注）
  const singles = state.bets
    .map((e, idx) => ({ e, idx }))
    .filter((x) => x.e.type === 'single');
  const singleListEl = qs('#single-list', dockEl);
  clear(singleListEl);

  // 1) 草稿条永远在最顶部
  if (draftKind === 'single') {
    singleListEl.appendChild(renderDraftRow('single'));
  }

  // 2) 实条目倒序渲染：数组最末（最新加入）显示为 #1，依次顺延
  const singlesReversed = [...singles].reverse();
  singlesReversed.forEach(({ e, idx }, i) => {
    singleListEl.appendChild(h('div.result-item.single', null, [
      h('span.idx', null, `#${i + 1}`),
      h('span.balls', null, [
        ...e.red.map((n) => h('span.mini-ball.red', null, pad2(n))),
        h('span.sep', null, '|'),
        h('span.mini-ball.blue', null, pad2(e.blue)),
      ]),
      h('button.del', { 'aria-label': '删除', dataset: { idx } }, '×'),
    ]));
  });

  if (singles.length === 0 && draftKind !== 'single') {
    singleListEl.appendChild(
      h('div.result-empty', null, '点「机选 1 / 机选 5」或在表格选 ≤ 6 红 ≤ 1 蓝'),
    );
  }
  qs('#single-meta', dockEl).textContent = `${singles.length} / ${MAX_SINGLE}`;

  // ── 复式区 ──（草稿条在顶部 → 最新组 → 最老组）
  const multis = state.bets
    .map((e, idx) => ({ e, idx }))
    .filter((x) => x.e.type === 'multi');
  const multiListEl = qs('#multi-list', dockEl);
  clear(multiListEl);

  // 1) 草稿条永远在最顶部
  if (draftKind === 'multi') {
    multiListEl.appendChild(renderDraftRow('multi'));
  }

  // 2) 实条目倒序渲染：数组最末（最新加入）显示为 #1
  const multisReversed = [...multis].reverse();
  multisReversed.forEach(({ e, idx }, i) => {
    multiListEl.appendChild(h('div.result-item.multi', null, [
      h('span.idx', null, `#${i + 1}`),
      h('span.bet-badge.multi', null,
        `${e.reds.length}+${e.blues.length} · ${e.count}注`),
      h('span.balls', null, [
        ...e.reds.map((n) => h('span.mini-ball.red', null, pad2(n))),
        h('span.sep', null, '|'),
        ...e.blues.map((n) => h('span.mini-ball.blue', null, pad2(n))),
      ]),
      h('button.del', { 'aria-label': '删除', dataset: { idx } }, '×'),
    ]));
  });

  if (multis.length === 0 && draftKind !== 'multi') {
    multiListEl.appendChild(
      h('div.result-empty', null, '在表格上选 ≥ 7 红 或 ≥ 2 蓝 → 草稿条上点「+ 加注」'),
    );
  }
  qs('#multi-meta', dockEl).textContent = `${multis.length} 组`;

  // ── 按钮事件（实条目删除 + 草稿 + 加注 / 清除） ──
  dockEl.querySelectorAll('.result-item').forEach((item) => {
    // 删除已确认条目
    const delBtn = item.querySelector('button.del:not([data-action])');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const idx = Number(delBtn.dataset.idx);
        state.bets.splice(idx, 1);
        refreshDock();
      });
    }

    // 草稿条按钮
    const draftAdd = item.querySelector('button.btn-draft-add');
    if (draftAdd && !draftAdd.disabled) {
      draftAdd.addEventListener('click', commitDraft);
    }
    const draftClear = item.querySelector('button.del[data-action="clear"]');
    if (draftClear) {
      draftClear.addEventListener('click', () => {
        state.reds = new Set();
        state.blues = new Set();
        applyAndRefresh();
      });
    }
  });

  // ── 合计（草稿合法时也计入预览）──
  const singleNotes = singles.length;
  const multiNotes = multis.reduce((s, x) => s + x.e.count, 0);
  const cur = currentToEntry();
  let curSingleNotes = 0;
  let curMultiNotes = 0;
  if (cur) {
    if (cur.type === 'single') curSingleNotes = 1;
    else curMultiNotes = cur.count;
  }
  const singleTotal = (singleNotes + curSingleNotes) * PRICE_PER_BET;
  const multiTotal = (multiNotes + curMultiNotes) * PRICE_PER_BET;
  const grandTotal = singleTotal + multiTotal;

  qs('#total-detail', dockEl).textContent =
    `单式 ¥${singleTotal} + 复式 ¥${multiTotal}`;
  qs('#bet-total', dockEl).textContent = `¥${grandTotal}`;

  // 折叠条上的总注数 + 总金额（移动端折叠态也能看到）
  const totalNotes = singleNotes + curSingleNotes + multiNotes + curMultiNotes;
  const summaryEl = qs('#toggle-summary', dockEl);
  if (summaryEl) summaryEl.textContent = `${totalNotes} 注 · ¥${grandTotal}`;

  // 通知 main.js 同步 dock 高度（CSS 变量）
  window.dispatchEvent(new CustomEvent('picker:layoutChange'));
}
