// ── 研究笔记：加载 Markdown，并以站内文章形式呈现 ──
import { h, qs } from './utils/dom.js';

const NOTES_BASE = new URL('../content/notes/', import.meta.url);
const NOTES_VERSION = '2026111515';

let initialized = false;
let loadToken = 0;
let katexPromise = null;

function inlineNodes(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      fragment.appendChild(h('strong', null, token.slice(2, -2)));
    } else if (token.startsWith('`')) {
      fragment.appendChild(h('code', null, token.slice(1, -1)));
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = linkMatch?.[2] || '#';
      const attrs = { href };
      if (/^https?:/.test(href)) {
        attrs.target = '_blank';
        attrs.rel = 'noopener noreferrer';
      }
      fragment.appendChild(h('a', attrs, linkMatch?.[1] || token));
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
  return fragment;
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function fractionNode(numerator, denominator) {
  return h('span.fraction', {
    role: 'math',
    'aria-label': `${numerator} / ${denominator}`,
  }, [
    h('span.fraction-num', { 'aria-hidden': 'true' }, numerator),
    h('span.fraction-den', { 'aria-hidden': 'true' }, denominator),
  ]);
}

function tableCellNodes(text) {
  const fraction = text.match(/^(\d[\d,]*)\s*\/\s*(\d[\d,]*)$/);
  if (fraction) return fractionNode(fraction[1], fraction[2]);
  return inlineNodes(text);
}

function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(line) {
  const value = line.trim();
  return !value
    || value.startsWith('#')
    || value.startsWith('>')
    || value.startsWith('|')
    || /^[-*]\s+/.test(value)
    || /^\d+\.\s+/.test(value)
    || /^---+$/.test(value);
}

function tableNode(header, rows) {
  const table = h('table.note-table');
  table.appendChild(h('thead', null, [
    h('tr', null, header.map((cell) => h('th', { scope: 'col' }, inlineNodes(cell)))),
  ]));
  const body = h('tbody');
  rows.forEach((row) => {
    body.appendChild(h('tr', null, row.map((cell) => h('td', null, tableCellNodes(cell)))));
  });
  table.appendChild(body);
  return h('div.note-table-wrap', {
    tabindex: '0',
    role: 'region',
    'aria-label': '概率数据表，可横向滚动',
  }, table);
}

function probabilityChart() {
  /** @type {Array<[string, number, string]>} */
  const rows = [
    ['一等奖', 17_721_088, 'red'],
    ['二等奖', 1_181_406, 'red'],
    ['三等奖', 109_389, 'blue'],
    ['四等奖', 2_303, 'blue'],
    ['五等奖', 129, 'gold'],
    ['六等奖', 17, 'muted'],
  ];
  const maxLog = Math.log10(rows[0][1]);
  const chart = h('div.prize-chart');
  rows.forEach(([label, oneIn, tone]) => {
    const width = Math.max(7, (Math.log10(oneIn) / maxLog) * 100);
    chart.appendChild(h('div.prize-row', null, [
      h('span.prize-label', null, label),
      h('div.prize-track', null, [
        h(`span.prize-fill.${tone}`, { style: { width: `${width}%` } }),
      ]),
      h('span.prize-value', null, fractionNode('1', String(oneIn))),
    ]));
  });
  return h('figure.note-chart', {
    'aria-label': '各奖级理论中奖概率，使用对数长度比较，一等奖约一千七百七十二万分之一',
  }, [
    h('figcaption', null, [
      h('strong', null, '各奖级理论概率'),
      h('span', null, '条形长度使用对数刻度；金额概率仍以右侧真实数值为准'),
    ]),
    chart,
  ]);
}

function expectationChart() {
  return h('figure.note-chart', {
    'aria-label': '每注两元的近似期望拆分：约一元形成期望奖金，约一元对应非奖金部分，期望净结果约为负一元',
  }, [
    h('figcaption', null, [
      h('strong', null, '每注 2 元的近似期望'),
      h('span', null, '按约 50% 理论返奖率做宏观拆分，不代表某一期结果'),
    ]),
    h('div.expectation-chart', null, [
      h('div.expectation-total', null, [
        h('span', null, '单注价格'),
        h('strong', null, '2.00 元'),
      ]),
      h('div.expectation-bar', { 'aria-hidden': 'true' }, [
        h('span.expectation-prize', { style: { width: '50%' } }),
        h('span.expectation-other', { style: { width: '50%' } }),
      ]),
      h('div.expectation-legend', null, [
        h('div', null, [
          h('i.expectation-dot.prize'),
          h('span', null, '约 1.00 元'),
          h('small', null, '长期平均期望奖金'),
        ]),
        h('div', null, [
          h('i.expectation-dot.other'),
          h('span', null, '约 1.00 元'),
          h('small', null, '非奖金部分及波动成本'),
        ]),
      ]),
      h('p.expectation-result', null, [
        h('span', null, '近似期望净结果'),
        h('strong', null, '-1.00 元 / 注'),
      ]),
    ]),
  ]);
}

function combinationTreeChart() {
  return h('figure.note-chart', {
    'aria-label': '组合树：33 个红球选 6 个有 1107568 种，16 个蓝球选 1 个有 16 种，相乘得到 17721088 种完整号码',
  }, [
    h('figcaption', null, [
      h('strong', null, '红球组合与蓝球选择相乘'),
      h('span', null, '每一注都由一个红球组合和一个蓝球共同确定'),
    ]),
    h('div.combination-flow', null, [
      h('div.combination-node.red', null, [
        h('span', null, '红球组合'),
        h('strong', null, 'C(33, 6)'),
        h('code', null, '1,107,568'),
      ]),
      h('span.combination-operator', { 'aria-hidden': 'true' }, '×'),
      h('div.combination-node.blue', null, [
        h('span', null, '蓝球选择'),
        h('strong', null, 'C(16, 1)'),
        h('code', null, '16'),
      ]),
      h('span.combination-operator', { 'aria-hidden': 'true' }, '='),
      h('div.combination-node.result', null, [
        h('span', null, '完整号码'),
        h('strong', null, '17,721,088'),
        h('code', null, '种组合'),
      ]),
    ]),
  ]);
}

function chartNode(name) {
  if (name === 'combination-tree') return combinationTreeChart();
  if (name === 'prize-probability') return probabilityChart();
  if (name === 'expectation') return expectationChart();
  return h('div.notes-error', null, `未知图表：${name}`);
}

function mathBlock(expression, mathEngine) {
  const wrapper = h('div.math-display', {
    role: 'math',
    tabindex: '0',
    'aria-label': expression,
  });
  if (!mathEngine) {
    wrapper.appendChild(h('pre', null, expression));
    return wrapper;
  }
  try {
    wrapper.innerHTML = mathEngine.renderToString(expression, {
      displayMode: true,
      output: 'mathml',
      throwOnError: false,
      strict: 'ignore',
    });
  } catch {
    wrapper.replaceChildren(h('code', null, expression));
  }
  return wrapper;
}

export function renderMarkdown(source, mathEngine = null) {
  const lines = String(source).replaceAll('\r\n', '\n').split('\n');
  const content = h('div.note-body');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const value = line.trim();
    if (!value) {
      index += 1;
      continue;
    }

    if (value === '$$') {
      const expression = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '$$') {
        expression.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      content.appendChild(mathBlock(expression.join('\n').trim(), mathEngine));
      continue;
    }

    const chart = value.match(/^:::chart\s+([a-z-]+)$/);
    if (chart) {
      index += 1;
      while (index < lines.length && lines[index].trim() !== ':::') index += 1;
      if (index < lines.length) index += 1;
      content.appendChild(chartNode(chart[1]));
      continue;
    }

    const heading = value.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length === 1 ? 2 : Math.min(4, heading[1].length);
      content.appendChild(h(`h${level}`, null, inlineNodes(heading[2])));
      index += 1;
      continue;
    }

    if (value.startsWith('>')) {
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      content.appendChild(h('blockquote', null, inlineNodes(quote.join(' '))));
      continue;
    }

    if (value.startsWith('|') && isTableDivider(lines[index + 1] || '')) {
      const header = splitTableRow(value);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      content.appendChild(tableNode(header, rows));
      continue;
    }

    if (/^[-*]\s+/.test(value)) {
      const list = h('ul');
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        list.appendChild(h('li', null, inlineNodes(lines[index].trim().replace(/^[-*]\s+/, ''))));
        index += 1;
      }
      content.appendChild(list);
      continue;
    }

    if (/^\d+\.\s+/.test(value)) {
      const list = h('ol');
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        list.appendChild(h('li', null, inlineNodes(lines[index].trim().replace(/^\d+\.\s+/, ''))));
        index += 1;
      }
      content.appendChild(list);
      continue;
    }

    if (/^---+$/.test(value)) {
      content.appendChild(h('hr'));
      index += 1;
      continue;
    }

    const paragraph = [value];
    index += 1;
    while (index < lines.length && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    content.appendChild(h('p', null, inlineNodes(paragraph.join(' '))));
  }

  return content;
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function articleNode(meta, markdown, mathEngine) {
  return h(`article.note-paper.tone-${meta.tone || 'red'}`, null, [
    h('header.note-article-head', null, [
      h('span.note-kicker', null, meta.category),
      h('h2', null, meta.title),
      h('p.note-summary', null, meta.summary),
      h('div.note-meta', null, [
        h('span', null, meta.level),
        h('span', null, `约 ${meta.minutes} 分钟`),
        h('span', null, '由原笔记拆分整理'),
      ]),
    ]),
    renderMarkdown(markdown, mathEngine),
  ]);
}

async function loadMathEngine() {
  if (!katexPromise) {
    const katexUrl = new URL(
      '../assets/vendor/katex/katex.mjs?v=2026111515',
      import.meta.url,
    ).href;
    katexPromise = import(katexUrl)
      .then((module) => module.default || module)
      .catch((error) => {
        console.error('KaTeX failed to load:', error);
        return null;
      });
  }
  return katexPromise;
}

export async function mountNotes() {
  if (initialized) return;
  const root = qs('#notes-root');
  if (!root) return;

  try {
    const manifest = await loadJson(new URL(`index.json?v=${NOTES_VERSION}`, NOTES_BASE));
    const notes = Array.isArray(manifest.notes) ? manifest.notes : [];
    if (notes.length === 0) throw new Error('笔记目录为空');

    const list = h('div.notes-list', { role: 'navigation', 'aria-label': '研究笔记列表' });
    const articleScroll = h('div.notes-article-scroll', {
      role: 'region',
      'aria-label': '研究笔记正文',
    });
    const status = h('span.sr-only', { role: 'status', 'aria-live': 'polite' });
    articleScroll.appendChild(status);
    const buttons = new Map();
    let activeId = '';
    const requestedId = new URLSearchParams(location.search).get('note');

    const setActive = (id) => {
      activeId = id;
      buttons.forEach((button, noteId) => {
        const active = noteId === id;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    };

    const openNote = async (note) => {
      setActive(note.id);
      const token = ++loadToken;
      articleScroll.replaceChildren(
        h('div.notes-loading', null, [
          h('span.spinner', { 'aria-hidden': 'true' }),
          '正在打开笔记',
        ]),
      );
      try {
        const [markdown, mathEngine] = await Promise.all([
          loadText(new URL(`${note.file}?v=${NOTES_VERSION}`, NOTES_BASE)),
          loadMathEngine(),
        ]);
        if (token !== loadToken || activeId !== note.id) return;
        const article = articleNode(note, markdown, mathEngine);
        articleScroll.replaceChildren(status, article);
        status.textContent = `已打开 ${note.title}`;
        const noteUrl = new URL(location.href);
        noteUrl.searchParams.set('view', 'notes');
        noteUrl.searchParams.set('note', note.id);
        history.replaceState({ view: 'notes', note: note.id }, '', noteUrl);
        root.scrollTop = 0;
        articleScroll.scrollTop = 0;
        const heading = article.querySelector('h2');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      } catch (error) {
        if (token !== loadToken) return;
        articleScroll.replaceChildren(
          h('div.notes-error', null, `笔记加载失败：${error.message || error}`),
        );
      }
    };

    notes.forEach((note, noteIndex) => {
      const button = h(`button.note-selector.tone-${note.tone || 'red'}`, {
        type: 'button',
        onclick: () => openNote(note),
      }, [
        h('span.note-cover', { 'aria-hidden': 'true' }, [
          h('span.note-cover-index', null, String(noteIndex + 1).padStart(2, '0')),
          h('strong.note-cover-formula', null, note.cover),
        ]),
        h('span.note-selector-body', null, [
          h('span.note-selector-title', null, note.title),
          h('span.note-selector-summary', null, note.summary),
          h('span.note-selector-meta', null, `${note.category} · ${note.minutes} 分钟 · 阅读`),
        ]),
      ]);
      buttons.set(note.id, button);
      list.appendChild(button);
    });

    const sidebar = h('aside.notes-sidebar', null, [
      h('div.notes-sidebar-head', null, [
        h('h3', null, '概率与理性'),
        h('p', null, '原始长笔记拆分为 3 篇独立阅读稿'),
      ]),
      list,
    ]);
    root.replaceChildren(sidebar, articleScroll);
    initialized = true;
    await openNote(notes.find((note) => note.id === requestedId) || notes[0]);
  } catch (error) {
    root.replaceChildren(
      h('div.notes-error', null, `研究笔记加载失败：${error.message || error}`),
    );
  }
}
