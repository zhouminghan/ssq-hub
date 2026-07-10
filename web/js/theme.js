// ── 三态主题下拉：auto / light / dark ──
import { qs } from './utils/dom.js';

// SVG 图标常量（与 index.html theme-item 的 SVG 保持一致）
const SVG_AUTO = '<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke-linecap="round" stroke-linejoin="round"/>';
const SVG_LIGHT = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
const SVG_DARK = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';

function getStoredMode() {
  const t = localStorage.getItem('theme');
  return (t === 'light' || t === 'dark') ? t : null;
}

function getEffectiveTheme() {
  const mode = getStoredMode();
  if (mode) return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeDropdownUI(getStoredMode());
}

function updateTriggerDisplay(mode) {
  const trigger = qs('#theme-trigger');
  const icon = qs('#theme-icon');
  const label = qs('#theme-label');
  if (!trigger || !icon || !label) return;

  if (mode === null) {
    icon.innerHTML = SVG_AUTO;
    label.textContent = '跟随系统';
  } else if (mode === 'light') {
    icon.innerHTML = SVG_LIGHT;
    label.textContent = '浅色';
  } else {
    icon.innerHTML = SVG_DARK;
    label.textContent = '深色';
  }
}

function syncThemeDropdownUI(mode) {
  updateTriggerDisplay(mode);
  const menu = qs('#theme-menu');
  if (!menu) return;
  menu.querySelectorAll('.theme-item').forEach(item => {
    const bt = item.dataset.theme;
    const active =
      (bt === 'auto' && mode === null) ||
      (bt === 'light' && mode === 'light') ||
      (bt === 'dark' && mode === 'dark');
    item.classList.toggle('active', active);
  });
}

export function initTheme() {
  const dropdown = qs('#theme-dropdown');
  const trigger = qs('#theme-trigger');
  const menu = qs('#theme-menu');
  if (!dropdown || !trigger || !menu) return;

  applyTheme(getEffectiveTheme());

  trigger.addEventListener('click', () => {
    const isOpen = dropdown.classList.toggle('open');
    menu.hidden = !isOpen;
  });

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-item');
    if (!btn) return;
    const chosen = btn.dataset.theme;
    if (chosen === 'auto') localStorage.removeItem('theme');
    else localStorage.setItem('theme', chosen);
    applyTheme(getEffectiveTheme());
    dropdown.classList.remove('open');
    menu.hidden = true;
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      menu.hidden = true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      dropdown.classList.remove('open');
      menu.hidden = true;
      trigger.focus();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}
