import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CI ? undefined : 'chrome',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const started = Date.now();
await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('#trend-table tbody tr').first().waitFor();
const startupMs = Date.now() - started;

const navigation = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  return {
    domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
    loadMs: Math.round(nav.loadEventEnd),
    resourceCount: resources.length,
    transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
    decodedBytes: resources.reduce((sum, item) => sum + (item.decodedBodySize || 0), 0),
    defaultRows: document.querySelectorAll('#trend-table tbody tr').length,
    defaultCells: document.querySelectorAll('#trend-table td').length,
  };
});

const select = page.locator('.filter-panel .filter-select');
const total = await select.locator('option').last().getAttribute('value');
const totalRows = Number(total);
const fullStart = Date.now();
await select.selectOption(total);
await page.locator('#trend-table tbody tr').nth(totalRows - 1).waitFor({ timeout: 60_000 });
const fullHistoryMs = Date.now() - fullStart;
const full = await page.evaluate(() => {
  const scroll = document.querySelector('#trend-scroll').getBoundingClientRect();
  const issue = document.querySelector('#trend-table tbody td.col-issue').getBoundingClientRect();
  const head = document.querySelector('#trend-table thead th').getBoundingClientRect();
  return {
    rows: document.querySelectorAll('#trend-table tbody tr').length,
    cells: document.querySelectorAll('#trend-table td').length,
    domNodes: document.getElementsByTagName('*').length,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    issueColumnOffsetPx: Math.abs(issue.left - scroll.left),
    stickyHeaderOffsetPx: Math.abs(head.top - scroll.top),
  };
});

console.log(JSON.stringify({
  url,
  measuredAt: new Date().toISOString(),
  startupMs,
  fullHistoryMs,
  ...navigation,
  ...full,
}, null, 2));

await browser.close();
