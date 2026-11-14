// ── SVG 蓝球中奖号码顺序连线（仿支付宝） ──
//   红球区不画线
//   蓝球区按期号顺序把每期中奖蓝球连成一条折线（zigzag）
import { rafThrottle } from './utils/format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {SVGSVGElement} svg
 * @param {HTMLTableElement} table
 * @param {HTMLElement} scrollEl  滚动容器（坐标系基准）
 */
export function renderOverlay(svg, table, scrollEl) {
  svg.replaceChildren();

  if (!table.tBodies[0] || table.tBodies[0].rows.length < 2) return;

  const tableRect = table.getBoundingClientRect();
  const scrollRect = scrollEl.getBoundingClientRect();
  const issueWidth = table.querySelector('thead th.col-issue')?.getBoundingClientRect().width || 78;
  const offsetX = tableRect.left - scrollRect.left + scrollEl.scrollLeft;
  const offsetY = tableRect.top - scrollRect.top + scrollEl.scrollTop;

  svg.setAttribute('width', String(table.scrollWidth));
  svg.setAttribute('height', String(table.scrollHeight));
  svg.style.left = offsetX + 'px';
  svg.style.top = offsetY + 'px';

  // 按行（期号顺序）收集每期蓝球的中奖坐标
  const bluePts = [];
  const rows = table.tBodies[0].rows;
  for (const row of rows) {
    for (const td of row.cells) {
      if (!td.classList.contains('hit')) continue;
      if (td.dataset.color !== 'blue') continue;
      const r = td.getBoundingClientRect();
      const x = r.left - tableRect.left + r.width / 2;
      const y = r.top - tableRect.top + r.height / 2;
      bluePts.push({ x, y });
      break; // 蓝球每行只有一个中奖
    }
  }

  if (bluePts.length < 2) return;

  // Keep the SVG itself clear of the frozen issue column. The sticky issue cell
  // also masks this area, but browsers can paint sticky table cells differently.
  const clipId = 'trend-blue-line-safe-area';
  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  clipPath.setAttribute('id', clipId);
  const clipRect = document.createElementNS(SVG_NS, 'rect');
  const clipStart = scrollEl.scrollLeft + issueWidth + 1;
  clipRect.setAttribute('x', String(clipStart));
  clipRect.setAttribute('y', '0');
  clipRect.setAttribute('width', String(Math.max(0, table.scrollWidth - clipStart)));
  clipRect.setAttribute('height', String(table.scrollHeight));
  clipPath.appendChild(clipRect);
  svg.appendChild(clipPath);

  // 一条 polyline 连接所有期蓝球
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('class', 'blue');
  line.setAttribute('clip-path', `url(#${clipId})`);
  line.setAttribute('points', bluePts.map((p) => `${p.x},${p.y}`).join(' '));
  svg.appendChild(line);
}

/**
 * 自动跟随表格 resize / scroll 重绘
 * 返回 dispose 函数
 */
export function bindOverlay(svg, table, scrollEl) {
  const draw = () => renderOverlay(svg, table, scrollEl);
  const throttled = rafThrottle(draw);

  const ro = new ResizeObserver(throttled);
  ro.observe(table);
  ro.observe(scrollEl);

  scrollEl.addEventListener('scroll', throttled, { passive: true });
  window.addEventListener('resize', throttled);

  requestAnimationFrame(draw);

  return () => {
    ro.disconnect();
    scrollEl.removeEventListener('scroll', throttled);
    window.removeEventListener('resize', throttled);
  };
}

/**
 * Render a paint-stable sticky header over the native table header.
 * The clone is non-interactive; the semantic header underneath owns input.
 */
export function bindStickyHeader(shell, track, issueCell, table, scrollEl) {
  const source = table.tHead?.rows[0];
  if (!source || source.cells.length === 0) {
    shell.hidden = true;
    return () => {};
  }

  const clone = document.createElement('table');
  clone.className = 'trend-table trend-header-clone';
  const thead = table.tHead.cloneNode(true);
  thead.querySelectorAll('button').forEach((button) => button.setAttribute('tabindex', '-1'));
  // The fixed issue overlay owns this label. Blanking the transformed clone
  // prevents a second "期号" appearing during horizontal drag.
  if (thead.rows[0]?.cells[0]) thead.rows[0].cells[0].textContent = '';
  clone.appendChild(thead);
  track.replaceChildren(clone);
  shell.hidden = false;

  const sync = () => {
    const sourceCells = [...source.cells];
    const cloneCells = [...clone.tHead.rows[0].cells];
    let totalWidth = 0;
    sourceCells.forEach((cell, index) => {
      const width = cell.getBoundingClientRect().width;
      totalWidth += width;
      if (cloneCells[index]) cloneCells[index].style.width = `${width}px`;
    });
    clone.style.width = `${Math.max(totalWidth, table.scrollWidth)}px`;
    issueCell.style.width = `${sourceCells[0]?.getBoundingClientRect().width || 78}px`;
    track.style.transform = `translateX(${-scrollEl.scrollLeft}px)`;

    // Hide the portion of a row crossing the sticky header boundary. Without
    // this, Chromium paints the row's balls below the native sticky header.
    const shellTop = shell.getBoundingClientRect().top;
    const headerBottom = shellTop + source.getBoundingClientRect().height;
    const crossing = [...(table.tBodies[0]?.rows || [])].find((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top < headerBottom && rect.bottom > headerBottom;
    });
    const extension = crossing
      ? Math.max(0, crossing.getBoundingClientRect().bottom - headerBottom)
      : 0;
    shell.style.height = `${source.getBoundingClientRect().height + extension}px`;
  };

  const observer = new ResizeObserver(sync);
  observer.observe(table);
  observer.observe(scrollEl);
  scrollEl.addEventListener('scroll', sync, { passive: true });

  const sourceHead = table.tHead;
  const mirrorFocus = (event) => {
    const sourceButton = event.target.closest?.('button[data-ball]');
    if (!sourceButton) return;
    const selector = `button[data-ball="${sourceButton.dataset.ball}"][data-color="${sourceButton.dataset.color}"]`;
    clone.querySelector(selector)?.classList.toggle('clone-focus', event.type === 'focusin');
  };
  sourceHead.addEventListener('focusin', mirrorFocus);
  sourceHead.addEventListener('focusout', mirrorFocus);
  requestAnimationFrame(sync);

  return () => {
    observer.disconnect();
    scrollEl.removeEventListener('scroll', sync);
    sourceHead.removeEventListener('focusin', mirrorFocus);
    sourceHead.removeEventListener('focusout', mirrorFocus);
  };
}
