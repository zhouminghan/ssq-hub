// ── 三态主题：auto / light / dark，首次绘制前已由内联脚本应用 ──
import { qs } from './utils/dom.js';

const SVG_AUTO = [
  '<rect x="3" y="4" width="18" height="13" rx="2"/>',
  '<path d="M8 21h8M12 17v4"/>',
].join('');
const SVG_LIGHT = [
  '<circle cx="12" cy="12" r="4"/>',
  '<path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.42 1.42M2 12h2M20 12h2M6.35 17.66l-1.42 1.42M19.07 4.93l-1.42 1.42"/>',
].join('');
const SVG_DARK = '<path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z"/>';

let initialized = false;
let mediaQuery = null;

function storedMode() {
  try {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function effectiveTheme() {
  return storedMode() || (mediaQuery.matches ? 'dark' : 'light');
}

function syncUI(mode) {
  const trigger = qs('#theme-trigger');
  const icon = qs('#theme-icon');
  const label = qs('#theme-label');
  if (!trigger || !icon || !label) return;

  if (mode === 'light') {
    icon.innerHTML = SVG_LIGHT;
    label.textContent = '浅色';
  } else if (mode === 'dark') {
    icon.innerHTML = SVG_DARK;
    label.textContent = '深色';
  } else {
    icon.innerHTML = SVG_AUTO;
    label.textContent = '跟随系统';
  }

  const selected = mode || 'auto';
  trigger.setAttribute('aria-label', `主题：${label.textContent}，点击选择`);
  qs('#theme-menu')?.querySelectorAll('.theme-item').forEach((item) => {
    const active = item.dataset.theme === selected;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
  });
}

function applyTheme() {
  const mode = storedMode();
  const theme = effectiveTheme();
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme-mode', mode || 'auto');
  syncUI(mode);
}

function closeMenu() {
  const dropdown = qs('#theme-dropdown');
  const trigger = qs('#theme-trigger');
  const menu = qs('#theme-menu');
  if (!dropdown || !trigger || !menu) return;
  dropdown.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
}

export function initTheme() {
  if (initialized) return;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const dropdown = qs('#theme-dropdown');
  const trigger = qs('#theme-trigger');
  const menu = qs('#theme-menu');
  if (!dropdown || !trigger || !menu) return;

  applyTheme();

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = !menu.hidden;
    menu.hidden = open;
    trigger.setAttribute('aria-expanded', String(!open));
    dropdown.classList.toggle('open', !open);
    if (!open) {
      requestAnimationFrame(() => menu.querySelector('.theme-item.active')?.focus());
    }
  });

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.theme-item');
    if (!item) return;
    try {
      if (item.dataset.theme === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', item.dataset.theme);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    applyTheme();
    closeMenu();
    trigger.focus();
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    closeMenu();
    trigger.focus();
  });

  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('.theme-item')];
    const current = items.indexOf(document.activeElement);
    let next = current;
    if (event.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    items[next].focus();
  });

  const onSystemChange = () => {
    if (!storedMode()) applyTheme();
  };
  if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onSystemChange);
  else mediaQuery.addListener(onSystemChange);

  initialized = true;
}
