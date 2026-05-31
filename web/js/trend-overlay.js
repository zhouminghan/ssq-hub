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
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  if (!table.tBodies[0] || table.tBodies[0].rows.length < 2) return;

  const tableRect = table.getBoundingClientRect();
  const scrollRect = scrollEl.getBoundingClientRect();
  const offsetX = tableRect.left - scrollRect.left + scrollEl.scrollLeft;
  const offsetY = tableRect.top - scrollRect.top + scrollEl.scrollTop;

  svg.setAttribute('width', table.scrollWidth);
  svg.setAttribute('height', table.scrollHeight);
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

  // 一条 polyline 连接所有期蓝球
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('class', 'blue');
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
