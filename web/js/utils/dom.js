// ── DOM 工具 ──
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * 极简 hyperscript：h('div.cls#id', {attr}, [children])
 * - tag 支持 'tag.cls.cls#id' 简写
 * - children 可以是字符串、数字、Node、数组、null/false（跳过）
 */
export function h(tag, attrs, children) {
  let el;
  let id = '';
  const classes = [];
  const tagPart = tag.replace(/[#.][^#.]+/g, (m) => {
    if (m[0] === '#') id = m.slice(1);
    else classes.push(m.slice(1));
    return '';
  });
  el = document.createElement(tagPart || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');

  // 判断第二参 attrs 是否为"真正的 attrs 对象"
  // 真正的 attrs：plain object 且不是 Node / 数组 / 字符串 / 数字
  const isAttrs =
    attrs != null &&
    typeof attrs === 'object' &&
    !Array.isArray(attrs) &&
    !(attrs instanceof Node);

  if (isAttrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') {
        el.className = (el.className ? el.className + ' ' : '') + v;
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'dataset' && typeof v === 'object') {
        Object.assign(el.dataset, v);
      } else if (k === 'hidden') {
        // hidden 是 boolean 属性，true 才设置
        if (v) el.setAttribute('hidden', '');
      } else {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
  } else if (children === undefined) {
    // 仅当第三参未传时，才把第二参当作 children
    // （否则 attrs=null + children='文本' 的常见调用会被错误覆盖）
    children = attrs;
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(el, c) {
  if (c == null || c === false || c === true) return;
  if (Array.isArray(c)) { c.forEach((x) => appendChildren(el, x)); return; }
  if (c instanceof Node) { el.appendChild(c); return; }
  el.appendChild(document.createTextNode(String(c)));
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export function on(el, event, handler, opts) {
  el.addEventListener(event, handler, opts);
  return () => el.removeEventListener(event, handler, opts);
}
